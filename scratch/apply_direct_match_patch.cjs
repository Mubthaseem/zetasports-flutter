const fs = require('fs');
const path = require('path');

function patchScriptPart() {
  const file = path.resolve('scripts/blogger_script_part.js');
  let content = fs.readFileSync(file, 'utf8');

  const target = `    // ── ROUTE 1: DEDICATED MATCH DETAILS & 8 SECTIONS (domain.com/team1-vs-team2-id) ──
    window.openMatchPage = function(matchId, pushState) {
      var match = allMatches.find(function(m) { return String(m.id) === String(matchId); });
      if (!match) return;

      currentMatchId = match.id;
      var mServers = getMatchServers(match);
      var hasLiveStream = mServers.length > 0;
      stopStream();

      var rawHomeName = match.home_team || (teamsMap[match.home_team_id] && teamsMap[match.home_team_id].name) || 'Home Team';
      var rawAwayName = match.away_team || (teamsMap[match.away_team_id] && teamsMap[match.away_team_id].name) || 'Away Team';
      var homeName = escapeHtml(rawHomeName);
      var awayName = escapeHtml(rawAwayName);
      var homeLogo = sanitizeUrl(match.home_logo || (teamsMap[match.home_team_id] && teamsMap[match.home_team_id].logo_url) || 'https://korra.world/wp-content/uploads/yalla-team-logos/114.png');
      var awayLogo = sanitizeUrl(match.away_logo || (teamsMap[match.away_team_id] && teamsMap[match.away_team_id].logo_url) || 'https://korra.world/wp-content/uploads/yalla-team-logos/109.png');
      var leagueName = escapeHtml(match.league_name || (leaguesMap[match.league_id] && leaguesMap[match.league_id].name) || 'Live Football Match');
      var venue = escapeHtml(match.venue || 'National Stadium');
      var referee = escapeHtml(match.referee || 'FIFA Licensed');
      var fotmobId = escapeHtml(String(match.fotmob_id || '').replace(/[^a-zA-Z0-9_\\-]/g, ''));
      var matchIdClean = escapeHtml(String(match.id || '').replace(/[^a-zA-Z0-9_\\-]/g, ''));
      var linksUrl = sanitizeUrl(getLinksUrl(match.id));

      var matchSlug = slugify(rawHomeName) + '-vs-' + slugify(rawAwayName) + '-' + match.id;
      if (pushState !== false) {
        window.history.pushState({ matchId: match.id }, '', '/' + matchSlug);
      }
      document.title = homeName + ' vs ' + awayName + ' — Live Score, News & Stream | ZetaSports';
      injectMatchSEO(homeName, awayName, leagueName, scoreText, isLive, kickoffFull);

      var liveInfo = getMatchLiveInfo(match);
      var isLive = liveInfo.isLive;
      var statusClass = liveInfo.statusClass;
      var statusText = liveInfo.statusText;
      var scoreText = liveInfo.scoreText;
      var kickoffFull = match.date ? new Date(match.date).toLocaleString() : 'TBD';`;

  const replacement = `    // ── Direct Match Fetcher for Virtual URLs / Deep Links ──
    async function fetchDirectMatch(matchId, pushState) {
      showView('match');
      var box = document.getElementById('matchBox');
      if (box) {
        box.innerHTML = '<div style="text-align:center;padding:48px 20px;color:#94a3b8;"><div class="loading-spinner" style="margin:0 auto 16px;width:32px;height:32px;border:3px solid rgba(255,255,255,0.1);border-top-color:#3b82f6;border-radius:50%;animation:spin 0.8s linear infinite;"></div><p style="font-size:15px;font-weight:600;color:#f8fafc;">Loading Match Details...</p><p style="font-size:12px;color:#64748b;margin-top:4px;">Connecting to ZetaSports Live Hub...</p></div>';
      }
      try {
        var res = await fetch(SB_URL + '/rest/v1/zeta_matches?id=eq.' + encodeURIComponent(matchId) + '&select=*', {
          headers: SB_HEADERS
        });
        if (res.ok) {
          var data = await res.json();
          if (data && data[0]) {
            var m = data[0];
            allMatches.push(m);
            window.openMatchPage(m.id, pushState);
            return;
          }
        }
      } catch (err) {
        console.error('[ZetaSports] Direct match fetch error:', err);
      }
      if (box) {
        box.innerHTML = '<div style="text-align:center;padding:48px 20px;color:#ef4444;"><p style="font-size:16px;font-weight:700;">Match Not Found</p><p style="font-size:13px;color:#94a3b8;margin-top:6px;">This match may have concluded or the URL is invalid.</p><button onclick="showView(\\'home\\')" style="margin-top:16px;padding:8px 16px;background:#2563eb;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;">← Return to Fixtures</button></div>';
      }
    }

    // ── ROUTE 1: DEDICATED MATCH DETAILS & 8 SECTIONS (domain.com/team1-vs-team2-id) ──
    window.openMatchPage = function(matchId, pushState) {
      var match = allMatches.find(function(m) { return String(m.id) === String(matchId); });
      if (!match) {
        fetchDirectMatch(matchId, pushState);
        return;
      }

      currentMatchId = match.id;
      var mServers = getMatchServers(match);
      var hasLiveStream = mServers.length > 0;
      stopStream();

      var rawHomeName = match.home_team || (teamsMap[match.home_team_id] && teamsMap[match.home_team_id].name) || 'Home Team';
      var rawAwayName = match.away_team || (teamsMap[match.away_team_id] && teamsMap[match.away_team_id].name) || 'Away Team';
      var homeName = escapeHtml(rawHomeName);
      var awayName = escapeHtml(rawAwayName);
      var homeLogo = sanitizeUrl(match.home_logo || (teamsMap[match.home_team_id] && teamsMap[match.home_team_id].logo_url) || 'https://korra.world/wp-content/uploads/yalla-team-logos/114.png');
      var awayLogo = sanitizeUrl(match.away_logo || (teamsMap[match.away_team_id] && teamsMap[match.away_team_id].logo_url) || 'https://korra.world/wp-content/uploads/yalla-team-logos/109.png');
      var leagueName = escapeHtml(match.league_name || (leaguesMap[match.league_id] && leaguesMap[match.league_id].name) || 'Live Football Match');
      var venue = escapeHtml(match.venue || 'National Stadium');
      var referee = escapeHtml(match.referee || 'FIFA Licensed');
      var fotmobId = escapeHtml(String(match.fotmob_id || '').replace(/[^a-zA-Z0-9_\\-]/g, ''));
      var matchIdClean = escapeHtml(String(match.id || '').replace(/[^a-zA-Z0-9_\\-]/g, ''));
      var linksUrl = sanitizeUrl(getLinksUrl(match.id));

      var liveInfo = getMatchLiveInfo(match);
      var isLive = liveInfo.isLive;
      var statusClass = liveInfo.statusClass;
      var statusText = liveInfo.statusText;
      var scoreText = liveInfo.scoreText;
      var kickoffFull = match.date ? new Date(match.date).toLocaleString() : 'TBD';

      var matchSlug = slugify(rawHomeName) + '-vs-' + slugify(rawAwayName) + '-' + match.id;
      if (pushState !== false) {
        window.history.pushState({ matchId: match.id }, '', '/' + matchSlug);
      }
      document.title = homeName + ' vs ' + awayName + ' — Live Score, News & Stream | ZetaSports';
      injectMatchSEO(homeName, awayName, leagueName, scoreText, isLive, kickoffFull);`;

  const normContent = content.replace(/\r\n/g, '\n');
  const normTarget = target.replace(/\r\n/g, '\n');

  if (normContent.includes(normTarget)) {
    const updated = normContent.replace(normTarget, replacement.replace(/\r\n/g, '\n'));
    fs.writeFileSync(file, updated, 'utf8');
    console.log('SUCCESS: Patched scripts/blogger_script_part.js');
  } else {
    console.error('FAILED: Target pattern not found in scripts/blogger_script_part.js');
  }
}

patchScriptPart();
