/**
 * ZetaSports Match Validator & Null Safety Engine
 * Validates match data schemas, enforces approval status, resolves SVG fallbacks,
 * and handles missing lineups or empty stream servers.
 */

const { escapeHtml, sanitizeUrl } = require('./sanitizer.js');

/**
 * Generates an accessible, responsive SVG shield with team initials for fallback display.
 * @param {string} teamName 
 * @param {number} [size=64]
 * @returns {string} Safe SVG data URI
 */
function generateShieldSvg(teamName, size = 64) {
  const name = (teamName || 'FC').trim();
  const words = name.split(/\s+/).filter(Boolean);
  let initials = 'FC';
  if (words.length >= 2) {
    initials = (words[0][0] + words[1][0]).toUpperCase();
  } else if (name.length >= 2) {
    initials = name.slice(0, 2).toUpperCase();
  } else {
    initials = name.toUpperCase();
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">` +
    `<defs>` +
      `<linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">` +
        `<stop offset="0%" stop-color="#1e293b"/>` +
        `<stop offset="100%" stop-color="#0f172a"/>` +
      `</linearGradient>` +
    `</defs>` +
    `<path d="M32 4 L56 14 C56 38 32 58 32 60 C32 58 8 38 8 14 Z" fill="url(#shieldGrad)" stroke="#38bdf8" stroke-width="2.5" stroke-linejoin="round"/>` +
    `<text x="32" y="38" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="18" font-weight="800" fill="#f8fafc" text-anchor="middle" dominant-baseline="middle">${initials}</text>` +
  `</svg>`;

  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

/**
 * Resolves a safe team logo URL. If null, empty, or broken, returns an inline SVG shield.
 * @param {string|null} logoUrl 
 * @param {string} [teamName='Home Team']
 * @returns {string}
 */
function resolveTeamLogo(logoUrl, teamName = 'Team') {
  if (!logoUrl || typeof logoUrl !== 'string' || logoUrl.trim() === '') {
    return generateShieldSvg(teamName);
  }
  const sanitized = sanitizeUrl(logoUrl.trim());
  if (sanitized === '#' || !sanitized.startsWith('http')) {
    return generateShieldSvg(teamName);
  }
  return sanitized;
}

/**
 * Filters an array of matches to strictly include approved matches.
 * Eliminates drafts or unapproved fixtures (`is_approved === false` or `approved === false`).
 * @param {Array<Object>} matches 
 * @returns {Array<Object>}
 */
function filterApprovedMatches(matches) {
  if (!Array.isArray(matches)) return [];
  return matches.filter(m => {
    if (!m || typeof m !== 'object') return false;
    // Strict approval check
    if (m.is_approved === false || m.approved === false) return false;
    // Must possess at least an ID and kickoff timestamp or status
    if (!m.id) return false;
    return true;
  });
}

/**
 * Safely resolves match lineup data. If lineups are absent, null, or empty,
 * provides a defensive structure preventing undefined property dereferencing.
 * @param {Object|null} rawLineup 
 * @param {string} [homeTeam='Home Team']
 * @param {string} [awayTeam='Away Team']
 * @returns {Object} Validated lineup payload
 */
function resolveLineupData(rawLineup, homeTeam = 'Home Team', awayTeam = 'Away Team') {
  const fallback = {
    available: false,
    message: 'Lineups have not yet been announced for this fixture. Tactical rosters publish 60 minutes prior to kickoff.',
    home: {
      team: escapeHtml(homeTeam),
      formation: 'TBD',
      startingXI: [],
      substitutes: []
    },
    away: {
      team: escapeHtml(awayTeam),
      formation: 'TBD',
      startingXI: [],
      substitutes: []
    }
  };

  if (!rawLineup || typeof rawLineup !== 'object') {
    return fallback;
  }

  const hasHome = Array.isArray(rawLineup.homeXI) && rawLineup.homeXI.length > 0;
  const hasAway = Array.isArray(rawLineup.awayXI) && rawLineup.awayXI.length > 0;

  if (!hasHome && !hasAway) {
    return fallback;
  }

  function sanitizeRoster(players) {
    if (!Array.isArray(players)) return [];
    return players.map((p, idx) => ({
      number: p.number != null ? escapeHtml(String(p.number)) : String(idx + 1),
      name: escapeHtml(p.name || 'Player'),
      position: escapeHtml(p.position || 'SUB'),
      rating: typeof p.rating === 'number' ? p.rating.toFixed(1) : (p.rating ? escapeHtml(String(p.rating)) : '—')
    }));
  }

  return {
    available: true,
    message: 'Official Starting Lineups & Formations',
    home: {
      team: escapeHtml(homeTeam),
      formation: escapeHtml(rawLineup.homeFormation || '4-3-3'),
      startingXI: sanitizeRoster(rawLineup.homeXI),
      substitutes: sanitizeRoster(rawLineup.homeSubs || rawLineup.homeSubstitutes)
    },
    away: {
      team: escapeHtml(awayTeam),
      formation: escapeHtml(rawLineup.awayFormation || '4-2-3-1'),
      startingXI: sanitizeRoster(rawLineup.awayXI),
      substitutes: sanitizeRoster(rawLineup.awaySubs || rawLineup.awaySubstitutes)
    }
  };
}

/**
 * Resolves stream servers with strict filtering of fake/mock streams and empty state defense.
 * @param {Object} match 
 * @param {Object} [streamsMap={}]
 * @returns {Object} { hasStreams: boolean, servers: Array, standbyNotice: string }
 */
function resolveStreamServers(match, streamsMap = {}) {
  const result = {
    hasStreams: false,
    standbyNotice: '📡 Live Stream Feeds Preparing. Broadcaster links connect 15 minutes before kickoff.',
    servers: []
  };

  if (!match || typeof match !== 'object') {
    return result;
  }

  const rawUrl = match.stream_url;
  const rawIds = match.stream_ids;
  const seen = new Set();

  function isValidStreamUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const u = url.trim().toLowerCase();
    if (!u.startsWith('http://') && !u.startsWith('https://')) return false;
    // Disallow mock / test stream domains per project specifications
    if (u.includes('mux.dev') || u.includes('bigbuckbunny') || u.includes('example.com')) return false;
    return true;
  }

  function addServer(name, url, quality, type) {
    if (!isValidStreamUrl(url)) return;
    const cleanUrl = url.trim();
    if (seen.has(cleanUrl)) return;
    seen.add(cleanUrl);

    let detectedType = type;
    if (!detectedType) {
      if (cleanUrl.includes('.m3u8') || cleanUrl.includes('/hls/')) detectedType = 'hls';
      else if (cleanUrl.includes('.mpd') || cleanUrl.includes('/dash/')) detectedType = 'mpd';
      else detectedType = 'iframe';
    }

    result.servers.push({
      name: escapeHtml(name || `Server ${result.servers.length + 1}`),
      url: cleanUrl,
      quality: escapeHtml(quality || '1080p HD'),
      type: detectedType
    });
  }

  // 1. Direct match.stream_url
  if (rawUrl) {
    if (typeof rawUrl === 'string' && (rawUrl.startsWith('[') || rawUrl.startsWith('{'))) {
      try {
        const parsed = JSON.parse(rawUrl);
        if (Array.isArray(parsed)) {
          parsed.forEach((s, idx) => addServer(s.name || s.label || `Server ${idx + 1}`, s.url, s.quality, s.type));
        } else if (parsed && parsed.url) {
          addServer(parsed.name || parsed.label || 'Server 1', parsed.url, parsed.quality, parsed.type);
        }
      } catch (e) {}
    } else if (typeof rawUrl === 'string' && rawUrl.startsWith('http')) {
      addServer('Server 1', rawUrl);
    }
  }

  // 2. stream_ids
  if (rawIds) {
    let ids = [];
    if (Array.isArray(rawIds)) ids = rawIds;
    else if (typeof rawIds === 'string') {
      try { ids = JSON.parse(rawIds); } catch (e) { ids = rawIds.split(',').map(s => s.trim()); }
    }
    ids.forEach(sid => {
      const sObj = streamsMap[sid];
      if (sObj && sObj.active !== false && sObj.url) {
        addServer(sObj.label || 'Live Stream', sObj.url, sObj.quality, sObj.type);
      }
    });
  }

  // 3. Backup stream
  if (match.backup_stream_url) {
    addServer('Backup Stream', match.backup_stream_url);
  }

  result.hasStreams = result.servers.length > 0;
  return result;
}

/**
 * Formats an empty state container when 0 matches match query or date.
 * @param {string} filter 
 * @param {string} [league='']
 * @returns {{ count: number, html: string }}
 */
function formatEmptyMatchesState(filter = 'today', league = '') {
  const fText = escapeHtml(filter);
  const lText = league ? ` in ${escapeHtml(league)}` : '';
  const message = `No matches scheduled for ${fText}${lText}. Check another tab or explore upcoming fixtures!`;
  
  const html = 
    `<div class="zeta-empty-state" style="text-align:center;padding:48px 20px;color:#94a3b8;">` +
      `<div style="font-size:44px;margin-bottom:12px;">⚽</div>` +
      `<h3 style="font-size:18px;font-weight:700;color:#f8fafc;margin:0 0 6px;">Zero Fixtures Found</h3>` +
      `<p style="font-size:13px;color:#64748b;max-width:440px;margin:0 auto 16px;">${message}</p>` +
      `<button onclick="window.filterDate('all')" class="match-chip-btn" style="min-height:44px;padding:10px 20px;background:#2563eb;color:#fff;border-radius:8px;font-weight:700;">Show All Fixtures</button>` +
    `</div>`;

  return { count: 0, html };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateShieldSvg,
    resolveTeamLogo,
    filterApprovedMatches,
    resolveLineupData,
    resolveStreamServers,
    formatEmptyMatchesState
  };
}
