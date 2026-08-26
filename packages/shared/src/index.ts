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

export interface ItineraryItem {
  id: string;
  userId: string;
  eventId: string;
  addedAt: string; // ISO 8601
}

export { findClash, haversineDistanceKm } from "./clash.js";
export type { ClashCheckEvent, ClashReason } from "./clash.js";
