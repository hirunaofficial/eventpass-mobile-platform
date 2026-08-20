import assert from "node:assert/strict";
import { test } from "node:test";
import { findClash, type ClashCheckEvent } from "./clash.js";

const venueA = { lat: 6.9271, lng: 79.8612 }; // Colombo Fort
const venueB = { lat: 6.9147, lng: 79.8731 }; // ~2.3km away, ~5min at 30km/h

function event(
  id: string,
  startsAt: string,
  endsAt: string,
  venue: { lat: number; lng: number }
): ClashCheckEvent {
  return { id, startsAt, endsAt, venue };
}

test("no clash: same-venue events with a comfortable gap", () => {
  const existing = [event("a", "2026-09-01T10:00:00Z", "2026-09-01T11:00:00Z", venueA)];
  const candidate = event("b", "2026-09-01T12:00:00Z", "2026-09-01T13:00:00Z", venueA);
  assert.equal(findClash(candidate, existing), null);
});

test("time overlap is detected", () => {
  const existing = [event("a", "2026-09-01T10:00:00Z", "2026-09-01T12:00:00Z", venueA)];
  const candidate = event("b", "2026-09-01T11:00:00Z", "2026-09-01T13:00:00Z", venueA);
  const result = findClash(candidate, existing);
  assert.deepEqual(result, { type: "time_overlap", withEventId: "a" });
});

test("insufficient travel time between different venues is detected", () => {
  const existing = [event("a", "2026-09-01T10:00:00Z", "2026-09-01T11:00:00Z", venueA)];
  // Starts 2 minutes after the first ends, but venues are ~5min apart
  const candidate = event("b", "2026-09-01T11:02:00Z", "2026-09-01T12:00:00Z", venueB);
  const result = findClash(candidate, existing);
  assert.equal(result?.type, "insufficient_travel_time");
});

test("back-to-back events at the same venue do not clash (zero travel time needed)", () => {
  const existing = [event("a", "2026-09-01T10:00:00Z", "2026-09-01T11:00:00Z", venueA)];
  const candidate = event("b", "2026-09-01T11:00:00Z", "2026-09-01T12:00:00Z", venueA);
  assert.equal(findClash(candidate, existing), null);
});

test("enough travel time between different venues does not clash", () => {
  const existing = [event("a", "2026-09-01T10:00:00Z", "2026-09-01T11:00:00Z", venueA)];
  const candidate = event("b", "2026-09-01T11:30:00Z", "2026-09-01T12:30:00Z", venueB);
  assert.equal(findClash(candidate, existing), null);
});
