import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module';
import zlib from 'zlib';
import { promisify } from 'util';

const gunzip = promisify(zlib.gunzip);

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://voocdrpetiyspuhyeapi.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_luDUt769BBrrApn8z-Cgvw_W9VE0rIV';
const MATCH_ID = process.env.MATCH_ID;

if (!MATCH_ID) {
  console.error('ERROR: MATCH_ID environment variable is required.');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Referer': 'https://www.fotmob.com/',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-GB,en;q=0.9',
};

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function getBuildId() {
  try {
    const res = await fetch('https://www.fotmob.com/', { headers: HEADERS });
    const html = await res.text();
    const tag = '__NEXT_DATA__" type="application/json">';
    const start = html.indexOf(tag) + tag.length;
    const end = html.indexOf('</script>', start);
    return JSON.parse(html.slice(start, end)).buildId;
  } catch (e) {
    console.warn('BuildId fallback:', e.message);
    return 'quX4vmazDEcAFzWw1ZjDZ';
  }
}

async function fetchJson(url, isGzip = false) {
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return { _error: `HTTP ${res.status}`, url };
    if (isGzip) {
      const buf = await res.arrayBuffer();
      const decompressed = await gunzip(Buffer.from(buf));
      return JSON.parse(decompressed.toString('utf8'));
    }
    return await res.json();
  } catch (e) {
    return { _error: e.message, url };
  }
}

async function dump(matchId, dataKey, json, phase = 'pre') {
  const { error } = await sb.from('fotmob_raw').upsert(
    { match_id: matchId, data_key: dataKey, raw_json: json, fetched_at: new Date().toISOString(), phase },
    { onConflict: 'match_id,data_key' }
  );
  if (error) console.warn(`  Supabase write error [${dataKey}]:`, error.message);
  else console.log(`  ✅ Saved [${dataKey}]`);
}

async function preFetch(matchId, buildId) {
  console.log('\n=== PRE-MATCH FETCH ===');

  // 1. Main match JSON
  const matchUrl = `https://www.fotmob.com/_next/data/${buildId}/en/match/${matchId}.json`;
  console.log('Fetching match details...');
  const matchData = await fetchJson(matchUrl);
  await dump(matchId, 'match', matchData, 'pre');

  const g = matchData.pageProps?.general;
  const c = matchData.pageProps?.content;

  if (!g) { console.error('No general data — invalid match?'); return null; }

  console.log(`Match: ${g.homeTeam?.name} vs ${g.awayTeam?.name}`);
  console.log(`League: ${g.leagueName} | Coverage: ${g.coverageLevel}`);

  const homeTeamId = g.homeTeam?.id;
  const awayTeamId = g.awayTeam?.id;
  const leagueId = g.leagueId || g.parentLeagueId;

  // 2. League table (gzip)
  if (leagueId) {
    const tableUrl = `https://data.fotmob.com/tables.ext.${leagueId}.fot.gz`;
    console.log('Fetching league table...');
    const tableData = await fetchJson(tableUrl, true);
    await dump(matchId, 'league_table', tableData, 'pre');
    await sleep(500);
  }

  // 3. Home team profile
  if (homeTeamId) {
    const homeUrl = `https://www.fotmob.com/api/teams?id=${homeTeamId}`;
    console.log('Fetching home team profile...');
    const homeData = await fetchJson(homeUrl);
    await dump(matchId, 'home_team', homeData, 'pre');
    await sleep(500);
  }

  // 4. Away team profile
  if (awayTeamId) {
    const awayUrl = `https://www.fotmob.com/api/teams?id=${awayTeamId}`;
    console.log('Fetching away team profile...');
    const awayData = await fetchJson(awayUrl);
    await dump(matchId, 'away_team', awayData, 'pre');
    await sleep(500);
  }

  // 5. Player profiles from lineup
  const lineup = c?.lineup;
  if (lineup && lineup.lineupType !== 'unavailable') {
    const allPlayers = [
      ...(lineup.homeTeam?.starters || []),
      ...(lineup.homeTeam?.subs || []),
      ...(lineup.awayTeam?.starters || []),
      ...(lineup.awayTeam?.subs || []),
    ];

    console.log(`Fetching ${allPlayers.length} player profiles (batches of 5)...`);
    for (let i = 0; i < allPlayers.length; i += 5) {
      const batch = allPlayers.slice(i, i + 5);
      await Promise.all(batch.map(async (p) => {
        const pUrl = `https://www.fotmob.com/api/playerData?id=${p.id}`;
        const pData = await fetchJson(pUrl);
        await dump(matchId, `player_${p.id}`, pData, 'pre');
      }));
      await sleep(1000);
    }
  } else {
    console.log('Lineup unavailable — skipping player profiles');
  }

  // 6. Heatmap URL (if available)
  const heatmapUrl = c?.heatmapUrl;
  if (heatmapUrl) {
    const fullHeatmapUrl = `https://www.fotmob.com${heatmapUrl}`;
    console.log('Fetching heatmap...');
    const heatData = await fetchJson(fullHeatmapUrl);
    await dump(matchId, 'heatmap', heatData, 'pre');
  }

  return { g, c, matchData };
}

async function livePoll(matchId, buildId) {
  console.log('\n=== LIVE POLLING STARTED ===');
  let pollCount = 0;

  while (true) {
    pollCount++;
    const matchUrl = `https://www.fotmob.com/_next/data/${buildId}/en/match/${matchId}.json`;
    const matchData = await fetchJson(matchUrl);
    const g = matchData.pageProps?.general;
    const c = matchData.pageProps?.content;

    const started = g?.started;
    const finished = g?.finished;
    const homeScore = matchData.pageProps?.header?.teams?.[0]?.score ?? 0;
    const awayScore = matchData.pageProps?.header?.teams?.[1]?.score ?? 0;
    const status = matchData.pageProps?.header?.status;
    const minute = status?.minutesStr || status?.reason?.short || '?';

    console.log(`[Poll #${pollCount}] ${minute}' | ${g?.homeTeam?.name} ${homeScore}-${awayScore} ${g?.awayTeam?.name} | finished:${finished}`);

    await dump(matchId, 'match', matchData, finished ? 'post' : 'live');

    // If lineup updated from predicted to standard — refetch players
    const lineup = c?.lineup;
    if (lineup?.lineupType === 'standard') {
      const allPlayers = [
        ...(lineup.homeTeam?.starters || []),
        ...(lineup.awayTeam?.starters || []),
      ];
      for (let i = 0; i < allPlayers.length; i += 5) {
        const batch = allPlayers.slice(i, i + 5);
        await Promise.all(batch.map(async (p) => {
          const pData = await fetchJson(`https://www.fotmob.com/api/playerData?id=${p.id}`);
          await dump(matchId, `player_${p.id}`, pData, 'live');
        }));
        await sleep(800);
      }
    }

    if (finished) {
      console.log('\n=== FULL TIME — STOPPING ===');
      // Final heatmap fetch
      const heatmapUrl = c?.heatmapUrl;
      if (heatmapUrl) {
        const heatData = await fetchJson(`https://www.fotmob.com${heatmapUrl}`);
        await dump(matchId, 'heatmap', heatData, 'post');
      }
      await dump(matchId, '_action_log', {
        stopped_at: new Date().toISOString(),
        stop_reason: 'full_time',
        poll_count: pollCount,
        match_id: matchId,
      }, 'post');
      break;
    }

    if (!started) {
      console.log('  Match not started yet — waiting 60s...');
    }

    await sleep(60000);

    // Refresh buildId every 30 polls to avoid stale buildId
    if (pollCount % 30 === 0) {
      buildId = await getBuildId();
      console.log('  Refreshed buildId:', buildId);
    }
  }
}

async function main() {
  console.log(`\n🚀 ZetaSports Match Data Fetcher`);
  console.log(`   Match ID: ${MATCH_ID}`);
  console.log(`   Started: ${new Date().toISOString()}`);

  let buildId = await getBuildId();
  console.log(`   BuildId: ${buildId}`);

  // Pre-match fetch
  const result = await preFetch(MATCH_ID, buildId);
  if (!result) process.exit(1);

  const { g } = result;
  const started = g?.started;
  const finished = g?.finished;

  if (finished) {
    console.log('\nMatch already finished. Pre-match data saved. Done.');
    return;
  }

  // Live polling (waits for kickoff if not started yet)
  await livePoll(MATCH_ID, buildId);

  console.log('\n✅ All done!');
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
