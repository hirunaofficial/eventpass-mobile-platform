# EventPass- Smart Event Discovery & Ticketing Platform- Design Spec

**Date:** 2026-08-15
**Course:** SE5070 – Enterprise Mobility, SLIIT MSc IT
**Student index:** MS26928388 → digit sum 46 → 46 mod 5 = 1 → **Entertainment** domain
**Deadline:** 2026-10-18

## 1. Project Overview

EventPass is a mobile app for discovering local entertainment events (concerts,
meetups, expos, etc.), building a personal clash-free itinerary across
multiple events/venues, and checking in at the venue via QR scan. It is
attendee-only (no organizer role)- event data is seeded server-side.

Core value proposition: unlike a plain calendar, EventPass actively prevents
the user from committing to events that overlap in time or that are not
physically reachable from each other in time (travel-time buffer between
venues), and keeps working when the venue has poor/no connectivity.

## 2. Technology Choices

| Concern | Choice | Why |
|---|---|---|
| Mobile framework | React Native (Expo, dev client) | Fast solo iteration; expo-camera/expo-location/expo-sensors cover all required native hardware without ejecting; still real native modules underneath for the live-coding defense. |
| Backend | Node.js + Express | Full control over data flow and sync/conflict logic, gives a concrete "in-depth data flow" story for the report/viva vs. a managed BaaS. |
| Backend DB | PostgreSQL + Prisma ORM | Relational fit for Users/Events/Venues/Tickets/Itinerary with clear foreign keys; Prisma keeps schema + migrations fast to iterate solo. |
| Auth | Email/password, JWT | Real per-user identity needed for itinerary/tickets to persist across devices/reinstalls; gives a concrete endpoint to live-code. |
| On-device persistence | SQLite (expo-sqlite / op-sqlite) | Embedded relational DB mirroring the server schema; supports real SQL queries for the clash-detection logic while offline. |
| Payments | Mocked | "Buy Ticket" reserves capacity and shows a fake confirmation- real gateway integration is out of scope for the grading criteria and would dilute effort better spent on offline/constraint/hardware work. |

## 3. User Roles

Single role: **Attendee**. Organizers are not app users in this scope- events
are seeded into Postgres via a seed script (represents a future
organizer-facing surface, out of scope for this assignment).

## 4. Data Model

Server (PostgreSQL, via Prisma):

```
User            (id, email, passwordHash, createdAt)
Venue           (id, name, address, lat, lng)
Event           (id, title, description, venueId, startsAt, endsAt,
                  capacity, remaining, imageUrl)
Ticket          (id, userId, eventId, status[reserved|confirmed|cancelled],
                  qrToken, createdAt)
ItineraryItem   (id, userId, eventId, addedAt)
```

On-device (SQLite)- mirrors `Event` (cached subset), `Ticket`,
`ItineraryItem`, plus a local-only table:

```
SyncQueueEntry  (id, action[add_itinerary|remove_itinerary|buy_ticket|check_in],
                  payload JSON, status[pending|synced|conflict], createdAt)
```

## 5. Core Flows

1. **Discover**- fetch nearby/upcoming events (GPS-sorted by distance),
   cache results locally for offline browsing.
2. **Add to itinerary**- runs the clash-detection check (§6) against the
   locally cached itinerary; on success, writes to local SQLite immediately
   (optimistic) and enqueues a `SyncQueueEntry`.
3. **Buy ticket**- optimistic local `Ticket(status=reserved)` + queued
   `buy_ticket` action. On sync, server re-validates capacity as the source
   of truth; if sold out while offline, the entry is marked `conflict` and
   surfaced to the user to acknowledge (no silent failure).
4. **Check-in**- camera scans the event's QR at the venue; validated
   against the locally cached ticket if offline, with a queued `check_in`
   action synced when back online.
5. **Sync**- a background task drains `SyncQueueEntry` rows against the API
   whenever connectivity is restored (NetInfo listener), oldest first,
   marking each `synced` or `conflict`.

## 6. Constraint Algorithm- Clash-Aware Itinerary

**Model:**
- Variables: each itinerary item (candidate event to add).
- Domain: `{included, excluded}`.
- Constraints:
  1. No two included items overlap in time.
  2. If items are at different venues, the gap between one item's end and
     the next item's start must be ≥ the travel time between those venues
     (estimated from GPS haversine distance between venue coordinates ÷ an
     assumed average travel speed).

**Algorithm:** on insert, run a greedy pairwise conflict check of the
candidate against all existing itinerary items. On conflict, reject the add
with a reason (time overlap vs. insufficient travel buffer) and offer the
nearest non-conflicting time slot for that same event if the event has
multiple sessions/showings, via a small backtracking search over the user's
existing saved items.

This is the algorithm to be simplified and live-coded during the viva's
coding defense.

## 7. Native Hardware Integration

| Hardware | Use |
|---|---|
| Camera | Scan venue QR to check in; display the user's own ticket as a QR code. |
| GPS | Sort/filter "nearby events" in Discover; compute venue-to-venue distance for the travel-time buffer in §6. |
| Accelerometer (shake gesture) | Shake-to-refresh the Discover feed. |

## 8. Custom Component

`<ItineraryTimeline>`- hand-built vertical timeline (raw `View`/`Animated`,
no calendar library), rendering the user's itinerary items as time-proportional
blocks and visually flagging clashes/insufficient-travel-buffer items in red
before they're resolved.

- **Props:** `items: ItineraryItem[]`, `startHour: number`, `endHour: number`,
  `onConflictPress: (item) => void`
- **Events:** `onItemPress(item)`, `onReorder(items)`

## 9. Offline Strategy

Full offline-first core loop: all reads/writes go to local SQLite first, so
Discover (cached), itinerary management (clash-checked locally), and the
ticket wallet (QR view) all work with no connectivity. Changes are recorded
in `SyncQueueEntry` and drained against the backend when connectivity
returns, with explicit `conflict` state surfaced to the user rather than
silently dropped or silently overwritten.

## 10. Project Structure (planned)

Monorepo, npm workspaces (one GitHub repo, one link for submission):

```
eventpass-mobile-platform/
  package.json           # workspaces root: ["app", "server", "packages/*"]
  app/                    # React Native (Expo) app        [workspace]
    src/
      screens/
      components/         # incl. ItineraryTimeline
      db/                 # SQLite schema + queries
      sync/               # sync queue drain logic
      api/                # backend client
  server/                 # Node/Express + Prisma API       [workspace]
    src/
      routes/
      prisma/
  packages/
    shared/                # shared TS types (Event, Ticket, [workspace]
                            # ItineraryItem, ...) used by both
                            # app and server, so the API contract
                            # can't silently drift out of sync
  docs/
    superpowers/specs/     # design specs (this file)
    superpowers/plans/     # implementation plans
```

Dependencies are installed at their latest stable versions at scaffold
time (not pinned to older LTS lines), since this is a fresh project with
no legacy compatibility constraints.

`decision-log.md` and `ai-usage-log.md` are NOT inside this repo- see §11.
This repo will be published publicly on GitHub as the assignment's source
link, and those two files are submission material, not source code.

## 11. Decision Records & Failure Log- Process

Required by the assignment brief verbatim: *"Outline of Decision Records &
Failure Logs - You need to document your process of implementation if you
used AI for certain parts you need to provide prompts and show the failures
and errors that you got during your implementation."*

This is treated as a first-class, continuously-maintained artifact, not
written retroactively. Both files live **outside this repo**, in
`eventpass-logs/` alongside the assignment PDF (sibling to
`eventpass-mobile-platform/`, not a subfolder of it)- since this repo is
published publicly on GitHub as the assignment's source-code link, and
these logs are project-document submission material, not source code:

- **`eventpass-logs/decision-log.md`**- one entry per notable
  architectural/design decision: what was decided, why, and what
  alternatives were considered. Seeded from the brainstorming session's
  choices (framework, backend, offline strategy, constraint algorithm
  scope, etc.).
- **`eventpass-logs/ai-usage-log.md`**- one entry per AI-assisted
  implementation step: the prompt used, what was produced, any
  errors/failures hit, and how they were resolved. Updated continuously
  during implementation, including this design/planning session itself as
  the first entries.

Both files were created during planning and are updated after every
subsequent implementation task.

## 12. Testing & Error Handling Notes

- Server: validate capacity/ownership on every ticket/itinerary mutation-
  client-side checks are optimistic UX only, server is the source of truth.
- Client: sync conflicts (e.g., sold-out while offline) surface as an
  explicit "needs your attention" state, never silently dropped.
- Constraint solver: unit-testable in isolation (pure functions over
  itinerary item lists), independent of UI and network.

## 13. Out of Scope

- Organizer-facing app/role.
- Real payment gateway integration.
- Push notifications.
- Social features (friends, sharing).
