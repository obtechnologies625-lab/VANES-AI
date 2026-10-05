CREATE TABLE IF NOT EXISTS vanes_users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 anonymous_id TEXT NOT NULL UNIQUE,
 user_name TEXT,
 level TEXT,
 combination TEXT,
 first_seen_at TEXT NOT NULL,
 last_seen_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vanes_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 anonymous_id TEXT NOT NULL,
 user_name TEXT,
 event TEXT NOT NULL,
 payload TEXT,
 created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vanes_quota (
 uid TEXT PRIMARY KEY,
 period_start INTEGER NOT NULL,
 used INTEGER NOT NULL DEFAULT 0,
 premium INTEGER NOT NULL DEFAULT 0,
 premium_code TEXT,
 updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vanes_events_anonymous_id ON vanes_events(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_vanes_events_event ON vanes_events(event);
CREATE INDEX IF NOT EXISTS idx_vanes_events_created_at ON vanes_events(created_at);
CREATE INDEX IF NOT EXISTS idx_vanes_users_name ON vanes_users(user_name);
