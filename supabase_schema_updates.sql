-- =============================================================================
-- ZETASPORTS — COMPLETE SUPABASE SCHEMA & CONFIGURATION SCRIPT
-- =============================================================================
-- Run this script in the Supabase SQL Editor (Dashboard > SQL Editor > New query).
-- This script:
--   1. Ensures all tables, columns, and relations exist.
--   2. Adds APK OTA URL & update controls to `zeta_config`.
--   3. Sets up Row Level Security (RLS) policies for anonymous Flutter app access.
--   4. Enables Supabase Realtime for live scores, commentary, and chat.
--   5. Provides cleanup commands to remove mock/dummy matches if needed.
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. APP CONFIGURATION & IN-APP UPDATES (zeta_config)
-- =============================================================================
CREATE TABLE IF NOT EXISTS zeta_config (
    id TEXT PRIMARY KEY DEFAULT 'global',
    min_version TEXT NOT NULL DEFAULT '1.2.0',
    latest_version TEXT NOT NULL DEFAULT '1.2.0',
    force_update BOOLEAN NOT NULL DEFAULT false,
    maintenance_mode BOOLEAN NOT NULL DEFAULT false,
    android_store_url TEXT DEFAULT 'https://play.google.com/store/apps/details?id=com.zetasports.zetasports',
    ios_store_url TEXT DEFAULT 'https://apps.apple.com/app/zetasports/id000000000',
    apk_url TEXT DEFAULT '',
    update_message TEXT DEFAULT 'A new version of ZetaSports is available. Please update to continue enjoying live streams and scores.',
    release_notes TEXT DEFAULT '• Live match streaming enhancements\n• Real-time tactical pitch lineups\n• Bug fixes and speed improvements',
    required_patch_version INTEGER DEFAULT 19,
    telegram_enabled BOOLEAN DEFAULT true,
    telegram_url TEXT DEFAULT 'https://t.me/zetasports_official',
    telegram_title TEXT DEFAULT '📢 Join Our Official Telegram Channel',
    telegram_message TEXT DEFAULT 'Get instant live match streams, backup links, and real-time goal alerts directly on Telegram!',
    telegram_interval_mins INTEGER DEFAULT 5,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure newly added columns exist if table was already created earlier
ALTER TABLE zeta_config ADD COLUMN IF NOT EXISTS apk_url TEXT DEFAULT '';
ALTER TABLE zeta_config ADD COLUMN IF NOT EXISTS release_notes TEXT DEFAULT '';
ALTER TABLE zeta_config ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Upsert the 'global' configuration row
INSERT INTO zeta_config (
    id,
    min_version,
    latest_version,
    force_update,
    maintenance_mode,
    android_store_url,
    ios_store_url,
    apk_url,
    update_message,
    release_notes,
    required_patch_version,
    telegram_enabled,
    telegram_url
) VALUES (
    'global',
    '1.2.0',
    '1.2.0',
    false,
    false,
    'https://play.google.com/store/apps/details?id=com.zetasports.zetasports',
    'https://apps.apple.com/app/zetasports/id000000000',
    'https://github.com/mubthaseem/zetasports/releases/download/v1.2.0/zetasports-testing.apk',
    'A new version of ZetaSports is available. Update now to enjoy live streams and real-time scores.',
    '• Real-time Supabase live scores\n• Tactical pitch lineup view\n• Live in-game viewer count\n• Performance optimizations',
    19,
    true,
    'https://t.me/zetasports_official'
)
ON CONFLICT (id) DO UPDATE SET
    min_version = EXCLUDED.min_version,
    latest_version = EXCLUDED.latest_version,
    apk_url = COALESCE(NULLIF(EXCLUDED.apk_url, ''), zeta_config.apk_url),
    updated_at = NOW();

-- =============================================================================
-- 2. LIVE MATCHES (zeta_matches)
-- =============================================================================
CREATE TABLE IF NOT EXISTS zeta_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    league_id TEXT,
    league_name TEXT NOT NULL DEFAULT 'International',
    league_logo TEXT,
    home_team TEXT NOT NULL,
    home_logo TEXT,
    away_team TEXT NOT NULL,
    away_logo TEXT,
    home_score INTEGER DEFAULT 0,
    away_score INTEGER DEFAULT 0,
    home_scorers JSONB DEFAULT '[]'::jsonb,
    away_scorers JSONB DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'NOT_STARTED', -- 'LIVE', 'FT', 'HT', 'NOT_STARTED', 'POSTPONED'
    is_live BOOLEAN NOT NULL DEFAULT false,
    match_time TIMESTAMPTZ DEFAULT NOW(),
    period TEXT,
    minute TEXT,
    venue TEXT,
    referee TEXT,
    round TEXT,
    viewers INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all necessary columns exist on zeta_matches
ALTER TABLE zeta_matches ADD COLUMN IF NOT EXISTS viewers INTEGER DEFAULT 0;
ALTER TABLE zeta_matches ADD COLUMN IF NOT EXISTS home_scorers JSONB DEFAULT '[]'::jsonb;
ALTER TABLE zeta_matches ADD COLUMN IF NOT EXISTS away_scorers JSONB DEFAULT '[]'::jsonb;
ALTER TABLE zeta_matches ADD COLUMN IF NOT EXISTS venue TEXT;
ALTER TABLE zeta_matches ADD COLUMN IF NOT EXISTS referee TEXT;
ALTER TABLE zeta_matches ADD COLUMN IF NOT EXISTS round TEXT;
ALTER TABLE zeta_matches ADD COLUMN IF NOT EXISTS period TEXT;
ALTER TABLE zeta_matches ADD COLUMN IF NOT EXISTS minute TEXT;
ALTER TABLE zeta_matches ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- =============================================================================
-- 3. MATCH TACTICAL LINEUPS (zeta_match_lineups)
-- =============================================================================
CREATE TABLE IF NOT EXISTS zeta_match_lineups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES zeta_matches(id) ON DELETE CASCADE,
    home_team TEXT,
    away_team TEXT,
    formation_home TEXT DEFAULT '4-3-3',
    formation_away TEXT DEFAULT '4-2-3-1',
    players JSONB DEFAULT '[]'::jsonb,
    substitutes JSONB DEFAULT '[]'::jsonb,
    coach_home TEXT,
    coach_away TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_match_lineup UNIQUE (match_id)
);

-- =============================================================================
-- 4. MATCH TELEMETRY & STATS (zeta_match_stats)
-- =============================================================================
CREATE TABLE IF NOT EXISTS zeta_match_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES zeta_matches(id) ON DELETE CASCADE,
    possession_home INTEGER DEFAULT 50,
    possession_away INTEGER DEFAULT 50,
    shots_home INTEGER DEFAULT 0,
    shots_away INTEGER DEFAULT 0,
    shots_on_target_home INTEGER DEFAULT 0,
    shots_on_target_away INTEGER DEFAULT 0,
    xg_home NUMERIC(4,2) DEFAULT 0.00,
    xg_away NUMERIC(4,2) DEFAULT 0.00,
    corners_home INTEGER DEFAULT 0,
    corners_away INTEGER DEFAULT 0,
    fouls_home INTEGER DEFAULT 0,
    fouls_away INTEGER DEFAULT 0,
    passes_home INTEGER DEFAULT 0,
    passes_away INTEGER DEFAULT 0,
    yellow_cards_home INTEGER DEFAULT 0,
    yellow_cards_away INTEGER DEFAULT 0,
    red_cards_home INTEGER DEFAULT 0,
    red_cards_away INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_match_stats UNIQUE (match_id)
);

-- =============================================================================
-- 5. MATCH COMMENTARY / TICKER (zeta_match_commentary)
-- =============================================================================
CREATE TABLE IF NOT EXISTS zeta_match_commentary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES zeta_matches(id) ON DELETE CASCADE,
    minute TEXT NOT NULL DEFAULT '',
    period TEXT,
    type TEXT DEFAULT 'text', -- 'goal', 'card', 'sub', 'var', 'text'
    text TEXT NOT NULL,
    icon TEXT,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 6. MATCH EVENTS (zeta_match_events)
-- =============================================================================
CREATE TABLE IF NOT EXISTS zeta_match_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES zeta_matches(id) ON DELETE CASCADE,
    minute TEXT NOT NULL,
    team TEXT NOT NULL, -- 'home' or 'away'
    player_name TEXT NOT NULL,
    assist_name TEXT,
    event_type TEXT NOT NULL, -- 'goal', 'yellow_card', 'red_card', 'sub_in', 'sub_out', 'penalty'
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 7. LIVE STREAMS (zeta_streams)
-- =============================================================================
CREATE TABLE IF NOT EXISTS zeta_streams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID REFERENCES zeta_matches(id) ON DELETE SET NULL,
    stream_name TEXT NOT NULL,
    stream_url TEXT NOT NULL,
    quality TEXT DEFAULT '1080p',
    language TEXT DEFAULT 'English',
    is_active BOOLEAN DEFAULT true,
    backup_url TEXT,
    headers JSONB DEFAULT '{}'::jsonb,
    deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 8. LIVE CHAT (zeta_chat)
-- =============================================================================
CREATE TABLE IF NOT EXISTS zeta_chat (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES zeta_matches(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    message TEXT NOT NULL,
    color TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 9. LEAGUE STANDINGS (zeta_league_standings)
-- =============================================================================
CREATE TABLE IF NOT EXISTS zeta_league_standings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    league_id TEXT NOT NULL,
    league_name TEXT NOT NULL,
    season TEXT NOT NULL DEFAULT '2025/2026',
    table_data JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_league_season UNIQUE (league_id, season)
);

-- =============================================================================
-- 10. HIGHLIGHTS & REPLAYS (zeta_highlights)
-- =============================================================================
CREATE TABLE IF NOT EXISTS zeta_highlights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID REFERENCES zeta_matches(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    competition TEXT,
    thumbnail_url TEXT,
    video_url TEXT NOT NULL,
    duration TEXT DEFAULT '03:45',
    views INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 11. NEWS ARTICLES (zeta_news)
-- =============================================================================
CREATE TABLE IF NOT EXISTS zeta_news (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    category TEXT DEFAULT 'Breaking',
    image_url TEXT,
    content TEXT,
    source TEXT DEFAULT 'ZetaSports',
    published_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 12. ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================
-- Enable RLS on all tables
ALTER TABLE zeta_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE zeta_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE zeta_match_lineups ENABLE ROW LEVEL SECURITY;
ALTER TABLE zeta_match_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE zeta_match_commentary ENABLE ROW LEVEL SECURITY;
ALTER TABLE zeta_match_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE zeta_streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE zeta_chat ENABLE ROW LEVEL SECURITY;
ALTER TABLE zeta_league_standings ENABLE ROW LEVEL SECURITY;
ALTER TABLE zeta_highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE zeta_news ENABLE ROW LEVEL SECURITY;

-- 12.1 Public Read (SELECT) Policies — Allows Flutter app to fetch data anonymously
DO $$
BEGIN
    -- zeta_config
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'zeta_config' AND policyname = 'Public read zeta_config') THEN
        CREATE POLICY "Public read zeta_config" ON zeta_config FOR SELECT TO public USING (true);
    END IF;

    -- zeta_matches
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'zeta_matches' AND policyname = 'Public read zeta_matches') THEN
        CREATE POLICY "Public read zeta_matches" ON zeta_matches FOR SELECT TO public USING (true);
    END IF;

    -- zeta_match_lineups
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'zeta_match_lineups' AND policyname = 'Public read zeta_match_lineups') THEN
        CREATE POLICY "Public read zeta_match_lineups" ON zeta_match_lineups FOR SELECT TO public USING (true);
    END IF;

    -- zeta_match_stats
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'zeta_match_stats' AND policyname = 'Public read zeta_match_stats') THEN
        CREATE POLICY "Public read zeta_match_stats" ON zeta_match_stats FOR SELECT TO public USING (true);
    END IF;

    -- zeta_match_commentary
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'zeta_match_commentary' AND policyname = 'Public read zeta_match_commentary') THEN
        CREATE POLICY "Public read zeta_match_commentary" ON zeta_match_commentary FOR SELECT TO public USING (true);
    END IF;

    -- zeta_match_events
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'zeta_match_events' AND policyname = 'Public read zeta_match_events') THEN
        CREATE POLICY "Public read zeta_match_events" ON zeta_match_events FOR SELECT TO public USING (true);
    END IF;

    -- zeta_streams
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'zeta_streams' AND policyname = 'Public read zeta_streams') THEN
        CREATE POLICY "Public read zeta_streams" ON zeta_streams FOR SELECT TO public USING (true);
    END IF;

    -- zeta_chat
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'zeta_chat' AND policyname = 'Public read zeta_chat') THEN
        CREATE POLICY "Public read zeta_chat" ON zeta_chat FOR SELECT TO public USING (true);
    END IF;

    -- zeta_league_standings
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'zeta_league_standings' AND policyname = 'Public read zeta_league_standings') THEN
        CREATE POLICY "Public read zeta_league_standings" ON zeta_league_standings FOR SELECT TO public USING (true);
    END IF;

    -- zeta_highlights
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'zeta_highlights' AND policyname = 'Public read zeta_highlights') THEN
        CREATE POLICY "Public read zeta_highlights" ON zeta_highlights FOR SELECT TO public USING (true);
    END IF;

    -- zeta_news
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'zeta_news' AND policyname = 'Public read zeta_news') THEN
        CREATE POLICY "Public read zeta_news" ON zeta_news FOR SELECT TO public USING (true);
    END IF;
END $$;

-- 12.2 Public Insert/Update Policies for Interactive Features
DO $$
BEGIN
    -- Allow sending chat messages
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'zeta_chat' AND policyname = 'Public insert zeta_chat') THEN
        CREATE POLICY "Public insert zeta_chat" ON zeta_chat FOR INSERT TO public WITH CHECK (true);
    END IF;

    -- Allow updating viewer counts on matches
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'zeta_matches' AND policyname = 'Public update viewers on zeta_matches') THEN
        CREATE POLICY "Public update viewers on zeta_matches" ON zeta_matches FOR UPDATE TO public
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

-- =============================================================================
-- 13. REALTIME REPLICATION (Instant Updates in Flutter)
-- =============================================================================
-- Enables instant push notifications for score changes, chat, and commentary
DO $$
BEGIN
    -- Add tables to realtime publication
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE zeta_matches;
    EXCEPTION WHEN duplicate_object THEN NULL; END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE zeta_chat;
    EXCEPTION WHEN duplicate_object THEN NULL; END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE zeta_match_commentary;
    EXCEPTION WHEN duplicate_object THEN NULL; END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE zeta_match_events;
    EXCEPTION WHEN duplicate_object THEN NULL; END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE zeta_match_stats;
    EXCEPTION WHEN duplicate_object THEN NULL; END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE zeta_config;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- =============================================================================
-- 14. OPTIONAL: CLEANUP MOCK / DUMMY DATA
-- =============================================================================
-- Uncomment the lines below if you wish to wipe any mock test rows:
-- DELETE FROM zeta_chat WHERE username LIKE '%test%' OR username LIKE '%mock%';
-- DELETE FROM zeta_matches WHERE home_team IN ('Arsenal (Mock)', 'Chelsea (Mock)') OR league_name = 'Mock League';

-- =============================================================================
-- 15. FOTMOB RAW DATA STORE (fotmob_raw)
-- =============================================================================
-- Stores complete raw API payloads for matches, team profiles, standings, and players.
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

ALTER TABLE fotmob_raw ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read fotmob_raw" ON fotmob_raw;
CREATE POLICY "Public read fotmob_raw" ON fotmob_raw FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow write fotmob_raw" ON fotmob_raw;
CREATE POLICY "Allow write fotmob_raw" ON fotmob_raw FOR ALL USING (true) WITH CHECK (true);

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE fotmob_raw;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

