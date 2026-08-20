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
