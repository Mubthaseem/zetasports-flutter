/**
 * live_score_updater.mjs
 *
 * Fetches live match scores from FotMob's public API and updates
 * the `zeta_matches` table in Supabase.
 *
 * Runs via GitHub Actions every 2 minutes during live match windows.
 *
 * Required env vars (set as GitHub Actions secrets):
 *   SUPABASE_URL   — your project URL
 *   SUPABASE_KEY   — your service_role secret key
 */

import { createClient } from '@supabase/supabase-js';

// ── Config ───────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const FOTMOB_TODAY_API = 'https://www.fotmob.com/api/matches?date=';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY environment variables.');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Helpers ───────────────────────────────────────────────────────────────────
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
}

function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
}

/**
 * Fetch all matches from FotMob for a given date string (YYYYMMDD).
 * Returns a flat array of match objects from all leagues.
 */
async function fetchFotmobDay(dateStr) {
  const url = `${FOTMOB_TODAY_API}${dateStr}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; ZetaSports-Bot/1.0)',
      'Accept': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`FotMob responded with HTTP ${res.status} for date ${dateStr}`);
  const json = await res.json();

  const matches = [];
  const leagues = json?.leagues || [];
  for (const league of leagues) {
    for (const match of (league.matches || [])) {
      matches.push(match);
    }
  }
  return matches;
}

/**
 * Parse FotMob status → our DB status string + score + time_elapsed.
 */
function parseStatus(m) {
  const s = m.status || {};
  let status = 'scheduled';
  let homeScore = null;
  let awayScore = null;
  let timeElapsed = null;

  // Score
  if (s.scoreStr) {
    const parts = s.scoreStr.split(' - ').map(x => parseInt(x.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      homeScore = parts[0];
      awayScore = parts[1];
    }
  }
  if (homeScore === null && s.homeScore !== undefined) homeScore = parseInt(s.homeScore) || 0;
  if (awayScore === null && s.awayScore !== undefined) awayScore = parseInt(s.awayScore) || 0;

  // Status classification
  if (s.cancelled) {
    status = 'cancelled';
  } else if (s.postponed) {
    status = 'postponed';
  } else if (s.finished) {
    status = 'finished';
  } else if (s.started) {
    status = 'live';
    timeElapsed = s.liveTime?.short || s.liveTime?.long || null;
  }

  return { status, homeScore, awayScore, timeElapsed };
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🔄 ZetaSports Live Score Updater — ${new Date().toISOString()}`);

  // 1. Get all matches from DB that have a fotmob_id and are not finished/cancelled
  const { data: dbMatches, error: dbErr } = await sb
    .from('zeta_matches')
    .select('id, fotmob_id, status, home_score, away_score')
    .not('fotmob_id', 'is', null)
    .in('status', ['scheduled', 'live']);

  if (dbErr) {
    console.error('❌ Failed to load matches from Supabase:', dbErr.message);
    process.exit(1);
  }

  if (!dbMatches || dbMatches.length === 0) {
    console.log('✅ No active matches to update.');
    return;
  }

  console.log(`📋 Found ${dbMatches.length} trackable matches in DB.`);

  // 2. Build a lookup map fotmob_id → DB match
  const dbMap = {};
  for (const m of dbMatches) {
    if (m.fotmob_id) dbMap[m.fotmob_id.toString()] = m;
  }

  // 3. Fetch today's + yesterday's FotMob data (covers late-night finishes)
  let fotmobMatches = [];
  try {
    const [today, yesterday] = await Promise.all([
      fetchFotmobDay(todayStr()),
      fetchFotmobDay(yesterdayStr()),
    ]);
    fotmobMatches = [...today, ...yesterday];
    console.log(`📡 Fetched ${fotmobMatches.length} matches from FotMob.`);
  } catch (e) {
    console.error('❌ FotMob fetch failed:', e.message);
    process.exit(1);
  }

  // 4. Find matching fotmob IDs and build update payloads
  const updates = [];
  for (const fm of fotmobMatches) {
    const fmId = fm.id?.toString();
    if (!fmId || !dbMap[fmId]) continue;

    const db = dbMap[fmId];
    const { status, homeScore, awayScore, timeElapsed } = parseStatus(fm);

    // Only update if something actually changed
    const changed =
      status !== db.status ||
      homeScore !== db.home_score ||
      awayScore !== db.away_score;

    if (changed) {
      updates.push({
        id: db.id,
        status,
        home_score: homeScore ?? db.home_score ?? 0,
        away_score: awayScore ?? db.away_score ?? 0,
        time_elapsed: timeElapsed,
      });
    }
  }

  if (updates.length === 0) {
    console.log('✅ All matches already up to date — no changes needed.');
    return;
  }

  console.log(`✏️  Updating ${updates.length} match(es)…`);

  // 5. Upsert all updates in one batch
  const { error: upErr } = await sb
    .from('zeta_matches')
    .upsert(updates, { onConflict: 'id' });

  if (upErr) {
    console.error('❌ Supabase upsert failed:', upErr.message);
    process.exit(1);
  }

  for (const u of updates) {
    const db = dbMap[Object.keys(dbMap).find(k => dbMap[k].id === u.id)];
    console.log(`  ✅ [${u.id.slice(0,8)}] ${u.status.toUpperCase()}  ${u.home_score} - ${u.away_score}  ${u.time_elapsed ? `(${u.time_elapsed})` : ''}`);
  }

  console.log(`\n🏁 Done — ${updates.length} match(es) updated.`);
}

main().catch(e => {
  console.error('💥 Unhandled error:', e);
  process.exit(1);
});
