-- Compact, normalized images persist with PostgreSQL; no local upload directory.
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_image BYTEA;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_version UUID;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='users_avatar_bounds' AND conrelid='users'::regclass) THEN
    ALTER TABLE users ADD CONSTRAINT users_avatar_bounds CHECK (
      (avatar_image IS NULL AND avatar_version IS NULL) OR
      (avatar_image IS NOT NULL AND avatar_version IS NOT NULL AND octet_length(avatar_image) <= 262144)
    );
  END IF;
END $$;
