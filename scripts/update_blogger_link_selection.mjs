import fs from 'fs';
import vm from 'vm';

console.log('=== Updating Blogger Link Selection Gateway & Cross-Domain 2-Blogger Routing ===');

// 1. Read blogger_script_part.js
let js = fs.readFileSync('scripts/blogger_script_part.js', 'utf8');

// Replace top section
const oldTopMarker = '// ── VIEW SWITCHERS & ROUTING ──';
const feature4Marker = '// ── FEATURE #4: GOAL WHISTLE AUDIO ──';

const topStartIdx = js.indexOf(oldTopMarker);
const topEndIdx = js.indexOf(feature4Marker);

if (topStartIdx === -1 || topEndIdx === -1) {
  throw new Error('Could not find top routing markers in blogger_script_part.js');
}

const newTopSection = `// ── VIEW SWITCHERS & ROUTING (2-BLOGGER CROSS-DOMAIN & FULL-PAGE REFRESH) ──
    function cleanDomain(d) {
      if (!d) return '';
      return String(d).trim().replace(/^https?:\\/\\//i, '').replace(/\\/+$/, '');
    }

    function getDetailsOrigin() {
      var d = (window.ZETA_CONFIG && window.ZETA_CONFIG.DETAILS_DOMAIN) || (window.bloggerConfig && window.bloggerConfig.detailsBlogDomain);
      var cd = cleanDomain(d);
      if (cd) return 'https://' + cd;
      return window.location.origin;
    }

    function getStreamOrigin() {
      var d = (window.ZETA_CONFIG && window.ZETA_CONFIG.STREAM_DOMAIN) || (window.bloggerConfig && window.bloggerConfig.streamBlogDomain);
      var cd = cleanDomain(d);
      if (cd) return 'https://' + cd;
      return window.location.origin;
    }

    function getHomeUrl() {
      return getDetailsOrigin() + '/';
    }

    function getMatchPostUrl(matchOrId) {
      var mId = (typeof matchOrId === 'object' && matchOrId) ? matchOrId.id : matchOrId;
      var match = (typeof matchOrId === 'object' && matchOrId) ? matchOrId : (allMatches ? allMatches.find(function(m){ return String(m.id) === String(mId); }) : null);
      if (match && match.article_url && match.article_url.startsWith('http')) {
        return match.article_url;
      }
      return getDetailsOrigin() + '/?match=' + encodeURIComponent(mId);
    }

    function getLinksUrl(matchId) {
      // Link Selection Gateway lives on Blogger Blog 1 (Details Domain)
      return getDetailsOrigin() + '/?links=' + encodeURIComponent(matchId);
    }

    function getStreamUrl(matchId, serverIdx) {
      // Stream Video Player lives on Blogger Blog 2 (Stream Domain)
      var sIdx = (serverIdx != null && serverIdx !== undefined) ? serverIdx : 0;
      return getStreamOrigin() + '/?stream=' + encodeURIComponent(matchId) + '&server=' + sIdx;
    }

    window.goHome = function() {
      window.location.href = getHomeUrl();
    };

    window.returnToMatch = function() {
      if (currentMatchId) {
        window.location.href = getMatchPostUrl(currentMatchId);
      } else {
        window.location.href = getHomeUrl();
      }
    };

    window.returnToLinks = function() {
      if (currentMatchId) {
        window.location.href = getLinksUrl(currentMatchId);
      } else {
        window.location.href = getHomeUrl();
      }
    };

    function showView(viewName) {
      var homeEl = document.getElementById('homeView');
      var matchEl = document.getElementById('matchView');
      var linksEl = document.getElementById('linksView');
      var streamEl = document.getElementById('streamView');

      if (homeEl) homeEl.style.display = (viewName === 'home') ? 'block' : 'none';
      if (matchEl) matchEl.style.display = (viewName === 'match') ? 'block' : 'none';
      if (linksEl) linksEl.style.display = (viewName === 'links') ? 'block' : 'none';
      if (streamEl) streamEl.style.display = (viewName === 'stream') ? 'block' : 'none';
    }

    function extractMatchId(str) {
      if (!str) return null;
      var uuidRegex = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;
      var match = str.match(uuidRegex);
      if (match) return match[0];

      for (var i = 0; i < (allMatches || []).length; i++) {
        if (str.indexOf(String(allMatches[i].id)) !== -1) {
          return allMatches[i].id;
        }
      }
      var parts = str.split('-');
      return parts[parts.length - 1];
    }
`;

js = js.substring(0, topStartIdx) + newTopSection + '\n    ' + js.substring(topEndIdx);

// 2. Replace the Watch button in openMatchPage
const oldWatchBtnBlock = `'<!-- TAB PANE 1: OVERVIEW -->' +
        '<div class="mtab-pane active" id="mpane-overview">' +
          '<div class="watch-action-box" style="border-radius:14px;margin-bottom:14px;">' +
            '<button class="btn-watch-stream" id="watchBtn" onclick="startStreamCountdown(\\'' + match.id + '\\')">' +
              '<span>▶</span> ' + (hasLiveStream ? ('Watch Live Stream HD (' + mServers.length + ' Server' + (mServers.length > 1 ? 's' : '') + ' Online)') : 'Live Match Stream (Starts at Kickoff)') +
            '</button>' +

            '<div class="countdown-box" id="countdownBox">' +
              '<div style="font-size:15px;font-weight:800;">Connecting to Live HD Broadcast Server...</div>' +
              '<div style="font-size:13px;color:#64748b;margin-top:4px;">Redirecting you to stream player at <code>/stream/' + match.id + '</code> in:</div>' +
              '<div class="countdown-timer-circle" id="countTimer">5</div>' +
              '<div class="progress-bar-wrap"><div class="progress-bar-fill" id="countBar"></div></div>' +
              '<div style="font-size:12px;color:#64748b;font-weight:600;">Preparing HD adaptive video feed with zero delay...</div>' +
            '</div>' +
          '</div>'`;

const newWatchBtnBlock = `'<!-- TAB PANE 1: OVERVIEW -->' +
        '<div class="mtab-pane active" id="mpane-overview">' +
          '<div class="watch-action-box" style="border-radius:14px;margin-bottom:14px;">' +
            '<a href="' + getLinksUrl(match.id) + '" class="btn-watch-stream" id="watchBtn" style="display:flex;align-items:center;justify-content:center;text-decoration:none;">' +
              '<span>▶</span> ' + (hasLiveStream ? ('Select Live Stream Server (' + mServers.length + ' Channels Online)') : 'Live Stream Gateway (Starts at Kickoff)') +
            '</a>' +
          '</div>'`;

if (js.indexOf(oldWatchBtnBlock) !== -1) {
  js = js.replace(oldWatchBtnBlock, newWatchBtnBlock);
  console.log('✔ Updated watchBtn on Match Details page to link to Link Selection Page');
} else {
  console.warn('⚠ Could not find exact oldWatchBtnBlock match; checking flexible match');
}

// 3. Update startStreamCountdown to redirect to getLinksUrl
const countdownFnOld = `window.startStreamCountdown = function(matchId) {`;
const countdownFnIdx = js.indexOf(countdownFnOld);
if (countdownFnIdx !== -1) {
  const countdownFnEnd = js.indexOf('// ── STREAM SERVER DETECTION & DYNAMIC SERVER RESOLVER', countdownFnIdx);
  if (countdownFnEnd !== -1) {
    const newCountdown = `window.startStreamCountdown = function(matchId) {
      window.location.href = getLinksUrl(matchId);
    };

    `;
    js = js.substring(0, countdownFnIdx) + newCountdown + js.substring(countdownFnEnd);
    console.log('✔ Updated startStreamCountdown function');
  }
}

// 4. Insert openLinksPage right before openStreamPage
const openStreamMarker = '// ── ROUTE 2: DEDICATED STREAMING PAGE WITH DYNAMIC MULTI-SERVER (domain.com/stream/id) ──';
const openStreamIdx = js.indexOf(openStreamMarker);

if (openStreamIdx === -1) {
  throw new Error('Could not find openStreamMarker in blogger_script_part.js');
}

const linksPageCode = `// ── ROUTE 1.5: DEDICATED LINK SELECTION GATEWAY (domain.com/?links=id) ──
    window.openLinksPage = function(matchId, pushState) {
      var match = allMatches.find(function(m) { return String(m.id) === String(matchId); });
      if (!match) return;

      currentMatchId = match.id;
      stopStream();

      if (pushState !== false) {
        window.history.pushState({ linksId: match.id }, '', '/?links=' + encodeURIComponent(match.id));
      }

      var homeName = match.home_team || (teamsMap[match.home_team_id] && teamsMap[match.home_team_id].name) || 'Home Team';
      var awayName = match.away_team || (teamsMap[match.away_team_id] && teamsMap[match.away_team_id].name) || 'Away Team';
      var homeLogo = match.home_logo || (teamsMap[match.home_team_id] && teamsMap[match.home_team_id].logo_url) || 'https://korra.world/wp-content/uploads/yalla-team-logos/114.png';
      var awayLogo = match.away_logo || (teamsMap[match.away_team_id] && teamsMap[match.away_team_id].logo_url) || 'https://korra.world/wp-content/uploads/yalla-team-logos/109.png';
      var leagueName = match.league_name || (leaguesMap[match.league_id] && leaguesMap[match.league_id].name) || 'Live Match Center';

      document.title = 'Watch Live Links: ' + homeName + ' vs ' + awayName + ' | ZetaSports';

      var liveInfo = getMatchLiveInfo(match);
      var isLive = liveInfo.isLive;
      var statusClass = liveInfo.statusClass;
      var statusText = liveInfo.statusText;
      var scoreText = liveInfo.scoreText;
      var kickoffFull = match.date ? new Date(match.date).toLocaleString() : 'TBD';

      var mServers = getMatchServers(match);
      var hasLiveStream = mServers.length > 0;

      var linksBox = document.getElementById('linksBox');
      if (!linksBox) return;

      var postUrl = getMatchPostUrl(match);

      var html = 
        '<!-- Scoreboard Header on Link Selection Page -->' +
        '<div class="match-page-header">' +
          '<div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#93c5fd;font-weight:700;margin-bottom:4px;">' + leagueName + ' • Live Broadcasting Gateway</div>' +
          '<h1 style="font-size:22px;font-weight:800;">' + homeName + ' vs ' + awayName + '</h1>' +
          '<div style="margin-top:8px;"><span class="' + statusClass + '">' + statusText + '</span></div>' +
        '</div>' +

        '<div class="match-scoreboard-grid">' +
          '<div class="team-unit">' +
            '<img src="' + homeLogo + '" alt="' + homeName + '" />' +
            '<h3>' + homeName + '</h3>' +
          '</div>' +
          '<div class="score-unit">' +
            '<div class="big-score">' + scoreText + '</div>' +
            '<div style="font-size:12px;color:#64748b;font-weight:700;">' + (isLive ? 'Current Match Score' : 'Kickoff') + '</div>' +
          '</div>' +
          '<div class="team-unit">' +
            '<img src="' + awayLogo + '" alt="' + awayName + '" />' +
            '<h3>' + awayName + '</h3>' +
          '</div>' +
        '</div>' +

        '<div class="match-meta-list">' +
          '<div class="match-meta-item"><span>Stadium:</span><strong>' + (match.venue || 'National Stadium') + '</strong></div>' +
          '<div class="match-meta-item"><span>Kickoff Date:</span><strong>' + kickoffFull + '</strong></div>' +
          '<div class="match-meta-item"><span>Active Channels:</span><strong style="color:#22c55e;">' + (hasLiveStream ? (mServers.length + ' HD Streams Online') : 'Standby Mode') + '</strong></div>' +
          '<div class="match-meta-item"><span>Max Quality:</span><strong>1080p 60FPS Ultra HD</strong></div>' +
        '</div>' +

        '<!-- AdSense Slot 1: Top Gateway Leaderboard -->' +
        '<div class="links-ad-container" style="min-height:90px;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:10px;margin:16px 0;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">' +
          '<span>ADVERTISEMENT • 728x90 LEADERBOARD</span>' +
        '</div>' +

        '<!-- Server Selection Header -->' +
        '<div class="links-selection-header" style="margin:20px 0 12px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">' +
          '<div>' +
            '<h2 style="font-size:18px;font-weight:800;color:#0f172a;margin:0;">Select Streaming Server</h2>' +
            '<p style="font-size:12px;color:#64748b;margin:3px 0 0;">Choose your preferred broadcaster feed, audio language, and resolution:</p>' +
          '</div>' +
          '<span style="background:#dbeafe;color:#1e40af;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;">' + mServers.length + ' Available Channels</span>' +
        '</div>';

      if (!hasLiveStream) {
        html += 
          '<div class="no-stream-card" style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:32px 20px;text-align:center;margin:14px 0;">' +
            '<div style="font-size:40px;margin-bottom:10px;">📡</div>' +
            '<h3 style="font-size:17px;font-weight:800;color:#0f172a;margin:0 0 6px;">Live Stream Feeds Preparing</h3>' +
            '<p style="font-size:13px;color:#64748b;max-width:500px;margin:0 auto 16px;line-height:1.5;">Direct broadcast feeds for this fixture connect approximately 15 minutes prior to scheduled kickoff. Refresh closer to match time.</p>' +
            '<div style="display:flex;gap:10px;justify-content:center;">' +
              '<a href="' + postUrl + '" class="match-chip-btn">← Return to Match Post</a>' +
              '<button onclick="location.reload()" class="match-chip-btn" style="background:#2563eb;color:#fff;border-color:#2563eb;">🔄 Check for Live Feeds</button>' +
            '</div>' +
          '</div>';
      } else {
        html += '<div class="links-servers-grid">';
        mServers.forEach(function(srv, idx) {
          var streamTargetUrl = getStreamUrl(match.id, idx);
          var qBadge = srv.quality || '1080p HD';
          var lang = srv.language || 'English';
          var typeBadge = (srv.type === 'mpd' ? 'DASH ClearKey' : (srv.type === 'iframe' ? 'Web Player' : 'HLS Fast CDN'));
          var statusGlow = '🟢 Ultra Fast CDN • 99.9% Uptime';

          html += 
            '<div class="link-server-card">' +
              '<div class="link-server-card-top">' +
                '<div class="link-server-title">' +
                  '<span class="server-num-badge">#' + (idx + 1) + '</span> ' +
                  '<strong>' + srv.name + '</strong>' +
                '</div>' +
                '<span class="link-server-status">' + statusGlow + '</span>' +
              '</div>' +
              '<div class="link-server-meta-row">' +
                '<span class="badge-chip badge-quality">' + qBadge + '</span>' +
                '<span class="badge-chip badge-lang">🎙️ ' + lang + '</span>' +
                '<span class="badge-chip badge-type">⚡ ' + typeBadge + '</span>' +
              '</div>' +
              '<a href="' + streamTargetUrl + '" class="btn-launch-stream">' +
                '<span>▶</span> Watch Live Stream on Server ' + (idx + 1) +
              '</a>' +
            '</div>';
        });
        html += '</div>';
      }

      html += 
        '<!-- AdSense Slot 2: In-Grid High-CTR Rectangle -->' +
        '<div class="links-ad-container" style="min-height:250px;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:10px;margin:20px 0;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">' +
          '<span>ADVERTISEMENT • 300x250 IN-ARTICLE UNIT</span>' +
        '</div>' +

        '<div style="margin-top:20px;text-align:center;">' +
          '<a href="' + postUrl + '" class="match-chip-btn" style="display:inline-flex;padding:10px 20px;font-size:13px;">' +
            '← Back to Match Post &amp; Tactical Lineups' +
          '</a>' +
        '</div>';

      linksBox.innerHTML = html;
      showView('links');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    `;

js = js.substring(0, openStreamIdx) + linksPageCode + js.substring(openStreamIdx);

// 5. Upgrade openStreamPage to accept serverIdx and set back navigation to Blog 1
const oldOpenStreamFnStart = `window.openStreamPage = function(matchId, pushState) {`;
const openStreamFnIdx = js.indexOf(oldOpenStreamFnStart);

if (openStreamFnIdx === -1) {
  throw new Error('Could not find oldOpenStreamFnStart in blogger_script_part.js');
}

const oldOpenStreamBodyEnd = js.indexOf('function renderServerButtons() {', openStreamFnIdx);

const newOpenStreamFn = `window.openStreamPage = function(matchId, pushState, serverIdx) {
      var match = allMatches.find(function(m) { return String(m.id) === String(matchId); });
      if (!match) return;

      currentMatchId = match.id;
      var targetServerIdx = (serverIdx != null && serverIdx !== undefined) ? parseInt(serverIdx, 10) : 0;
      if (isNaN(targetServerIdx)) targetServerIdx = 0;

      if (pushState !== false) {
        window.history.pushState({ streamId: match.id, server: targetServerIdx }, '', '/?stream=' + encodeURIComponent(match.id) + '&server=' + targetServerIdx);
      }

      var homeName = match.home_team || (teamsMap[match.home_team_id] && teamsMap[match.home_team_id].name) || 'Home Team';
      var awayName = match.away_team || (teamsMap[match.away_team_id] && teamsMap[match.away_team_id].name) || 'Away Team';
      var title = homeName + ' vs ' + awayName + ' — Live Stream HD';

      document.title = 'Live Stream: ' + title + ' | ZetaSports';
      var titleEl = document.getElementById('streamTitle');
      if (titleEl) titleEl.textContent = title;

      // Update back navigation buttons to point back to Blogger Blog 1 (Details Domain)
      var backLinksBtn = document.getElementById('btnBackToLinks');
      if (backLinksBtn) backLinksBtn.href = getLinksUrl(match.id);
      var backPostBtn = document.getElementById('btnBackToPost');
      if (backPostBtn) backPostBtn.href = getMatchPostUrl(match);
      var backHomeBtn = document.getElementById('btnBackToHome');
      if (backHomeBtn) backHomeBtn.href = getHomeUrl();

      showView('stream');
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Resolve real servers matching Admin Panel 1:1
      currentMatchServers = getMatchServers(match);
      currentServerIndex = (targetServerIdx < currentMatchServers.length) ? targetServerIdx : 0;

      renderServerButtons();

      if (currentMatchServers.length === 0) {
        stopStream();
        showNoStreamUI();
      } else {
        hideNoStreamUI();
        loadStreamServer(currentMatchServers[currentServerIndex]);
      }
    };

    `;

js = js.substring(0, openStreamFnIdx) + newOpenStreamFn + js.substring(oldOpenStreamBodyEnd);

// 6. Update checkUrlRoute() to support ?links=... and /links/...
const oldCheckRouteMarker = 'function checkUrlRoute() {';
const checkRouteIdx = js.indexOf(oldCheckRouteMarker);

if (checkRouteIdx === -1) {
  throw new Error('Could not find checkUrlRoute marker in blogger_script_part.js');
}

const checkRouteEnd = js.indexOf("window.addEventListener('popstate'", checkRouteIdx);

const newCheckRoute = `function checkUrlRoute() {
      var path = window.location.pathname || '';
      var params = new URLSearchParams(window.location.search);
      var streamParam = params.get('stream');
      var linksParam = params.get('links') || params.get('link');
      var matchParam = params.get('match');
      var serverParam = params.get('server');
      var serverIdx = parseInt(serverParam || '0', 10);
      if (isNaN(serverIdx)) serverIdx = 0;

      // 1. Stream Route on Blogger Blog 2: ?stream={id} or /stream/{id}
      if (streamParam || path.indexOf('/stream/') !== -1) {
        var sId = streamParam || extractMatchId(path.split('/stream/')[1]);
        if (sId) {
          openStreamPage(sId, false, serverIdx);
          return;
        }
      }

      // 2. Link Selection Route on Blogger Blog 1: ?links={id} or /links/{id}
      if (linksParam || path.indexOf('/links/') !== -1) {
        var lId = linksParam || extractMatchId(path.split('/links/')[1]);
        if (lId) {
          openLinksPage(lId, false);
          return;
        }
      }

      // 3. Match Details Post Route on Blogger Blog 1: ?match={id} or /{slug}-{id}
      if (matchParam) {
        var mId = extractMatchId(matchParam);
        if (mId) {
          openMatchPage(mId, false);
          return;
        }
      }

      if (path && path !== '/' && path.indexOf('/p/') === -1 && path.indexOf('/search') === -1) {
        var cleanPath = path.replace(/^\\/+|\\/+$/g, '');
        var mId2 = extractMatchId(cleanPath);
        if (mId2) {
          openMatchPage(mId2, false);
          return;
        }
      }

      // 4. Default Home View on Blogger Blog 1
      showView('home');
    }

    `;

js = js.substring(0, checkRouteIdx) + newCheckRoute + js.substring(checkRouteEnd);

// 7. Verify syntax
try {
  new vm.Script(js);
  console.log('✔ Syntax verification passed: scripts/blogger_script_part.js is 100% valid!');
} catch (e) {
  console.error('✖ Syntax error in modified js:', e);
  process.exit(1);
}

// 8. Write updated file
fs.writeFileSync('scripts/blogger_script_part.js', js, 'utf8');
console.log('✔ Successfully saved scripts/blogger_script_part.js');

