# EventPass — Architecture and Data Flow

How the application is structured, how data moves between layers, and
why the source is organised the way it is.

---

## 1. Layers

The app follows the layered model taught in the module: presentation
sits on top of business logic, which sits on data access, with
cross-cutting concerns running through all three.

```
┌──────────────────────────────────────────────────────────────┐
│ PRESENTATION           app/src/app/**      screens (routes)  │
│                        app/src/components  views             │
├──────────────────────────────────────────────────────────────┤
│ BUSINESS               app/src/lib/use-*.ts     hooks        │
│   the "ViewModel"      app/src/lib/auth-context.tsx          │
├──────────────────────────────────────────────────────────────┤
│ DATA ACCESS            app/src/lib/api.ts    network         │
│                        app/src/lib/cache.ts  SQLite          │
│                        app/src/lib/db.ts     connection      │
│                        app/src/lib/sync-queue.ts             │
└──────────────────────────────────────────────────────────────┘
                              │  HTTP + JWT
┌──────────────────────────────────────────────────────────────┐
│ ROUTES                 server/src/routes/*.ts                │
│ MIDDLEWARE             server/src/middleware/auth.ts         │
│ DATA ACCESS            server/src/lib/prisma.ts → PostgreSQL │
└──────────────────────────────────────────────────────────────┘

        packages/shared  ── types + constraint algorithm ──
                 imported by BOTH sides, unmodified
```

**The rule that keeps the layers honest:** a screen never calls
`fetch`. It calls a hook. The hook is the only thing that knows whether
data came from the network or the cache, and `api.ts` is the only file
in the app that touches the network at all. That single chokepoint is
why error handling, auth headers and the 401 logout path exist in one
place rather than scattered across screens.

---

## 2. Data flow — three traces

### 2.1 A read: opening Discover

```
Discover screen mounts
   │
   └─ useEvents()
        ├─ apiFetch("/events", { token })        ← Data layer
        │     │
        │     └─→ Express: requireAuth (verify JWT)
        │            └─→ Prisma: events + venue joined
        │                   └─→ PostgreSQL
        │     ←──────────── 200 [EventWithVenue]
        │
        ├─ setEvents(data)                       → screen re-renders
        └─ cacheEvents(data)                     → SQLite, for offline

   on network failure:
        └─ getCachedEvents()  → setEvents(cached), setIsOffline(true)
```

The cache write is wrapped in its **own** try/catch, separate from the
fetch. If the fetch succeeded but the cache write failed, a shared catch
block would reload stale cached data over the fresh data already on
screen, and wrongly flag the app as offline.

### 2.2 A constrained write: adding to the itinerary

This is the most interesting path, because the same rule is enforced
twice on purpose.

```
User taps "Add to plan"
   │
   └─ useItinerary().addToItinerary(event, catalogue)
        │
        ├─ findClash(candidate, existing)        ← runs LOCALLY first
        │     │                                    (packages/shared)
        │     ├─ clash? → suggestAlternatives(...)
        │     │            └─ return { ok:false, reason, resolutions }
        │     │               → ClashResolutionSheet opens
        │     │                 (no network call was ever made)
        │     └─ no clash ↓
        │
        └─ apiFetch POST /itinerary
              └─→ requireAuth → zod validate
                    └─→ findClash(...)           ← AUTHORITATIVE
                          ├─ clash → 409 { clash, resolutions }
                          └─ ok    → Prisma insert → 201
```

**Why check twice.** The client copy gives instant feedback with no
round-trip — the user sees a clash explained before a request would
even have left the device. The server copy is the guarantee: another
device could have changed the itinerary since this client last synced.
Both call *literally the same function*, imported from
`packages/shared`, so they cannot drift apart. The server also
recomputes the repair suggestions from a fresh catalogue read, because
a client working from a stale cache could otherwise propose an
alternative that is no longer valid.

### 2.3 An offline write: store and forward

```
User adds an event while offline
   │
   └─ addToItinerary()
        ├─ findClash() locally → passes
        ├─ apiFetch(...) → throws (network unreachable)
        │
        └─ catch: not an ApiError, so this is offline, not rejection
             ├─ setItems([...items, optimisticItem])   → UI updates now
             ├─ cacheItinerary(next)                   → survives restart
             └─ enqueueSyncAction("add_itinerary", …)  → sync_queue table

… later, connectivity returns …

   NetInfo fires  → useNetworkStatus → drainSyncQueue(token)
        │
        └─ for each pending row, in order:
             ├─ replay the API call
             ├─ 2xx            → delete the row
             ├─ ApiError (4xx) → mark 'conflict'   (e.g. sold out)
             └─ network error  → leave 'pending'   (try again later)

   conflicts surface via SyncConflictNotice, mounted once at the root
```

Distinguishing a **real server rejection** from **the network dropping
again mid-drain** matters: the first is a permanent conflict the user
must be told about, the second must stay pending. Conflating them would
either spam false conflicts or silently lose queued work.

---

## 3. Why the source is organised this way

### 3.1 A monorepo with three workspaces

```
eventpass-mobile-platform/
├── app/              Expo client
├── server/           Express API
├── packages/shared/  types + constraint algorithm
└── tools/            artwork generator
```

- **One repository** because the submission is a single GitHub link,
  and as a solo project the app and server have no independent release
  cadence. The usual reason to split repos does not apply.
- **`packages/shared` exists for one specific reason**: the API
  contract and the constraint rules must not drift. The server builds
  responses from these types and the client consumes them, so renaming
  a field breaks the build on *both* sides immediately rather than
  failing silently at runtime.
- Plain npm workspaces, not Turborepo or Nx — at three packages, the
  extra tooling would cost more than it returns.

### 3.2 Inside the app

```
app/src/
├── app/            Expo Router — the directory tree IS the nav graph
│   ├── (tabs)/     attendee shell: index, itinerary, tickets, profile
│   ├── event/[id]  detail
│   ├── login | signup | staff-login
│   └── scan.tsx    staff-only scanner
├── components/     first-party components
│   └── ui/         copy-owned primitives (source in repo, not a dep)
├── lib/            business + data layers
└── assets/         self-authored artwork
```

File-based routing means the folder structure documents the navigation
without a separate config to keep in sync. Everything that is not a
screen lives in `lib/`, which keeps screens thin and declarative — a
screen holds view state (which dialog is open, the search text) and
nothing else.

`components/ui/` holds *copied* component source rather than an npm
dependency. That was deliberate: every component can be read, edited
and explained, with no opaque library behaviour to account for.

### 3.3 Inside the server

```
server/src/
├── index.ts          app entry, middleware order, error handlers
├── middleware/auth   requireAuth, requireStaff, signToken
├── lib/prisma.ts     one shared client = one connection pool
└── routes/           one file per resource
```

Adding a feature is: a new file in `routes/`, one mount line in
`index.ts`. Every route follows the same shape — validate with zod,
return `400` with field errors on failure, only then touch the
database.

---

## 4. Cross-cutting concerns

| Concern | Where it lives |
|---|---|
| **Authentication** | JWT signed server-side with the role embedded, so `requireStaff` authorises without a database lookup. Stored client-side in the secure enclave via `expo-secure-store` |
| **Authorisation** | `requireAuth` → `requireStaff` chained as middleware. `AuthGate` mirrors it in the UI so staff never see a screen they cannot use |
| **Error handling** | `apiFetch` throws a typed `ApiError` on non-2xx and flattens zod field errors into readable text. Express has a catch-all 404 and error handler so every failure returns the same `{ error }` shape |
| **Offline** | SQLite cache + `sync_queue`, drained on the real reconnect event rather than a poll timer |
| **Concurrency** | Atomic guarded updates server-side (`updateMany` with a condition) prevent overselling and double check-in. Client-side, shared async resources are serialised behind in-flight locks |
| **Configuration** | `.env` per workspace, gitignored, with committed `.env.example` templates |

---

## 5. Concurrency: one pattern, three times

Three separate bugs in this project had the same shape — a shared
async resource with several independent callers starting at once, and
no serialisation. All three were fixed the same way: memoise the
**in-flight promise**, not just the resolved value.

| Where | Symptom |
|---|---|
| `getDb()` | Three hooks each opened their own SQLite handle on first launch and ran `CREATE TABLE` concurrently — native crash on Android |
| `drainSyncQueue()` | Two hooks reacting to one reconnect event could double-process a queued purchase |
| `runInTransaction()` | Three cache writes opened transactions on one shared connection, which permits only one — offline caching silently never worked |

Worth stating plainly: "each hook is self-contained" stops being true
the moment hooks share a resource.

---

## 6. Data model

```
User ──┬─< Ticket >── Event >── Venue
       └─< ItineraryItem >──┘
```

`ItineraryItem` is **intent to attend** — what the constraint algorithm
operates on. `Ticket` is **a purchase**. They are deliberately separate:
buying a ticket does not commit you to a schedule (you might be buying
for a friend), and planning to attend does not require paying. Merging
them would have made the clash rules ambiguous for no benefit.
