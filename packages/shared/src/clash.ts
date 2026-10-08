export interface ClashCheckEvent {
  id: string;
  startsAt: string;
  endsAt: string;
  venue: { lat: number; lng: number };
}

export type ClashReason =
  | { type: "time_overlap"; withEventId: string }
  | {
      type: "insufficient_travel_time";
      withEventId: string;
      neededMinutes: number;
      availableMinutes: number;
    };

const AVERAGE_TRAVEL_SPEED_KMH = 30;

export function haversineDistanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
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

function travelMinutesBetween(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
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

/* ===================================================================
   CONFLICT RESOLUTION
   -------------------------------------------------------------------
   `findClash` answers "is this addition legal?". That is only half a
   constraint system: rejecting a user's choice with no way forward is
   a dead end. These functions answer "given that it isn't legal, what
   CAN you do?" - the repair half of the algorithm.

   Framed in CSP terms: the itinerary is a partial assignment, each
   event is a variable, and the constraints are (1) no time overlap and
   (2) enough travel time between venues. When adding a candidate makes
   the assignment inconsistent we offer two kinds of repair:

     - SWAP       a minimal repair: drop exactly one already-assigned
                  item so the candidate becomes consistent. Verified by
                  re-running the full constraint check on the reduced
                  set, because dropping the directly-overlapping item
                  can still leave a travel-time violation with another.

     - ALTERNATIVE  a different value from the domain: another event
                  that is consistent with the itinerary as it already
                  stands, so nothing has to be given up at all.

   Both are pure and I/O-free, so the same code runs client-side for
   instant feedback and server-side as the authoritative check.
   =================================================================== */

export interface SuggestionCandidate extends ClashCheckEvent {
  /** Category key, used only to rank alternatives by similarity. */
  category?: string | null;
}

export type Resolution =
  | {
      type: "swap";
      /** Drop this already-added item and the candidate becomes legal. */
      dropEventId: string;
    }
  | {
      type: "alternative";
      /** Add this instead; it clashes with nothing already scheduled. */
      eventId: string;
      /** True when it shares the candidate's category. */
      sameCategory: boolean;
    };

/**
 * Every existing item the candidate conflicts with, not just the first.
 * `findClash` short-circuits on the first violation because that is all
 * an accept/reject decision needs; repair needs the complete set.
 */
export function findAllClashes(
  candidate: ClashCheckEvent,
  existingItems: ClashCheckEvent[]
): ClashReason[] {
  const reasons: ClashReason[] = [];
  for (const item of existingItems) {
    const reason = findClash(candidate, [item]);
    if (reason) reasons.push(reason);
  }
  return reasons;
}

/**
 * Propose ways out of a clash, best-first.
 *
 * Alternatives are offered before swaps: adding something that fits
 * costs the user nothing, whereas a swap asks them to give something
 * up. Within alternatives, same-category events rank first (closest to
 * what they actually wanted) and then by soonest start.
 *
 * Returns an empty array when the candidate does not clash at all -
 * callers should only reach this after `findClash` returned non-null.
 */
export function suggestAlternatives(
  candidate: SuggestionCandidate,
  existingItems: ClashCheckEvent[],
  catalogue: SuggestionCandidate[],
  options: { limit?: number } = {}
): Resolution[] {
  const limit = options.limit ?? 3;
  if (findClash(candidate, existingItems) === null) return [];

  const scheduledIds = new Set(existingItems.map((i) => i.id));
  const resolutions: Resolution[] = [];

  // --- Alternatives: other events that need no sacrifice. ---------
  const fitting = catalogue
    .filter(
      (e) =>
        e.id !== candidate.id &&
        !scheduledIds.has(e.id) &&
        new Date(e.startsAt).getTime() > Date.now() &&
        findClash(e, existingItems) === null
    )
    .map((e) => ({
      event: e,
      sameCategory:
        candidate.category != null && e.category === candidate.category,
    }))
    .sort((a, b) => {
      if (a.sameCategory !== b.sameCategory) return a.sameCategory ? -1 : 1;
      return (
        new Date(a.event.startsAt).getTime() -
        new Date(b.event.startsAt).getTime()
      );
    });

  for (const { event, sameCategory } of fitting) {
    resolutions.push({ type: "alternative", eventId: event.id, sameCategory });
    if (resolutions.length >= limit) return resolutions;
  }

  // --- Swaps: minimal repair, one dropped item at a time. ---------
  // Only single-item drops are offered. Dropping two or more to fit one
  // new event is a worse trade than simply not adding it, so it is not
  // proposed even when it would technically satisfy the constraints.
  for (const item of existingItems) {
    const reduced = existingItems.filter((i) => i.id !== item.id);
    if (findClash(candidate, reduced) === null) {
      resolutions.push({ type: "swap", dropEventId: item.id });
      if (resolutions.length >= limit) break;
    }
  }

  return resolutions;
}
