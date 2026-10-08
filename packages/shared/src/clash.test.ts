import assert from "node:assert/strict";
import { test } from "node:test";
import {
  findAllClashes,
  findClash,
  suggestAlternatives,
  type ClashCheckEvent,
  type SuggestionCandidate,
} from "./clash.js";

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

/* ---------------------------------------------------------------
   Conflict resolution (suggestAlternatives)

   These fixtures are built relative to `Date.now()` rather than
   pinned to literal dates: `suggestAlternatives` filters the
   catalogue to future events only, so hard-coded dates would
   silently stop exercising the code once they slipped into the
   past - which is exactly what happened to the fixtures above.
   --------------------------------------------------------------- */

const HOUR = 60 * 60 * 1000;
const iso = (hoursFromNow: number) =>
  new Date(Date.now() + hoursFromNow * HOUR).toISOString();

function futureEvent(
  id: string,
  startHour: number,
  endHour: number,
  venue: { lat: number; lng: number },
  category?: string
): SuggestionCandidate {
  return { id, startsAt: iso(startHour), endsAt: iso(endHour), venue, category };
}

test("suggestAlternatives returns nothing when the candidate does not clash", () => {
  const existing = [futureEvent("a", 24, 25, venueA)];
  const candidate = futureEvent("b", 30, 31, venueA);
  assert.deepEqual(suggestAlternatives(candidate, existing, []), []);
});

test("suggestAlternatives offers a non-clashing catalogue event as an alternative", () => {
  const existing = [futureEvent("a", 24, 26, venueA)];
  const candidate = futureEvent("b", 25, 27, venueA); // overlaps "a"
  const catalogue = [candidate, futureEvent("c", 40, 41, venueA)];

  const result = suggestAlternatives(candidate, existing, catalogue);
  // Both repairs are valid and both are offered: the alternative first
  // (costs nothing), the swap second (asks the user to give something up).
  assert.deepEqual(result, [
    { type: "alternative", eventId: "c", sameCategory: false },
    { type: "swap", dropEventId: "a" },
  ]);
});

test("same-category alternatives are ranked above other categories", () => {
  const existing = [futureEvent("a", 24, 26, venueA)];
  const candidate = futureEvent("b", 25, 27, venueA, "music");
  const catalogue = [
    candidate,
    futureEvent("earlier-other", 30, 31, venueA, "film"),
    futureEvent("later-music", 48, 49, venueA, "music"),
  ];

  const result = suggestAlternatives(candidate, existing, catalogue);
  // "later-music" starts later but shares the category, so it wins.
  assert.equal(result[0]?.type, "alternative");
  assert.deepEqual(result[0], {
    type: "alternative",
    eventId: "later-music",
    sameCategory: true,
  });
});

test("a swap is offered when dropping one item makes the candidate fit", () => {
  const existing = [futureEvent("a", 24, 26, venueA)];
  const candidate = futureEvent("b", 25, 27, venueA);

  // Empty catalogue, so the only possible repair is dropping "a".
  const result = suggestAlternatives(candidate, existing, []);
  assert.deepEqual(result, [{ type: "swap", dropEventId: "a" }]);
});

test("no swap is offered when dropping one item still leaves a clash", () => {
  // Two existing items both overlap the candidate, so removing either
  // one on its own is not enough - a minimal single-item repair fails.
  const existing = [
    futureEvent("a", 24, 26, venueA),
    futureEvent("b", 25, 27, venueA),
  ];
  const candidate = futureEvent("c", 24.5, 26.5, venueA);

  const result = suggestAlternatives(candidate, existing, []);
  assert.deepEqual(result, []);
});

test("past catalogue events are never suggested", () => {
  const existing = [futureEvent("a", 24, 26, venueA)];
  const candidate = futureEvent("b", 25, 27, venueA);
  const catalogue = [candidate, futureEvent("gone", -48, -47, venueA)];

  const result = suggestAlternatives(candidate, existing, catalogue);
  assert.ok(
    !result.some((r) => r.type === "alternative" && r.eventId === "gone"),
    "a catalogue event in the past must not be offered"
  );
});

test("already-scheduled events are never offered as alternatives", () => {
  const existing = [futureEvent("a", 24, 26, venueA)];
  const candidate = futureEvent("b", 25, 27, venueA);
  // "a" is already in the itinerary; it must not be suggested back.
  const catalogue = [candidate, existing[0]!];

  const result = suggestAlternatives(candidate, existing, catalogue);
  assert.ok(!result.some((r) => r.type === "alternative" && r.eventId === "a"));
});

test("findAllClashes reports every conflicting item, not just the first", () => {
  const existing = [
    futureEvent("a", 24, 26, venueA),
    futureEvent("b", 25, 27, venueA),
  ];
  const candidate = futureEvent("c", 24.5, 26.5, venueA);

  const reasons = findAllClashes(candidate, existing);
  assert.equal(reasons.length, 2);
  assert.deepEqual(
    reasons.map((r) => r.withEventId).sort(),
    ["a", "b"]
  );
});
