-- Single-user app: profile is a singleton row (id = 1).
CREATE TABLE IF NOT EXISTS profile (
  id                       int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  full_name                text NOT NULL DEFAULT '',
  email                    text NOT NULL DEFAULT '',
  reg_no                   text NOT NULL DEFAULT '',
  class_name               text NOT NULL DEFAULT '',
  model                    text NOT NULL DEFAULT 'gemini-2.5-flash',
  thinking_level           text NOT NULL DEFAULT 'low' CHECK (thinking_level IN ('off','low','medium','high')),
  gemini_api_key_enc       text,
  icloud_username          text NOT NULL DEFAULT '',
  icloud_app_password_enc  text,
  reminders_sync_token     text
);
INSERT INTO profile (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS contacts (
  id     serial PRIMARY KEY,
  name   text NOT NULL,
  email  text NOT NULL,
  roles  text[] NOT NULL DEFAULT '{}',
  notes  text NOT NULL DEFAULT ''
);

-- Apple Reminders pushed in by the iOS/macOS Shortcut (full replace on each sync).
CREATE TABLE IF NOT EXISTS reminders (
  id         serial PRIMARY KEY,
  source     text NOT NULL DEFAULT 'apple',
  title      text NOT NULL,
  notes      text NOT NULL DEFAULT '',
  due        timestamptz,
  list_name  text NOT NULL DEFAULT '',
  completed  boolean NOT NULL DEFAULT false,
  synced_at  timestamptz NOT NULL DEFAULT now()
);
