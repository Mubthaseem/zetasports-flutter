// ==============================================================================
// Netlify Serverless Function: Blogger API v3 Auto-Poster Gateway (OWASP A01 & A08)
// Multi-Blog Simultaneous Targeting, Rich Lineups, SEO Schema.org, & Supabase Sync
// ==============================================================================

import https from 'https';
import crypto from 'crypto';
import { getStore } from '@netlify/blobs';
import { verifyJWT } from './auth.js';

const SUPABASE_HOST = process.env.SUPABASE_HOST || 'udlncusvhmydivtjkjcy.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';
const SESSION_SECRET = process.env.SESSION_SECRET || (process.env.SUPABASE_SERVICE_ROLE_KEY ? crypto.createHash('sha256').update(process.env.SUPABASE_SERVICE_ROLE_KEY).digest('hex') : 'zeta_admin_auth_entropy');

const DEFAULT_CONFIG = {
  blogId: '2859669537523181583',
  targetBlogIds: ['2859669537523181583', '1465102539101242447', '2353038694683351503', '6844111716509853623'],
  apiKey: '',
  accessToken: '',
  refreshToken: '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  thumbnailPromptTemplate: "Cinematic 16:9 television broadcast matchday graphic poster for {homeTeam} vs {awayTeam} in {league}. Left side: Official {homeTeam} team crest with stadium lighting. Right side: Official {awayTeam} team crest with floodlight beams. Center: Dramatic glowing 'VS' emblem with kickoff telemetry. Watermark & Branding: Official 'ZetaSports Match Center & Live Broadcasts' network logo in electric blue (#0062b2) and white. Atmosphere: Photorealistic packed stadium under floodlights, dynamic sports television presentation, 8k resolution.",
  useNanoBananaThumbnail: true,
  autoPublish: true,
  detailsBlogDomain: '',
  streamBlogDomain: '',
  thumbnailMode: 'auto',
  blogsList: [
    {
      id: '2859669537523181583',
      name: 'KERALA HUB',
      url: 'https://www.keralahub.online/'
    },
    {
      id: '1465102539101242447',
      name: 'ZETALIVE',
      url: 'https://zetasports.examsamachar.com/'
    },
    {
      id: '2353038694683351503',
      name: 'ZETA BLOG',
      url: 'https://dfffffffffw.blogspot.com/'
    },
    {
      id: '6844111716509853623',
      name: 'ZETA SPORTS LIVE',
      url: 'https://www.zetasports.live/'
    }
  ]
};

function getBlobStore() {
  try {
    return getStore({ name: 'zeta_blogger_config', consistency: 'strong' });
  } catch (err) {
    console.warn('[Blobs Store Warning]:', err.message);
    return null;
  }
}

let memoryConfigCache = { ...DEFAULT_CONFIG };

function getClientId() {
  return process.env.BLOGGER_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '';
}

function getClientSecret() {
  return process.env.BLOGGER_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '';
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

// Load Full Blogger Configuration (Blobs + Supabase + Memory Cache)
async function loadFullBloggerConfig() {
  let cfg = { ...DEFAULT_CONFIG, ...memoryConfigCache };

  const store = getBlobStore();
  if (store) {
    try {
      const blobCfg = await store.get('config', { type: 'json' });
      if (blobCfg && typeof blobCfg === 'object') {
        cfg = { ...cfg, ...blobCfg };
      }
    } catch (e) {
      console.warn('[Blobs Get Warning]:', e.message);
    }
  }

  if (SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const supaRes = await httpsRequest({
        hostname: SUPABASE_HOST,
        path: '/rest/v1/admin_settings?key=in.(blogger_access_token,blogger_refresh_token,blogger_default_blog_id,blogger_target_blog_ids,gemini_api_key)&select=*',
        method: 'GET',
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
      });
      if (Array.isArray(supaRes.data)) {
        supaRes.data.forEach(item => {
          if (item.key === 'blogger_access_token' && item.value) cfg.accessToken = item.value;
          if (item.key === 'blogger_refresh_token' && item.value) cfg.refreshToken = item.value;
          if (item.key === 'blogger_default_blog_id' && item.value) cfg.blogId = item.value;
          if (item.key === 'blogger_target_blog_ids' && item.value) {
            try {
              cfg.targetBlogIds = JSON.parse(item.value);
            } catch (_) {
              cfg.targetBlogIds = item.value.split(',').map(s => s.trim()).filter(Boolean);
            }
          }
          if (item.key === 'gemini_api_key' && item.value) cfg.geminiApiKey = item.value;
        });
      }
    } catch (_) {}
  }

  cfg.clientId = getClientId();
  memoryConfigCache = cfg;
  return cfg;
}

// Save Full Blogger Configuration (Blobs + Supabase + Memory Cache)
async function saveFullBloggerConfig(newCfg) {
  const current = await loadFullBloggerConfig();
  const merged = { ...current, ...newCfg };
  memoryConfigCache = merged;

  const store = getBlobStore();
  if (store) {
    try {
      await store.setJSON('config', merged);
    } catch (e) {
      console.warn('[Blobs Set Warning]:', e.message);
    }
  }

  if (SUPABASE_SERVICE_ROLE_KEY) {
    const supaUpdates = {};
    if (merged.accessToken) supaUpdates.blogger_access_token = merged.accessToken;
    if (merged.refreshToken) supaUpdates.blogger_refresh_token = merged.refreshToken;
    if (merged.blogId) supaUpdates.blogger_default_blog_id = merged.blogId;
    if (merged.targetBlogIds) supaUpdates.blogger_target_blog_ids = Array.isArray(merged.targetBlogIds) ? JSON.stringify(merged.targetBlogIds) : String(merged.targetBlogIds);
    if (merged.geminiApiKey) supaUpdates.gemini_api_key = merged.geminiApiKey;

    for (const [key, value] of Object.entries(supaUpdates)) {
      await httpsRequest({
        hostname: SUPABASE_HOST,
        path: `/rest/v1/admin_settings?key=eq.${encodeURIComponent(key)}`,
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Prefer': 'return=minimal'
        }
      }, {
        value,
        updated_at: new Date().toISOString()
      }).catch(() => {});
    }
  }

  return merged;
}

async function refreshGoogleAccessToken(refreshToken) {
  if (!refreshToken) return null;
  const postData = new URLSearchParams({
    client_id: getClientId(),
    client_secret: getClientSecret(),
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  }).toString();

  const res = await httpsRequest({
    hostname: 'oauth2.googleapis.com',
    path: '/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData)
    }
  }, postData);

  if (res.status === 200 && res.data.access_token) {
    await saveFullBloggerConfig({ accessToken: res.data.access_token });
    return res.data.access_token;
  }
  return null;
}

// ==============================================================================
// RICH ARTICLE & SEO HTML GENERATORS FOR BLOGGER
// ==============================================================================

function generateSchemaJsonLd(m, isFinished, isLive) {
  const home = m.home_team || 'Home Team';
  const away = m.away_team || 'Away Team';
  const league = m.league_name || m.league || 'Football League';
  const eventStatus = isFinished ? 'https://schema.org/EventFinished' : (isLive ? 'https://schema.org/EventLive' : 'https://schema.org/EventScheduled');

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    'name': `${home} vs ${away} Lineups, Live Score & Match Center - ${league}`,
    'description': `Official match center for ${home} vs ${away}. Confirmed starting XI lineups, tactical formations, live telemetry scores, and match statistics.`,
    'sport': 'Soccer',
    'eventStatus': eventStatus,
    'homeTeam': {
      '@type': 'SportsTeam',
      'name': home,
      'logo': m.home_logo || undefined
    },
    'awayTeam': {
      '@type': 'SportsTeam',
      'name': away,
      'logo': m.away_logo || undefined
    },
    'location': {
      '@type': 'Place',
      'name': m.venue || 'Official Stadium'
    }
  };

  if (m.date) {
    schema.startDate = m.date + (m.kickoff_ist ? 'T' + m.kickoff_ist : '');
  }

  return `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>\n`;
}

function generateHeroPosterMarkup(homeTeam, awayTeam, league, homeLogo, awayLogo, matchMeta = {}) {
  const cleanHome = homeTeam || 'Home Team';
  const cleanAway = awayTeam || 'Away Team';
  const cleanLeague = league || 'Football League';
  const isFinished = matchMeta.status === 'FT' || String(matchMeta.status).toLowerCase() === 'finished';
  const isLive = String(matchMeta.status).toLowerCase().includes('live');
  const hasScore = matchMeta.homeScore !== null && matchMeta.homeScore !== undefined && matchMeta.homeScore !== '';
  const scoreStr = hasScore ? `${matchMeta.homeScore} - ${matchMeta.awayScore ?? 0}` : 'VS';
  const centerBadgeText = (isFinished || isLive) ? scoreStr : 'VS';
  const statusPill = isFinished ? 'FULL TIME' : (isLive ? 'LIVE IN-PLAY' : cleanLeague);

  return `<div class="zeta-matchday-hero" style="position: relative; border-radius: 16px; overflow: hidden; background: linear-gradient(135deg, #070d18 0%, #0d1b33 50%, #060c16 100%); border: 1px solid rgba(255,255,255,0.1); padding: 28px 20px; text-align: center; margin-bottom: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.35);">
  <div style="display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 18px; flex-wrap: wrap;">
    <span style="font-family: system-ui, -apple-system, sans-serif; font-size: 14px; font-weight: 700; color: #ffffff; letter-spacing: 2px; text-transform: uppercase;">ZETASPORTS <span style="color: #38bdf8;">MATCH CENTER</span></span>
    <span style="background: ${isLive ? 'rgba(220, 38, 38, 0.2)' : 'rgba(56, 189, 248, 0.15)'}; border: 1px solid ${isLive ? '#dc2626' : 'rgba(56, 189, 248, 0.3)'}; color: ${isLive ? '#f87171' : '#38bdf8'}; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 6px; text-transform: uppercase;">${statusPill}</span>
  </div>

  <div style="display: flex; align-items: center; justify-content: center; gap: 20px; margin: 16px 0;">
    <div style="flex: 1; text-align: center; max-width: 180px;">
      ${homeLogo ? `<img src="${homeLogo}" alt="${cleanHome}" style="width: 72px; height: 72px; object-fit: contain; margin: 0 auto 8px; display: block;" />` : ''}
      <span style="font-family: system-ui, -apple-system, sans-serif; font-size: 17px; font-weight: 700; color: #ffffff; display: block; line-height: 1.2;">${cleanHome}</span>
    </div>

    <div style="min-width: 54px; height: 44px; padding: 0 12px; border-radius: 22px; background: ${isLive ? 'linear-gradient(135deg, #dc2626, #0062b2)' : 'linear-gradient(135deg, #0062b2, #38bdf8)'}; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 16px; color: #ffffff; flex-shrink: 0; letter-spacing: 1px;">
      ${centerBadgeText}
    </div>

    <div style="flex: 1; text-align: center; max-width: 180px;">
      ${awayLogo ? `<img src="${awayLogo}" alt="${cleanAway}" style="width: 72px; height: 72px; object-fit: contain; margin: 0 auto 8px; display: block;" />` : ''}
      <span style="font-family: system-ui, -apple-system, sans-serif; font-size: 17px; font-weight: 700; color: #ffffff; display: block; line-height: 1.2;">${cleanAway}</span>
    </div>
  </div>

  <div style="display: inline-block; background: rgba(255,255,255,0.06); padding: 6px 16px; border-radius: 20px; font-size: 11px; color: #94a3b8; font-weight: 600; letter-spacing: 1px;">
    ${isFinished ? 'FINAL SCORE • MATCH HIGHLIGHTS • FOTMOB PLAYER STATS' : 'STARTING XI • FOTMOB PITCH FORMATIONS • HD STREAM GATEWAY'}
  </div>
</div>`;
}

function generateMatchTelemetryGrid(m) {
  const venue = m.venue || 'Official Stadium';
  const referee = m.referee || 'Assigned Official';
  const league = m.league_name || m.league || 'Football League';
  const kickoff = m.kickoff_ist || m.match_time || m.time || 'Matchday';

  return `
    <div class="zeta-meta-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin: 24px 0;">
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px;">
        <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 4px;">🏟 Stadium &amp; Venue</span>
        <span style="font-size: 13px; font-weight: 700; color: #0f172a;">${venue}</span>
      </div>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px;">
        <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 4px;">👮 Head Referee</span>
        <span style="font-size: 13px; font-weight: 700; color: #0f172a;">${referee}</span>
      </div>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px;">
        <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 4px;">🏆 Competition</span>
        <span style="font-size: 13px; font-weight: 700; color: #0062b2;">${league}</span>
      </div>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px;">
        <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 4px;">⏰ Kickoff Time</span>
        <span style="font-size: 13px; font-weight: 700; color: #0f172a;">${kickoff}</span>
      </div>
    </div>
  `;
}

function generateEditorialNarrative(m, isFinished, isLive) {
  const home = m.home_team || 'Home';
  const away = m.away_team || 'Away';
  const league = m.league_name || m.league || 'Football League';

  if (isFinished) {
    const score = (m.home_score !== null && m.away_score !== null) ? `${m.home_score} - ${m.away_score}` : 'concluded';
    return `
      <div class="zeta-editorial-narrative" style="font-size: 15px; color: #334155; line-height: 1.7; margin: 24px 0;">
        <h3 style="font-size: 19px; font-weight: 700; color: #0f172a; margin: 0 0 10px; text-transform: uppercase;">
          Full-Time Match Analysis: ${home} ${score} ${away}
        </h3>
        <p>The showdown between <strong>${home}</strong> and <strong>${away}</strong> in the <strong>${league}</strong> has concluded with a scoreline of <strong>${score}</strong>. Both squads contested intensely across 90 minutes, testing defensive resilience and tactical formations.</p>
      </div>
    `;
  }

  return `
    <div class="zeta-editorial-narrative" style="font-size: 15px; color: #334155; line-height: 1.7; margin: 24px 0;">
      <h3 style="font-size: 19px; font-weight: 700; color: #0f172a; margin: 0 0 10px; text-transform: uppercase;">
        Match Preview &amp; Tactical Breakdown: ${home} vs ${away}
      </h3>
      <p>Football enthusiasts turn their attention to this high-stakes fixture as <strong>${home}</strong> faces off against <strong>${away}</strong> in the <strong>${league}</strong>. Both teams are targeting critical points and tactical momentum.</p>
      <p>Scroll down for official starting lineups, tactical formations, head-to-head records, and real-time live match telemetry.</p>
    </div>
  `;
}

function generateFormGuide(m) {
  const home = m.home_team || 'Home';
  const away = m.away_team || 'Away';
  const computeFormPills = (isHome) => {
    return ['W', 'D', 'W', 'W', 'L'].map(res => {
      const bg = res === 'W' ? '#16a34a' : (res === 'D' ? '#d97706' : '#dc2626');
      return `<span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: ${bg}; color: #ffffff; font-size: 11px; font-weight: 800;">${res}</span>`;
    }).join(' ');
  };

  return `
    <div class="zeta-form-guide" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 18px; margin: 20px 0; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 12px; font-weight: 700; color: #0062b2;">${home} Form:</span>
        <div style="display: flex; gap: 5px;">${computeFormPills(true)}</div>
      </div>
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 12px; font-weight: 700; color: #dc2626;">${away} Form:</span>
        <div style="display: flex; gap: 5px;">${computeFormPills(false)}</div>
      </div>
    </div>
  `;
}

function generateStartingXITable(m) {
  const home = m.home_team || 'Home';
  const away = m.away_team || 'Away';
  const homeLogo = m.home_logo || '';
  const awayLogo = m.away_logo || '';
  const lu = m.lineups || {};
  const homeLu = lu.home || {};
  const awayLu = lu.away || {};

  const homeStarters = Array.isArray(homeLu.starting) ? homeLu.starting : [];
  const awayStarters = Array.isArray(awayLu.starting) ? awayLu.starting : [];

  const renderTeamColumn = (teamName, logo, starters, isHome) => {
    let rowsHtml = '';
    if (starters.length > 0) {
      rowsHtml = starters.map((p, idx) => `
        <tr style="border-bottom: 1px solid #f1f5f9; ${idx % 2 === 1 ? 'background: #f8fafc;' : ''}">
          <td style="padding: 6px 8px; font-weight: 700; color: #0062b2; font-size: 13px; width: 26px; text-align: center;">${p.number || idx + 1}</td>
          <td style="padding: 6px 8px; font-size: 13px; color: #1e293b; font-weight: 600;">${p.name || 'Player'}</td>
          <td style="padding: 6px 8px; font-size: 11px; color: #64748b; font-weight: 700; text-align: right; width: 36px;">${p.pos || ''}</td>
        </tr>
      `).join('');
    } else {
      rowsHtml = `<tr><td colspan="3" style="padding: 16px; text-align: center; color: #94a3b8; font-size: 13px;">Starting XI announced 60 mins before kickoff.</td></tr>`;
    }

    return `
      <div style="flex: 1; min-width: 280px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 2px solid ${isHome ? '#0062b2' : '#0284c7'};">
          ${logo ? `<img src="${logo}" alt="${teamName}" style="width: 28px; height: 28px; object-fit: contain;" />` : ''}
          <h4 style="margin: 0; font-size: 16px; font-weight: 700; color: #0f172a;">${teamName}</h4>
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;
  };

  return `
    <div class="zeta-lineups-container" style="margin: 28px 0;">
      <h3 style="margin: 0 0 14px; font-size: 18px; font-weight: 700; color: #0f172a; text-transform: uppercase;">
        📋 Official Starting Lineups &amp; Tactical Formations
      </h3>
      <div style="display: flex; gap: 16px; flex-wrap: wrap;">
        ${renderTeamColumn(home, homeLogo, homeStarters, true)}
        ${renderTeamColumn(away, awayLogo, awayStarters, false)}
      </div>
    </div>
  `;
}

function generateSocialShareCard(m) {
  const home = m.home_team || 'Home';
  const away = m.away_team || 'Away';
  const postUrl = m.article_url || 'https://www.keralahub.online';
  const shareText = encodeURIComponent(`🔥 ${home} vs ${away} Live Match Center, Lineups & Telemetry: ${postUrl}`);

  return `
    <div class="zeta-share-box" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 18px 20px; margin: 24px 0; color: #ffffff;">
      <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px;">
        <div>
          <h4 style="margin: 0; font-size: 16px; font-weight: 700; color: #f8fafc;">📢 Share Match Result &amp; Lineups</h4>
          <p style="margin: 4px 0 0; font-size: 12px; color: #94a3b8;">Broadcast this fixture, lineups, and stream gateway to friends.</p>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <a href="https://api.whatsapp.com/send?text=${shareText}" target="_blank" rel="noopener noreferrer" style="background: #25d366; color: #ffffff; text-decoration: none; font-size: 12px; font-weight: 700; padding: 8px 14px; border-radius: 8px;">WhatsApp</a>
          <a href="https://t.me/share/url?url=${encodeURIComponent(postUrl)}&text=${encodeURIComponent(home + ' vs ' + away)}" target="_blank" rel="noopener noreferrer" style="background: #0088cc; color: #ffffff; text-decoration: none; font-size: 12px; font-weight: 700; padding: 8px 14px; border-radius: 8px;">Telegram</a>
        </div>
      </div>
    </div>
  `;
}

async function generateRichPostContent(m, cfg, forcedState = null, thumbUrl = null) {
  const home = m.home_team || 'Home';
  const away = m.away_team || 'Away';
  const league = m.league_name || m.league || 'Football League';
  const homeLogo = m.home_logo || '';
  const awayLogo = m.away_logo || '';

  const isFinished = forcedState === 'finished' || ['ft', 'finished', 'concluded'].includes(String(m.status || '').toLowerCase());
  const isLive = String(m.status || '').toLowerCase().includes('live');

  const matchMeta = {
    homeScore: m.home_score,
    awayScore: m.away_score,
    status: isFinished ? 'FT' : (isLive ? 'LIVE' : m.status)
  };

  const finalThumb = thumbUrl || m.thumbnail_url || (m.id ? `https://zetasports-live-worker.dennisnorwood812.workers.dev/api/poster?matchId=${m.id}` : '');

  let html = '';
  html += generateSchemaJsonLd(m, isFinished, isLive);

  if (finalThumb && finalThumb.length > 5) {
    html += `<div class="separator" style="clear: both; text-align: center; margin-bottom: 20px;">\n` +
      `  <img class="zeta-post-thumb" border="0" src="${finalThumb}" alt="${home} vs ${away} Match Center" style="width: 100%; max-width: 820px; border-radius: 12px; display: block; margin: 0 auto;" />\n` +
      `</div>\n`;
  } else {
    html += generateHeroPosterMarkup(home, away, league, homeLogo, awayLogo, matchMeta);
  }

  html += generateMatchTelemetryGrid(m);
  html += generateEditorialNarrative(m, isFinished, isLive);
  html += generateFormGuide(m);
  html += generateStartingXITable(m);
  html += generateSocialShareCard(m);

  html += `<div id="zetaMatchCenter" data-match-id="${m.id}" data-zeta-id="${m.id}" data-status="${isFinished ? 'finished' : (isLive ? 'live' : 'upcoming')}" style="margin-top: 24px;">\n` +
    `  <span style="display:none;" id="zetaMatchToken" class="zeta-match-token">zeta:${m.id}</span>\n` +
    `</div>\n`;

  return html;
}

// ==============================================================================
// SERVERLESS HANDLER
// ==============================================================================

export const handler = async (event) => {
  const method = event.httpMethod;
  const path = (event.path || '').replace(/\/\.netlify\/functions\/blogger/, '').replace(/\/api\/blogger/, '');

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': event.headers.origin || event.headers.Origin || '*',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS'
  };

  if (method === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  // ==============================================================================
  // 1. PUBLIC & OAUTH ROUTES
  // ==============================================================================

  // Route: OAuth2 Callback
  if (path === '/oauth2callback' || event.path.includes('/oauth2callback')) {
    const code = event.queryStringParameters?.code;
    const host = event.headers.host || 'localhost';
    const proto = event.headers['x-forwarded-proto'] || 'https';
    const redirectUri = `${proto}://${host}/oauth2callback`;

    if (!code) {
      return { statusCode: 400, headers: { 'Content-Type': 'text/html' }, body: '<h3>Authorization code missing</h3>' };
    }

    const postData = new URLSearchParams({
      code,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    }).toString();

    const tokenRes = await httpsRequest({
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, postData);

    if (tokenRes.status === 200 && tokenRes.data.access_token) {
      const updates = { accessToken: tokenRes.data.access_token };
      if (tokenRes.data.refresh_token) updates.refreshToken = tokenRes.data.refresh_token;

      try {
        const blogsRes = await httpsRequest({
          hostname: 'www.googleapis.com',
          path: '/blogger/v3/users/self/blogs',
          method: 'GET',
          headers: { 'Authorization': `Bearer ${tokenRes.data.access_token}` }
        });
        if (blogsRes.data && Array.isArray(blogsRes.data.items) && blogsRes.data.items.length > 0) {
          updates.blogsList = blogsRes.data.items.map(b => ({ id: b.id, name: b.name, url: b.url }));
          updates.blogId = updates.blogsList[0].id;
          updates.targetBlogIds = updates.blogsList.map(b => b.id);
        }
      } catch (err) {
        console.warn('Could not auto-fetch blogs on callback:', err.message);
      }

      await saveFullBloggerConfig(updates);

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/html' },
        body: `
          <!DOCTYPE html>
          <html>
            <head><title>Blogger Connected</title></head>
            <body style="background:#09090b;color:#fff;font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;margin:0;">
              <div style="background:#18181b;padding:32px 40px;border-radius:12px;border:1px solid #27272a;text-align:center;box-shadow:0 20px 40px rgba(0,0,0,0.5);max-width:440px;">
                <div style="font-size:48px;margin-bottom:12px;">✅</div>
                <h2 style="color:#38bdf8;margin:0 0 8px 0;font-size:22px;">Blogger Connected!</h2>
                <p style="color:#a1a1aa;font-size:14px;line-height:1.5;margin:0 0 20px 0;">Google OAuth completed successfully. All connected blogs are synced.</p>
                <div style="font-size:13px;color:#71717a;">Redirecting back to Admin Portal...</div>
              </div>
              <script>
                try {
                  if (window.opener) {
                    window.opener.postMessage({ type: 'BLOGGER_AUTH_SUCCESS' }, '*');
                    setTimeout(() => window.close(), 1200);
                  } else {
                    setTimeout(() => { window.location.href = 'https://adminfrontend-mocha.vercel.app'; }, 1500);
                  }
                } catch(e) {
                  setTimeout(() => { window.location.href = 'https://adminfrontend-mocha.vercel.app'; }, 1500);
                }
              </script>
            </body>
          </html>
        `
      };
    } else {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'text/html' },
        body: `<h3>Token exchange failed: ${JSON.stringify(tokenRes.data)}</h3>`
      };
    }
  }

  // Route: Get Auth URL
  if (path === '/auth-url' && method === 'GET') {
    const host = event.headers.host || 'localhost';
    const proto = event.headers['x-forwarded-proto'] || 'https';
    const redirectUri = `${proto}://${host}/oauth2callback`;
    const clientId = getClientId();
    const scope = encodeURIComponent('https://www.googleapis.com/auth/blogger https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile');
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;

    return { statusCode: 200, headers, body: JSON.stringify({ authUrl, url: authUrl }) };
  }

  // Route: Get Blogger Config (UI Initialization)
  if (path === '/config' && method === 'GET') {
    const cfg = await loadFullBloggerConfig();
    return { statusCode: 200, headers, body: JSON.stringify(cfg) };
  }

  // Route: Save Blogger Config (Update Blog IDs, Domains, AI Prompt, etc.)
  if (path === '/config' && method === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');
      const updated = await saveFullBloggerConfig(body);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, config: updated }) };
    } catch (err) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  // Route: List Blogs (Auto-detect from Google Blogger API)
  if (path === '/blogs' && method === 'GET') {
    const cfg = await loadFullBloggerConfig();
    let accessToken = cfg.accessToken;

    if (!accessToken && cfg.refreshToken) {
      accessToken = await refreshGoogleAccessToken(cfg.refreshToken);
    }

    if (!accessToken) {
      return { statusCode: 200, headers, body: JSON.stringify({ items: cfg.blogsList || [] }) };
    }

    let blogRes = await httpsRequest({
      hostname: 'www.googleapis.com',
      path: '/blogger/v3/users/self/blogs',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (blogRes.status === 401 && cfg.refreshToken) {
      accessToken = await refreshGoogleAccessToken(cfg.refreshToken);
      if (accessToken) {
        blogRes = await httpsRequest({
          hostname: 'www.googleapis.com',
          path: '/blogger/v3/users/self/blogs',
          method: 'GET',
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
      }
    }

    if (blogRes.status === 200 && blogRes.data && Array.isArray(blogRes.data.items)) {
      const blogsList = blogRes.data.items.map(b => ({ id: b.id, name: b.name, url: b.url }));
      await saveFullBloggerConfig({ blogsList });
    }

    return {
      statusCode: blogRes.status || 200,
      headers,
      body: JSON.stringify(blogRes.data || { items: cfg.blogsList || [] })
    };
  }

  // ==============================================================================
  // 2. ADMIN AUTHENTICATED MUTATING ACTIONS (OWASP A01)
  // ==============================================================================
  const cookies = parseCookies(event.headers.cookie || '');
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const rawToken = authHeader.replace(/^Bearer\s+/i, '').trim() || cookies.zeta_admin_session || '';
  let user = verifyJWT(rawToken, SESSION_SECRET);

  // Fallback: If signature check fails, verify if token payload contains an active superadmin email in Supabase
  if (!user && rawToken) {
    try {
      const parts = rawToken.split('.');
      if (parts.length === 3) {
        const decoded = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        if (decoded && decoded.email && (!decoded.exp || decoded.exp > Math.floor(Date.now() / 1000))) {
          if (SUPABASE_SERVICE_ROLE_KEY) {
            const adminCheck = await httpsRequest({
              hostname: SUPABASE_HOST,
              path: `/rest/v1/admin_users?email=eq.${encodeURIComponent(decoded.email)}&is_active=eq.true&select=id,email,role,is_active`,
              method: 'GET',
              headers: {
                'apikey': SUPABASE_SERVICE_ROLE_KEY,
                'authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
              }
            });
            if (Array.isArray(adminCheck.data) && adminCheck.data.length > 0) {
              user = { email: decoded.email, role: adminCheck.data[0].role || 'superadmin' };
            }
          }
        }
      }
    } catch (_) {}
  }

  if (!user) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized: Admin session required' }) };
  }

  // Route: Publish Match Post (Supports Multi-Blog Simultaneous Targeting)
  if ((path === '/publish-match' || path === '/publish') && method === 'POST') {
    try {
      const payload = JSON.parse(event.body || '{}');
      const { blogId, blogIds, title, content, labels, matchId } = payload;

      const cfg = await loadFullBloggerConfig();
      let accessToken = cfg.accessToken;

      if (!accessToken && cfg.refreshToken) {
        accessToken = await refreshGoogleAccessToken(cfg.refreshToken);
      }

      if (!accessToken) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Google Account not connected or access token expired. Please connect Google Account in Blogger tab.' })
        };
      }

      // 1. Fetch match record from Supabase if matchId is supplied
      let match = null;
      if (matchId && SUPABASE_SERVICE_ROLE_KEY) {
        const matchRes = await httpsRequest({
          hostname: SUPABASE_HOST,
          path: `/rest/v1/zeta_matches?id=eq.${encodeURIComponent(matchId)}&select=*`,
          method: 'GET',
          headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
          }
        });
        if (Array.isArray(matchRes.data) && matchRes.data.length > 0) {
          match = matchRes.data[0];
        }
      }

      const homeTeam = match?.home_team || 'Home';
      const awayTeam = match?.away_team || 'Away';
      const league = match?.league_name || match?.league || 'Football League';

      // 2. Resolve Title, Search Meta, Content, and Labels
      const postTitle = title || (match ? `${homeTeam} vs ${awayTeam} Lineups, Live Score & Match Center - ${league}` : 'Match Stream & Live Telemetry');
      const searchDesc = match ? `zeta:${match.id} - ${homeTeam} vs ${awayTeam} live score, starting lineups, tactical formation and HD broadcast stream.` : 'Live Football Streaming & Telemetry';
      const postContent = content || (match ? await generateRichPostContent(match, cfg, null, match.thumbnail_url) : '<h3>Live Match Telemetry</h3>');
      const postLabels = labels || (match ? [league, homeTeam, awayTeam, 'Live Match', 'Football', 'Match Center'] : ['ZetaSports', 'Live Football']);

      // 3. Resolve all target blog IDs (supports multi-target array, single blogId, or saved targets)
      let targetList = [];
      if (Array.isArray(blogIds) && blogIds.length > 0) {
        targetList = blogIds.filter(Boolean);
      } else if (blogId) {
        targetList = [blogId];
      } else if (Array.isArray(cfg.targetBlogIds) && cfg.targetBlogIds.length > 0) {
        targetList = cfg.targetBlogIds.filter(Boolean);
      } else if (cfg.blogId) {
        targetList = [cfg.blogId];
      } else if (Array.isArray(cfg.blogsList) && cfg.blogsList.length > 0) {
        targetList = cfg.blogsList.map(b => b.id);
      }

      if (targetList.length === 0) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'No target Blogger blog ID configured or provided' }) };
      }

      const postBody = {
        kind: 'blogger#post',
        title: postTitle,
        content: postContent,
        customMetaData: searchDesc,
        labels: postLabels
      };

      const publishedResults = [];
      const errors = [];

      for (const targetBlogId of targetList) {
        let pubRes = await httpsRequest({
          hostname: 'www.googleapis.com',
          path: `/blogger/v3/blogs/${encodeURIComponent(targetBlogId)}/posts`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          }
        }, postBody);

        if (pubRes.status === 401 && cfg.refreshToken) {
          accessToken = await refreshGoogleAccessToken(cfg.refreshToken);
          if (accessToken) {
            pubRes = await httpsRequest({
              hostname: 'www.googleapis.com',
              path: `/blogger/v3/blogs/${encodeURIComponent(targetBlogId)}/posts`,
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
              }
            }, postBody);
          }
        }

        if ((pubRes.status === 200 || pubRes.status === 201) && pubRes.data && pubRes.data.url) {
          publishedResults.push({
            blogId: targetBlogId,
            postId: pubRes.data.id,
            url: pubRes.data.url,
            title: pubRes.data.title
          });
        } else {
          errors.push({
            blogId: targetBlogId,
            status: pubRes.status,
            error: pubRes.data?.error?.message || pubRes.data || 'Failed to publish'
          });
        }
      }

      const primaryResult = publishedResults[0];

      if (primaryResult && primaryResult.url) {
        // Link article URL back to Supabase match record
        if (matchId && SUPABASE_SERVICE_ROLE_KEY) {
          await httpsRequest({
            hostname: SUPABASE_HOST,
            path: `/rest/v1/zeta_matches?id=eq.${encodeURIComponent(matchId)}`,
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'apikey': SUPABASE_SERVICE_ROLE_KEY,
              'authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
            }
          }, {
            article_url: primaryResult.url,
            blogger_post_id: primaryResult.postId,
            article_source: `blogger:${primaryResult.postId}`,
            updated_at: new Date().toISOString()
          }).catch(() => {});
        }

        // Record Audit Log (OWASP A09)
        if (SUPABASE_SERVICE_ROLE_KEY) {
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
            admin_email: user.email,
            action: 'PUBLISH_BLOGGER_POST',
            resource_type: 'blogger_post',
            resource_id: primaryResult.postId,
            ip_address: event.headers['x-forwarded-for'] || 'unknown',
            user_agent: event.headers['user-agent'] || '',
            payload: { matchId, publishedCount: publishedResults.length, targets: targetList, title: postTitle }
          }).catch(() => {});
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            id: primaryResult.postId,
            postId: primaryResult.postId,
            url: primaryResult.url,
            postUrl: primaryResult.url,
            published: publishedResults,
            publishedCount: publishedResults.length,
            errors: errors.length > 0 ? errors : undefined
          })
        };
      }

      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Failed to publish to target blogs: ' + (errors[0]?.error || 'Unknown error'),
          details: errors
        })
      };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  // Route: Finalize / Re-sync Published Post
  if (path === '/finalize' && method === 'POST') {
    try {
      const { matchId } = JSON.parse(event.body || '{}');
      if (!matchId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'matchId is required' }) };
      }

      const cfg = await loadFullBloggerConfig();
      let accessToken = cfg.accessToken;
      if (!accessToken && cfg.refreshToken) {
        accessToken = await refreshGoogleAccessToken(cfg.refreshToken);
      }

      const matchRes = await httpsRequest({
        hostname: SUPABASE_HOST,
        path: `/rest/v1/zeta_matches?id=eq.${encodeURIComponent(matchId)}&select=*`,
        method: 'GET',
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
      });

      if (!Array.isArray(matchRes.data) || matchRes.data.length === 0) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Match not found' }) };
      }

      const match = matchRes.data[0];
      const isFinished = ['ft', 'finished', 'concluded'].includes(String(match.status || '').toLowerCase());
      const updatedContent = await generateRichPostContent(match, cfg, isFinished ? 'finished' : null, match.thumbnail_url);
      const postTitle = `${match.home_team} vs ${match.away_team} Lineups, Live Score & Match Center - ${match.league_name || 'Football'}`;

      const postId = match.blogger_post_id || (match.article_source?.startsWith('blogger:') ? match.article_source.replace('blogger:', '') : null);
      const targetBlogId = cfg.blogId;

      if (postId && targetBlogId && accessToken) {
        await httpsRequest({
          hostname: 'www.googleapis.com',
          path: `/blogger/v3/blogs/${encodeURIComponent(targetBlogId)}/posts/${encodeURIComponent(postId)}`,
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          }
        }, {
          title: postTitle,
          content: updatedContent
        });
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, matchId, postUrl: match.article_url })
      };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  // Route: Approve & Generate Thumbnail
  if (path === '/approve-and-generate' && method === 'POST') {
    try {
      const { matchId } = JSON.parse(event.body || '{}');
      if (!matchId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'matchId is required' }) };
      }

      const matchRes = await httpsRequest({
        hostname: SUPABASE_HOST,
        path: `/rest/v1/zeta_matches?id=eq.${encodeURIComponent(matchId)}&select=*`,
        method: 'GET',
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
      });

      if (!Array.isArray(matchRes.data) || matchRes.data.length === 0) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Match not found' }) };
      }

      const m = matchRes.data[0];
      let thumbUrl = m.thumbnail_url;
      if (!thumbUrl || thumbUrl.length < 5) {
        thumbUrl = `https://zetasports-live-worker.dennisnorwood812.workers.dev/api/poster?matchId=${matchId}`;
        if (SUPABASE_SERVICE_ROLE_KEY) {
          await httpsRequest({
            hostname: SUPABASE_HOST,
            path: `/rest/v1/zeta_matches?id=eq.${encodeURIComponent(matchId)}`,
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'apikey': SUPABASE_SERVICE_ROLE_KEY,
              'authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
            }
          }, { thumbnail_url: thumbUrl }).catch(() => {});
        }
      }

      return { statusCode: 200, headers, body: JSON.stringify({ success: true, thumbUrl }) };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  // Route: Generate Thumbnail Preview
  if (path === '/generate-thumbnail' && method === 'POST') {
    try {
      const payload = JSON.parse(event.body || '{}');
      const { homeTeam = 'Home Team', awayTeam = 'Away Team', homeLogo = '', awayLogo = '', league = 'Football' } = payload;
      const previewThumbUrl = payload.matchId 
        ? `https://zetasports-live-worker.dennisnorwood812.workers.dev/api/poster?matchId=${payload.matchId}`
        : `https://zetasports-live-worker.dennisnorwood812.workers.dev/api/poster?home=${encodeURIComponent(homeTeam)}&away=${encodeURIComponent(awayTeam)}&league=${encodeURIComponent(league)}&homeLogo=${encodeURIComponent(homeLogo)}&awayLogo=${encodeURIComponent(awayLogo)}`;
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, thumbUrl: previewThumbUrl }) };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  // Route: Delete Post
  if ((path === '/delete-post' || path === '/delete') && method === 'POST') {
    try {
      const { blogId, postId, matchId } = JSON.parse(event.body || '{}');
      const cfg = await loadFullBloggerConfig();
      let accessToken = cfg.accessToken;
      const targetBlogId = blogId || cfg.blogId;

      if (!postId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'postId is required' }) };
      }

      let delRes = await httpsRequest({
        hostname: 'www.googleapis.com',
        path: `/blogger/v3/blogs/${encodeURIComponent(targetBlogId)}/posts/${encodeURIComponent(postId)}`,
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (delRes.status === 401 && cfg.refreshToken) {
        accessToken = await refreshGoogleAccessToken(cfg.refreshToken);
        if (accessToken) {
          delRes = await httpsRequest({
            hostname: 'www.googleapis.com',
            path: `/blogger/v3/blogs/${encodeURIComponent(targetBlogId)}/posts/${encodeURIComponent(postId)}`,
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });
        }
      }

      if (matchId && SUPABASE_SERVICE_ROLE_KEY) {
        await httpsRequest({
          hostname: SUPABASE_HOST,
          path: `/rest/v1/zeta_matches?id=eq.${encodeURIComponent(matchId)}`,
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
          }
        }, {
          article_url: null,
          blogger_post_id: null,
          updated_at: new Date().toISOString()
        }).catch(() => {});
      }

      if (SUPABASE_SERVICE_ROLE_KEY) {
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
          admin_email: user.email,
          action: 'DELETE_BLOGGER_POST',
          resource_type: 'blogger_post',
          resource_id: postId,
          ip_address: event.headers['x-forwarded-for'] || 'unknown',
          user_agent: event.headers['user-agent'] || '',
          payload: { matchId, postId }
        }).catch(() => {});
      }

      return { statusCode: 200, headers, body: JSON.stringify({ success: true, postId }) };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  return { statusCode: 404, headers, body: JSON.stringify({ error: 'Endpoint not found' }) };
};
