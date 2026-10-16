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

      -- Saved cards hold ONLY what card tokenisation leaves behind:
      -- brand, last four digits, expiry and name. The full number and
      -- the CVC are never written anywhere - not here, not to the
      -- server, not to the keychain. There is deliberately no column
      -- they could go in.
      CREATE TABLE IF NOT EXISTS saved_cards (
        id TEXT PRIMARY KEY NOT NULL,
        brand TEXT NOT NULL,
        last4 TEXT NOT NULL,
        expiry TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL
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
 * `getDb()` hands every caller the SAME connection and SQLite allows
 * one transaction per connection. The three data hooks mount together
 * and each cached its fetch, so their BEGIN/COMMIT pairs interleaved
 * and tore each other apart - the writes silently failed, which
 * disabled the offline cache entirely.
 *
 * `.catch(() => {})` on the tail is required: without it one failed
 * write poisons the chain and every later write rejects.
 *
 * Same fix as the in-flight locks in `getDb()` above and
 * `drainSyncQueue()` - a shared async resource with several callers.
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
