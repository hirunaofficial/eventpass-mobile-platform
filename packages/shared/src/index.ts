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
  imageUrl: string | null;
}

export type TicketStatus = "reserved" | "confirmed" | "cancelled";

export interface Ticket {
  id: string;
  userId: string;
  eventId: string;
  status: TicketStatus;
  qrToken: string;
  createdAt: string; // ISO 8601
}

export interface ItineraryItem {
  id: string;
  userId: string;
  eventId: string;
  addedAt: string; // ISO 8601
}
