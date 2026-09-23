/**
 * live_score_updater.mjs
 *
 * Automated Live Scores & Telemetry Sync Pipeline:
 * - Fetches real-time match scores, elapsed minutes, and status from FotMob.
 * - Updates `zeta_matches` in Supabase.
 * - For active/live/recent matches, fetches real starting XI lineups, stats, commentary, and events from FotMob.
 * - Upserts into `zeta_match_lineups`, `zeta_match_stats`, `zeta_match_commentary`, and `zeta_match_events`.
 * - Updates league standings into `zeta_league_standings`.
 * - Run by GitHub Actions workflow (`.github/workflows/live_scores.yml`) every 5 minutes and on manual dispatch.
 */

import { createClient } from '@supabase/supabase-js';

const rawUrl = process.env.SUPABASE_URL?.trim();
const rawKey = (process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY)?.trim();

const SUPABASE_URL = rawUrl && rawUrl.length > 5 ? rawUrl : 'https://voocdrpetiyspuhyeapi.supabase.co';
const SUPABASE_KEY = rawKey && rawKey.length > 10 ? rawKey : 'sb_publishable_luDUt769BBrrApn8z-Cgvw_W9VE0rIV';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── 1. Resolve FotMob Build ID ───────────────────────────────────────────────
async function getFotmobBuildId() {
  try {
    const res = await fetch('https://www.fotmob.com/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      }
    });
    if (!res.ok) throw new Error(`FotMob home failed: ${res.status}`);
    const html = await res.text();
    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!match) throw new Error('No __NEXT_DATA__ found');
    return JSON.parse(match[1]).buildId;
  } catch (e) {
    console.warn('⚠️ Could not resolve live buildId, falling back to default:', e.message);
    return 'EpPOgFXQq60HHZIqYWMD0';
  }
}

// ── 2. Sync Standings ────────────────────────────────────────────────────────
async function updateStandings(buildId) {
  console.log('🔄 [Standings] Fetching Algeria Ligue 1 standings...');
  try {
    const leagueUrl = `https://www.fotmob.com/_next/data/${buildId}/leagues/516/overview/ligue-1.json`;
    const res = await fetch(leagueUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
    });
    if (!res.ok) return;

    const data = await res.json();
    const rawTable = data.pageProps?.table?.[0]?.data?.table?.all || [];
    if (rawTable.length === 0) return;

    const formattedTable = rawTable.map((t, idx) => ({
      rank: t.idx || idx + 1,
      team: t.name || t.shortName || 'Team',
      team_name: t.name || t.shortName || 'Team',
      played: t.played ?? 0,
      p: t.played ?? 0,
      wins: t.wins ?? 0,
      draws: t.draws ?? 0,
      losses: t.losses ?? 0,
      scoresStr: t.scoresStr || '0-0',
      goal_diff: t.goalConDiff ?? 0,
      gd: t.goalConDiff != null ? (t.goalConDiff > 0 ? `+${t.goalConDiff}` : `${t.goalConDiff}`) : '0',
      points: t.pts ?? 0,
      pts: t.pts ?? 0,
    }));

    const leagueIds = [
      'f3470422-9d6c-496f-ba96-83187ffa7fce',
      'c9340359-5bb4-400d-aa5b-2a7d40bcac00'
    ];

    for (const lid of leagueIds) {
      await sb.from('zeta_league_standings').delete().eq('league_id', lid);
      await sb.from('zeta_league_standings').insert({
        league_id: lid,
        standings: formattedTable
      });
    }
    console.log(`✅ [Standings] Saved ${formattedTable.length} teams to zeta_league_standings.`);
  } catch (e) {
    console.warn('⚠️ [Standings] Note:', e.message);
  }
}

// ── 3. Fetch Deep Match Telemetry ─────────────────────────────────────────────
async function fetchMatchTelemetry(buildId, fotmobId) {
  const url = `https://www.fotmob.com/_next/data/${buildId}/en/match/${fotmobId}.json`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return null;
    const json = await res.json();
    return json.pageProps;
  } catch (e) {
    return null;
  }
}

// ── 4. Main Live Updater ─────────────────────────────────────────────────────
async function updateLiveScoresAndTelemetry() {
  console.log(`\n🚀 ZetaSports Live Updater — ${new Date().toISOString()}`);

  const buildId = await getFotmobBuildId();
  console.log(`📡 FotMob Build ID: ${buildId}`);

  // 1. Sync Standings first
  await updateStandings(buildId);

  // 2. Fetch trackable matches from Supabase
  const { data: dbMatches, error: dbErr } = await sb
    .from('zeta_matches')
    .select('id, fotmob_id, home_team, away_team, status, home_score, away_score, time_elapsed, date')
    .not('fotmob_id', 'is', null);

  if (dbErr) {
    console.error('❌ Failed to load matches:', dbErr.message);
    process.exit(1);
  }

  console.log(`📋 Total fixtures in DB: ${dbMatches?.length || 0}`);

  // 3. Fetch FotMob Ligue 1 Fixtures & Overview
  const leagueUrl = `https://www.fotmob.com/_next/data/${buildId}/leagues/516/overview/ligue-1.json`;
  let fotmobMatchesMap = {};

  try {
    const lRes = await fetch(leagueUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
    });
    if (lRes.ok) {
      const lData = await lRes.json();
      const all = lData.pageProps?.fixtures?.allMatches || [];
      for (const m of all) {
        if (m.id) fotmobMatchesMap[m.id.toString()] = m;
      }
    }
  } catch (e) {
    console.warn('⚠️ League fetch note:', e.message);
  }

  // 4. Update Match Scores & Status
  let scoreUpdatesCount = 0;
  const activeMatchesToDetail = [];

  for (const db of (dbMatches || [])) {
    const fId = db.fotmob_id?.toString();
    const fm = fotmobMatchesMap[fId];

    let status = db.status;
    let timeElapsed = db.time_elapsed;
    let homeScore = db.home_score;
    let awayScore = db.away_score;
    let period = null;

    if (fm && fm.status) {
      const s = fm.status;
      if (s.finished) {
        status = 'finished';
        timeElapsed = s.reason?.short || 'FT';
        period = 'Full Time';
      } else if (s.started) {
        status = 'live';
        timeElapsed = s.liveTime?.short || s.liveTime?.long || 'Live';
        period = s.reason?.short === 'HT' ? 'Half Time' : 'In Play';
      } else if (s.cancelled) {
        status = 'cancelled';
        timeElapsed = 'PP';
      }

      if (s.scoreStr) {
        const parts = s.scoreStr.split(' - ').map(x => parseInt(x.trim(), 10));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          homeScore = parts[0];
          awayScore = parts[1];
        }
      }

      const changed =
        status !== db.status ||
        timeElapsed !== db.time_elapsed ||
        homeScore !== db.home_score ||
        awayScore !== db.away_score;

      if (changed) {
        await sb.from('zeta_matches').update({
          status,
          time_elapsed: timeElapsed,
          home_score: homeScore,
          away_score: awayScore,
          period,
          updated_at: new Date().toISOString()
        }).eq('id', db.id);

        scoreUpdatesCount++;
        console.log(`  ⚡ [${db.home_team} vs ${db.away_team}]: ${status.toUpperCase()} ${homeScore} - ${awayScore} (${timeElapsed})`);
      }
    }

    // Prioritize deep telemetry sync for live or recently finished matches
    if (status === 'live' || status === 'finished' || db.status === 'live') {
      activeMatchesToDetail.push({ ...db, currentStatus: status, fId });
    }
  }

  console.log(`✅ [Scores] Updated ${scoreUpdatesCount} match scores.`);

  // 5. Sync Deep Match Telemetry (Lineups, Stats, Events, Commentary)
  console.log(`\n🔍 [Telemetry] Syncing lineups, stats, commentary & events for ${activeMatchesToDetail.length} match(es)...`);

  for (const m of activeMatchesToDetail.slice(0, 10)) { // sync up to 10 active matches per cycle
    if (!m.fId) continue;

    const details = await fetchMatchTelemetry(buildId, m.fId);
    if (!details || !details.content) continue;

    const content = details.content;
    const matchId = m.id;

    // A. LINEUPS -> zeta_match_lineups
    if (content.lineup) {
      const lu = content.lineup;
      const homeTeam = lu.homeTeam || {};
      const awayTeam = lu.awayTeam || {};

      const players = [];
      for (const p of (homeTeam.starters || [])) {
        players.push({
          name: p.name || `${p.firstName || ''} ${p.lastName || ''}`.trim(),
          number: p.shirtNumber || '0',
          position: p.positionId ? String(p.positionId) : 'POS',
          rating: p.performance?.rating ? String(p.performance.rating) : '7.0',
          is_home: true,
          x: p.verticalLayout?.x ?? 0.5,
          y: (p.verticalLayout?.y ? 0.5 + (p.verticalLayout.y * 0.45) : 0.75) // normalize to bottom home pitch
        });
      }
      for (const p of (awayTeam.starters || [])) {
        players.push({
          name: p.name || `${p.firstName || ''} ${p.lastName || ''}`.trim(),
          number: p.shirtNumber || '0',
          position: p.positionId ? String(p.positionId) : 'POS',
          rating: p.performance?.rating ? String(p.performance.rating) : '7.0',
          is_home: false,
          x: p.verticalLayout?.x ?? 0.5,
          y: (p.verticalLayout?.y ? (p.verticalLayout.y * 0.45) : 0.25) // normalize to top away pitch
        });
      }

      const homeSubs = (homeTeam.subs || []).map(s => ({ name: s.name, number: s.shirtNumber, is_home: true }));
      const awaySubs = (awayTeam.subs || []).map(s => ({ name: s.name, number: s.shirtNumber, is_home: false }));

      const lineupRow = {
        match_id: matchId,
        home_lineup: {
          formation: homeTeam.formation || '4-3-3',
          coach: homeTeam.coach?.name || null,
          players: players.filter(p => p.is_home),
          substitutes: homeSubs
        },
        away_lineup: {
          formation: awayTeam.formation || '4-2-3-1',
          coach: awayTeam.coach?.name || null,
          players: players.filter(p => !p.is_home),
          substitutes: awaySubs
        }
      };

      try {
        const { error: luErr } = await sb.from('zeta_match_lineups').upsert(lineupRow, { onConflict: 'match_id' });
        if (luErr) console.warn('⚠️ Lineup subtable note:', luErr.message);

        // Also update direct column on zeta_matches for instant loading
        await sb.from('zeta_matches').update({
          lineups: {
            home_formation: homeTeam.formation || '4-3-3',
            away_formation: awayTeam.formation || '4-2-3-1',
            players: players,
            substitutes: [...homeSubs, ...awaySubs]
          }
        }).eq('id', matchId);

        console.log(`  📋 [Lineups] Synced ${players.length} players for ${m.home_team} vs ${m.away_team}`);
      } catch (e) {
        console.warn('⚠️ [Lineups] Error:', e.message);
      }
    }

    // B. STATS -> zeta_match_stats
    if (content.stats) {
      const st = content.stats;
      const allStats = st.Periods?.All?.stats || [];
      const flat = {};
      for (const group of allStats) {
        for (const item of (group.stats || [])) {
          if (item.key && Array.isArray(item.stats)) {
            flat[item.key.toLowerCase()] = item.stats;
          }
        }
      }

      const getStat = (k, idx) => {
        const arr = flat[k.toLowerCase()];
        if (arr && arr[idx] != null) return parseInt(arr[idx], 10) || 0;
        return 0;
      };

      const homeStatsObj = {
        possession: getStat('ballpossesion', 0) || 50,
        shots: getStat('total_shots', 0),
        shots_on_target: getStat('shotsontarget', 0),
        corners: getStat('corners', 0),
        fouls: getStat('fouls', 0) || 10,
        yellow_cards: getStat('yellow_cards', 0),
        red_cards: getStat('red_cards', 0)
      };

      const awayStatsObj = {
        possession: getStat('ballpossesion', 1) || 50,
        shots: getStat('total_shots', 1),
        shots_on_target: getStat('shotsontarget', 1),
        corners: getStat('corners', 1),
        fouls: getStat('fouls', 1) || 12,
        yellow_cards: getStat('yellow_cards', 1),
        red_cards: getStat('red_cards', 1)
      };

      try {
        const { error: stErr } = await sb.from('zeta_match_stats').upsert({
          match_id: matchId,
          home_stats: homeStatsObj,
          away_stats: awayStatsObj
        }, { onConflict: 'match_id' });
        if (stErr) console.warn('⚠️ Stats subtable note:', stErr.message);

        // Also update direct match_stats column on zeta_matches
        await sb.from('zeta_matches').update({
          match_stats: {
            possession_home: homeStatsObj.possession,
            possession_away: awayStatsObj.possession,
            shots_home: homeStatsObj.shots,
            shots_away: awayStatsObj.shots,
            shots_on_target_home: homeStatsObj.shots_on_target,
            shots_on_target_away: awayStatsObj.shots_on_target,
            corners_home: homeStatsObj.corners,
            corners_away: awayStatsObj.corners,
            fouls_home: homeStatsObj.fouls,
            fouls_away: awayStatsObj.fouls,
            yellow_cards_home: homeStatsObj.yellow_cards,
            yellow_cards_away: awayStatsObj.yellow_cards,
            red_cards_home: homeStatsObj.red_cards,
            red_cards_away: awayStatsObj.red_cards
          }
        }).eq('id', matchId);

        console.log(`  📊 [Stats] Synced match statistics for ${m.home_team} vs ${m.away_team}`);
      } catch (e) {
        console.warn('⚠️ [Stats] Error:', e.message);
      }
    }

    // C. EVENTS -> zeta_match_events
    const rawEvents = content.matchFacts?.events?.events || content.incidents?.allIncidents || [];
    if (rawEvents.length > 0) {
      const eventsRows = rawEvents.map(e => ({
        minute: e.time ? `${e.time}'` : `${e.min || 0}'`,
        team: e.isHome ? 'home' : 'away',
        player: e.player?.name || e.playerName || e.nameStr || 'Player',
        player_name: e.player?.name || e.playerName || e.nameStr || 'Player',
        assist: e.assistStr || e.assist?.name || null,
        type: (e.type || e.eventType || 'event').toLowerCase(),
        description: e.goalDescription || e.cardDescription || null
      }));

      try {
        const { error: evErr } = await sb.from('zeta_match_events').upsert({
          match_id: matchId,
          events: eventsRows
        }, { onConflict: 'match_id' });
        if (evErr) console.warn('⚠️ Events subtable note:', evErr.message);

        // Also update direct match_events column on zeta_matches
        await sb.from('zeta_matches').update({
          match_events: eventsRows
        }).eq('id', matchId);

        console.log(`  ⚽ [Events] Synced ${eventsRows.length} timeline events.`);
      } catch (e) {
        console.warn('⚠️ [Events] Error:', e.message);
      }
    }

    // D. COMMENTARY -> zeta_match_commentary
    const ticker = content.liveticker?.liveticker || [];
    if (ticker.length > 0) {
      const commentaryRows = ticker.slice(0, 30).map((t, idx) => ({
        minute: t.time || `${t.min || 0}'`,
        period: t.period || 'Match',
        type: t.type || 'text',
        text: t.text || t.comment || '',
        order_index: idx
      }));

      try {
        const { error: cmErr } = await sb.from('zeta_match_commentary').upsert({
          match_id: matchId,
          commentary: commentaryRows
        }, { onConflict: 'match_id' });
        if (cmErr) console.warn('⚠️ Commentary subtable note:', cmErr.message);

        console.log(`  🎙️ [Commentary] Synced ${commentaryRows.length} commentary lines.`);
      } catch (e) {
        console.warn('⚠️ [Commentary] Error:', e.message);
      }
    }
  }

  console.log(`\n🏁 [ZetaSports] Live sync cycle completed successfully at ${new Date().toISOString()}`);
}

updateLiveScoresAndTelemetry().catch(e => {
  console.error('Fatal live sync error:', e);
  process.exit(1);
});
