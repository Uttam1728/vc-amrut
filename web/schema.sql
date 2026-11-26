-- Feedback from students. Apply with:
--   npx wrangler d1 execute vachanamrut-feedback --remote --file schema.sql
CREATE TABLE IF NOT EXISTS feedback (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  kind        TEXT    NOT NULL,          -- mistake | suggestion | other
  message     TEXT    NOT NULL,
  name        TEXT,
  quote       TEXT,                      -- e.g. "લો. ૬ · સંત સમાગમ › …" when sent from a card
  page        TEXT,                      -- the app link they were on
  ip_hash     TEXT,                      -- salted hash only (for rate limiting), never the raw IP
  user_agent  TEXT
);
CREATE INDEX IF NOT EXISTS feedback_ip_time ON feedback (ip_hash, created_at);
