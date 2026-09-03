import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import type { DatabaseSync } from "node:sqlite";
import type { UserContextHealth } from "./types";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");

const CONTEXT_DIR = path.join(CONFIG_DIR, "context");
export const USER_CONTEXT_DB_FILE = path.join(CONTEXT_DIR, "user-context.sqlite");
export const USER_CONTEXT_SCHEMA_VERSION = 3;

const g = globalThis as typeof globalThis & {
  __movvizUserContextDb?: DatabaseSync | null;
  __movvizUserContextDbInitialized?: boolean;
  __movvizUserContextDbError?: string | null;
};

function isContextEngineDisabled(): boolean {
  return /^(?:1|true|yes|on)$/i.test((process.env.MOVVIZ_CONTEXT_ENGINE_DISABLED ?? "").trim());
}

function setError(error: unknown): void {
  g.__movvizUserContextDbError = error instanceof Error ? error.message : String(error);
}

function loadDatabaseSync(): (new (path: string) => DatabaseSync) | null {
  try {
    const runtimeRequire = createRequire(path.join(process.cwd(), "package.json"));
    const sqlite = runtimeRequire("node:sqlite") as { DatabaseSync?: new (path: string) => DatabaseSync };
    return typeof sqlite.DatabaseSync === "function" ? sqlite.DatabaseSync : null;
  } catch (error) {
    setError(error);
    return null;
  }
}

function ensureSchema(db: DatabaseSync): void {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA busy_timeout = 5000;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS context_schema (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS context_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      source TEXT NOT NULL,
      tmdb_id INTEGER,
      media_type TEXT,
      season_number INTEGER,
      episode_number INTEGER,
      media_id TEXT,
      rating_key TEXT,
      title_snapshot TEXT,
      position_ms INTEGER,
      duration_ms INTEGER,
      numeric_value REAL,
      text_value TEXT,
      occurred_at INTEGER NOT NULL,
      recorded_at INTEGER NOT NULL,
      source_event_id TEXT,
      payload_json TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_context_events_user_date
      ON context_events(user_id, occurred_at DESC);

    CREATE INDEX IF NOT EXISTS idx_context_events_user_type_date
      ON context_events(user_id, event_type, occurred_at DESC);

    CREATE INDEX IF NOT EXISTS idx_context_events_user_tmdb
      ON context_events(user_id, tmdb_id, media_type, occurred_at DESC);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_context_events_source_event
      ON context_events(source, source_event_id)
      WHERE source_event_id IS NOT NULL;

    CREATE TABLE IF NOT EXISTS user_media_state (
      state_key TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      tmdb_id INTEGER NOT NULL,
      media_type TEXT NOT NULL,
      media_id TEXT,
      rating_key TEXT,
      title_snapshot TEXT,
      season_number INTEGER,
      episode_number INTEGER,
      position_ms INTEGER,
      duration_ms INTEGER,
      progress_ratio REAL,
      eligible_for_resume INTEGER NOT NULL DEFAULT 0,
      watched INTEGER NOT NULL DEFAULT 0,
      started_at INTEGER,
      last_played_at INTEGER,
      watched_at INTEGER,
      updated_at INTEGER NOT NULL,
      source_revision INTEGER,
      progress_updated_at INTEGER,
      progress_source TEXT,
      watched_updated_at INTEGER,
      watched_source TEXT,
      rating_value REAL,
      rating_updated_at INTEGER,
      rating_source TEXT,
      watchlist_present INTEGER,
      watchlist_updated_at INTEGER,
      watchlist_source TEXT,
      watchlist_added_at INTEGER,
      watchlist_removed_at INTEGER,
      plex_guid TEXT,
      plex_discover_rating_key TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_user_media_state_user_updated
      ON user_media_state(user_id, updated_at DESC);

    CREATE INDEX IF NOT EXISTS idx_user_media_state_user_tmdb
      ON user_media_state(user_id, tmdb_id, media_type);

    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id TEXT NOT NULL,
      dimension TEXT NOT NULL,
      pref_key TEXT NOT NULL,
      label TEXT NOT NULL,
      affinity REAL NOT NULL,
      confidence REAL NOT NULL,
      source TEXT NOT NULL,
      tmdb_id INTEGER,
      media_type TEXT,
      evidence_count INTEGER NOT NULL DEFAULT 1,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY(user_id, dimension, pref_key)
    );

    CREATE INDEX IF NOT EXISTS idx_user_preferences_user_updated
      ON user_preferences(user_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS context_sync_state (
      source TEXT NOT NULL,
      user_id TEXT NOT NULL,
      cursor TEXT,
      last_synced_at INTEGER,
      last_success_at INTEGER,
      last_error TEXT,
      PRIMARY KEY(source, user_id)
    );

    CREATE TABLE IF NOT EXISTS user_media_sync_state (
      user_id TEXT NOT NULL,
      state_key TEXT NOT NULL,
      field TEXT NOT NULL,
      target TEXT NOT NULL,
      capability TEXT NOT NULL DEFAULT 'PENDING',
      last_observed_at INTEGER,
      last_applied_at INTEGER,
      last_ack_at INTEGER,
      last_remote_hash TEXT,
      last_error TEXT,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY(user_id, state_key, field, target)
    );

    CREATE INDEX IF NOT EXISTS idx_user_media_sync_pending
      ON user_media_sync_state(target, capability, updated_at);
  `);

  // v2 databases already have the table, so CREATE TABLE cannot add the
  // field-level clocks required by v3. Keep this migration idempotent.
  const columns = new Set((db.prepare("PRAGMA table_info(user_media_state)").all() as Array<{ name: string }>).map((row) => row.name));
  const additions: Array<[string, string]> = [
    ["progress_updated_at", "INTEGER"], ["progress_source", "TEXT"],
    ["watched_updated_at", "INTEGER"], ["watched_source", "TEXT"],
    ["rating_value", "REAL"], ["rating_updated_at", "INTEGER"], ["rating_source", "TEXT"],
    ["watchlist_present", "INTEGER"], ["watchlist_updated_at", "INTEGER"],
    ["watchlist_source", "TEXT"], ["watchlist_added_at", "INTEGER"], ["watchlist_removed_at", "INTEGER"],
    ["plex_guid", "TEXT"], ["plex_discover_rating_key", "TEXT"],
  ];
  for (const [name, type] of additions) {
    if (!columns.has(name)) db.exec(`ALTER TABLE user_media_state ADD COLUMN ${name} ${type}`);
  }

  const existing = db.prepare("SELECT version FROM context_schema WHERE version = ?").get(USER_CONTEXT_SCHEMA_VERSION);
  if (!existing) {
    db.prepare("INSERT INTO context_schema(version, applied_at) VALUES(?, ?)").run(USER_CONTEXT_SCHEMA_VERSION, Date.now());
  }
}

export function getUserContextDb(): DatabaseSync | null {
  if (g.__movvizUserContextDbInitialized) return g.__movvizUserContextDb ?? null;
  g.__movvizUserContextDbInitialized = true;

  // Emergency rollback switch: disabling the new Context Engine must restore
  // the legacy Movviz behavior without touching/deleting the SQLite file.
  // Every caller already treats a null DB as best-effort unavailable and
  // falls back to the existing watch/progress/profile stores.
  if (isContextEngineDisabled()) {
    g.__movvizUserContextDb = null;
    g.__movvizUserContextDbError = null;
    return null;
  }

  const Database = loadDatabaseSync();
  if (!Database) {
    g.__movvizUserContextDb = null;
    return null;
  }

  try {
    fs.mkdirSync(CONTEXT_DIR, { recursive: true });
    const db = new Database(USER_CONTEXT_DB_FILE);
    ensureSchema(db);
    g.__movvizUserContextDb = db;
    g.__movvizUserContextDbError = null;
    return db;
  } catch (error) {
    setError(error);
    g.__movvizUserContextDb = null;
    return null;
  }
}

export function withUserContextDb<T>(fn: (db: DatabaseSync) => T, fallback: T): T {
  const db = getUserContextDb();
  if (!db) return fallback;
  try {
    return fn(db);
  } catch (error) {
    setError(error);
    return fallback;
  }
}

export function getUserContextHealth(): UserContextHealth {
  const db = getUserContextDb();
  return {
    database: db ? "ok" : g.__movvizUserContextDbError ? "error" : "unavailable",
    schemaVersion: USER_CONTEXT_SCHEMA_VERSION,
    file: USER_CONTEXT_DB_FILE,
    lastError: g.__movvizUserContextDbError ?? null,
  };
}
