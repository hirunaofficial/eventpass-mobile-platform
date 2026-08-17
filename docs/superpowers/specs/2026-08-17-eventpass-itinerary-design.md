# EventPass- Itinerary & Clash-Detection Constraint Algorithm- Design Spec

**Date:** 2026-08-17
**Builds on:** `docs/superpowers/specs/2026-08-15-eventpass-design.md` (§6 Constraint Algorithm- this spec finalizes it into a real, tested implementation), `docs/superpowers/specs/2026-08-16-eventpass-auth-db-design.md` (auth, Prisma schema, `apiFetch`/`useAuth` this builds on).

## 1. Scope

Implements the assignment's required "constraint design algorithm": a clash-detection check that prevents a user from adding two events to their itinerary that overlap in time, or that don't leave enough travel time between venues. Covers the algorithm itself (pure, unit-testable), the server API to persist itinerary items with the same check enforced server-side, and the app UI to add/remove/view itinerary items.

Out of scope: the hand-built `<ItineraryTimeline>` custom component (visualizing the itinerary- a later phase per the master spec §8), live GPS-based travel estimation (this phase uses static venue coordinates already in the DB), offline queueing of itinerary changes (later phase per master spec §9).

## 2. The Constraint Algorithm

**Model** (per master spec §6):
- Variables: each of the user's itinerary items (existing + the candidate being added).
- Domain: `{included, excluded}`.
- Constraints:
  1. No two included items overlap in time.
  2. If items are at different venues, the gap between one item's end and the next item's start must be ≥ the travel time between those venues, estimated via haversine distance between venue lat/lng ÷ an assumed average travel speed.

**Implementation**- `packages/shared/src/clash.ts` (pure function, no I/O, importable by both `app` and `server` so the exact same logic runs client-side for instant feedback and server-side as the source of truth):

```typescript
export interface ClashCheckEvent {
  id: string;
  startsAt: string;
  endsAt: string;
  venue: { lat: number; lng: number };
}

export type ClashReason =
  | { type: "time_overlap"; withEventId: string }
  | { type: "insufficient_travel_time"; withEventId: string; neededMinutes: number; availableMinutes: number };

const AVERAGE_TRAVEL_SPEED_KMH = 30;

function haversineDistanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function travelMinutesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const km = haversineDistanceKm(a, b);
  return (km / AVERAGE_TRAVEL_SPEED_KMH) * 60;
}

export function findClash(
  candidate: ClashCheckEvent,
  existingItems: ClashCheckEvent[]
): ClashReason | null {
  const candidateStart = new Date(candidate.startsAt).getTime();
  const candidateEnd = new Date(candidate.endsAt).getTime();

  for (const item of existingItems) {
    const itemStart = new Date(item.startsAt).getTime();
    const itemEnd = new Date(item.endsAt).getTime();

    const overlaps = candidateStart < itemEnd && itemStart < candidateEnd;
    if (overlaps) {
      return { type: "time_overlap", withEventId: item.id };
    }

    const [earlier, later] =
      itemEnd <= candidateStart ? [item, candidate] : [candidate, item];
    const gapMinutes =
      (new Date(later.startsAt).getTime() - new Date(earlier.endsAt).getTime()) / 60000;
    const neededMinutes = travelMinutesBetween(earlier.venue, later.venue);

    if (gapMinutes < neededMinutes) {
      return {
        type: "insufficient_travel_time",
        withEventId: item.id,
        neededMinutes: Math.round(neededMinutes),
        availableMinutes: Math.round(gapMinutes),
      };
    }
  }

  return null;
}
```

This is the exact function to be simplified and live-coded in the viva's coding defense, per the master spec §6.

## 3. Server API

New routes under `server/src/routes/itinerary.ts`, mounted at `/itinerary`, all `requireAuth`:

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/itinerary` |- | `ItineraryItem[]` with `event` (incl. `venue`) included |
| POST | `/itinerary` | `{ eventId }` | `201` + created item, or `409` with the `ClashReason` if `findClash` rejects it |
| DELETE | `/itinerary/:eventId` |- | `204` |

`POST /itinerary` loads the user's existing itinerary items (with their events' venues), loads the candidate event, runs `findClash`, and only creates the `ItineraryItem` row if the result is `null`. This makes the server the authoritative check- the app's own `findClash` call is optimistic UX, not the real guarantee (same pattern as capacity checks in the master spec).

## 4. App

- `app/src/lib/use-itinerary.ts`- hook: `{ items, isLoading, error, addToItinerary(event), removeFromItinerary(eventId), refresh }`. `addToItinerary` runs `findClash` locally first against the currently-loaded itinerary items; if it returns a reason, throws a typed error the caller can catch and show in the confirmation dialog instead of calling the API. If clear, calls `POST /itinerary`; if the server itself returns 409 (a race- e.g., itinerary changed on another device), surfaces that as an error too rather than silently succeeding.
- Discover screen's `EventCard` gets an "Add" button. Tapping it either adds directly (no clash) or opens an `AlertDialog` explaining the specific clash reason (`"This overlaps with <event title>"` or `"Only Xmin between venues, need Ymin"`) with Cancel/nothing-else (a real clash is a hard block per master spec §6, not an override- matches "Hard clash prevention" already decided).
- New screen `app/src/app/itinerary.tsx`- lists saved itinerary items (reusing `EventCard`-style presentation), each with a "Remove" button calling `removeFromItinerary`.
- Root layout: no change to auth gating; itinerary screen requires being authenticated already (covered by the existing `AuthGate`).

## 5. File Structure (additions)

```
packages/shared/
  src/
    clash.ts                 # findClash()- pure, tested, imported by both app and server
server/
  src/
    routes/
      itinerary.ts
app/
  src/
    lib/
      use-itinerary.ts
    app/
      itinerary.tsx
```

## 6. Testing

`packages/shared` gets its first real test suite: `packages/shared/src/clash.test.ts` (using Node's built-in `node:test` + `node:assert`- no new test-runner dependency needed) covering: no clash for non-overlapping same-day events with enough travel gap, time-overlap detection, insufficient-travel-time detection between distant venues, and the boundary case of back-to-back events at the same venue (zero travel time needed, should not clash).

## 7. Out of Scope (this phase)

- `<ItineraryTimeline>` custom component (visual timeline with clash highlighting)- later phase.
- Live GPS for travel estimation- this phase uses static venue coordinates.
- Offline queueing of itinerary add/remove actions- later phase.
- Ticket purchase- separate, later flow (itinerary ≠ tickets per the data model; a user can plan to attend without a ticket yet).
