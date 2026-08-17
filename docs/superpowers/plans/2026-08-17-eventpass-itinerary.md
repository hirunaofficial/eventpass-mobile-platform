# EventPass Itinerary & Clash-Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the assignment's required constraint-design algorithm as a real, tested `findClash()` function shared between client and server, and wire it into a full itinerary feature- add/remove/list- with server-side enforcement and client-side instant feedback.

**Architecture:** `findClash()` lives in `packages/shared` as a pure function (no I/O), imported unmodified by both `server` (as the authoritative check on `POST /itinerary`) and `app` (as an optimistic pre-check before the app even calls the server, so the user sees a clash dialog instantly). The server route is the source of truth; the app's check is UX only.

**Tech Stack:** TypeScript, Node's built-in `node:test`/`node:assert` (no new test-runner dependency), Express, Prisma, React Native Reusables `AlertDialog`.

**Spec:** `docs/superpowers/specs/2026-08-17-eventpass-itinerary-design.md`

## Global Constraints

- Native/Expo packages installed via `npx expo install`; everything else via `<package>@latest` (project convention, no new packages expected in this plan since `node:test` is built into Node).
- Git commits use Conventional Commits tags; no `Co-Authored-By` trailer (standing instruction for this project).
- Every task gets a real run-and-observe verification step- curl for API endpoints, `node --test` for the algorithm, `tsc --noEmit` for type-checking. No step is marked done on code inspection alone.
- Docker Postgres (`server-postgres-1`, `server-pgadmin-1`) is already running from the previous phase- reuse it, don't recreate.
- The server's shared Prisma client singleton is `server/src/lib/prisma.ts` (`export const prisma = new PrismaClient({ adapter })`)- every route imports this, never instantiates its own `PrismaClient`.

---

## File Structure

```
packages/shared/
  src/
    clash.ts                 # findClash()- pure constraint algorithm
    clash.test.ts             # node:test suite
  package.json                 # add "test": "node --test --import tsx src/clash.test.ts"
server/
  src/
    routes/
      itinerary.ts             # GET/POST /itinerary, DELETE /itinerary/:eventId
    index.ts                    # mounts /itinerary
app/
  src/
    lib/
      use-itinerary.ts          # addToItinerary/removeFromItinerary/items/refresh
    app/
      index.tsx                  # EventCard gets an "Add" button + clash AlertDialog
      itinerary.tsx               # new: My Itinerary screen
```

---

### Task 1: `findClash()` constraint algorithm with tests

**Files:**
- Create: `packages/shared/src/clash.ts`
- Create: `packages/shared/src/clash.test.ts`
- Modify: `packages/shared/package.json` (add `test` script and `tsx` devDependency)
- Modify: `packages/shared/src/index.ts` (re-export `findClash`, `ClashCheckEvent`, `ClashReason`)

**Interfaces:**
- Produces: `findClash(candidate: ClashCheckEvent, existingItems: ClashCheckEvent[]): ClashReason | null`- imported unmodified by Task 2 (server) and Task 3 (app hook).
- Produces: `export interface ClashCheckEvent { id: string; startsAt: string; endsAt: string; venue: { lat: number; lng: number } }`.
- Produces: `export type ClashReason = { type: "time_overlap"; withEventId: string } | { type: "insufficient_travel_time"; withEventId: string; neededMinutes: number; availableMinutes: number }`.

- [ ] **Step 1: Write packages/shared/src/clash.ts**

```typescript
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

function haversineDistanceKm(
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
```

- [ ] **Step 2: Write packages/shared/src/clash.test.ts**

```typescript
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
```

- [ ] **Step 3: Add the test script and tsx devDependency**

Edit `packages/shared/package.json`, adding to `"scripts"`:
```json
"test": "node --import tsx --test src/clash.test.ts"
```

Run: `npm install tsx@latest -w packages/shared --save-dev`

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npm run test -w packages/shared`
Expected: 5 tests pass, 0 failures.

- [ ] **Step 5: Re-export from packages/shared/src/index.ts**

Edit `packages/shared/src/index.ts`, adding at the end:
```typescript
export { findClash } from "./clash.js";
export type { ClashCheckEvent, ClashReason } from "./clash.js";
```

- [ ] **Step 6: Type-check**

Run: `npm run type-check -w packages/shared`
Expected: passes clean.

- [ ] **Step 7: Commit**

```bash
git add packages/shared
git commit -m "feat: add findClash constraint-detection algorithm with tests"
```

---

### Task 2: Server itinerary routes

**Files:**
- Create: `server/src/routes/itinerary.ts`
- Modify: `server/src/index.ts` (mount `/itinerary`)

**Interfaces:**
- Consumes: `findClash`, `ClashCheckEvent` from `@eventpass/shared` (Task 1); `prisma` singleton from `server/src/lib/prisma.ts`; `requireAuth` from `server/src/middleware/auth.ts`.
- Produces: `GET /itinerary`, `POST /itinerary`, `DELETE /itinerary/:eventId`- the exact contract Task 3's `use-itinerary.ts` calls against.

- [ ] **Step 1: Write server/src/routes/itinerary.ts**

```typescript
import { Router } from "express";
import { z } from "zod";
import { findClash, type ClashCheckEvent } from "@eventpass/shared";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const items = await prisma.itineraryItem.findMany({
    where: { userId: req.userId },
    include: { event: { include: { venue: true } } },
    orderBy: { event: { startsAt: "asc" } },
  });
  res.json(items);
});

const addItemSchema = z.object({ eventId: z.string() });

router.post("/", requireAuth, async (req, res) => {
  const parsed = addItemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const { eventId } = parsed.data;

  const candidateEvent = await prisma.event.findUnique({
    where: { id: eventId },
    include: { venue: true },
  });
  if (!candidateEvent) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const existingItems = await prisma.itineraryItem.findMany({
    where: { userId: req.userId },
    include: { event: { include: { venue: true } } },
  });

  const candidate: ClashCheckEvent = {
    id: candidateEvent.id,
    startsAt: candidateEvent.startsAt.toISOString(),
    endsAt: candidateEvent.endsAt.toISOString(),
    venue: { lat: candidateEvent.venue.lat, lng: candidateEvent.venue.lng },
  };
  const existing: ClashCheckEvent[] = existingItems.map((item) => ({
    id: item.event.id,
    startsAt: item.event.startsAt.toISOString(),
    endsAt: item.event.endsAt.toISOString(),
    venue: { lat: item.event.venue.lat, lng: item.event.venue.lng },
  }));

  const clash = findClash(candidate, existing);
  if (clash) {
    res.status(409).json({ error: "This event clashes with your itinerary", clash });
    return;
  }

  const created = await prisma.itineraryItem.create({
    data: { userId: req.userId!, eventId },
    include: { event: { include: { venue: true } } },
  });
  res.status(201).json(created);
});

router.delete("/:eventId", requireAuth, async (req, res) => {
  await prisma.itineraryItem.deleteMany({
    where: { userId: req.userId, eventId: req.params.eventId },
  });
  res.status(204).send();
});

export default router;
```

- [ ] **Step 2: Mount the router in server/src/index.ts**

Edit `server/src/index.ts`, adding the import:
```typescript
import itineraryRouter from "./routes/itinerary.js";
```
and the mount (next to the existing `app.use("/events", eventsRouter);`):
```typescript
app.use("/itinerary", itineraryRouter);
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check -w server`
Expected: passes clean.

- [ ] **Step 4: Smoke-test the full flow**

Start the server: `npm run dev -w server &` (background), wait ~2s. Then, using a token from the existing test user (log in again if needed):
```bash
TOKEN=$(curl -s -X POST http://localhost:4000/auth/login -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"password123"}' | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")
EVENT_ID=$(curl -s http://localhost:4000/events -H "Authorization: Bearer $TOKEN" | python3 -c "import json,sys; print(json.load(sys.stdin)[0]['id'])")
curl -s -i -X POST http://localhost:4000/itinerary -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"eventId\":\"$EVENT_ID\"}"
```
Expected: HTTP 201, JSON with the created itinerary item including `event.venue`.

- [ ] **Step 5: Smoke-test the clash rejection**

Get a second event's ID and try adding it if (per the seed data) it overlaps or is too close to the first- using the seed data's "Colombo Tech Meetup" (Independence Arcade) and "Startup Pitch Night" (also Independence Arcade, different day, no clash expected) won't clash; instead verify clash detection by adding the SAME event twice isn't the right test either (no time delta). Instead: fetch all events, pick two that are seeded close together- use "Acoustic Night Live" and "Jazz & Poetry Evening" (both at Barefoot Garden Cafe, several days apart per seed data- no clash expected either). Since the seed data doesn't include a deliberately-clashing pair, verify the 409 path with a synthetic case:
```bash
curl -s -i -X POST http://localhost:4000/itinerary -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"eventId\":\"$EVENT_ID\"}"
```
(adding the exact same event again- it's still in the user's itinerary, so its own time range trivially overlaps itself)
Expected: HTTP 409, body includes `"clash":{"type":"time_overlap", ...}`.

- [ ] **Step 6: Smoke-test GET and DELETE**

```bash
curl -s http://localhost:4000/itinerary -H "Authorization: Bearer $TOKEN"
curl -s -i -X DELETE "http://localhost:4000/itinerary/$EVENT_ID" -H "Authorization: Bearer $TOKEN"
curl -s http://localhost:4000/itinerary -H "Authorization: Bearer $TOKEN"
```
Expected: first GET shows 1 item; DELETE returns 204; second GET shows an empty array.

- [ ] **Step 7: Stop the background dev server**

Run: `kill %1` (or find and kill the `tsx` process).

- [ ] **Step 8: Commit**

```bash
git add server/src/routes/itinerary.ts server/src/index.ts
git commit -m "feat: add itinerary API with server-side clash enforcement"
```

---

### Task 3: App itinerary hook

**Files:**
- Create: `app/src/lib/use-itinerary.ts`

**Interfaces:**
- Consumes: `apiFetch` from `app/src/lib/api.ts`; `useAuth` from `app/src/lib/auth-context.tsx`; `findClash` from `@eventpass/shared` (Task 1).
- Produces: `useItinerary(): { items: ItineraryItemWithEvent[]; isLoading: boolean; error: string | null; refresh: () => Promise<void>; addToItinerary: (event: EventWithVenue) => Promise<{ ok: true } | { ok: false; reason: ClashReason }>; removeFromItinerary: (eventId: string) => Promise<void> }`- consumed by Task 4 (Discover screen) and Task 5 (itinerary screen).

- [ ] **Step 1: Write app/src/lib/use-itinerary.ts**

```typescript
import { useCallback, useEffect, useState } from "react";
import type { ClashReason, EventWithVenue, ItineraryItem } from "@eventpass/shared";
import { findClash } from "@eventpass/shared";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export type ItineraryItemWithEvent = ItineraryItem & { event: EventWithVenue };

type AddResult = { ok: true } | { ok: false; reason: ClashReason };

export function useItinerary() {
  const { token } = useAuth();
  const [items, setItems] = useState<ItineraryItemWithEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const data = await apiFetch<ItineraryItemWithEvent[]>("/itinerary", { token });
      setItems(data);
    } catch {
      setError("Couldn't load your itinerary.");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function addToItinerary(event: EventWithVenue): Promise<AddResult> {
    const existing = items.map((item) => ({
      id: item.event.id,
      startsAt: item.event.startsAt,
      endsAt: item.event.endsAt,
      venue: { lat: item.event.venue.lat, lng: item.event.venue.lng },
    }));
    const candidate = {
      id: event.id,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      venue: { lat: event.venue.lat, lng: event.venue.lng },
    };

    const localClash = findClash(candidate, existing);
    if (localClash) {
      return { ok: false, reason: localClash };
    }

    try {
      await apiFetch("/itinerary", {
        method: "POST",
        token,
        body: JSON.stringify({ eventId: event.id }),
      });
      await refresh();
      return { ok: true };
    } catch {
      return {
        ok: false,
        reason: { type: "time_overlap", withEventId: event.id },
      };
    }
  }

  async function removeFromItinerary(eventId: string) {
    await apiFetch(`/itinerary/${eventId}`, { method: "DELETE", token });
    await refresh();
  }

  return { items, isLoading, error, refresh, addToItinerary, removeFromItinerary };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p app`
Expected: passes clean.

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/use-itinerary.ts
git commit -m "feat: add useItinerary hook with optimistic client-side clash check"
```

---

### Task 4: "Add to itinerary" on the Discover screen with clash dialog

**Files:**
- Modify: `app/src/app/index.tsx`

**Interfaces:**
- Consumes: `useItinerary` from Task 3; `AlertDialog` family from `@/components/ui/alert-dialog`.

- [ ] **Step 1: Add the itinerary hook and clash-dialog state to Index**

Edit `app/src/app/index.tsx`: add the import
```typescript
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useItinerary } from "@/lib/use-itinerary";
import type { ClashReason, EventWithVenue } from "@eventpass/shared";
import { useState } from "react";
```

Inside the `Index` component, add:
```typescript
const { addToItinerary } = useItinerary();
const [clashInfo, setClashInfo] = useState<{ event: EventWithVenue; reason: ClashReason } | null>(null);

async function handleAdd(event: EventWithVenue) {
  const result = await addToItinerary(event);
  if (!result.ok) {
    setClashInfo({ event, reason: result.reason });
  }
}

function clashMessage(reason: ClashReason): string {
  if (reason.type === "time_overlap") {
    return "This event overlaps with something already in your itinerary.";
  }
  return `You'd only have ${reason.availableMinutes} min to travel between venues, but need about ${reason.neededMinutes} min.`;
}
```

- [ ] **Step 2: Pass an onAdd handler into EventCard and render the "Add" button**

Edit the `EventCard` function signature to accept `onAdd`:
```typescript
function EventCard({ event, onAdd }: { event: EventWithVenue; onAdd: (event: EventWithVenue) => void }) {
```

Add a `CardFooter` with the Add button- import `CardFooter` alongside the existing `Card`/`CardContent`/`CardHeader` import, and add after the existing `CardContent` block inside the returned JSX:
```typescript
<CardFooter className="justify-end">
  <Button size="sm" onPress={() => onAdd(event)}>
    <Text>Add to itinerary</Text>
  </Button>
</CardFooter>
```
(add `import { Button } from "@/components/ui/button";` if not already present- it is not, in the current `index.tsx`)

Update the `renderItem` call site to pass the handler:
```typescript
renderItem={({ item }) => <EventCard event={item} onAdd={handleAdd} />}
```

- [ ] **Step 3: Render the clash AlertDialog at the bottom of Index's JSX, controlled by clashInfo**

Add just before the closing `</View>` of the outer container:
```typescript
<AlertDialog open={clashInfo !== null} onOpenChange={(open) => !open && setClashInfo(null)}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Can't add this event</AlertDialogTitle>
      <AlertDialogDescription>
        {clashInfo ? clashMessage(clashInfo.reason) : ""}
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogAction onPress={() => setClashInfo(null)}>
      <Text>OK</Text>
    </AlertDialogAction>
  </AlertDialogContent>
</AlertDialog>
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit -p app`
Expected: passes clean.

- [ ] **Step 5: Manual verification (flag for the user)**

Needs the app running on device/emulator with server + Docker DB up. Cannot be verified headlessly. Note in the AI usage log: tapping "Add to itinerary" on an event should add it silently (no dialog) the first time; tapping "Add to itinerary" again on the *same* event should show the clash dialog (self-overlap, matching the server smoke test in Task 2 Step 5).

- [ ] **Step 6: Commit**

```bash
git add app/src/app/index.tsx
git commit -m "feat: add itinerary button and clash dialog to Discover screen"
```

---

### Task 5: My Itinerary screen

**Files:**
- Create: `app/src/app/itinerary.tsx`

**Interfaces:**
- Consumes: `useItinerary` from Task 3.

- [ ] **Step 1: Write app/src/app/itinerary.tsx**

```typescript
import { CalendarDays, MapPin, Trash2 } from "lucide-react-native";
import { FlatList, RefreshControl, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useItinerary, type ItineraryItemWithEvent } from "@/lib/use-itinerary";

function formatEventTime(startsAt: string) {
  return new Date(startsAt).toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function ItineraryCard({
  item,
  onRemove,
}: {
  item: ItineraryItemWithEvent;
  onRemove: (eventId: string) => void;
}) {
  return (
    <Card className="mb-3">
      <CardHeader className="flex-row items-center gap-3">
        <View className="bg-primary h-10 w-10 items-center justify-center rounded-full">
          <Icon as={CalendarDays} size={18} className="text-primary-foreground" />
        </View>
        <View className="flex-1">
          <Text variant="large">{item.event.title}</Text>
          <View className="flex-row items-center gap-1">
            <Icon as={MapPin} size={12} className="text-muted-foreground" />
            <Text variant="muted">{item.event.venue.name}</Text>
          </View>
        </View>
      </CardHeader>
      <CardContent>
        <Text variant="muted">{formatEventTime(item.event.startsAt)}</Text>
      </CardContent>
      <CardFooter className="justify-end">
        <Button variant="ghost" size="sm" onPress={() => onRemove(item.event.id)}>
          <Icon as={Trash2} size={16} className="text-destructive" />
          <Text className="text-destructive">Remove</Text>
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function ItineraryScreen() {
  const { items, isLoading, error, refresh, removeFromItinerary } = useItinerary();

  return (
    <View className="bg-background flex-1">
      <View className="border-border border-b px-4 pb-3 pt-16">
        <Text variant="h4">My Itinerary</Text>
      </View>

      <View className="flex-1 px-4">
        {error ? <Text className="text-destructive mb-2 mt-2">{error}</Text> : null}

        {!isLoading && items.length === 0 ? (
          <Text variant="muted" className="mt-4">
            Nothing here yet- add events from Discover.
          </Text>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ItineraryCard item={item} onRemove={removeFromItinerary} />
            )}
            contentContainerStyle={{ paddingTop: 12, paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} />}
          />
        )}
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p app`
Expected: passes clean.

- [ ] **Step 3: Full workspace type-check**

Run: `npm run type-check`
Expected: all three workspaces pass clean.

- [ ] **Step 4: Manual verification (flag for the user)**

Needs the app running on device/emulator. Navigate to `/itinerary` (no nav link exists yet- reachable via `router.push("/itinerary")` from a debug action, or directly by typing the URL in Expo's dev menu) and confirm items added on Discover appear here, and Remove actually removes them (refetch confirms).

- [ ] **Step 5: Commit**

```bash
git add app/src/app/itinerary.tsx
git commit -m "feat: add My Itinerary screen"
```

---

## Self-Review Notes

- **Spec coverage:** §2 (algorithm) → Task 1, with the exact function from the spec plus a real test suite (spec's §6 testing requirement). §3 (server API) → Task 2, including the server-as-source-of-truth requirement. §4 (app) → Tasks 3–5. §7 (out of scope) respected- no `<ItineraryTimeline>`, no live GPS, no offline queueing added here.
- **Type consistency:** `ClashCheckEvent`/`ClashReason` defined once in Task 1, imported unmodified in Task 2 (server) and Task 3 (app). `ItineraryItemWithEvent` defined once in Task 3, reused in Tasks 4–5.
- **No placeholders:** every file has full literal content. Task 2 Step 5's clash smoke-test uses a slightly unusual but concrete and correct approach (re-adding the same event to itself) since the seed data has no deliberately-clashing pair- documented inline why, not left vague.
- **Note:** Task 4 doesn't add a navigation entry point to reach `/itinerary` (no tab bar/nav menu exists yet in the app)- this is intentionally out of scope here (navigation chrome is a separate concern) but is why Task 5's manual verification calls out `router.push` as the way to reach it for now.
