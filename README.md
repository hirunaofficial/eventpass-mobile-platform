# EventPass

A mobile platform for discovering live events, planning which ones to
attend, buying tickets, and checking in at the door.

Built for **SE5070 – Enterprise Mobility**, M.Sc. in IT, SLIIT.
Domain allocated by index number: `MS26928388` → digit sum 46 → 46 mod 5
= 1 → **Entertainment**.

---

## What makes it more than a listings app

Every ticketing app will happily sell you tickets to two events that
overlap, or to two events twenty kilometres apart with fifteen minutes
between them. You find out on the night.

EventPass treats a personal itinerary as a **constraint satisfaction
problem**. Adding an event must satisfy two rules:

1. **No time overlap** with anything already planned.
2. **Enough travel time** between venues — haversine distance divided by
   an assumed average speed, compared against the real gap.

When an addition fails, the app does not stop at "no". It computes
repairs: a different event that fits as-is, or the single item you'd
have to drop. See [`packages/shared/src/clash.ts`](packages/shared/src/clash.ts).

---

## Stack

| Layer | Choice |
|---|---|
| App | React Native 0.86 / Expo SDK 57, Expo Router |
| Styling | NativeWind v4 (Tailwind), copy-owned component source |
| Backend | Node / Express 5 |
| Database | PostgreSQL 16 via Prisma 7 (Docker) |
| Local store | SQLite (`expo-sqlite`) |
| Auth | JWT + bcrypt, roles: attendee / staff |

A monorepo on npm workspaces: `app/`, `server/`, `packages/shared/`.
`packages/shared` holds the API types **and the constraint algorithm**,
imported unmodified by both sides — so client and server can never
disagree about what counts as a clash.

---

## Running it

```bash
# 1. Database
cd server && docker compose up -d

# 2. Install, migrate, seed  (from the repo root)
npm install
cd server && npx prisma migrate deploy && npm run db:seed

# 3. Run
cd server && npm run dev        # API on :4000
cd app    && npx expo start     # Metro on :8081
```

`server/.env` is required — copy `server/.env.example` and fill it in.
The app needs no configuration: it derives the API host from Expo's own
`hostUri`, so it works on whatever network you are on.

### Verify

```bash
npm run type-check               # all three workspaces
npm run test -w packages/shared  # constraint algorithm, 13 cases
```

---

## Features

- **Discover** — search, category filters, distance sorting via GPS,
  grouped into Tonight / This week / Later
- **Plan** — constraint-checked itinerary on a hand-built timeline, with
  clashes highlighted and repairs offered
- **Tickets** — purchase with an atomic capacity guard, QR wallet
- **Check-in** — staff-only camera scanner, single-use enforcement
- **Offline** — full offline reads plus queued writes that sync on
  reconnect

### Offline behaviour

| Action | Offline |
|---|---|
| Browse, view itinerary, view tickets | Served from SQLite cache |
| Add / remove itinerary | Applied immediately, queued |
| Buy ticket | Queued, **not** applied optimistically |
| Check in | Requires connectivity, by design |

Itinerary adds are applied immediately because `findClash()` is a
complete client-side guarantee. Ticket capacity has no such guarantee —
a cached `remaining` count can be stale — so showing a ticket as
purchased before the server confirms would be a lie the sync step might
have to walk back.

---

## Hardware

Camera (QR check-in), GPS (distance sorting), accelerometer (shake to
refresh), secure enclave (token storage), photo library (save a ticket
QR, and check in from a saved image when one device must do both ends).

---

## Custom components

Three are hand-built rather than taken from a library:

- **`ItineraryTimeline`** — time-proportional vertical timeline, no
  calendar library. Computes its own clash set by calling the shared
  algorithm, so it is always consistent with the server's rules.
- **`FloatingTabBar`** — detached pill, spring-animated on the UI
  thread, icon weight changes on focus.
- **`ClashResolutionSheet`** — surfaces the solver's repair options.

---

## Assets

All event artwork is self-authored. The 11 category illustrations are
generated from geometric primitives by
[`tools/generate_category_art.py`](tools/generate_category_art.py),
which is committed as provenance — the artwork can be regenerated from
source at any time.
