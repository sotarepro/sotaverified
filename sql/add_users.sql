-- Stage 3a: Users table for GitHub OAuth
CREATE TABLE IF NOT EXISTS users (
  github_id              TEXT PRIMARY KEY,
  username               TEXT NOT NULL,
  email                  TEXT,
  avatar_url             TEXT,
  account_created_at     TIMESTAMPTZ,
  is_flagged_new_account BOOLEAN NOT NULL DEFAULT FALSE,
  reputation_score       INTEGER NOT NULL DEFAULT 0,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
