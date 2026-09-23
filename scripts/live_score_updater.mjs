/**
 * live_score_updater.mjs
 *
 * Ultra-Fast Admin-Driven Live Tracking & Single Bundle Generator:
 * 1. 🤖 Auto-Untracks on Full Time (FT) - zero manual cleanup.
 * 2. ⚡ 1-Click Admin-selected matches only - zero wasted cloud minutes.
 * 3. 🚀 Compiles `data/live_bundle.json` - site loads everything in 1 request (<100ms).
 * 4. 📢 Real-Time Goal Alerts to Telegram bot on score changes.
 * 5. 💤 Smart Sleep Mode - exits in 2 seconds if no matches are live.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const rawUrl = process.env.SUPABASE_URL?.trim();
const rawKey = (process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY)?.trim();

const SUPABASE_URL = rawUrl && rawUrl.length > 5 ? rawUrl : 'https://voocdrpetiyspuhyeapi.supabase.co';
const SUPABASE_KEY = rawKey && rawKey.length > 10 ? rawKey : 'sb_publishable_luDUt769BBrrApn8z-Cgvw_W9VE0rIV';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── 1. Telegram Goal Alerts Dispatcher ───────────────────────────────────────
async function sendTelegramAlert(botToken, chatId, messageHtml) {
  if (!botToken || !chatId) return;
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageHtml,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });
    if (res.ok) {
      console.log('  📢 [Telegram] Real-time goal alert dispatched successfully!');
    }
  } catch (e) {
    console.warn('  ⚠️ [Telegram] Note:', e.message);
  }
}

// ── 2. Resolve FotMob Build ID ───────────────────────────────────────────────
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
    return 'quX4vmazDEcAFzWw1ZjDZ';
  }
}

// ── 3. Sync Standings ────────────────────────────────────────────────────────
async function updateStandings(buildId) {
  try {
    const leagueUrl = `https://www.fotmob.com/_next/data/${buildId}/leagues/516/overview/ligue-1.json`;
    const res = await fetch(leagueUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
    });
    if (!res.ok) return [];

    const data = await res.json();
    const rawTable = data.pageProps?.table?.[0]?.data?.table?.all || [];
    if (rawTable.length === 0) return [];

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

    // Also write to data/matches/standings/516.json
    const standingsDir = path.join(ROOT_DIR, 'data', 'matches', 'standings');
    if (!fs.existsSync(standingsDir)) fs.mkdirSync(standingsDir, { recursive: true });
    fs.writeFileSync(path.join(standingsDir, '516.json'), JSON.stringify({
      competitionId: "516",
      competitionName: "Algerian Ligue 1",
      updatedAt: new Date().toISOString(),
      table: formattedTable
    }, null, 2));

    console.log(`✅ [Standings] Synced ${formattedTable.length} teams in Algerian Ligue 1.`);
    return formattedTable;
  } catch (e) {
    console.warn('⚠️ [Standings] Note:', e.message);
    return [];
  }
}

// ── 4. Fetch Deep Match Telemetry (Direct FotMob API) ──────────────────────────
async function fetchMatchTelemetry(fotmobId) {
  const url = `https://www.fotmob.com/api/data/matchDetails?matchId=${fotmobId}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Referer': 'https://www.fotmob.com/',
        'Accept': 'application/json, text/plain, */*'
      }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

// ── 5. Main Execution Engine ─────────────────────────────────────────────────
async function updateLiveScoresAndTelemetry() {
  const startTime = Date.now();
  console.log(`\n🚀 ZetaSports Autonomous Live Engine — ${new Date().toISOString()}`);

  // Fetch telegram config from Supabase or env
  let tgBotToken = process.env.TELEGRAM_BOT_TOKEN;
  let tgChatId = process.env.TELEGRAM_CHAT_ID;
  try {
    const { data: cfg } = await sb.from('zeta_config').select('*').eq('id', 'global').maybeSingle();
    if (cfg) {
      if (!tgBotToken && cfg.telegram_bot_token) tgBotToken = cfg.telegram_bot_token;
      if (!tgChatId && cfg.telegram_chat_id) tgChatId = cfg.telegram_chat_id;
    }
  } catch (e) {}

  // 1. Read Admin-Selected Tracked Matches
  const trackedMatchesFilePath = path.join(ROOT_DIR, 'data', 'tracked_matches.json');
  let trackedConfig = { updatedAt: new Date().toISOString(), trackedMatches: [] };
  if (fs.existsSync(trackedMatchesFilePath)) {
    try {
      trackedConfig = JSON.parse(fs.readFileSync(trackedMatchesFilePath, 'utf8'));
    } catch (e) {
      console.warn('⚠️ Could not parse tracked_matches.json:', e.message);
    }
  }

  // Also query Supabase for matches marked status = 'live'
  const { data: dbLiveMatches } = await sb
    .from('zeta_matches')
    .select('id, fotmob_id, home_team, away_team, home_logo, away_logo, league_name, status, home_score, away_score, time_elapsed, date')
    .eq('status', 'live')
    .not('fotmob_id', 'is', null);

  // Merge unique targets
  const targetMap = new Map();

  for (const m of (trackedConfig.trackedMatches || [])) {
    // Only track if active live (not finished or archived)
    if (m.fotmobId && m.status !== 'archived' && m.status !== 'finished') {
      targetMap.set(String(m.fotmobId), {
        fotmobId: String(m.fotmobId),
        id: m.matchId || null,
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        status: m.status || 'live',
        previousScore: `${m.homeScore ?? ''}-${m.awayScore ?? ''}`
      });
    }
  }

  for (const m of (dbLiveMatches || [])) {
    if (m.fotmob_id) {
      const fId = String(m.fotmob_id);
      const existing = targetMap.get(fId) || {};
      targetMap.set(fId, {
        ...existing,
        fotmobId: fId,
        id: m.id,
        homeTeam: m.home_team || existing.homeTeam,
        awayTeam: m.away_team || existing.awayTeam,
        homeLogo: m.home_logo,
        awayLogo: m.away_logo,
        leagueName: m.league_name,
        status: 'live',
        previousScore: `${m.home_score ?? ''}-${m.away_score ?? ''}`
      });
    }
  }

  if (process.env.MATCH_ID) {
    const fId = String(process.env.MATCH_ID).trim();
    if (fId.length > 0) {
      const existing = targetMap.get(fId) || {};
      targetMap.set(fId, {
        ...existing,
        fotmobId: fId,
        status: 'live',
        previousScore: '-'
      });
      console.log(`📌 [Workflow Target] Manual MATCH_ID injected: ${fId}`);
    }
  }

  const activeTargets = Array.from(targetMap.values());

  // 💤 5. SMART SLEEP MODE: If 0 tracked matches, exit in ~2 seconds
  if (activeTargets.length === 0) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`💤 [Smart Sleep] 0 active live matches. Completed cleanly in ${elapsed}s.`);

    // Keep live.json and live_bundle.json clean
    const fixturesDir = path.join(ROOT_DIR, 'data', 'fixtures');
    if (!fs.existsSync(fixturesDir)) fs.mkdirSync(fixturesDir, { recursive: true });
    fs.writeFileSync(path.join(fixturesDir, 'live.json'), '[]\n');

    const liveBundlePath = path.join(ROOT_DIR, 'data', 'live_bundle.json');
    fs.writeFileSync(liveBundlePath, JSON.stringify({
      generatedAt: new Date().toISOString(),
      activeMatchesCount: 0,
      matches: []
    }, null, 2) + '\n');

    const metaJsonPath = path.join(ROOT_DIR, 'data', 'meta.json');
    if (fs.existsSync(metaJsonPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaJsonPath, 'utf8'));
        meta.lastSuccessfulSync = new Date().toISOString();
        meta.activeMatchesCount = 0;
        fs.writeFileSync(metaJsonPath, JSON.stringify(meta, null, 2) + '\n');
      } catch (e) {}
    }

    return;
  }

  console.log(`🎯 Found ${activeTargets.length} admin-selected match(es) for live tracking:`);
  for (const t of activeTargets) {
    console.log(`  👉 [${t.fotmobId}] ${t.homeTeam || 'Home'} vs ${t.awayTeam || 'Away'}`);
  }

  const buildId = await getFotmobBuildId();
  console.log(`📡 FotMob Build ID: ${buildId}`);

  // Sync Ligue 1 standings in background
  const latestStandings = await updateStandings(buildId);

  const bundledLiveMatches = [];
  const updatedTrackedMatches = [];

  for (const target of activeTargets) {
    const fId = target.fotmobId;
    console.log(`\n🔍 Fetching live telemetry for FotMob ID: ${fId}...`);

    const details = await fetchMatchTelemetry(fId);
    if (!details) {
      console.warn(`  ⚠️ Could not fetch details for FotMob match ${fId}`);
      updatedTrackedMatches.push(target);
      continue;
    }

    const header = details.header || {};
    const content = details.content || {};
    const teams = header.teams || [];
    const statusObj = header.status || {};

    let homeScore = 0;
    let awayScore = 0;
    if (teams.length >= 2) {
      homeScore = parseInt(teams[0].score, 10) || 0;
      awayScore = parseInt(teams[1].score, 10) || 0;
    }

    let status = 'live';
    let timeElapsed = 'Live';
    let period = 'In Play';

    // 🤖 1. AUTO-UNTRACK ON FULL TIME (FT)
    let isFinished = false;
    if (statusObj.finished) {
      status = 'finished';
      timeElapsed = statusObj.reason?.short || 'FT';
      period = 'Full Time';
      isFinished = true;
    } else if (statusObj.started) {
      status = 'live';
      timeElapsed = statusObj.liveTime?.short || statusObj.liveTime?.long || 'Live';
      period = statusObj.reason?.short === 'HT' ? 'Half Time' : 'In Play';
    } else if (statusObj.cancelled) {
      status = 'cancelled';
      timeElapsed = 'PP';
      isFinished = true;
    }

    const homeTeamName = teams[0]?.name || target.homeTeam || 'Home Team';
    const awayTeamName = teams[1]?.name || target.awayTeam || 'Away Team';
    const homeTeamLogo = teams[0]?.imageUrl || `https://images.fotmob.com/image_resources/logo/teamlogo/${teams[0]?.id}_small.png`;
    const awayTeamLogo = teams[1]?.imageUrl || `https://images.fotmob.com/image_resources/logo/teamlogo/${teams[1]?.id}_small.png`;

    console.log(`  ⚡ Score: ${homeTeamName} ${homeScore} - ${awayScore} ${awayTeamName} (${timeElapsed}) | Status: ${status.toUpperCase()}`);

    // 📢 4. REAL-TIME GOAL ALERT DISPATCHER
    const currentScoreStr = `${homeScore}-${awayScore}`;
    if (target.previousScore && target.previousScore !== '-' && target.previousScore !== currentScoreStr) {
      const goalMsg = `⚽ <b>GOAL!</b>\n\n<b>${homeTeamName}</b> ${homeScore} - ${awayScore} <b>${awayTeamName}</b>\n⏱ <i>${timeElapsed}</i>\n🏆 ${header.leagueName || 'Match Alert'}\n\n📲 Watch live on ZETA SPORTS!`;
      await sendTelegramAlert(tgBotToken, tgChatId, goalMsg);
    }

    // Resolve Supabase match ID
    let matchId = target.id;
    if (!matchId) {
      const { data: found } = await sb.from('zeta_matches').select('id').eq('fotmob_id', fId).maybeSingle();
      if (found) matchId = found.id;
    }

    // Lineups
    let parsedLineups = null;
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
          y: (p.verticalLayout?.y ? 0.5 + (p.verticalLayout.y * 0.45) : 0.75)
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
          y: (p.verticalLayout?.y ? (p.verticalLayout.y * 0.45) : 0.25)
        });
      }

      const homeSubs = (homeTeam.subs || []).map(s => ({ name: s.name, number: s.shirtNumber, is_home: true }));
      const awaySubs = (awayTeam.subs || []).map(s => ({ name: s.name, number: s.shirtNumber, is_home: false }));

      parsedLineups = {
        home_formation: homeTeam.formation || '4-3-3',
        away_formation: awayTeam.formation || '4-2-3-1',
        coach_home: homeTeam.coach?.name || null,
        coach_away: awayTeam.coach?.name || null,
        players,
        substitutes: [...homeSubs, ...awaySubs]
      };

      if (matchId) {
        try {
          await sb.from('zeta_match_lineups').upsert({
            match_id: matchId,
            home_lineup: { formation: parsedLineups.home_formation, coach: parsedLineups.coach_home, players: players.filter(p => p.is_home), substitutes: homeSubs },
            away_lineup: { formation: parsedLineups.away_formation, coach: parsedLineups.coach_away, players: players.filter(p => !p.is_home), substitutes: awaySubs }
          }, { onConflict: 'match_id' });
        } catch (e) {}
      }
    }

    // Extract xG
    let xgHome = null;
    let xgAway = null;
    const allStatsPeriods = content.stats?.Periods?.All?.stats || [];
    for (const group of allStatsPeriods) {
      const item = group.stats?.find(s => (s.key === 'expected_goals' || s.title?.toLowerCase().includes('expected goals')) && Array.isArray(s.stats));
      if (item && item.stats[0] !== null) {
        xgHome = parseFloat(item.stats[0]) || 0;
        xgAway = parseFloat(item.stats[1]) || 0;
        break;
      }
    }
    if (xgHome === null && content.shotmap?.shots?.length) {
      let hX = 0, aX = 0;
      const hTeamId = details.general?.homeTeam?.id || teams[0]?.id;
      content.shotmap.shots.forEach(s => {
        if (s.teamId === hTeamId) hX += (s.expectedGoals || 0);
        else aX += (s.expectedGoals || 0);
      });
      xgHome = parseFloat(hX.toFixed(2));
      xgAway = parseFloat(aX.toFixed(2));
    }

    // Stats
    let homeStatsObj = null;
    let awayStatsObj = null;
    if (content.stats) {
      const flat = {};
      for (const group of allStatsPeriods) {
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

      homeStatsObj = {
        possession: getStat('ballpossesion', 0) || 50,
        shots: getStat('total_shots', 0),
        shots_on_target: getStat('shotsontarget', 0),
        corners: getStat('corners', 0),
        fouls: getStat('fouls', 0) || 10,
        yellow_cards: getStat('yellow_cards', 0),
        red_cards: getStat('red_cards', 0),
        xg: xgHome
      };

      awayStatsObj = {
        possession: getStat('ballpossesion', 1) || 50,
        shots: getStat('total_shots', 1),
        shots_on_target: getStat('shotsontarget', 1),
        corners: getStat('corners', 1),
        fouls: getStat('fouls', 1) || 12,
        yellow_cards: getStat('yellow_cards', 1),
        red_cards: getStat('red_cards', 1),
        xg: xgAway
      };

      if (matchId) {
        try {
          await sb.from('zeta_match_stats').upsert({
            match_id: matchId,
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
            xg_home: xgHome != null ? xgHome : undefined,
            xg_away: xgAway != null ? xgAway : undefined,
            home_stats: homeStatsObj,
            away_stats: awayStatsObj,
            updated_at: new Date().toISOString()
          }, { onConflict: 'match_id' });
        } catch (e) {}
      }
    }

    // Events & Goal Scorers
    let eventsRows = [];
    const rawEvents = content.matchFacts?.events?.events || content.incidents?.allIncidents || [];
    if (rawEvents.length > 0) {
      eventsRows = rawEvents.map(e => ({
        minute: e.time ? `${e.time}'` : `${e.min || 0}'`,
        team: e.isHome ? 'home' : 'away',
        player: e.player?.name || e.playerName || e.nameStr || 'Player',
        player_name: e.player?.name || e.playerName || e.nameStr || 'Player',
        assist: e.assistStr || e.assist?.name || null,
        type: (e.type || e.eventType || 'event').toLowerCase(),
        description: e.goalDescription || e.cardDescription || null
      }));

      if (matchId) {
        try {
          await sb.from('zeta_match_events').upsert({
            match_id: matchId,
            events: eventsRows
          }, { onConflict: 'match_id' });
        } catch (e) {}
      }
    }

    const goalEvents = rawEvents.filter(e => (e.type || e.eventType || '').toLowerCase() === 'goal');
    const homeScorersList = goalEvents.filter(e => e.isHome).map(g => `${g.nameStr || g.player?.name || 'Goal'} ${g.timeStr || g.time || ''}'${g.ownGoal ? ' (OG)' : ''}`).join(', ');
    const awayScorersList = goalEvents.filter(e => !e.isHome).map(g => `${g.nameStr || g.player?.name || 'Goal'} ${g.timeStr || g.time || ''}'${g.ownGoal ? ' (OG)' : ''}`).join(', ');

    // Dump master raw JSON into fotmob_raw
    try {
      await sb.from('fotmob_raw').upsert({
        match_id: String(fId),
        data_key: 'match',
        raw_json: details,
        fetched_at: new Date().toISOString(),
        phase: isFinished ? 'post' : (statusObj.started ? 'live' : 'pre')
      }, { onConflict: 'match_id,data_key' });
    } catch (e) {}

    // Commentary
    let commentaryRows = [];
    const ticker = content.liveticker?.liveticker || [];
    if (ticker.length > 0) {
      commentaryRows = ticker.slice(0, 30).map((t, idx) => ({
        minute: t.time || `${t.min || 0}'`,
        period: t.period || 'Match',
        type: t.type || 'text',
        text: t.text || t.comment || '',
        order_index: idx
      }));

      if (matchId) {
        try {
          await sb.from('zeta_match_commentary').upsert({
            match_id: matchId,
            commentary: commentaryRows
          }, { onConflict: 'match_id' });
        } catch (e) {}
      }
    }

    // Update Supabase zeta_matches
    if (matchId) {
      await sb.from('zeta_matches').update({
        status,
        time_elapsed: timeElapsed,
        home_score: homeScore,
        away_score: awayScore,
        period,
        lineups: parsedLineups,
        match_stats: homeStatsObj ? {
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
          red_cards_away: awayStatsObj.red_cards,
          xg_home: xgHome,
          xg_away: xgAway
        } : undefined,
        match_events: eventsRows,
        updated_at: new Date().toISOString()
      }).eq('id', matchId);
    }

    // 🚀 2. BUILD SINGLE PRE-COMPILED BUNDLE OBJECT (< 100ms load)
    const matchBundle = {
      id: String(fId),
      matchId: matchId || null,
      competitionId: String(header.leagueId || "516"),
      competitionName: header.leagueName || target.leagueName || "Football League",
      competitionSlug: (header.leagueName || "league").toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      country: "Algeria",
      round: header.round || 1,
      utcDate: header.status?.utcTime || new Date().toISOString(),
      status: isFinished ? 'FINISHED' : (period === 'Half Time' ? 'PAUSED' : 'IN_PLAY'),
      minute: timeElapsed,
      homeTeam: {
        id: String(teams[0]?.id || 'home'),
        name: homeTeamName,
        shortName: teams[0]?.name || homeTeamName,
        logoUrl: homeTeamLogo,
        score: homeScore
      },
      awayTeam: {
        id: String(teams[1]?.id || 'away'),
        name: awayTeamName,
        shortName: teams[1]?.name || awayTeamName,
        logoUrl: awayTeamLogo,
        score: awayScore
      },
      score: { home: homeScore, away: awayScore },
      lineups: parsedLineups,
      stats: { home: homeStatsObj, away: awayStatsObj },
      events: eventsRows,
      xg: (xgHome != null && xgAway != null) ? { home: xgHome, away: xgAway } : undefined,
      scorers: { home: homeScorersList, away: awayScorersList },
      venue: content.matchFacts?.infoBox?.Stadium?.name || undefined,
      referee: typeof content.matchFacts?.infoBox?.Referee === 'string' ? content.matchFacts?.infoBox?.Referee : (content.matchFacts?.infoBox?.Referee?.text || undefined),
      updatedAt: new Date().toISOString()
    };

    bundledLiveMatches.push(matchBundle);

    // Auto-untrack logic
    if (isFinished) {
      console.log(`  🤖 [Auto-Untrack] Match ${fId} reached ${timeElapsed}. Auto-archiving.`);
      updatedTrackedMatches.push({
        ...target,
        status: 'finished',
        homeScore,
        awayScore,
        timeElapsed,
        archivedAt: new Date().toISOString()
      });
    } else {
      updatedTrackedMatches.push({
        ...target,
        status: 'live',
        homeScore,
        awayScore,
        timeElapsed,
        previousScore: currentScoreStr
      });
    }
  }

  // ── 6. WRITE DATA BUNDLES ──────────────────────────────────────────────────
  const fixturesDir = path.join(ROOT_DIR, 'data', 'fixtures');
  if (!fs.existsSync(fixturesDir)) fs.mkdirSync(fixturesDir, { recursive: true });

  // 1. live.json (standard format)
  fs.writeFileSync(path.join(fixturesDir, 'live.json'), JSON.stringify(bundledLiveMatches.map(m => ({
    id: m.id,
    competitionId: m.competitionId,
    competitionName: m.competitionName,
    competitionSlug: m.competitionSlug,
    country: m.country,
    round: m.round,
    utcDate: m.utcDate,
    status: m.status,
    minute: m.minute,
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    score: m.score,
    venue: m.venue,
    referee: m.referee,
    updatedAt: m.updatedAt
  })), null, 2) + '\n');

  // 2. live_bundle.json (Ultra-fast single pre-compiled bundle)
  const masterBundle = {
    generatedAt: new Date().toISOString(),
    activeMatchesCount: bundledLiveMatches.length,
    matches: bundledLiveMatches,
    standings: latestStandings
  };
  fs.writeFileSync(path.join(ROOT_DIR, 'data', 'live_bundle.json'), JSON.stringify(masterBundle, null, 2) + '\n');
  console.log(`💾 Pre-compiled single bundle saved to data/live_bundle.json (${bundledLiveMatches.length} matches)`);

  // 3. tracked_matches.json
  trackedConfig.updatedAt = new Date().toISOString();
  trackedConfig.trackedMatches = updatedTrackedMatches;
  fs.writeFileSync(trackedMatchesFilePath, JSON.stringify(trackedConfig, null, 2) + '\n');

  // 4. meta.json
  const metaJsonPath = path.join(ROOT_DIR, 'data', 'meta.json');
  if (fs.existsSync(metaJsonPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaJsonPath, 'utf8'));
      meta.lastSuccessfulSync = new Date().toISOString();
      meta.activeMatchesCount = bundledLiveMatches.length;
      fs.writeFileSync(metaJsonPath, JSON.stringify(meta, null, 2) + '\n');
    } catch (e) {}
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n🏁 [ZetaSports] Autonomous cycle completed in ${totalTime}s.`);
}

updateLiveScoresAndTelemetry().catch(e => {
  console.error('Fatal live sync error:', e);
  process.exit(1);
});
