import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://voocdrpetiyspuhyeapi.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_luDUt769BBrrApn8z-Cgvw_W9VE0rIV';
const MATCH_ID = process.env.MATCH_ID;
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '30000', 10);

if (!MATCH_ID) {
  console.error('❌ ERROR: MATCH_ID environment variable is required.');
  console.error('   Example: MATCH_ID=5181862 node scripts/match_data_fetcher.mjs');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const FOTMOB_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Referer': 'https://www.fotmob.com/',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-GB,en;q=0.9',
};

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchJson(url) {
  try {
    const res = await fetch(url, { headers: FOTMOB_HEADERS });
    if (!res.ok) return { _error: `HTTP ${res.status}: ${res.statusText}`, url };
    return await res.json();
  } catch (e) {
    return { _error: e.message, url };
  }
}

async function saveToSupabase(matchId, dataKey, rawJson, phase = 'live') {
  try {
    const { error } = await sb.from('fotmob_raw').upsert(
      {
        match_id: String(matchId),
        data_key: dataKey,
        raw_json: rawJson,
        fetched_at: new Date().toISOString(),
        phase,
      },
      { onConflict: 'match_id,data_key' }
    );
    if (error) {
      console.warn(`  ⚠️ Supabase upsert error [${dataKey}]:`, error.message);
    } else {
      console.log(`  ✅ Stored [${dataKey}] in Supabase fotmob_raw`);
    }
  } catch (err) {
    console.warn(`  ⚠️ Supabase exception [${dataKey}]:`, err.message);
  }
}

async function fetchAndDump(matchId, pollCount = 1) {
  const matchApiUrl = `https://www.fotmob.com/api/data/matchDetails?matchId=${matchId}`;
  const matchData = await fetchJson(matchApiUrl);

  if (matchData._error) {
    console.error(`❌ Failed to fetch match details: ${matchData._error}`);
    return null;
  }

  const g = matchData.general || {};
  const h = matchData.header || {};
  const c = matchData.content || {};

  const started = g.started;
  const finished = g.finished;
  const phase = finished ? 'post' : (started ? 'live' : 'pre');

  const home = g.homeTeam?.name || 'Home';
  const away = g.awayTeam?.name || 'Away';
  const score = `${h.teams?.[0]?.score ?? 0} - ${h.teams?.[1]?.score ?? 0}`;
  const minute = h.status?.liveTime?.short || h.status?.minutesStr || (finished ? 'FT' : (started ? 'Live' : 'Upcoming'));

  console.log(`[Poll #${pollCount}] [${phase.toUpperCase()}] ${home} ${score} ${away} (${minute}) | Coverage: ${g.coverageLevel || 'basic'}`);

  // 1. Dump master match JSON
  await saveToSupabase(matchId, 'match', matchData, phase);

  // 2. Fetch & Dump TV Listings once during pre/early-match
  if (pollCount === 1) {
    const tvUrl = `https://www.fotmob.com/api/data/tvlistings?matchId=${matchId}`;
    const tvData = await fetchJson(tvUrl);
    if (!tvData._error && tvData && Object.keys(tvData).length > 0) {
      await saveToSupabase(matchId, 'tv', tvData, phase);
    }
  }

  // 3. Save telemetry metadata
  await saveToSupabase(matchId, '_telemetry', {
    match_id: matchId,
    poll_count: pollCount,
    home_team: home,
    away_team: away,
    score,
    minute,
    coverage: g.coverageLevel,
    lineup_type: c.lineup?.lineupType,
    has_stats: !!c.stats,
    has_shotmap: !!c.shotmap?.shots?.length,
    started,
    finished,
    last_updated: new Date().toISOString()
  }, phase);

  return { started, finished };
}

async function main() {
  console.log(`\n======================================================`);
  console.log(`🚀 ZetaSports Advanced Match Telemetry Ingestion`);
  console.log(`   Match ID:       ${MATCH_ID}`);
  console.log(`   Direct API:     https://www.fotmob.com/api/data/matchDetails?matchId=${MATCH_ID}`);
  console.log(`   Poll Interval:  ${POLL_INTERVAL_MS / 1000}s`);
  console.log(`======================================================\n`);

  let pollCount = 1;
  const initial = await fetchAndDump(MATCH_ID, pollCount);

  if (!initial) {
    process.exit(1);
  }

  if (initial.finished) {
    console.log('\n🏁 Match is finished. Pre/Post-match data captured. Exiting cleanly.');
    return;
  }

  console.log(`\n⚡ Realtime Telemetry Poller Active (polling every ${POLL_INTERVAL_MS / 1000}s)...`);

  while (true) {
    await sleep(POLL_INTERVAL_MS);
    pollCount++;
    const state = await fetchAndDump(MATCH_ID, pollCount);
    if (state?.finished) {
      console.log('\n🏁 Full-time confirmed. All final telemetry archived. Exiting.');
      break;
    }
  }
}

main().catch(err => {
  console.error('Fatal fetcher error:', err);
  process.exit(1);
});
