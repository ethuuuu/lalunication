-- Multi-user: every row belongs to a lowercased Google email (user_email).
-- Idempotent; safe on a fresh DB and on the old single-user DB.
-- :owner is substituted by scripts/migrate.mjs with ALLOWED_EMAIL (pre-existing single-user rows become theirs).

CREATE TABLE IF NOT EXISTS profile (
  id                         serial PRIMARY KEY,
  user_email                 text NOT NULL UNIQUE,
  full_name                  text NOT NULL DEFAULT '',
  email                      text NOT NULL DEFAULT '',
  reg_no                     text NOT NULL DEFAULT '',
  class_name                 text NOT NULL DEFAULT '',
  model                      text NOT NULL DEFAULT 'gemini-2.5-flash',
  thinking_level             text NOT NULL DEFAULT 'low' CHECK (thinking_level IN ('off','low','medium','high')),
  gemini_api_key_enc         text,
  icloud_username            text NOT NULL DEFAULT '',
  icloud_app_password_enc    text,
  reminders_sync_token_hash  text UNIQUE
);

CREATE TABLE IF NOT EXISTS contacts (
  id          serial PRIMARY KEY,
  user_email  text NOT NULL,
  name        text NOT NULL,
  email       text NOT NULL,
  roles       text[] NOT NULL DEFAULT '{}',
  notes       text NOT NULL DEFAULT ''
);

-- Apple Reminders pushed in by each user's Shortcut (full replace per user on each sync).
CREATE TABLE IF NOT EXISTS reminders (
  id          serial PRIMARY KEY,
  user_email  text NOT NULL,
  source      text NOT NULL DEFAULT 'apple',
  title       text NOT NULL,
  notes       text NOT NULL DEFAULT '',
  due         timestamptz,
  list_name   text NOT NULL DEFAULT '',
  completed   boolean NOT NULL DEFAULT false,
  synced_at   timestamptz NOT NULL DEFAULT now()
);

-- ---- Upgrade path from the single-user schema (no-ops on a fresh DB) ----
ALTER TABLE profile DROP CONSTRAINT IF EXISTS profile_id_check;
ALTER TABLE profile ADD COLUMN IF NOT EXISTS user_email text;
UPDATE profile SET user_email = :owner WHERE user_email IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profile_user_email_key ON profile (user_email);
CREATE SEQUENCE IF NOT EXISTS profile_id_seq OWNED BY profile.id;
SELECT setval('profile_id_seq', GREATEST((SELECT max(id) FROM profile), 1));
ALTER TABLE profile ALTER COLUMN id SET DEFAULT nextval('profile_id_seq');
ALTER TABLE profile ALTER COLUMN user_email SET NOT NULL;

-- Sync tokens are stored as sha256 hex, looked up by hash.
ALTER TABLE profile ADD COLUMN IF NOT EXISTS reminders_sync_token_hash text;
CREATE UNIQUE INDEX IF NOT EXISTS profile_sync_hash_key ON profile (reminders_sync_token_hash);
ALTER TABLE profile DROP COLUMN IF EXISTS reminders_sync_token;

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS user_email text;
UPDATE contacts SET user_email = :owner WHERE user_email IS NULL;
ALTER TABLE contacts ALTER COLUMN user_email SET NOT NULL;
CREATE INDEX IF NOT EXISTS contacts_user_email_idx ON contacts (user_email);

ALTER TABLE reminders ADD COLUMN IF NOT EXISTS user_email text;
UPDATE reminders SET user_email = :owner WHERE user_email IS NULL;
ALTER TABLE reminders ALTER COLUMN user_email SET NOT NULL;
CREATE INDEX IF NOT EXISTS reminders_user_email_idx ON reminders (user_email);
