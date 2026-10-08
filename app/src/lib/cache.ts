/**
 * Offline read cache. Each table holds the last successfully-fetched
 * server response as JSON blobs - deliberately not normalised into
 * columns, because the cache's only job is "show what we last knew",
 * not to be queried relationally.
 *
 * Every writer goes through runInTransaction() rather than calling
 * db.withTransactionAsync directly: the three data hooks mount at the
 * same time and share one SQLite connection, which allows only one
 * transaction at a time. See db.ts for the full story.
 */
import type { EventWithVenue, TicketWithEvent } from "@eventpass/shared";
import { getDb, runInTransaction } from "@/lib/db";
import type { ItineraryItemWithEvent } from "@/lib/use-itinerary";

// Replace-all rather than upsert: the server response IS the truth, so
// a delete + insert inside one transaction keeps the cache exactly in
// step and removes anything deleted server-side.
export async function cacheEvents(events: EventWithVenue[]): Promise<void> {
  const db = await getDb();
  const now = Date.now();
  await runInTransaction(async () => {
    await db.runAsync("DELETE FROM events_cache");
    for (const event of events) {
      await db.runAsync(
        "INSERT INTO events_cache (id, data, updated_at) VALUES (?, ?, ?)",
        event.id,
        JSON.stringify(event),
        now
      );
    }
  });
}

/** Read path used when the network fetch fails. */
export async function getCachedEvents(): Promise<EventWithVenue[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ data: string }>(
    "SELECT data FROM events_cache ORDER BY updated_at DESC"
  );
  return rows.map((row) => JSON.parse(row.data) as EventWithVenue);
}

export async function cacheItinerary(items: ItineraryItemWithEvent[]): Promise<void> {
  const db = await getDb();
  const now = Date.now();
  await runInTransaction(async () => {
    await db.runAsync("DELETE FROM itinerary_cache");
    for (const item of items) {
      await db.runAsync(
        "INSERT INTO itinerary_cache (id, event_id, data, updated_at) VALUES (?, ?, ?, ?)",
        item.id,
        item.eventId,
        JSON.stringify(item),
        now
      );
    }
  });
}

export async function getCachedItinerary(): Promise<ItineraryItemWithEvent[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ data: string }>(
    "SELECT data FROM itinerary_cache ORDER BY updated_at DESC"
  );
  return rows.map((row) => JSON.parse(row.data) as ItineraryItemWithEvent);
}

export async function cacheTickets(tickets: TicketWithEvent[]): Promise<void> {
  const db = await getDb();
  const now = Date.now();
  await runInTransaction(async () => {
    await db.runAsync("DELETE FROM tickets_cache");
    for (const ticket of tickets) {
      await db.runAsync(
        "INSERT INTO tickets_cache (id, data, updated_at) VALUES (?, ?, ?)",
        ticket.id,
        JSON.stringify(ticket),
        now
      );
    }
  });
}

export async function getCachedTickets(): Promise<TicketWithEvent[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ data: string }>(
    "SELECT data FROM tickets_cache ORDER BY updated_at DESC"
  );
  return rows.map((row) => JSON.parse(row.data) as TicketWithEvent);
}
