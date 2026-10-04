// ============================================================================
// ZetaSports v2: Stage 2 Supabase Synchronizer
// Upserts normalized matches from Stage 1 into Supabase and runs 11-day pruning
// ============================================================================

import crypto from 'crypto';
import { supabase } from './supabase_client.mjs';
import slidingWindow from '../stage1_data_engine/sliding_window.mjs';

/**
 * Generate a deterministic UUID from any string (e.g. fotmob_5181825)
 * @param {string} str
 * @returns {string} Valid RFC-compliant UUID
 */
export function toUUID(str) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(str)) return str;
  const hash = crypto.createHash('md5').update(String(str)).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

/**
 * Upsert normalized matches into Supabase
 * @param {Array} matches - Standardized matches from Stage 1
 * @returns {Promise<{ upsertedCount: number, teamsCount: number, prunedCount: number }>}
 */
export async function syncMatchesToSupabase(matches) {
  if (!Array.isArray(matches) || matches.length === 0) {
    return { upsertedCount: 0, teamsCount: 0, prunedCount: 0 };
  }

  // 1. Enforce 11-Day Sliding Window filter
  const { retained } = slidingWindow.pruneAndFilterMatches(matches);
  console.log(`[SupabaseSync] Upserting ${retained.length} matches within sliding window...`);

  // 2. Extract & Upsert Teams
  const teamsMap = new Map();
  for (const m of retained) {
    if (m.home_team?.name) {
      const teamId = toUUID(`team_${m.home_team.name.toLowerCase().trim()}`);
      teamsMap.set(teamId, {
        id: teamId,
        name: m.home_team.name,
        short_code: m.home_team.short_name || '',
        logo: m.home_team.logo_url || '',
        logo_url: m.home_team.logo_url || '',
        sport: 'football'
      });
    }
    if (m.away_team?.name) {
      const teamId = toUUID(`team_${m.away_team.name.toLowerCase().trim()}`);
      teamsMap.set(teamId, {
        id: teamId,
        name: m.away_team.name,
        short_code: m.away_team.short_name || '',
        logo: m.away_team.logo_url || '',
        logo_url: m.away_team.logo_url || '',
        sport: 'football'
      });
    }
  }

  const teamsPayload = Array.from(teamsMap.values());
  if (teamsPayload.length > 0) {
    const { error: teamErr } = await supabase.from('zeta_teams').upsert(teamsPayload, { onConflict: 'id' });
    if (teamErr) console.warn('[SupabaseSync] Team upsert notice:', teamErr.message);
  }

  // 3. Prepare match rows
  const matchRows = retained.map(m => {
    const matchUUID = toUUID(m.id || `fotmob_${m.external_ids?.fotmob}` || `match_${m.home_team?.name}_vs_${m.away_team?.name}`);
    const homeTeamUUID = toUUID(`team_${m.home_team?.name?.toLowerCase()?.trim()}`);
    const awayTeamUUID = toUUID(`team_${m.away_team?.name?.toLowerCase()?.trim()}`);

    let leagueId = null;
    const rawLg = (m.league?.name || '').toLowerCase();
    if (rawLg.includes('nations league')) {
      leagueId = '7996a8ea-1acb-43a8-84e4-788990104b9d';
    } else if (rawLg.includes('premier league')) {
      leagueId = '47';
    } else if (rawLg.includes('champions league')) {
      leagueId = '42';
    } else if (rawLg.includes('laliga') || rawLg.includes('la liga')) {
      leagueId = '87';
    } else if (rawLg.includes('serie a')) {
      leagueId = '55';
    } else if (rawLg.includes('bundesliga')) {
      leagueId = '54';
    } else if (rawLg.includes('ligue 1')) {
      leagueId = '53';
    } else if (rawLg.includes('europa league')) {
      leagueId = '73';
    } else if (rawLg.includes('conference league')) {
      leagueId = '10216';
    } else if (rawLg.includes('friendly') || rawLg.includes('friendlies')) {
      leagueId = 'intl_friendlies';
    } else if (rawLg.includes('fa cup')) {
      leagueId = '132';
    } else if (rawLg.includes('carabao cup')) {
      leagueId = '133';
    } else if (rawLg.includes('indian super league') || rawLg.includes('isl')) {
      leagueId = 'isl';
    }

    return {
      id: matchUUID,
      fotmob_id: m.external_ids?.fotmob || null,
      espn_id: m.external_ids?.espn || null,
      league_id: leagueId,
      league_name: m.league?.name || 'Football League',
      round: m.league?.name || m.league?.round || '',
      home_team_id: homeTeamUUID,
      away_team_id: awayTeamUUID,
      home_team: m.home_team?.name || 'Home Team',
      away_team: m.away_team?.name || 'Away Team',
      home_short: (m.home_team?.short_name || '').slice(0, 10),
      away_short: (m.away_team?.short_name || '').slice(0, 10),
      home_logo: m.home_team?.logo_url || '',
      away_logo: m.away_team?.logo_url || '',
      date: m.schedule?.kickoff_utc || new Date().toISOString(),
      kickoff_ist: m.schedule?.kickoff_ist || '',
      status: m.status?.state || 'scheduled',
      time_elapsed: m.status?.display_text || '',
      home_score: m.score?.home ?? 0,
      away_score: m.score?.away ?? 0,
      goal_scorers: m.events?.goals || [],
      cards: m.events?.cards || [],
      substitutions: m.events?.substitutions || [],
      stats: m.stats || {},
      active_provider: m.telemetry?.active_provider || 'fotmob',
      updated_at: new Date().toISOString()
    };
  });

  // Chunk upserts in batches of 50 for speed and network reliability
  let upsertedCount = 0;
  const chunkSize = 50;
  for (let i = 0; i < matchRows.length; i += chunkSize) {
    const chunk = matchRows.slice(i, i + chunkSize);
    const { error: matchErr } = await supabase.from('zeta_matches').upsert(chunk, { onConflict: 'id' });
    if (matchErr) {
      console.error(`[SupabaseSync] Chunk ${i}-${i + chunk.length} upsert error:`, matchErr.message);
    } else {
      upsertedCount += chunk.length;
    }
  }

  // 4. Auto-Pruning: Purge matches older than 5 days from Supabase
  const { minDateStr } = slidingWindow.getSlidingWindow();
  console.log(`[SupabaseSync] Auto-pruning Supabase matches older than ${minDateStr}...`);
  const { count: prunedCount, error: pruneErr } = await supabase
    .from('zeta_matches')
    .delete({ count: 'exact' })
    .lt('date', `${minDateStr}T00:00:00.000Z`);

  if (pruneErr) {
    console.warn('[SupabaseSync] Prune notice:', pruneErr.message);
  } else {
    console.log(`[SupabaseSync] Successfully purged ${prunedCount || 0} stale matches from database.`);
  }

  return {
    upsertedCount,
    teamsCount: teamsPayload.length,
    prunedCount: prunedCount || 0
  };
}

export default {
  toUUID,
  syncMatchesToSupabase
};
