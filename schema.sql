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

CREATE TABLE IF NOT EXISTS vanes_payments (
 reference TEXT PRIMARY KEY,
 uid TEXT,
 phone TEXT,
 amount INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'PENDING',
 provider TEXT NOT NULL DEFAULT 'airtel',
 airtel_id TEXT,
 code TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vanes_code_counter (
 id INTEGER PRIMARY KEY CHECK (id=1),
 count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS vanes_payment_claims (
 id TEXT PRIMARY KEY,
 uid TEXT NOT NULL,
 image_hash TEXT NOT NULL UNIQUE,
 txn_id TEXT,
 amount INTEGER,
 payer_name TEXT,
 recipient TEXT,
 model TEXT,
 verdict TEXT NOT NULL,
 reason TEXT,
 code TEXT,
 created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vanes_premium_codes (
 code TEXT PRIMARY KEY,
 counter INTEGER NOT NULL DEFAULT 0,
 source TEXT,
 order_ref TEXT,
 issued_at TEXT NOT NULL,
 redeemed_uid TEXT,
 redeemed_at TEXT
);

CREATE TABLE IF NOT EXISTS vanes_short_links (
 code TEXT PRIMARY KEY,
 url TEXT NOT NULL,
 title TEXT,
 subject TEXT,
 uid TEXT NOT NULL,
 clicks INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL,
 last_click_at TEXT
);

CREATE TABLE IF NOT EXISTS vanes_portal_posts (
 id TEXT PRIMARY KEY,
 uid TEXT NOT NULL,
 author TEXT,
 subject TEXT,
 title TEXT NOT NULL,
 body TEXT NOT NULL,
 reply_count INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vanes_portal_replies (
 id TEXT PRIMARY KEY,
 post_id TEXT NOT NULL,
 uid TEXT NOT NULL,
 author TEXT,
 body TEXT NOT NULL,
 created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vanes_progress_daily (
 uid TEXT NOT NULL,
 day TEXT NOT NULL,
 subject TEXT NOT NULL,
 level TEXT,
 seconds INTEGER NOT NULL DEFAULT 0,
 ai_questions INTEGER NOT NULL DEFAULT 0,
 questions INTEGER NOT NULL DEFAULT 0,
 correct INTEGER NOT NULL DEFAULT 0,
 updated_at TEXT NOT NULL,
 PRIMARY KEY (uid,day,subject)
);

CREATE TABLE IF NOT EXISTS vanes_parent_codes (
 code TEXT PRIMARY KEY,
 uid TEXT NOT NULL,
 learner_name TEXT,
 learner_level TEXT,
 created_at TEXT NOT NULL,
 revoked INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_vanes_events_anonymous_id ON vanes_events(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_vanes_events_event ON vanes_events(event);
CREATE INDEX IF NOT EXISTS idx_vanes_events_created_at ON vanes_events(created_at);
CREATE INDEX IF NOT EXISTS idx_vanes_users_name ON vanes_users(user_name);
CREATE INDEX IF NOT EXISTS idx_vanes_payments_status ON vanes_payments(status, created_at);
CREATE INDEX IF NOT EXISTS idx_vanes_payments_airtel_id ON vanes_payments(airtel_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vanes_claims_txn ON vanes_payment_claims(txn_id) WHERE txn_id IS NOT NULL AND verdict='APPROVED';
CREATE INDEX IF NOT EXISTS idx_vanes_claims_uid ON vanes_payment_claims(uid, created_at);
CREATE INDEX IF NOT EXISTS idx_vanes_short_links_uid ON vanes_short_links(uid);
CREATE INDEX IF NOT EXISTS idx_vanes_portal_posts_subject ON vanes_portal_posts(subject, created_at);
CREATE INDEX IF NOT EXISTS idx_vanes_portal_replies_post ON vanes_portal_replies(post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_vanes_progress_daily_uid_day ON vanes_progress_daily(uid, day);
CREATE INDEX IF NOT EXISTS idx_vanes_parent_codes_uid ON vanes_parent_codes(uid);
