// ==============================================================================
// ZetaSports v2: Live Score Sync Daemon (10-Second High-Frequency Poller)
// Continuously polls FotMob for in-play scores & match facts and updates
// Supabase zeta_matches directly in real-time.
// ==============================================================================

import { createClient } from '@supabase/supabase-js';

const SB_URL = (process.env.SUPABASE_URL || 'https://voocdrpetiyspuhyeapi.supabase.co').replace(/\/+$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || 'sb_publishable_luDUt769BBrrApn8z-Cgvw_W9VE0rIV';

const supabase = createClient(SB_URL, SB_KEY);

const FOTMOB_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.fotmob.com/'
};

// ANSI color helpers
const C = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
  bold: '\x1b[1m'
};

/**
 * Fetch live telemetry from FotMob matchDetails API
 */
export async function fetchFotMobMatchTelemetry(fotmobId) {
  const url = `https://www.fotmob.com/api/data/matchDetails?matchId=${fotmobId}`;
  const res = await fetch(url, { headers: FOTMOB_HEADERS, signal: AbortSignal.timeout(10000) });
  if (!res.ok) {
    throw new Error(`FotMob API HTTP ${res.status}: ${res.statusText}`);
  }
  return await res.json();
}

/**
 * Parse FotMob match details into standardized ZetaSports fields
 */
export function parseFotMobDetails(data) {
  const header = data.header || {};
  const statusObj = header.status || {};
  const teams = header.teams || [];

  let homeScore = 0;
  let awayScore = 0;

  if (teams.length >= 2) {
    homeScore = parseInt(teams[0].score, 10) || 0;
    awayScore = parseInt(teams[1].score, 10) || 0;
  } else if (statusObj.scoreStr) {
    const parts = statusObj.scoreStr.split('-').map(s => parseInt(s.trim(), 10));
    if (parts.length === 2 && !isNaN(parts[0])) {
      homeScore = parts[0];
      awayScore = parts[1];
    }
  }

  const isFinished = statusObj.finished === true;
  const isStarted = statusObj.started === true;
  const isCancelled = statusObj.cancelled === true;

  let status = 'scheduled';
  let timeElapsed = statusObj.liveTime?.short || statusObj.scoreStr || '';

  if (isFinished) {
    status = 'finished';
    timeElapsed = 'FT';
  } else if (isCancelled) {
    status = 'cancelled';
    timeElapsed = 'Cancelled';
  } else if (isStarted) {
    status = 'live';
    if (!timeElapsed || timeElapsed.includes('-')) {
      timeElapsed = statusObj.liveTime?.long || 'LIVE';
    }
  }

  const goalScorers = [];
  const cards = [];
  const subs = [];

  const events = data.content?.matchFacts?.events?.events || [];
  events.forEach(e => {
    const min = e.time || e.minute || 0;
    const isHome = e.isHome !== undefined ? e.isHome : (e.team === 'home');
    const teamKey = isHome ? 'home' : 'away';

    if (e.type === 'Goal') {
      goalScorers.push({
        team: teamKey,
        player: e.name || e.player?.name || 'Goal',
        minute: min,
        assist: e.assistStr || '',
        own_goal: e.isOwnGoal || false,
        penalty: e.isPenalty || false
      });
    } else if (e.type === 'Card') {
      cards.push({
        team: teamKey,
        player: e.name || e.player?.name || 'Player',
        minute: min,
        type: e.card === 'Red' ? 'red' : 'yellow'
      });
    } else if (e.type === 'Substitution') {
      subs.push({
        team: teamKey,
        minute: min,
        player_in: e.playerIn?.name || 'Sub In',
        player_out: e.playerOut?.name || 'Sub Out'
      });
    }
  });

  return {
    homeScore,
    awayScore,
    status,
    timeElapsed,
    goalScorers,
    cards,
    subs
  };
}

/**
 * Sync single match by FotMob ID and update Supabase
 */
export async function syncMatchByFotMobId(matchRow) {
  const fotmobId = matchRow.fotmob_id;
  if (!fotmobId) return null;

  try {
    const rawData = await fetchFotMobMatchTelemetry(fotmobId);
    const parsed = parseFotMobDetails(rawData);

    const scoreChanged = parsed.homeScore !== matchRow.home_score || parsed.awayScore !== matchRow.away_score;
    const statusChanged = parsed.status !== matchRow.status;
    const timeChanged = parsed.timeElapsed !== matchRow.time_elapsed;

    if (scoreChanged || statusChanged || timeChanged) {
      const updatePayload = {
        home_score: parsed.homeScore,
        away_score: parsed.awayScore,
        status: parsed.status,
        time_elapsed: parsed.timeElapsed,
        goal_scorers: parsed.goalScorers,
        cards: parsed.cards,
        substitutions: parsed.subs,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('zeta_matches')
        .update(updatePayload)
        .eq('id', matchRow.id);

      if (error) throw error;

      console.log(`  ${C.green}⚡ [Score Change]${C.reset} ${matchRow.home_team_name || matchRow.home_team || 'Home'} vs ${matchRow.away_team_name || matchRow.away_team || 'Away'}: ${C.bold}${parsed.homeScore} - ${parsed.awayScore}${C.reset} (${parsed.timeElapsed})`);
      return { success: true, updated: true, parsed };
    }

    return { success: true, updated: false, parsed };
  } catch (err) {
    console.error(`  ${C.red}✖ [Error]${C.reset} Match ${matchRow.id} (FotMob: ${fotmobId}):`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Sync active matches that are in-play or near kickoff
 */
export async function syncActiveMatches() {
  const { data: matches, error } = await supabase
    .from('zeta_matches')
    .select('id, home_team, away_team, home_score, away_score, fotmob_id, status, time_elapsed, date, kickoff_at')
    .not('fotmob_id', 'is', null);

  if (error) {
    console.error(`${C.red}[Supabase Error]${C.reset}`, error.message);
    return { liveCount: 0, updated: 0 };
  }

  const now = new Date();
  const activeCandidates = [];

  for (const m of matches || []) {
    const st = String(m.status || '').toLowerCase();
    if (st === 'live' || st === 'in_play') {
      activeCandidates.push(m);
      continue;
    }

    // Check if match kickoff is within -20 to +180 minutes
    const matchTime = m.kickoff_at || m.date;
    if (matchTime) {
      try {
        const dt = new Date(matchTime);
        const diff = (now - dt) / 60000;
        if (diff >= -20 && diff <= 180) {
          activeCandidates.push(m);
        }
      } catch (e) {}
    }
  }

  let updatedCount = 0;
  for (const m of activeCandidates) {
    const res = await syncMatchByFotMobId(m);
    if (res && res.updated) updatedCount++;
  }

  return { liveCount: activeCandidates.length, updated: updatedCount };
}

// ── Autonomous Loop Controller ───────────────────────────────────────────────
async function run() {
  const isOnce = process.argv.includes('--once');
  console.log(`${C.cyan}╔════════════════════════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.cyan}║   ZetaSports v2 - Local High-Frequency Sync Daemon         ║${C.reset}`);
  console.log(`${C.cyan}║   Cadence: 10 Seconds (Live Matches) / 60s (Idle Mode)     ║${C.reset}`);
  console.log(`${C.cyan}╚════════════════════════════════════════════════════════════╝${C.reset}\n`);

  if (isOnce) {
    console.log('Running single sync pass...');
    const res = await syncActiveMatches();
    console.log(`\nDone. Active: ${res.liveCount}, Updated: ${res.updated}`);
    process.exit(0);
  }

  while (true) {
    const timestamp = new Date().toLocaleTimeString();
    try {
      const { liveCount, updated } = await syncActiveMatches();
      if (liveCount > 0) {
        console.log(`[${timestamp}] ${C.green}● LIVE TRACKING${C.reset}: ${liveCount} in-play match(es) active. Next poll in 10s...`);
        await new Promise(r => setTimeout(r, 10000)); // 10-second cadence!
      } else {
        process.stdout.write(`\r[${timestamp}] ${C.dim}💤 Idle: 0 live matches. Next check in 60s...${C.reset}   `);
        await new Promise(r => setTimeout(r, 60000)); // 60s idle cadence
      }
    } catch (err) {
      console.error(`\n[${timestamp}] Loop error:`, err.message);
      await new Promise(r => setTimeout(r, 15000));
    }
  }
}

run().catch(e => {
  console.error('Fatal crash:', e);
  process.exit(1);
});
