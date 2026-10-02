CREATE TABLE IF NOT EXISTS links (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(32) NOT NULL UNIQUE,
  original_url TEXT NOT NULL,
  title VARCHAR(120) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  CHECK (char_length(original_url) BETWEEN 1 AND 2048),
  CHECK (code ~ '^[A-Za-z0-9_-]{4,32}$')
);

CREATE TABLE IF NOT EXISTS click_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  link_id BIGINT NOT NULL REFERENCES links(id) ON DELETE CASCADE,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS links_created_at_idx ON links(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS click_events_link_id_idx ON click_events(link_id);
CREATE INDEX IF NOT EXISTS click_events_opened_at_idx ON click_events(opened_at);
