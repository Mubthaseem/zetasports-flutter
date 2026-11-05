// ==============================================================================
// Netlify / Vercel Serverless Function: FotMob Live Telemetry & Supabase Sync (OWASP A10)
// ==============================================================================

import https from 'https';
import crypto from 'crypto';
import { verifyJWT } from './auth.js';

const SUPABASE_HOST = process.env.SUPABASE_HOST || 'udlncusvhmydivtjkjcy.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';
const SESSION_SECRET = process.env.SESSION_SECRET || (process.env.SUPABASE_SERVICE_ROLE_KEY ? crypto.createHash('sha256').update(process.env.SUPABASE_SERVICE_ROLE_KEY).digest('hex') : 'zeta_admin_auth_entropy');

function httpsGet(url, customHeaders = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36', ...customHeaders } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (_) {
          resolve({ status: res.statusCode, data });
        }
      });
    }).on('error', reject);
  });
}

function httpsRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (_) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    req.end();
  });
}

function parseCookies(header = '') {
  const list = {};
  header.split(';').forEach(c => {
    const parts = c.split('=');
    if (parts.length >= 2) list[parts[0].trim()] = decodeURIComponent(parts.slice(1).join('=').trim());
  });
  return list;
}

function toUUID(str) {
  const hash = crypto.createHash('md5').update(String(str)).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function formatIST(isoString) {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch (e) {
    return '';
  }
}

const APPROVED_LEAGUES_WHITELIST = [
  'premier league', 'laliga', 'la liga', 'serie a', 'bundesliga', 'ligue 1',
  'fa cup', 'copa del rey', 'champions league', 'europa league', 'conference league',
  'afc cup', 'caf confed', 'caf confederation', 'super cup', 'campeones cup',
  'copa argentina', 'indian super league', 'super league', 'isl', 'i-league',
  'durand cup', 'world cup', 'euro', 'european championship', 'copa america',
  'asian cup', 'saff', 'saff championship', 'friendly', 'friendlies'
];

function isApprovedCompetition(leagueName, ccode) {
  if (!leagueName) return false;
  const lower = leagueName.toLowerCase().trim();
  if (lower === 'super league' && ccode && ccode !== 'IND') return false;
  return APPROVED_LEAGUES_WHITELIST.some(w => lower.includes(w));
}

function resolveLeagueId(leagueName) {
  const lower = (leagueName || '').toLowerCase();
  if (lower.includes('nations league')) return '7996a8ea-1acb-43a8-84e4-788990104b9d';
  if (lower.includes('premier league')) return '47';
  if (lower.includes('champions league')) return '42';
  if (lower.includes('laliga') || lower.includes('la liga')) return '87';
  if (lower.includes('serie a')) return '55';
  if (lower.includes('bundesliga')) return '54';
  if (lower.includes('ligue 1')) return '53';
  if (lower.includes('europa league')) return '73';
  if (lower.includes('conference league')) return '10216';
  if (lower.includes('fa cup')) return '132';
  if (lower.includes('carabao cup')) return '133';
  if (lower.includes('isl') || lower.includes('indian super league')) return 'isl';
  if (lower.includes('saff')) return '9876';
  return null;
}

function getSlidingWindowDates() {
  const dates = [];
  const base = new Date();
  for (let offset = -1; offset <= 2; offset++) {
    const d = new Date(base);
    d.setUTCDate(base.getUTCDate() + offset);
    dates.push(d.toISOString().slice(0, 10).replace(/-/g, ''));
  }
  return dates;
}

export const handler = async (event) => {
  const method = event.httpMethod;
  const path = event.path.replace(/\/\.netlify\/functions\/fotmob/, '').replace(/\/api\/fotmob/, '');

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': event.headers.origin || '*',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (method === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  // Route: /inspect-league (Public read-only inspection of FotMob League metadata)
  if (path === '/inspect-league' && method === 'GET') {
    try {
      const q = event.queryStringParameters || {};
      const rawInput = q.id || q.url || '';
      const match = String(rawInput).match(/leagues\/(\d+)/i) || String(rawInput).match(/^(\d+)$/);
      const leagueId = match ? match[1] : null;

      if (!leagueId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Valid FotMob League ID or URL is required' }) };
      }

      const fotmobUrl = `https://www.fotmob.com/api/data/leagues?id=${encodeURIComponent(leagueId)}`;
      const fmRes = await httpsGet(fotmobUrl);

      if (fmRes.status !== 200 || !fmRes.data || !fmRes.data.details) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'League not found on FotMob for ID: ' + leagueId }) };
      }

      const d = fmRes.data;
      const details = d.details || {};
      const allMatches = d.fixtures?.allMatches || [];
      const logoUrl = `https://images.fotmob.com/image_resources/logo/leaguelogo/${leagueId}.png`;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          league: {
            id: String(leagueId),
            name: details.name || details.shortName || 'Unknown Tournament',
            country: details.country || 'INT',
            season: details.selectedSeason || '2026',
            sport: 'football',
            logoUrl: logoUrl,
            color: details.leagueColor || '#2235B6',
            seopath: details.seopath || ''
          },
          fixturesCount: allMatches.length,
          sampleFixtures: allMatches.slice(0, 5).map(m => ({
            id: m.id,
            home: m.home?.name,
            away: m.away?.name,
            date: m.status?.utcTime,
            round: m.round
          }))
        })
      };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  const cookies = parseCookies(event.headers.cookie || '');
  const token = cookies.zeta_admin_session || (event.headers.authorization || '').replace('Bearer ', '');
  const user = verifyJWT(token, SESSION_SECRET);

  if (!user) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized: Admin session required' }) };
  }

  // Route: /sync-window (Ingests fresh sliding window fixtures from FotMob)
  if (path === '/sync-window' && method === 'POST') {
    try {
      const dates = getSlidingWindowDates();
      let totalSynced = 0;
      const allTeams = new Map();
      const allMatches = [];

      for (const dStr of dates) {
        const url = `https://www.fotmob.com/api/data/matches?date=${dStr}`;
        const fmRes = await httpsGet(url);
        if (fmRes.status !== 200 || !fmRes.data || !fmRes.data.leagues) continue;

        for (const lg of fmRes.data.leagues) {
          if (!isApprovedCompetition(lg.name, lg.ccode)) continue;

          for (const m of (lg.matches || [])) {
            if (!m.home || !m.away || !m.home.name || !m.away.name) continue;

            const homeTeamId = toUUID(`team_${m.home.name.toLowerCase().trim()}`);
            const awayTeamId = toUUID(`team_${m.away.name.toLowerCase().trim()}`);
            const homeLogo = m.home.id ? `https://images.fotmob.com/image_resources/logo/teamlogo/${m.home.id}.png` : '';
            const awayLogo = m.away.id ? `https://images.fotmob.com/image_resources/logo/teamlogo/${m.away.id}.png` : '';

            allTeams.set(homeTeamId, {
              id: homeTeamId,
              name: m.home.name,
              short_code: (m.home.shortName || m.home.name).slice(0, 10),
              logo: homeLogo,
              logo_url: homeLogo
            });

            allTeams.set(awayTeamId, {
              id: awayTeamId,
              name: m.away.name,
              short_code: (m.away.shortName || m.away.name).slice(0, 10),
              logo: awayLogo,
              logo_url: awayLogo
            });

            const statusObj = m.status || {};
            let status = 'scheduled';
            let timeElapsed = '';

            if (statusObj.finished === true) {
              status = 'finished';
              timeElapsed = 'FT';
            } else if (statusObj.started === true) {
              status = 'live';
              timeElapsed = statusObj.liveTime?.short || statusObj.liveTime?.long || 'LIVE';
            } else if (statusObj.cancelled === true) {
              status = 'cancelled';
              timeElapsed = 'Cancelled';
            }

            const utcTime = statusObj.utcTime || (m.timeTS ? new Date(m.timeTS).toISOString() : new Date().toISOString());
            const matchId = toUUID(`fotmob_${m.id}`);

            allMatches.push({
              id: matchId,
              fotmob_id: String(m.id),
              league_id: resolveLeagueId(lg.name),
              league_name: (lg.name && lg.name.toLowerCase().includes('saff')) ? 'SAFF Championship' : (lg.name || 'Football League'),
              round: lg.name || '',
              home_team_id: homeTeamId,
              away_team_id: awayTeamId,
              home_team: m.home.name,
              away_team: m.away.name,
              home_short: (m.home.shortName || m.home.name).slice(0, 10),
              away_short: (m.away.shortName || m.away.name).slice(0, 10),
              home_logo: homeLogo,
              away_logo: awayLogo,
              date: utcTime,
              kickoff_ist: formatIST(utcTime),
              status: status,
              time_elapsed: timeElapsed,
              home_score: m.home.score ?? 0,
              away_score: m.away.score ?? 0,
              updated_at: new Date().toISOString()
            });
          }
        }
      }

      // Upsert teams in batches of 50
      const teamsArr = Array.from(allTeams.values());
      for (let i = 0; i < teamsArr.length; i += 50) {
        const chunk = teamsArr.slice(i, i + 50);
        await httpsRequest({
          hostname: SUPABASE_HOST,
          path: '/rest/v1/zeta_teams',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Prefer': 'resolution=merge-duplicates'
          }
        }, chunk);
      }

      // Upsert matches in batches of 50
      for (let i = 0; i < allMatches.length; i += 50) {
        const chunk = allMatches.slice(i, i + 50);
        await httpsRequest({
          hostname: SUPABASE_HOST,
          path: '/rest/v1/zeta_matches',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Prefer': 'resolution=merge-duplicates'
          }
        }, chunk);
        totalSynced += chunk.length;
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, count: totalSynced, teams: allTeams.size })
      };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  // Route: /sync-match
  if (path === '/sync-match' && method === 'POST') {
    try {
      const { matchId, fotmobId } = JSON.parse(event.body || '{}');
      if (!matchId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'matchId is required' }) };
      }

      let targetFotmobId = fotmobId;
      if (!targetFotmobId) {
        const matchRes = await httpsRequest({
          hostname: SUPABASE_HOST,
          path: `/rest/v1/zeta_matches?id=eq.${encodeURIComponent(matchId)}&select=fotmob_id`,
          method: 'GET',
          headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
          }
        });
        if (Array.isArray(matchRes.data) && matchRes.data[0]?.fotmob_id) {
          targetFotmobId = matchRes.data[0].fotmob_id;
        }
      }

      if (!targetFotmobId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'No fotmob_id found for match in Supabase' }) };
      }

      // Fetch live details from FotMob API Gateway (SSRF restricted to fotmob.com)
      const fotmobUrl = `https://www.fotmob.com/api/matchDetails?matchId=${encodeURIComponent(targetFotmobId)}`;
      const fotmobRes = await httpsGet(fotmobUrl);

      if (fotmobRes.status !== 200 || !fotmobRes.data) {
        return { statusCode: 502, headers, body: JSON.stringify({ error: 'Failed to fetch match from FotMob' }) };
      }

      const d = fotmobRes.data;
      const header = d.header || {};
      const status = header.status || {};
      const teams = header.teams || [];

      const patchData = {
        updated_at: new Date().toISOString()
      };

      if (teams.length >= 2) {
        patchData.home_score = teams[0].score !== undefined ? parseInt(teams[0].score, 10) : null;
        patchData.away_score = teams[1].score !== undefined ? parseInt(teams[1].score, 10) : null;
      }

      if (status.finished) patchData.status = 'finished';
      else if (status.liveTime) patchData.status = 'live';

      if (d.content?.lineup) {
        patchData.lineups = d.content.lineup;
      }
      if (d.content?.matchFacts?.events) {
        patchData.events = d.content.matchFacts.events;
      }
      if (d.content?.stats) {
        patchData.stats = d.content.stats;
      }

      // Patch into Supabase
      const updateRes = await httpsRequest({
        hostname: SUPABASE_HOST,
        path: `/rest/v1/zeta_matches?id=eq.${encodeURIComponent(matchId)}`,
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Prefer': 'return=representation'
        }
      }, patchData);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          matchId,
          fotmobId: targetFotmobId,
          data: updateRes.data
        })
      };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  // Route: /add-league (Save league to zeta_leagues and sync its fixtures)
  if (path === '/add-league' && method === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');
      const rawInput = body.leagueId || body.fotmobUrl || body.url || '';
      const match = String(rawInput).match(/leagues\/(\d+)/i) || String(rawInput).match(/^(\d+)$/);
      const leagueId = match ? match[1] : String(rawInput).trim();

      if (!leagueId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'League ID or URL is required' }) };
      }

      // Fetch live metadata from FotMob
      const fotmobUrl = `https://www.fotmob.com/api/data/leagues?id=${encodeURIComponent(leagueId)}`;
      const fmRes = await httpsGet(fotmobUrl);
      const d = (fmRes.status === 200 && fmRes.data) ? fmRes.data : {};
      const details = d.details || {};

      const leagueName = body.name || details.name || details.shortName || `League ${leagueId}`;
      const country = body.country || details.country || 'INT';
      const season = body.season || details.selectedSeason || '2026';
      const logoUrl = body.logoUrl || `https://images.fotmob.com/image_resources/logo/leaguelogo/${leagueId}.png`;

      // 1. Upsert into zeta_leagues
      const leagueRow = {
        id: String(leagueId),
        name: leagueName,
        logo: logoUrl,
        logo_url: logoUrl,
        country: country,
        season: season,
        sport: body.sport || 'football'
      };

      await httpsRequest({
        hostname: SUPABASE_HOST,
        path: '/rest/v1/zeta_leagues',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Prefer': 'resolution=merge-duplicates'
        }
      }, leagueRow);

      // 2. Sync all matches for this league if available or requested
      let syncedMatchesCount = 0;
      const allMatches = d.fixtures?.allMatches || [];

      if (body.syncFixtures !== false && allMatches.length > 0) {
        const allTeams = new Map();
        const matchRows = [];

        for (const m of allMatches) {
          if (!m.home || !m.away || !m.home.name || !m.away.name) continue;

          const homeTeamId = toUUID(`team_${m.home.name.toLowerCase().trim()}`);
          const awayTeamId = toUUID(`team_${m.away.name.toLowerCase().trim()}`);
          const homeLogo = m.home.id ? `https://images.fotmob.com/image_resources/logo/teamlogo/${m.home.id}.png` : '';
          const awayLogo = m.away.id ? `https://images.fotmob.com/image_resources/logo/teamlogo/${m.away.id}.png` : '';

          allTeams.set(homeTeamId, {
            id: homeTeamId,
            name: m.home.name,
            short_code: (m.home.shortName || m.home.name).slice(0, 10),
            logo: homeLogo,
            logo_url: homeLogo
          });

          allTeams.set(awayTeamId, {
            id: awayTeamId,
            name: m.away.name,
            short_code: (m.away.shortName || m.away.name).slice(0, 10),
            logo: awayLogo,
            logo_url: awayLogo
          });

          const statusObj = m.status || {};
          let status = 'scheduled';
          let timeElapsed = '';

          if (statusObj.finished === true) {
            status = 'finished';
            timeElapsed = 'FT';
          } else if (statusObj.started === true) {
            status = 'live';
            timeElapsed = statusObj.liveTime?.short || statusObj.liveTime?.long || 'LIVE';
          } else if (statusObj.cancelled === true) {
            status = 'cancelled';
            timeElapsed = 'Cancelled';
          }

          const utcTime = statusObj.utcTime || (m.timeTS ? new Date(m.timeTS).toISOString() : new Date().toISOString());
          const matchId = toUUID(`fotmob_${m.id}`);

          matchRows.push({
            id: matchId,
            fotmob_id: String(m.id),
            league_id: String(leagueId),
            league_name: leagueName,
            round: 'Round ' + (m.round || '1') + (m.group ? ' Grp. ' + m.group : ''),
            home_team_id: homeTeamId,
            away_team_id: awayTeamId,
            home_team: m.home.name,
            away_team: m.away.name,
            home_short: (m.home.shortName || m.home.name).slice(0, 10),
            away_short: (m.away.shortName || m.away.name).slice(0, 10),
            home_logo: homeLogo,
            away_logo: awayLogo,
            date: utcTime,
            kickoff_ist: formatIST(utcTime),
            status: status,
            time_elapsed: timeElapsed,
            home_score: m.home.score ?? 0,
            away_score: m.away.score ?? 0,
            is_approved: false,
            updated_at: new Date().toISOString()
          });
        }

        // Upsert teams
        const teamsArr = Array.from(allTeams.values());
        for (let i = 0; i < teamsArr.length; i += 50) {
          await httpsRequest({
            hostname: SUPABASE_HOST,
            path: '/rest/v1/zeta_teams',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': SUPABASE_SERVICE_ROLE_KEY,
              'authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              'Prefer': 'resolution=merge-duplicates'
            }
          }, teamsArr.slice(i, i + 50));
        }

        // Upsert matches
        for (let i = 0; i < matchRows.length; i += 50) {
          const chunk = matchRows.slice(i, i + 50);
          await httpsRequest({
            hostname: SUPABASE_HOST,
            path: '/rest/v1/zeta_matches',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': SUPABASE_SERVICE_ROLE_KEY,
              'authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              'Prefer': 'resolution=merge-duplicates'
            }
          }, chunk);
          syncedMatchesCount += chunk.length;
        }
      }

      // 3. Record Audit Log
      try {
        await httpsRequest({
          hostname: SUPABASE_HOST,
          path: '/rest/v1/admin_audit_logs',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
          }
        }, {
          admin_email: user.email || 'superadmin',
          action: 'LEAGUE_ADDED',
          details: { leagueId, leagueName, country, season, syncedMatchesCount },
          ip_address: event.headers['client-ip'] || event.headers['x-forwarded-for'] || '127.0.0.1'
        });
      } catch (_) {}

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          league: leagueRow,
          syncedMatchesCount,
          message: `Successfully added '${leagueName}' and synced ${syncedMatchesCount} matches!`
        })
      };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  return { statusCode: 404, headers, body: JSON.stringify({ error: 'Endpoint not found' }) };
};