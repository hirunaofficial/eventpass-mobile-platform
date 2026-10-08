/**
 * The API contract, shared by BOTH the Express server and the Expo app.
 *
 * This package exists so the two cannot drift: the server builds its
 * responses from these types and the client consumes them, so a change
 * to a field name breaks the build on both sides instead of failing
 * silently at runtime.
 *
 * It also exports the constraint algorithm (clash.ts), which is why the
 * client and server can never disagree about what counts as a clash -
 * they run literally the same function.
 */
export interface Venue {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  venueId: string;
  startsAt: string; // ISO 8601
  endsAt: string; // ISO 8601
  capacity: number;
  remaining: number;
  // Key into the app's own bundled category illustrations (see
  // app/src/assets/event-categories/)- not a remote URL.
  imageKey: string | null;
}

// Events are almost always sent with their venue joined in- the clash
// algorithm needs venue coordinates to compute travel time.
export interface EventWithVenue extends Event {
  venue: Venue;
}

export type TicketStatus = "reserved" | "confirmed" | "cancelled";

export interface Ticket {
  id: string;
  userId: string;
  eventId: string;
  status: TicketStatus;
  qrToken: string;
  createdAt: string; // ISO 8601
  checkedInAt: string | null; // ISO 8601
}

export type UserRole = "attendee" | "staff";

export interface TicketWithEvent extends Ticket {
  event: EventWithVenue;
}

// An ItineraryItem is INTENT to attend (what the clash algorithm
// operates on). A Ticket is a purchase. They are deliberately separate:
// buying a ticket does not commit you to a schedule, and planning to
// attend does not require paying.
export interface ItineraryItem {
  id: string;
  userId: string;
  eventId: string;
  addedAt: string; // ISO 8601
}

export {
  findAllClashes,
  findClash,
  haversineDistanceKm,
  suggestAlternatives,
} from "./clash.js";
export type {
  ClashCheckEvent,
  ClashReason,
  Resolution,
  SuggestionCandidate,
} from "./clash.js";
