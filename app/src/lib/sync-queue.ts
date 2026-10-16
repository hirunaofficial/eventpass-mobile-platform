import { getDb } from "@/lib/db";
import { ApiError, apiFetch } from "@/lib/api";

export type SyncAction = "add_itinerary" | "remove_itinerary" | "buy_ticket";

/** `paymentRef` is only present for buy_ticket, hence optional. */
export interface SyncActionPayload {
  eventId: string;
  paymentRef?: string;
}

export interface SyncQueueEntry {
  id: string;
  action: SyncAction;
  payload: SyncActionPayload;
  status: "pending" | "synced" | "conflict";
  createdAt: number;
}

export async function enqueueSyncAction(
  action: SyncAction,
  payload: SyncActionPayload
): Promise<void> {
  const db = await getDb();
  const id = `${action}-${payload.eventId}-${Date.now()}`;
  await db.runAsync(
    "INSERT INTO sync_queue (id, action, payload, status, created_at) VALUES (?, ?, ?, 'pending', ?)",
    id,
    action,
    JSON.stringify(payload),
    Date.now()
  );
}

export async function getPendingSyncCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM sync_queue WHERE status = 'pending'"
  );
  return row?.count ?? 0;
}

function endpointFor(action: SyncAction): { path: string; method: "POST" | "DELETE" } {
  switch (action) {
    case "add_itinerary":
      return { path: "/itinerary", method: "POST" };
    case "remove_itinerary":
      return { path: "/itinerary", method: "DELETE" };
    case "buy_ticket":
      return { path: "/tickets", method: "POST" };
  }
}

let inFlightDrain: Promise<{ synced: number; conflicts: number }> | null = null;

/**
 * Replays queued offline actions against the server in the order they were
 * made, once connectivity returns. Each entry is marked 'synced' (removed)
 * on success or 'conflict' (kept, for the caller to surface) on a real
 * rejection from the server- e.g. an event sold out or was double-added
 * while offline. Never silently drops a queued action.
 *
 * Multiple hooks (`use-itinerary`, `use-tickets`) each listen for
 * reconnect independently, so this can be called concurrently from more
 * than one place on the same reconnect event. Without deduping, two
 * concurrent drains would both read the same "pending" rows and both
 * replay them- e.g. buying the same ticket twice. The in-flight guard
 * below makes every concurrent caller share one real drain.
 */
export async function drainSyncQueue(token: string | null): Promise<{ synced: number; conflicts: number }> {
  if (!token) return { synced: 0, conflicts: 0 };
  if (inFlightDrain) return inFlightDrain;

  inFlightDrain = (async () => {
    try {
      const db = await getDb();
      const rows = await db.getAllAsync<{
        id: string;
        action: SyncAction;
        payload: string;
      }>("SELECT id, action, payload FROM sync_queue WHERE status = 'pending' ORDER BY created_at ASC");

      let synced = 0;
      let conflicts = 0;

      for (const row of rows) {
        const payload = JSON.parse(row.payload) as { eventId: string };
        const { path, method } = endpointFor(row.action);

        try {
          if (method === "DELETE") {
            await apiFetch(`${path}/${payload.eventId}`, { method: "DELETE", token });
          } else {
            await apiFetch(path, { method: "POST", token, body: JSON.stringify(payload) });
          }
          await db.runAsync("DELETE FROM sync_queue WHERE id = ?", row.id);
          synced++;
        } catch (e) {
          if (e instanceof ApiError) {
            // A real rejection from a reachable server (e.g. sold out,
            // already removed)- genuinely needs the user's attention.
            await db.runAsync("UPDATE sync_queue SET status = 'conflict' WHERE id = ?", row.id);
            conflicts++;
          } else {
            // Network dropped again mid-drain. Leave this (and every
            // row after it) 'pending' rather than mislabeling a
            // transient failure as a permanent conflict- stop here so
            // the next reconnect retries them in the original order
            // instead of skipping ahead.
            break;
          }
        }
      }

      return { synced, conflicts };
    } finally {
      inFlightDrain = null;
    }
  })();

  return inFlightDrain;
}

export async function getConflictCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM sync_queue WHERE status = 'conflict'"
  );
  return row?.count ?? 0;
}

export async function clearConflicts(): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM sync_queue WHERE status = 'conflict'");
}
