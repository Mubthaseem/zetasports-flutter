-- ZetaSports: fotmob_raw table
-- Stores raw JSON responses from all FotMob API endpoints for a match

CREATE TABLE IF NOT EXISTS fotmob_raw (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id    TEXT NOT NULL,
  data_key    TEXT NOT NULL,
  raw_json    JSONB,
  fetched_at  TIMESTAMPTZ DEFAULT NOW(),
  phase       TEXT DEFAULT 'pre',
  UNIQUE (match_id, data_key)
);

CREATE INDEX IF NOT EXISTS idx_fotmob_raw_match ON fotmob_raw(match_id);
CREATE INDEX IF NOT EXISTS idx_fotmob_raw_key ON fotmob_raw(data_key);

-- Enable Row Level Security (RLS)
ALTER TABLE fotmob_raw ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for client apps / admin panel)
DROP POLICY IF EXISTS "Public read fotmob_raw" ON fotmob_raw;
CREATE POLICY "Public read fotmob_raw" ON fotmob_raw FOR SELECT USING (true);

-- Allow write access for data sync workflows
DROP POLICY IF EXISTS "Allow write fotmob_raw" ON fotmob_raw;
CREATE POLICY "Allow write fotmob_raw" ON fotmob_raw FOR ALL USING (true) WITH CHECK (true);

-- Realtime synchronization
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE fotmob_raw;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
