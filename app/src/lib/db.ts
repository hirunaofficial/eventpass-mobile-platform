import * as SQLite from "expo-sqlite";

let dbInstance: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Offline-first local store (design spec §9). Cache tables hold the last
 * successfully-fetched server data as JSON blobs (simple, correct, and
 * enough for read-while-offline- no need to normalize into per-field
 * columns for a cache whose only job is "show what we last knew").
 * sync_queue holds mutations made while offline, replayed in order once
 * connectivity returns (see sync-queue.ts).
 *
 * `use-events`/`use-itinerary`/`use-tickets` all call this independently
 * on mount, so multiple callers can race here before the first open
 * finishes. Without memoizing the in-flight promise (not just the
 * resolved instance), concurrent callers each open their own native
 * handle and run `CREATE TABLE` against the same file at once- on
 * Android this crashed with a native NullPointerException inside
 * execAsync. Mirrors the same in-flight-lock fix applied to
 * drainSyncQueue() in sync-queue.ts.
 */
export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const db = await SQLite.openDatabaseAsync("eventpass.db");
    await db.execAsync(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS events_cache (
        id TEXT PRIMARY KEY NOT NULL,
        data TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS itinerary_cache (
        id TEXT PRIMARY KEY NOT NULL,
        event_id TEXT NOT NULL,
        data TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tickets_cache (
        id TEXT PRIMARY KEY NOT NULL,
        data TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY NOT NULL,
        action TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at INTEGER NOT NULL
      );
    `);

    dbInstance = db;
    return db;
  })();

  return initPromise;
}

/**
 * Serializes write transactions against the single shared connection.
 *
 * `getDb()` deliberately hands every caller the SAME `SQLiteDatabase`
 * instance, and SQLite allows only one transaction per connection. The
 * three data hooks (`use-events`/`use-itinerary`/`use-tickets`) all
 * mount at once and each cache their fetch, so their
 * `withTransactionAsync` calls interleaved on that one connection and
 * tore each other's transactions apart:
 *
 *   hook A: BEGIN ................... COMMIT
 *   hook B:     BEGIN  -> "cannot start a transaction within a transaction"
 *               ROLLBACK -> "cannot rollback - no transaction is active"
 *
 * Both errors were observed together, alternating, on a real device.
 * The caching writes silently failed, which quietly disabled the
 * offline cache- the feature the local database exists for.
 *
 * The fix is a promise-chain mutex: each call waits for the previous
 * one to settle before opening its own transaction. `.catch(() => {})`
 * on the tail is important- without it one failed write would poison
 * the chain and every later write would reject.
 *
 * This is the same class of bug, and the same shape of fix, as the
 * in-flight locks already in `getDb()` above and in `drainSyncQueue()`:
 * a shared async resource with several independent callers on mount.
 *
 * `withExclusiveTransactionAsync` was considered instead- it opens a
 * second connection per transaction, which avoids the nesting but
 * trades it for lock contention between connections on the same file
 * (SQLITE_BUSY). Serializing on one connection avoids both.
 */
let writeChain: Promise<unknown> = Promise.resolve();

export function runInTransaction(task: () => Promise<void>): Promise<void> {
  const run = writeChain.then(async () => {
    const db = await getDb();
    await db.withTransactionAsync(task);
  });
  writeChain = run.catch(() => {});
  return run;
}
