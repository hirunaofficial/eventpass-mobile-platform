# EventPass- Database & Auth- Design Spec

**Date:** 2026-08-16
**Builds on:** `docs/superpowers/specs/2026-08-15-eventpass-design.md` (master design- see §4 Data Model, §5 Core Flows for the source of truth this spec finalizes into a real implementation)

## 1. Scope

This phase makes the data layer real: a Dockerized PostgreSQL database, the full Prisma schema, a first migration, seed data, and a complete auth slice (server API + app screens/state) end to end. Event discovery, itinerary, tickets, offline sync, and hardware integration remain out of scope- they build on top of this once auth and the data model exist.

## 2. Database- Docker + Prisma

**Docker Compose** (`server/docker-compose.yml`): two services-
- `postgres` (`postgres:16-alpine`), named volume for persistence, exposed on `5432`, credentials via environment variables matching `server/.env`.
- `pgadmin` (`dpage/pgadmin4`), exposed on `5050`, for visually browsing the database during development.

`server/.env`'s `DATABASE_URL` points at `localhost:5432` (the Compose-exposed port); the server itself keeps running on the host via `npm run dev`, not inside a container- this keeps hot-reload fast and matches how the project has run so far.

**Prisma schema** (`server/prisma/schema.prisma`), replacing the placeholder from the scaffold phase:

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String         @id @default(cuid())
  email        String         @unique
  passwordHash String
  createdAt    DateTime       @default(now())
  tickets      Ticket[]
  itineraryItems ItineraryItem[]
}

model Venue {
  id      String  @id @default(cuid())
  name    String
  address String
  lat     Float
  lng     Float
  events  Event[]
}

model Event {
  id             String          @id @default(cuid())
  title          String
  description    String
  venue          Venue           @relation(fields: [venueId], references: [id])
  venueId        String
  startsAt       DateTime
  endsAt         DateTime
  capacity       Int
  remaining      Int
  imageUrl       String?
  tickets        Ticket[]
  itineraryItems ItineraryItem[]
}

enum TicketStatus {
  reserved
  confirmed
  cancelled
}

model Ticket {
  id        String       @id @default(cuid())
  user      User         @relation(fields: [userId], references: [id])
  userId    String
  event     Event        @relation(fields: [eventId], references: [id])
  eventId   String
  status    TicketStatus
  qrToken   String       @unique @default(cuid())
  createdAt DateTime     @default(now())
}

model ItineraryItem {
  id      String   @id @default(cuid())
  user    User     @relation(fields: [userId], references: [id])
  userId  String
  event   Event    @relation(fields: [eventId], references: [id])
  eventId String
  addedAt DateTime @default(now())

  @@unique([userId, eventId])
}
```

This is a direct, faithful translation of the master spec's §4 data model into Prisma syntax- no new entities introduced. `ItineraryItem`'s `@@unique([userId, eventId])` prevents duplicate itinerary entries at the DB level (defense in depth alongside the app-level clash check planned for a later phase).

**Migration:** `npx prisma migrate dev --name init` against the Dockerized Postgres, generating `server/prisma/migrations/`.

**Seed script** (`server/prisma/seed.ts`): inserts 2–3 sample venues and 4–5 sample events (replacing the hardcoded array currently living in `app/src/app/index.tsx`), run via `npx prisma db seed`.

## 3. Auth API (server)

New dependencies: `bcrypt` + `@types/bcrypt` (password hashing), `jsonwebtoken` + `@types/jsonwebtoken` (JWT), `zod` (request validation).

Routes, under `server/src/routes/auth.ts`, mounted at `/auth`:

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/auth/signup` | `{ email, password }` (zod-validated) | `{ token, user: { id, email } }` |
| POST | `/auth/login` | `{ email, password }` | `{ token, user: { id, email } }` |
| GET | `/auth/me` |- (requires `Authorization: Bearer <token>`) | `{ id, email }` |

- Signup: reject if email already exists (409); hash password with `bcrypt.hash(password, 10)`; create `User`; sign a JWT (`jsonwebtoken.sign({ sub: user.id }, JWT_SECRET, { expiresIn: "30d" })`).
- Login: look up by email, `bcrypt.compare`, same JWT issuance on success, 401 on mismatch.
- `server/src/middleware/auth.ts`: an Express middleware that verifies the `Authorization` header's JWT, attaches `req.userId`, and is reused by every future protected route (tickets, itinerary).
- `JWT_SECRET` added to `.env`/`.env.example` (a long random string in `.env`, an obvious placeholder in `.env.example`).

`User.passwordHash` is never included in any API response- routes always select/return an explicit `{ id, email }` shape, never the raw Prisma record.

## 4. Auth (app)

New dependency: `expo-secure-store`.

- `app/src/lib/api.ts`- a thin `fetch` wrapper: `apiFetch(path, options)` that prefixes the server base URL from `process.env.EXPO_PUBLIC_API_URL` (Expo's standard client-exposed env var convention, set in `app/.env` to `http://<host-LAN-IP>:4000` for on-device testing), attaches `Authorization: Bearer <token>` when a token is present, and throws on non-2xx with the parsed error body.
- `app/src/lib/auth-context.tsx`- `AuthProvider` + `useAuth()` exposing `{ user, token, isLoading, signIn(email, password), signUp(email, password), signOut() }`. On mount, reads a persisted token from `expo-secure-store` and calls `GET /auth/me` to restore the session; on sign-in/up, persists the returned token via `expo-secure-store.setItemAsync`; on sign-out, deletes it.
- `app/src/app/login.tsx` and `app/src/app/signup.tsx`- built from the existing `Card`/`Input`/`Label`/`Button`/`Text` components (no new UI components needed), calling `useAuth().signIn`/`signUp`.
- `app/src/app/_layout.tsx`- wrapped in `AuthProvider`; renders `login`/`signup` when unauthenticated, otherwise the existing showcase screen (`index.tsx`) stands in as the authenticated landing screen until Discover is built in a later phase.

## 5. File Structure (additions)

```
server/
  docker-compose.yml
  prisma/
    schema.prisma        # finalized (was placeholder)
    seed.ts
    migrations/           # generated by `prisma migrate dev`
  src/
    middleware/
      auth.ts
    routes/
      auth.ts
    index.ts               # mounts /auth routes
app/
  .env                      # EXPO_PUBLIC_API_URL (gitignored)
  .env.example              # committed placeholder
  src/
    lib/
      api.ts
      auth-context.tsx
    app/
      login.tsx
      signup.tsx
      _layout.tsx           # wrapped in AuthProvider
```

## 6. Testing & Error Handling

- Server: zod validation errors → 400 with field-level messages; duplicate email → 409; bad credentials → 401 (no distinction between "no such user" and "wrong password," to avoid user enumeration); missing/invalid JWT on protected routes → 401 via the shared middleware.
- App: `AuthProvider` surfaces a loading state while restoring the session so the UI doesn't flash a login screen before the stored token is checked; sign-in/up errors are caught and shown inline on the form (no silent failures).

## 7. Out of Scope (this phase)

- Event discovery / Discover screen wiring to real event data (seed data exists, but the showcase screen isn't rewired to fetch it yet- next phase).
- Itinerary constraint solver, offline sync queue, ticket purchase flow, camera/GPS/accelerometer integration, `<ItineraryTimeline>`- all still future phases per the master spec.
- Password reset / email verification- not required by the assignment brief; a real accounts system without them is a reasonable, documented scope cut for an 8-week solo project.
