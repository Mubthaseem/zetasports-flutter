// ==============================================================================
// ZetaSports v2: Ultra-Fast Cloudflare Worker Telemetry Engine
// 24/7 Serverless Live Scores, Goal Alerts & 10-Second Sub-Minute Poller
// ==============================================================================

const FOTMOB_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.fotmob.com/'
};

// ── 1. Telemetry Parser ───────────────────────────────────────────────────────
function parseFotMobTelemetry(data) {
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
  let timeElapsed = '';

  if (isFinished) {
    status = 'finished';
    timeElapsed = 'FT';
  } else if (isCancelled) {
    status = 'cancelled';
    timeElapsed = 'Cancelled';
  } else if (isStarted) {
    status = 'live';
    const liveTime = statusObj.liveTime || {};
    timeElapsed = liveTime.short || liveTime.long || 'LIVE';
    if (!timeElapsed || timeElapsed.includes('-')) {
      timeElapsed = 'LIVE';
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

// ── 2. Poll Active Live Matches ──────────────────────────────────────────────
async function pollActiveMatches(env) {
  const sbUrl = (env.SUPABASE_URL || 'https://voocdrpetiyspuhyeapi.supabase.co').replace(/\/+$/, '');
  const sbKey = env.SUPABASE_SERVICE_KEY || env.SUPABASE_KEY;

  if (!sbKey) {
    console.error('[Worker] SUPABASE_SERVICE_KEY missing in environment!');
    return { error: 'SUPABASE_SERVICE_KEY missing' };
  }

  const sbHeaders = {
    'apikey': sbKey,
    'Authorization': `Bearer ${sbKey}`,
    'Content-Type': 'application/json'
  };

  // 1. Fetch approved leagues list from zeta_leagues
  let approvedLeagueNames = new Set();
  try {
    const lgRes = await fetch(`${sbUrl}/rest/v1/zeta_leagues?select=name,featured&featured=eq.true`, { headers: sbHeaders });
    if (lgRes.ok) {
      const lgs = await lgRes.json();
      approvedLeagueNames = new Set(lgs.map(l => (l.name || '').trim().toLowerCase()));
      console.log(`[Worker] Loaded ${approvedLeagueNames.size} approved leagues from database.`);
    }
  } catch (err) {
    console.warn('[Worker] Could not fetch approved leagues, using fallback:', err.message);
  }

  // 2. Fetch candidate matches: status in live/in_play/scheduled with fotmob_id
  const getUrl = `${sbUrl}/rest/v1/zeta_matches?select=id,fotmob_id,home_team,away_team,home_score,away_score,status,time_elapsed,date,kickoff_at,is_approved,league_name&fotmob_id=not.is.null&order=date.asc`;
  const res = await fetch(getUrl, { headers: sbHeaders });
  if (!res.ok) {
    throw new Error(`Supabase GET matches failed: ${res.status}`);
  }

  const allMatches = await res.json();
  const now = new Date();
  const candidates = [];

  for (const m of allMatches) {
    // STRICT FILTER: Match must be explicitly approved or belong to an admin-approved competition
    const lgNorm = (m.league_name || '').trim().toLowerCase();
    const isApproved = m.is_approved === true || (approvedLeagueNames.size > 0 && approvedLeagueNames.has(lgNorm));
    if (!isApproved) {
      continue; // Skip non-approved leagues completely!
    }

    const st = String(m.status || '').toLowerCase();
    if (st === 'live' || st === 'in_play') {
      candidates.push(m);
      continue;
    }

    // Check if scheduled match is within kickoff window (+/- 3 hours)
    const matchTime = m.kickoff_at || m.date;
    if (matchTime) {
      try {
        const kickoffDt = new Date(matchTime);
        const diffMins = (now - kickoffDt) / 60000;
        if (diffMins >= -20 && diffMins <= 180) {
          candidates.push(m);
        }
      } catch (err) {}
    }
  }

  if (candidates.length === 0) {
    return { live_count: 0, polled: 0, updated: 0, message: 'No live matches active' };
  }

  let updatedCount = 0;

  // Poll telemetry concurrently for all active candidates
  await Promise.all(candidates.map(async (match) => {
    const fotmobId = match.fotmob_id;
    try {
      const fmUrl = `https://www.fotmob.com/api/data/matchDetails?matchId=${fotmobId}`;
      const fmRes = await fetch(fmUrl, { headers: FOTMOB_HEADERS });
      if (!fmRes.ok) return;

      const raw = await fmRes.json();
      const parsed = parseFotMobTelemetry(raw);

      const scoreChanged = parsed.homeScore !== match.home_score || parsed.awayScore !== match.away_score;
      const statusChanged = parsed.status !== match.status;
      const timeChanged = parsed.timeElapsed !== match.time_elapsed;

      if (scoreChanged || statusChanged || timeChanged) {
        const patchUrl = `${sbUrl}/rest/v1/zeta_matches?id=eq.${match.id}`;
        const patchPayload = {
          home_score: parsed.homeScore,
          away_score: parsed.awayScore,
          status: parsed.status,
          time_elapsed: parsed.timeElapsed,
          goal_scorers: parsed.goalScorers,
          cards: parsed.cards,
          substitutions: parsed.subs
        };

        const patchRes = await fetch(patchUrl, {
          method: 'PATCH',
          headers: { ...sbHeaders, 'Prefer': 'return=representation' },
          body: JSON.stringify(patchPayload)
        });

        if (patchRes.ok) {
          updatedCount++;
          console.log(`[Worker] Updated ${match.id}: ${parsed.homeScore}-${parsed.awayScore} (${parsed.timeElapsed})`);
        }
      }
    } catch (e) {
      console.warn(`[Worker] Error polling FotMob ${fotmobId}:`, e.message);
    }
  }));

  return { live_count: candidates.length, polled: candidates.length, updated: updatedCount };
}

// ── 3. Cloudflare Worker Entrypoint ──────────────────────────────────────────
export default {
  // Cron Handler (Triggered every minute by Cloudflare)
  async scheduled(event, env, ctx) {
    console.log('[Worker] Cron triggered:', event.cron);

    // 10-Second Sub-Minute Loop:
    // Polls every 10 seconds during the 60-second window when matches are live!
    const ITERATIONS = 5; // 5 cycles x 10s = 50s total execution
    for (let i = 0; i < ITERATIONS; i++) {
      const result = await pollActiveMatches(env);

      // If no matches are live or near kickoff, break immediately to save CPU
      if (result.live_count === 0) {
        console.log('[Worker] No matches live. Sleeping until next cron.');
        break;
      }

      if (i < ITERATIONS - 1) {
        await new Promise(resolve => setTimeout(resolve, 10000)); // sleep 10s
      }
    }
  },

  // HTTP Webhook Handler
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
      'Content-Type': 'application/json'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'healthy',
        service: 'ZetaSports v2 24/7 Cloudflare Telemetry Worker',
        timestamp: new Date().toISOString(),
        cron_cadence: '10-Second Sub-Minute Poller'
      }), { headers: corsHeaders });
    }

    if (url.pathname === '/sync/live') {
      const result = await pollActiveMatches(env);
      return new Response(JSON.stringify({
        status: 'success',
        polled_at: new Date().toISOString(),
        result
      }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
      status: 404,
      headers: corsHeaders
    });
  }
};
