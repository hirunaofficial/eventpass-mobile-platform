import type { EventWithVenue, TicketWithEvent } from "@eventpass/shared";
import { getDb } from "@/lib/db";
import type { ItineraryItemWithEvent } from "@/lib/use-itinerary";

export async function cacheEvents(events: EventWithVenue[]): Promise<void> {
  const db = await getDb();
  const now = Date.now();
  await db.withTransactionAsync(async () => {
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
  await db.withTransactionAsync(async () => {
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
  await db.withTransactionAsync(async () => {
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
