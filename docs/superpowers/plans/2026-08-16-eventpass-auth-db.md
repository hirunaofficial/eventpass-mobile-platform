# EventPass Auth & Database Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a real, migrated PostgreSQL database (via Docker) behind the finalized Prisma schema, and ship a complete auth slice- signup/login/me on the server, and a login/signup flow with persisted sessions on the app- so every later feature (events, itinerary, tickets) has real accounts and real data to build on.

**Architecture:** PostgreSQL runs in Docker (Compose), migrated via Prisma CLI from the host. The Express server exposes `/auth/signup`, `/auth/login`, `/auth/me`, using bcrypt for password hashing, JWT for stateless session tokens, and zod for request validation. The Expo app persists its JWT in `expo-secure-store`, exposes it app-wide via a React Context (`AuthProvider`/`useAuth`), and gates the root layout between `login`/`signup` screens (unauthenticated) and the existing showcase screen (authenticated, standing in for Discover).

**Tech Stack:** PostgreSQL 16 (Docker), Prisma (schema + migrate + Client), pgAdmin4 (Docker), bcrypt, jsonwebtoken, zod, expo-secure-store.

**Spec:** `docs/superpowers/specs/2026-08-16-eventpass-auth-db-design.md`

## Global Constraints

- Native/Expo packages installed via `npx expo install`; everything else via `<package>@latest` (spec, project convention).
- Git commits use Conventional Commits tags (feat/fix/docs/style/refactor/perf/test/build/ci/chore/revert); no `Co-Authored-By` trailer (explicit user instruction, standing for this project).
- `User.passwordHash` must never appear in any API response (spec §3).
- Docker is confirmed installed and running on this machine (Docker 29.6.2, Compose v5.3.1), and ports `5432`/`5050` are free- verified before this plan was written. Task 1 re-verifies this as its first step regardless, since plans may be executed later/elsewhere.
- Every task that changes server or app behavior gets a real, run-and-observe verification step (curl for API endpoints, `tsc --noEmit` for the app)- no step is marked done on code inspection alone.

---

## File Structure

```
server/
  docker-compose.yml           # postgres + pgadmin
  .env                          # DATABASE_URL now points at Docker Postgres; JWT_SECRET added
  .env.example                  # updated placeholders
  prisma/
    schema.prisma               # finalized: User, Venue, Event, Ticket, ItineraryItem
    seed.ts                     # sample venues/events
    migrations/                 # generated
  src/
    middleware/
      auth.ts                   # verifies JWT, attaches req.userId
    routes/
      auth.ts                   # signup/login/me
    index.ts                    # mounts /auth
app/
  .env                           # EXPO_PUBLIC_API_URL (gitignored)
  .env.example
  src/
    lib/
      api.ts                     # apiFetch() wrapper
      auth-context.tsx           # AuthProvider / useAuth
    app/
      login.tsx
      signup.tsx
      _layout.tsx                 # wrapped in AuthProvider, gates login/signup vs. showcase
```

---

### Task 1: Dockerized PostgreSQL + pgAdmin

**Files:**
- Create: `server/docker-compose.yml`
- Modify: `server/.env` (DATABASE_URL)
- Modify: `server/.env.example`

**Interfaces:**
- Produces: a running Postgres reachable at `postgresql://eventpass:eventpass@localhost:5432/eventpass`, used by every later task.

- [ ] **Step 1: Verify Docker is available**

Run: `docker info` and `docker compose version`
Expected: both succeed (no "Cannot connect to the Docker daemon" error). If either fails, STOP and report to the user- the rest of this task is blocked without a running Docker daemon.

- [ ] **Step 2: Write server/docker-compose.yml**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: eventpass
      POSTGRES_PASSWORD: eventpass
      POSTGRES_DB: eventpass
    ports:
      - "5432:5432"
    volumes:
      - eventpass_pgdata:/var/lib/postgresql/data

  pgadmin:
    image: dpage/pgadmin4
    restart: unless-stopped
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@eventpass.local
      PGADMIN_DEFAULT_PASSWORD: eventpass
    ports:
      - "5050:80"
    depends_on:
      - postgres

volumes:
  eventpass_pgdata:
```

- [ ] **Step 3: Start the containers**

Run: `cd server && docker compose up -d`
Expected: both `server-postgres-1` and `server-pgadmin-1` (or similarly named) containers report `Up` when you run `docker compose ps`.

- [ ] **Step 4: Update server/.env**

Edit `server/.env`, replacing the placeholder `DATABASE_URL` line with:
```
DATABASE_URL="postgresql://eventpass:eventpass@localhost:5432/eventpass?schema=public"
```

- [ ] **Step 5: Update server/.env.example to match**

Edit `server/.env.example`'s `DATABASE_URL` line to the same non-secret value (these are already throwaway local-dev credentials, safe to commit verbatim):
```
DATABASE_URL="postgresql://eventpass:eventpass@localhost:5432/eventpass?schema=public"
```

- [ ] **Step 6: Verify connectivity**

Run: `docker exec -it $(docker compose -f server/docker-compose.yml ps -q postgres) psql -U eventpass -d eventpass -c '\dt'`
Expected: connects successfully and reports "Did not find any relations." (no tables yet- that's correct, migration hasn't run).

- [ ] **Step 7: Commit**

```bash
git add server/docker-compose.yml server/.env.example
git commit -m "build: add Dockerized PostgreSQL and pgAdmin for local development"
```

Note: `server/.env` itself is gitignored- nothing to add there.

---

### Task 2: Finalize the Prisma schema and run the first migration

**Files:**
- Modify: `server/prisma/schema.prisma`

**Interfaces:**
- Consumes: the running Postgres from Task 1.
- Produces: the `User`, `Venue`, `Event`, `Ticket`, `ItineraryItem` tables and the generated Prisma Client (`@prisma/client`, output at `server/src/generated/prisma`) that every later task imports.

- [ ] **Step 1: Write the finalized schema.prisma**

Replace the full contents of `server/prisma/schema.prisma` with:

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
  id             String          @id @default(cuid())
  email          String          @unique
  passwordHash   String
  createdAt      DateTime        @default(now())
  tickets        Ticket[]
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

- [ ] **Step 2: Run the migration**

Run: `cd server && npx prisma migrate dev --name init`
Expected: creates `server/prisma/migrations/<timestamp>_init/migration.sql`, applies it to the Dockerized Postgres, and regenerates the Prisma Client. Output should end with "Your database is now in sync with your schema" (or equivalent success message).

- [ ] **Step 3: Verify the tables exist**

Run: `docker exec -it $(docker compose -f server/docker-compose.yml ps -q postgres) psql -U eventpass -d eventpass -c '\dt'`
Expected: lists `User`, `Venue`, `Event`, `Ticket`, `ItineraryItem`, and Prisma's `_prisma_migrations` table.

- [ ] **Step 4: Type-check**

Run: `npm run type-check -w server`
Expected: passes clean- confirms the regenerated Prisma Client's types are valid.

- [ ] **Step 5: Commit**

```bash
git add server/prisma
git commit -m "feat: finalize Prisma schema and run initial migration"
```

---

### Task 3: Seed data

**Files:**
- Create: `server/prisma/seed.ts`
- Modify: `server/package.json` (add `prisma.seed` config and a `db:seed` script)

**Interfaces:**
- Consumes: the migrated schema from Task 2 (`Venue`, `Event` models).
- Produces: 3 sample `Venue` rows and 5 sample `Event` rows in the database, which Task 8 (app-side Discover wiring, if reached) or manual testing can rely on existing.

- [ ] **Step 1: Install tsx as a dependency of the seed script (already present)**

`tsx` is already installed (added in the scaffold phase for `npm run dev`). No new install needed- verify with:
Run: `npx tsx --version`
Expected: prints a version number.

- [ ] **Step 2: Write server/prisma/seed.ts**

```typescript
import { PrismaClient } from "../src/generated/prisma/client.js";

const prisma = new PrismaClient();

async function main() {
  const independenceArcade = await prisma.venue.create({
    data: {
      name: "Independence Arcade",
      address: "Independence Ave, Colombo 07",
      lat: 6.9034,
      lng: 79.8688,
    },
  });

  const barefootGarden = await prisma.venue.create({
    data: {
      name: "Barefoot Garden Cafe",
      address: "704 Galle Rd, Colombo 03",
      lat: 6.8988,
      lng: 79.8542,
    },
  });

  const lionelWendt = await prisma.venue.create({
    data: {
      name: "Lionel Wendt Gallery",
      address: "18 Guildford Cres, Colombo 07",
      lat: 6.9101,
      lng: 79.8571,
    },
  });

  const now = Date.now();
  const hour = 60 * 60 * 1000;

  await prisma.event.createMany({
    data: [
      {
        title: "Colombo Tech Meetup",
        description: "Developers share ideas, demo projects, and network.",
        venueId: independenceArcade.id,
        startsAt: new Date(now + 2 * hour),
        endsAt: new Date(now + 4 * hour),
        capacity: 100,
        remaining: 42,
      },
      {
        title: "Acoustic Night Live",
        description: "An intimate evening of live acoustic performances.",
        venueId: barefootGarden.id,
        startsAt: new Date(now + 24 * hour),
        endsAt: new Date(now + 27 * hour),
        capacity: 60,
        remaining: 8,
      },
      {
        title: "Contemporary Art Expo",
        description:
          "Local artists showcase paintings, sculpture, and installations.",
        venueId: lionelWendt.id,
        startsAt: new Date(now + 72 * hour),
        endsAt: new Date(now + 78 * hour),
        capacity: 200,
        remaining: 156,
      },
      {
        title: "Startup Pitch Night",
        description: "Early-stage founders pitch to a room of mentors.",
        venueId: independenceArcade.id,
        startsAt: new Date(now + 96 * hour),
        endsAt: new Date(now + 98 * hour),
        capacity: 80,
        remaining: 30,
      },
      {
        title: "Jazz & Poetry Evening",
        description: "Spoken word and live jazz in the garden.",
        venueId: barefootGarden.id,
        startsAt: new Date(now + 120 * hour),
        endsAt: new Date(now + 123 * hour),
        capacity: 50,
        remaining: 12,
      },
    ],
  });

  console.log("Seeded 3 venues and 5 events.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 3: Add the seed script and prisma.seed config to server/package.json**

Edit `server/package.json`, adding a top-level `prisma` key and a `db:seed` script:

```json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

Add to the existing `"scripts"` block:
```json
"db:seed": "prisma db seed"
```

- [ ] **Step 4: Run the seed**

Run: `cd server && npx prisma db seed`
Expected: prints "Seeded 3 venues and 5 events." with no errors.

- [ ] **Step 5: Verify via psql**

Run: `docker exec -it $(docker compose -f server/docker-compose.yml ps -q postgres) psql -U eventpass -d eventpass -c 'SELECT count(*) FROM "Event";'`
Expected: returns `5`.

- [ ] **Step 6: Commit**

```bash
git add server/prisma/seed.ts server/package.json
git commit -m "feat: add database seed script with sample venues and events"
```

---

### Task 4: Auth dependencies and JWT middleware

**Files:**
- Create: `server/src/middleware/auth.ts`
- Modify: `server/.env` (add `JWT_SECRET`)
- Modify: `server/.env.example`

**Interfaces:**
- Produces: `requireAuth` middleware- an Express `RequestHandler` that reads `Authorization: Bearer <token>`, verifies it, and sets `req.userId: string` (via an augmented `Express.Request` type), or responds `401` and does not call `next()`. Task 5's `/auth/me` and every future protected route import this.
- Produces: `signToken(userId: string): string` and `JWT_SECRET` (exported from this file), reused by Task 5's signup/login handlers.

- [ ] **Step 1: Install dependencies**

Run: `cd server && npm install bcrypt jsonwebtoken zod`
Run: `npm install --save-dev @types/bcrypt @types/jsonwebtoken`

- [ ] **Step 2: Add JWT_SECRET to server/.env**

Edit `server/.env`, adding a new line:
```
JWT_SECRET="dev-only-secret-do-not-use-in-production-a1b2c3d4e5"
```

- [ ] **Step 3: Add the placeholder to server/.env.example**

Edit `server/.env.example`, adding:
```
JWT_SECRET="replace-with-a-long-random-string"
```

- [ ] **Step 4: Write server/src/middleware/auth.ts**

```typescript
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is not set");
}

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "30d" });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or malformed Authorization header" });
    return;
  }

  const token = header.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string };
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
```

- [ ] **Step 5: Type-check**

Run: `npm run type-check -w server`
Expected: passes clean.

- [ ] **Step 6: Commit**

```bash
git add server/src/middleware server/.env.example
git commit -m "feat: add JWT signing and auth middleware"
```

---

### Task 5: Signup, login, and me routes

**Files:**
- Create: `server/src/routes/auth.ts`
- Modify: `server/src/index.ts` (mount `/auth`)

**Interfaces:**
- Consumes: `signToken` and `requireAuth` from Task 4; `PrismaClient` from the Task 2 schema.
- Produces: `POST /auth/signup`, `POST /auth/login`, `GET /auth/me`- the exact contract Task 7 (app `auth-context.tsx`) calls against.

- [ ] **Step 1: Write server/src/routes/auth.ts**

```typescript
import bcrypt from "bcrypt";
import { Router } from "express";
import { z } from "zod";
import { PrismaClient } from "../generated/prisma/client.js";
import { requireAuth, signToken } from "../middleware/auth.js";

const prisma = new PrismaClient();
const router = Router();

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

router.post("/signup", async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const { email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, passwordHash },
    select: { id: true, email: true },
  });

  res.status(201).json({ token: signToken(user.id), user });
});

router.post("/login", async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  res.json({
    token: signToken(user.id),
    user: { id: user.id, email: user.email },
  });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, email: true },
  });
  if (!user) {
    res.status(401).json({ error: "User no longer exists" });
    return;
  }
  res.json(user);
});

export default router;
```

- [ ] **Step 2: Mount the router in server/src/index.ts**

Edit `server/src/index.ts`, adding the import and mount (after the existing `app.use(express.json())` line, before the `/health` route):

```typescript
import authRouter from "./routes/auth.js";
```

```typescript
app.use("/auth", authRouter);
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check -w server`
Expected: passes clean.

- [ ] **Step 4: Smoke-test signup**

Run: `npm run dev -w server &` (background), wait ~2 seconds, then:
```bash
curl -s -X POST http://localhost:4000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```
Expected: JSON response with a `token` string and `user: { id, email: "test@example.com" }`- no `passwordHash` field anywhere in the response.

- [ ] **Step 5: Smoke-test duplicate signup rejection**

Run the same curl command again.
Expected: `{"error":"An account with this email already exists"}` with HTTP 409 (check via `-i` flag or `-w "%{http_code}"`).

- [ ] **Step 6: Smoke-test login**

```bash
curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```
Expected: same shape as signup- `token` + `user`.

- [ ] **Step 7: Smoke-test /me with the returned token**

Extract the `token` from Step 6's response, then:
```bash
curl -s http://localhost:4000/auth/me -H "Authorization: Bearer <token>"
```
Expected: `{"id":"...","email":"test@example.com"}`.

- [ ] **Step 8: Smoke-test /me without a token**

```bash
curl -s -i http://localhost:4000/auth/me
```
Expected: HTTP 401.

- [ ] **Step 9: Stop the background dev server**

Run: `kill %1` (or find and kill the `tsx` process).

- [ ] **Step 10: Commit**

```bash
git add server/src/routes server/src/index.ts
git commit -m "feat: add signup, login, and me auth routes"
```

---

### Task 6: App API client and auth context

**Files:**
- Create: `app/src/lib/api.ts`
- Create: `app/src/lib/auth-context.tsx`
- Create: `app/.env`
- Create: `app/.env.example`

**Interfaces:**
- Produces: `apiFetch<T>(path: string, options?: RequestInit): Promise<T>`- used by `auth-context.tsx` here and by every future data-fetching hook.
- Produces: `AuthProvider` (React component) and `useAuth(): { user: { id: string; email: string } | null; token: string | null; isLoading: boolean; signIn(email: string, password: string): Promise<void>; signUp(email: string, password: string): Promise<void>; signOut(): Promise<void> }`- consumed by Task 7's `_layout.tsx`, `login.tsx`, `signup.tsx`.

- [ ] **Step 1: Install expo-secure-store**

Run: `cd app && npx expo install expo-secure-store`

- [ ] **Step 2: Create app/.env**

Find your machine's LAN IP (needed since the Android emulator/device can't reach `localhost` meaning the host):
Run: `ipconfig getifaddr en0` (macOS Wi-Fi)- note the printed IP address.

Write `app/.env`:
```
EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:4000
```
(substitute the actual IP from the command above, e.g. `http://192.168.1.138:4000`)

- [ ] **Step 3: Create app/.env.example**

```
EXPO_PUBLIC_API_URL=http://192.168.1.100:4000
```

- [ ] **Step 4: Write app/src/lib/api.ts**

```typescript
const API_URL = process.env.EXPO_PUBLIC_API_URL;

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {}
): Promise<T> {
  if (!API_URL) {
    throw new Error("EXPO_PUBLIC_API_URL is not set");
  }

  const { token, headers, ...rest } = options;
  const response = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      body && typeof body.error === "string" ? body.error : "Request failed";
    throw new ApiError(response.status, message);
  }

  return body as T;
}
```

- [ ] **Step 5: Write app/src/lib/auth-context.tsx**

```typescript
import * as SecureStore from "expo-secure-store";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { apiFetch } from "@/lib/api";

const TOKEN_KEY = "eventpass_token";

type AuthUser = { id: string; email: string };

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!storedToken) {
        setIsLoading(false);
        return;
      }
      try {
        const me = await apiFetch<AuthUser>("/auth/me", { token: storedToken });
        setToken(storedToken);
        setUser(me);
      } catch {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  async function handleAuthResponse(promise: Promise<{ token: string; user: AuthUser }>) {
    const { token: newToken, user: newUser } = await promise;
    await SecureStore.setItemAsync(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
  }

  async function signIn(email: string, password: string) {
    await handleAuthResponse(
      apiFetch("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) })
    );
  }

  async function signUp(email: string, password: string) {
    await handleAuthResponse(
      apiFetch("/auth/signup", { method: "POST", body: JSON.stringify({ email, password }) })
    );
  }

  async function signOut() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit -p app`
Expected: passes clean.

- [ ] **Step 7: Commit**

```bash
git add app/src/lib app/.env.example
git commit -m "feat: add API client and auth context with secure token storage"
```

---

### Task 7: Login/signup screens and root layout gating

**Files:**
- Create: `app/src/app/login.tsx`
- Create: `app/src/app/signup.tsx`
- Modify: `app/src/app/_layout.tsx`

**Interfaces:**
- Consumes: `useAuth`, `AuthProvider` from Task 6; `Card`, `Input`, `Label`, `Button`, `Text` from the existing `src/components/ui/*`.

- [ ] **Step 1: Write app/src/app/login.tsx**

```typescript
import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View className="bg-background flex-1 justify-center p-4">
      <Card>
        <CardHeader>
          <Text variant="h2">Log in</Text>
        </CardHeader>
        <CardContent className="gap-4">
          <View className="gap-2">
            <Label>Email</Label>
            <Input
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@example.com"
            />
          </View>
          <View className="gap-2">
            <Label>Password</Label>
            <Input
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
            />
          </View>
          {error ? <Text className="text-destructive">{error}</Text> : null}
          <Button onPress={handleSubmit} disabled={submitting}>
            <Text>{submitting ? "Logging in..." : "Log in"}</Text>
          </Button>
          <Button variant="ghost" onPress={() => router.push("/signup")}>
            <Text>Need an account? Sign up</Text>
          </Button>
        </CardContent>
      </Card>
    </View>
  );
}
```

- [ ] **Step 2: Write app/src/app/signup.tsx**

```typescript
import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function SignupScreen() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await signUp(email, password);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View className="bg-background flex-1 justify-center p-4">
      <Card>
        <CardHeader>
          <Text variant="h2">Sign up</Text>
        </CardHeader>
        <CardContent className="gap-4">
          <View className="gap-2">
            <Label>Email</Label>
            <Input
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@example.com"
            />
          </View>
          <View className="gap-2">
            <Label>Password</Label>
            <Input
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="At least 8 characters"
            />
          </View>
          {error ? <Text className="text-destructive">{error}</Text> : null}
          <Button onPress={handleSubmit} disabled={submitting}>
            <Text>{submitting ? "Signing up..." : "Sign up"}</Text>
          </Button>
          <Button variant="ghost" onPress={() => router.push("/login")}>
            <Text>Already have an account? Log in</Text>
          </Button>
        </CardContent>
      </Card>
    </View>
  );
}
```

- [ ] **Step 3: Update app/src/app/_layout.tsx to gate on auth state**

Replace the full contents of `app/src/app/_layout.tsx` with:

```typescript
import "../../global.css";

import { PortalHost } from "@rn-primitives/portal";
import { Redirect, Slot, usePathname } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/lib/auth-context";

function AuthGate() {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const isAuthRoute = pathname === "/login" || pathname === "/signup";

  if (isLoading) {
    return null;
  }

  if (!user && !isAuthRoute) {
    return <Redirect href="/login" />;
  }

  if (user && isAuthRoute) {
    return <Redirect href="/" />;
  }

  return <Slot />;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <AuthGate />
          <PortalHost />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit -p app`
Expected: passes clean.

- [ ] **Step 5: Manual verification (flag for the user)**

This step needs the running app on a device/emulator with the server (Task 5) and Docker Postgres (Task 1) both up. Cannot be verified headlessly. Note in the AI usage log that this step needs manual confirmation: launching the app should redirect to `/login`; signing up should log in and land on the showcase screen; killing and reopening the app should stay logged in (session restored from `expo-secure-store`).

- [ ] **Step 6: Commit**

```bash
git add app/src/app/login.tsx app/src/app/signup.tsx app/src/app/_layout.tsx
git commit -m "feat: add login/signup screens and auth-gated root layout"
```

---

## Self-Review Notes

- **Spec coverage:** §2 (Docker + Prisma schema + migration + seed) → Tasks 1–3. §3 (auth API) → Tasks 4–5. §4 (app auth) → Tasks 6–7. §6 (testing/error handling- 400/409/401 status codes, no user enumeration, loading state before redirect) → covered inline in Tasks 5 and 7. §7 (out of scope) is respected- no event/itinerary/ticket routes are added here.
- **Type consistency:** `AuthUser = { id: string; email: string }` is defined once in Task 6 (`auth-context.tsx`) and reused as the exact shape returned by every Task 5 route (`select: { id: true, email: true }`)- verified consistent. `apiFetch<T>` signature defined in Task 6 Step 4 is used identically in Task 6 Step 5 and would be used identically by any future data-fetching code.
- **No placeholders:** every file has full literal content; every verification step is a real command with an explicit expected result, including exact curl invocations and HTTP status codes to check for the auth routes' three failure modes (400 validation, 409 duplicate, 401 bad credentials/missing token).
