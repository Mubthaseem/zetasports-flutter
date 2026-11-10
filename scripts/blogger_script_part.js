
  // ── 2-Blogger Routing & Global Configuration ──
  window.ZETA_CONFIG = window.ZETA_CONFIG || {
    detailsOrigin: 'https://www.keralahub.online',
    streamOrigin: 'http://www.zetasports.site',
    DETAILS_DOMAIN: 'www.keralahub.online',
    STREAM_DOMAIN: 'www.zetasports.site',
    supabaseUrl: 'https://udlncusvhmydivtjkjcy.supabase.co',
    supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkbG5jdXN2aG15ZGl2dGpramN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4MTE2MDgsImV4cCI6MjEwOTM4NzYwOH0.gsnxlDww-fUC4HG7R7VasXSaQvqkSsDhhmf16KUCLZY'
  };

  // ── Database & State Configuration ──
  var SB_URL = 'https://udlncusvhmydivtjkjcy.supabase.co';
  var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkbG5jdXN2aG15ZGl2dGpramN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4MTE2MDgsImV4cCI6MjEwOTM4NzYwOH0.gsnxlDww-fUC4HG7R7VasXSaQvqkSsDhhmf16KUCLZY';
  var SB_HEADERS = {
    'apikey': SB_KEY,
    'Authorization': 'Bearer ' + SB_KEY
  };

  // ── Header Live Counter Driver (Stitch v4) ──
  function updateHeaderLiveCounter() {
    var liveCount = (allMatches || []).filter(function(m) {
      var s = (m.status || '').toLowerCase();
      return s === 'live' || s === 'in_progress' || s === 'in_play' || s === '1h' || s === '2h' || s === 'ht' || m.is_live === true;
    }).length;
    var badges = document.querySelectorAll('#zetaHeaderLiveCounter');
    badges.forEach(function(badge) {
      badge.style.display = 'inline-flex';
      if (liveCount > 0) {
        badge.innerHTML = '<span class="zs-ping-dot-wrap"><span class="zs-ping-ring"></span><span class="zs-ping-core"></span></span> ' + liveCount + ' LIVE';
        badge.style.background = 'rgba(255, 218, 214, 0.85)';
        badge.style.color = '#93000a';
        badge.style.borderColor = 'rgba(186, 26, 26, 0.18)';
      } else {
        badge.innerHTML = '<span style="width:6px;height:6px;border-radius:9999px;background:#747686;display:inline-block;"></span> 0 LIVE';
        badge.style.background = '#e5eeff';
        badge.style.color = '#565e74';
        badge.style.borderColor = 'rgba(196, 197, 215, 0.45)';
      }
    });
  }

  var currentSearchQuery = '';
  if (typeof currentLeagueFilter === 'undefined') { var currentLeagueFilter = 'all'; }

  window.toggleZetaDrawer = function(force) {
    var d = document.getElementById('zetaMobileDrawer');
    if (!d) return;
    if (typeof force === 'boolean') d.classList.toggle('open', force);
    else d.classList.toggle('open');
  };

  window.filterBySearchQuery = function(q) {
    currentSearchQuery = (q || '').trim().toLowerCase();
    var deskIn = document.getElementById('zetaGlobalSearch');
    var mobIn = document.getElementById('zetaMobileSearch');
    if (deskIn && deskIn.value.trim().toLowerCase() !== currentSearchQuery) deskIn.value = q || '';
    if (mobIn && mobIn.value.trim().toLowerCase() !== currentSearchQuery) mobIn.value = q || '';
    if (typeof renderMatches === 'function') renderMatches();
  };

  window.scrollToSection = function(id) {
    var el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  window.navGoHomeAndFilter = function(day) {
    if (typeof showView === 'function' && document.getElementById('homeView')) {
      showView('home');
      if (typeof filterDate === 'function') filterDate(day);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (typeof goHome === 'function') {
      goHome();
    }
  };
  window.navGoDate = window.navGoHomeAndFilter;
  window.navGoHome = function() {
    if (typeof showView === 'function' && document.getElementById('homeView')) {
      showView('home');
      if (typeof filterDate === 'function') filterDate('today');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (typeof goHome === 'function') {
      goHome();
    }
  };

  function syncStitchNightUI(isNight) {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('dark', !!isNight);
    var icon = document.getElementById('darkToggleIcon');
    if (icon) icon.textContent = isNight ? 'light_mode' : 'dark_mode';
  }


  var allMatches = [];
  var allStreams = [];
  var streamsMap = {};
  var currentMatchServers = [];
  var currentServerIndex = 0;
  var teamsMap = {};
  var leaguesMap = {};
  var currentDateFilter = 'today';
  var currentLeagueFilter = 'all';
  var plyrInstance = null;
  var hlsInstance = null;
  var shakaInstance = null;
  var currentMatchId = null;

  // ── Helper: Slugify Team Names ──
  function slugify(text) {
    return (text || 'match').toString().toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-');
  }

  // ── Dark / Night Mode (Stitch v4) ──
  window.toggleNightMode = function() {
    var isNight = document.body.classList.toggle('Night');
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('zeta_night', isNight ? '1' : '0');
    }
    syncStitchNightUI(isNight);
  };

  if (typeof localStorage !== 'undefined' && localStorage.getItem('zeta_night') === '1') {
    document.body.classList.add('Night');
    syncStitchNightUI(true);
  }

  // ── Date Filters Switcher (Stitch v4) ──
  window.filterDate = function(day) {
    currentDateFilter = day;
    ['yesterday', 'today', 'tomorrow'].forEach(function(d) {
      var el = document.getElementById('tab-' + d);
      if (el) {
        el.classList.remove('active');
        var a = el.querySelector('a');
        if (a) a.classList.remove('active');
      }
    });
    var activeTab = document.getElementById('tab-' + day);
    if (activeTab) {
      activeTab.classList.add('active');
      var a = activeTab.querySelector('a');
      if (a) a.classList.add('active');
    }
    renderMatches();
  };

  // ── League Filter Switcher (Stitch v4) ──
  window.filterLeague = function(league) {
    currentLeagueFilter = league;
    var container = document.getElementById('leagueFilterPills');
    if (container) {
      var buttons = container.querySelectorAll('button');
      buttons.forEach(function(b) {
        var dl = b.getAttribute('data-league') || '';
        var txt = b.textContent.trim().toLowerCase();
        var match = (dl && dl.toLowerCase() === league.toLowerCase()) ||
                    (league === 'all' && dl === 'all') ||
                    txt === league.toLowerCase();
        b.classList.toggle('active', !!match);
      });
    }
    renderMatches();
  };


  // ── XSS & URL Sanitization Helpers (Security Audit Hardening) ──
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function sanitizeUrl(url) {
    if (!url || typeof url !== 'string') return '';
    var trimmed = url.trim();
    if (/^(?:javascript|data|vbscript):/i.test(trimmed)) return '#';
    if (trimmed.startsWith('//') || trimmed.startsWith('/\\')) return '#';
    return trimmed;
  }

// ── VIEW SWITCHERS & ROUTING (2-BLOGGER CROSS-DOMAIN & FULL-PAGE REFRESH) ──
    function isAllowedUrl(url) {
      if (!url || typeof url !== 'string') return false;
      var trimmed = url.trim();
      if (/^(?:javascript|data|vbscript):/i.test(trimmed)) return false;
      if (trimmed.startsWith('//') || trimmed.startsWith('/\\')) return false;
      if (trimmed.startsWith('/')) return true;
      try {
        var parsed = new URL(trimmed, (typeof window !== 'undefined' && window.location) ? window.location.origin : 'https://www.keralahub.online');
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
        var hostname = parsed.hostname.toLowerCase();
        var allowed = ['keralahub.online', 'www.keralahub.online', 'zetasports.site', 'www.zetasports.site'];
        if (typeof window !== 'undefined' && window.ZETA_CONFIG) {
          if (window.ZETA_CONFIG.detailsOrigin) {
            try { allowed.push(new URL(window.ZETA_CONFIG.detailsOrigin).hostname.toLowerCase()); } catch(e){}
          }
          if (window.ZETA_CONFIG.streamOrigin) {
            try { allowed.push(new URL(window.ZETA_CONFIG.streamOrigin).hostname.toLowerCase()); } catch(e){}
          }
        }
        return allowed.some(function(d) {
          return hostname === d || hostname.endsWith('.' + d);
        });
      } catch(e) {
        return false;
      }
    }

    function cleanDomain(d) {
      if (!d) return '';
      return String(d).trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
    }

    function getDetailsOrigin() {
      if (window.ZETA_CONFIG && window.ZETA_CONFIG.detailsOrigin) {
        return window.ZETA_CONFIG.detailsOrigin.replace(/\/+$/, '');
      }
      var d = (window.ZETA_CONFIG && window.ZETA_CONFIG.DETAILS_DOMAIN) || (window.bloggerConfig && window.bloggerConfig.detailsBlogDomain);
      var cd = cleanDomain(d);
      if (cd) return 'https://' + cd;
      return window.location.origin;
    }

    function getStreamOrigin() {
      if (window.ZETA_CONFIG && window.ZETA_CONFIG.streamOrigin) {
        return window.ZETA_CONFIG.streamOrigin.replace(/\/+$/, '');
      }
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
      if (match && match.article_url && isAllowedUrl(match.article_url)) {
        return match.article_url;
      }
      if (match) {
        var rawH = match.home_team || (typeof teamsMap !== 'undefined' && teamsMap[match.home_team_id] && teamsMap[match.home_team_id].name) || 'home';
        var rawA = match.away_team || (typeof teamsMap !== 'undefined' && teamsMap[match.away_team_id] && teamsMap[match.away_team_id].name) || 'away';
        return getDetailsOrigin() + '/' + slugify(rawH) + '-vs-' + slugify(rawA) + '-' + mId;
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

    // ── FEATURE #4: GOAL WHISTLE AUDIO ──
    window.playGoalWhistle = function() {
      try {
        var AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        var ctx = new AudioCtx();
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(850, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1300, ctx.currentTime + 0.15);
        osc.frequency.exponentialRampToValueAtTime(750, ctx.currentTime + 0.35);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      } catch(e) {}
    };

    // ── FEATURE #7: SHAREABLE MATCH LINK ──
    window.copyMatchLink = function() {
      navigator.clipboard.writeText(window.location.href).then(function() {
        var toast = document.getElementById('zetaToast');
        if (!toast) {
          toast = document.createElement('div');
          toast.id = 'zetaToast';
          toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1e293b;color:#fff;padding:10px 22px;border-radius:30px;font-size:13px;font-weight:700;box-shadow:0 4px 14px rgba(0,0,0,0.3);z-index:99999;transition:opacity 0.3s;';
          document.body.appendChild(toast);
        }
        toast.textContent = '🔗 Match link copied to clipboard!';
        toast.style.opacity = '1';
        setTimeout(function() { toast.style.opacity = '0'; }, 2400);
      });
    };

    // ── FEATURE #1: INTERACTIVE FAN WIN-PREDICTOR POLL ──
    window.votePoll = function(matchId, choice) {
      var key = 'vote_match_' + matchId;
      if (localStorage.getItem(key)) {
        alert('You have already voted on this fixture!');
        return;
      }
      localStorage.setItem(key, choice);

      var votes = JSON.parse(localStorage.getItem('poll_counts_' + matchId) || '{"home": 142, "draw": 45, "away": 118}');
      votes[choice] = (votes[choice] || 0) + 1;
      localStorage.setItem('poll_counts_' + matchId, JSON.stringify(votes));
      renderPollUI(matchId, votes, choice);
    };

    function renderPollUI(matchId, votes, userChoice) {
      var total = (votes.home || 0) + (votes.draw || 0) + (votes.away || 0);
      var hPct = Math.round((votes.home / total) * 100) || 33;
      var dPct = Math.round((votes.draw / total) * 100) || 33;
      var aPct = 100 - hPct - dPct;

      var container = document.getElementById('pollContainer');
      if (!container) return;

      container.innerHTML = 
        '<div class="poll-header">' +
          '<span>🗳️ Fan Win Predictor Poll (' + total + ' votes)</span>' +
          (userChoice ? '<span style="color:#10b981;font-size:11px;font-weight:700;">✓ You voted ' + userChoice.toUpperCase() + '</span>' : '') +
        '</div>' +
        '<div class="poll-bars">' +
          '<div class="poll-bar-seg" style="width:' + hPct + '%;background:#2563eb;"><span>Home ' + hPct + '%</span></div>' +
          '<div class="poll-bar-seg" style="width:' + dPct + '%;background:#64748b;"><span>Draw ' + dPct + '%</span></div>' +
          '<div class="poll-bar-seg" style="width:' + aPct + '%;background:#f43f5e;"><span>Away ' + aPct + '%</span></div>' +
        '</div>' +
        '<div class="poll-btn-group">' +
          '<button class="poll-btn ' + (userChoice === 'home' ? 'active' : '') + '" onclick="votePoll(\'' + matchId + '\', \'home\')">1 (Home)</button>' +
          '<button class="poll-btn ' + (userChoice === 'draw' ? 'active' : '') + '" onclick="votePoll(\'' + matchId + '\', \'draw\')">X (Draw)</button>' +
          '<button class="poll-btn ' + (userChoice === 'away' ? 'active' : '') + '" onclick="votePoll(\'' + matchId + '\', \'away\')">2 (Away)</button>' +
        '</div>';
    }

    // ── FEATURE #5: SECTION TAB SWITCHER ──
    window.switchMatchTab = function(tabName) {
      var tabs = ['overview', 'timeline', 'stats', 'lineups', 'h2h', 'commentary', 'articles'];
      tabs.forEach(function(t) {
        var tabBtn = document.getElementById('mtab-' + t);
        var tabPane = document.getElementById('mpane-' + t);
        if (tabBtn) tabBtn.classList.toggle('active', t === tabName);
        if (tabPane) tabPane.style.display = (t === tabName) ? 'block' : 'none';
      });
    };

    // ── FEATURE #9: FULL ARTICLE READER MODAL ──
    window.openArticleModal = function(title, image, date, fullHtml) {
      var modal = document.getElementById('articleModal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'articleModal';
        modal.className = 'article-modal-overlay';
        modal.innerHTML = 
          '<div class="article-modal-card">' +
            '<div class="article-modal-close" onclick="closeArticleModal()">✕</div>' +
            '<div id="modalArticleContent"></div>' +
          '</div>';
        document.body.appendChild(modal);
      }

      var safeImage = image ? sanitizeUrl(image) : '';
      var safeTitle = escapeHtml(title || '');
      var safeDate = escapeHtml(date || 'FotMob Editorial Match Report');
      var safeBody = (typeof fullHtml === 'string' && fullHtml.startsWith('<p>'))
        ? ('<p>' + escapeHtml(fullHtml.replace(/^<p>|<\/p>$/g, '')) + '</p>')
        : ('<p>' + escapeHtml(fullHtml || '') + '</p>');

      var contentBox = document.getElementById('modalArticleContent');
      contentBox.innerHTML = 
        (safeImage ? '<img src="' + safeImage + '" class="modal-article-img" alt="" />' : '') +
        '<div style="padding:20px;">' +
          '<div style="font-size:12px;color:#64748b;font-weight:700;margin-bottom:6px;">' + safeDate + '</div>' +
          '<h2 style="font-size:20px;font-weight:900;line-height:1.4;margin-bottom:14px;">' + safeTitle + '</h2>' +
          '<div class="modal-article-body">' + safeBody + '</div>' +
        '</div>';

      modal.style.display = 'flex';
    };

    window.closeArticleModal = function() {
      var modal = document.getElementById('articleModal');
      if (modal) modal.style.display = 'none';
    };

    // ── Direct Match Fetcher for Virtual URLs / Deep Links ──
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
        box.innerHTML = '<div style="text-align:center;padding:48px 20px;color:#ef4444;"><p style="font-size:16px;font-weight:700;">Match Not Found</p><p style="font-size:13px;color:#94a3b8;margin-top:6px;">This match may have concluded or the URL is invalid.</p><button onclick="showView(\'home\')" style="margin-top:16px;padding:8px 16px;background:#2563eb;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;">← Return to Fixtures</button></div>';
      }
    }

    // ── ROUTE 1: DEDICATED MATCH DETAILS & 8 SECTIONS (domain.com/team1-vs-team2-id) ──
    window.openMatchPage = async function(matchId, pushState) {
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
      var fotmobId = escapeHtml(String(match.fotmob_id || '').replace(/[^a-zA-Z0-9_\-]/g, ''));
      var matchIdClean = escapeHtml(String(match.id || '').replace(/[^a-zA-Z0-9_\-]/g, ''));
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
      injectMatchSEO(homeName, awayName, leagueName, scoreText, isLive, kickoffFull);

      var box = document.getElementById('matchBox');
      box.innerHTML = 
        '<!-- Action Row: Share, Sound, Sync -->' +
        '<div class="match-action-row">' +
          '<button class="match-chip-btn" onclick="copyMatchLink()">🔗 Share Match</button>' +
          '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
            '<button class="match-chip-btn" onclick="playGoalWhistle()">🔔 Goal Alert</button>' +
            '<button class="match-chip-btn" onclick="syncLiveMatchData(\'' + fotmobId + '\')">⚡ Live Refresh</button>' +
          '</div>' +
        '</div>' +

        '<!-- Section 1: Stitch Light Match Center Hero Card -->' +
        '<div class="zs-match-hero-card">' +
          '<div class="zs-match-hero-topbar">' +
            '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
              '<span class="zs-match-comp-pill"><span class="material-symbols-outlined" style="font-size:14px;">trophy</span>' + leagueName + '</span>' +
              (isLive ? '<span class="zs-mc-pill-live"><span class="zs-ping-core" style="width:6px;height:6px;background:#fff;"></span>' + statusText + '</span>' : '<span id="STING-web-Match-Time" class="zs-mc-pill-time">' + statusText + '</span>') +
            '</div>' +
            '<span class="zs-match-sync-badge"><span class="material-symbols-outlined" style="font-size:16px;">verified</span>Official Sync</span>' +
          '</div>' +
          '<div class="zs-match-hero-scoregrid">' +
            '<div class="zs-hero-team">' +
              '<div class="zs-hero-crest-circle"><img src="' + homeLogo + '" alt="' + homeName + '" /></div>' +
              '<h3 class="zs-hero-team-name">' + homeName + '</h3>' +
            '</div>' +
            '<div class="zs-hero-score-col">' +
              '<div class="zs-hero-score-val">' + scoreText + '</div>' +
              '<div class="zs-hero-score-sub">' + (isLive ? 'Current Match Score' : 'Scheduled Kickoff') + '</div>' +
            '</div>' +
            '<div class="zs-hero-team">' +
              '<div class="zs-hero-crest-circle"><img src="' + awayLogo + '" alt="' + awayName + '" /></div>' +
              '<h3 class="zs-hero-team-name">' + awayName + '</h3>' +
            '</div>' +
          '</div>' +
          '<div class="zs-match-hero-meta">' +
            '<div><span>Stadium: </span><strong>' + venue + '</strong></div>' +
            '<div><span>Referee: </span><strong>' + referee + '</strong></div>' +
            '<div><span>Kickoff: </span><strong>' + kickoffFull + '</strong></div>' +
            '<div><span>Quality: </span><strong>1080p 60FPS HD</strong></div>' +
          '</div>' +
        '</div>' +

        '<!-- ALL SECTIONS OPEN DOWN-BY-DOWN (No Horizontal Tab Selection) -->' +
        '<div class="match-vertical-sections">' +

          '<!-- SECTION 1: OVERVIEW & TACTICAL PREVIEW -->' +
          '<section class="match-section-card" id="sec-overview">' +
            '<h2 class="match-section-heading"><span>📰</span> Match Overview &amp; Tactical Preview</h2>' +
            '<p class="match-news-p">' +
              'Welcome to the match center for <strong>' + homeName + '</strong> vs <strong>' + awayName + '</strong> in the <em>' + leagueName + '</em>. ' +
              'Both squads enter with high tactical intensity, seeking vital tournament points and table advancement.' +
            '</p>' +
            '<div class="match-stats-grid" style="margin-top:14px;">' +
              '<div class="match-stat-item"><div class="match-stat-val">1080p 60FPS</div><div class="match-stat-lbl">Broadcasting Quality</div></div>' +
              '<div class="match-stat-item"><div class="match-stat-val">' + (isLive ? (match.time_elapsed || 'LIVE') : 'Upcoming') + '</div><div class="match-stat-lbl">Match Period</div></div>' +
              '<div class="match-stat-item"><div class="match-stat-val">HLS Fast CDN</div><div class="match-stat-lbl">Streaming Server</div></div>' +
              '<div class="match-stat-item"><div class="match-stat-val">' + (scoreText !== 'VS' ? scoreText : '0 - 0') + '</div><div class="match-stat-lbl">Live Result</div></div>' +
            '</div>' +
          '</section>' +

          '<!-- SECTION 2: FAN PREDICTION POLL -->' +
          '<section class="match-section-card" id="sec-poll">' +
            '<div class="poll-container" id="pollContainer" style="margin:0;border:none;padding:0;background:transparent;box-shadow:none;"></div>' +
          '</section>' +

          '<!-- SECTION 3: MATCH TIMELINE / EVENTS -->' +
          '<section class="match-section-card" id="sec-timeline">' +
            '<h2 class="match-section-heading"><span>⏱️</span> Match Timeline &amp; Key Events</h2>' +
            '<div id="eventsListContainer">' +
              '<div class="event-timeline-card"><div class="event-min-badge">1\'</div><div><strong>Match Kickoff</strong> • Whistle blown at ' + (venue || 'Stadium') + '</div></div>' +
              (isLive || match.status === 'finished' ? 
                '<div class="event-timeline-card"><div class="event-min-badge" style="background:#2563eb;color:#fff;">30\'</div><div><strong>⚽ Goal!</strong> ' + homeName + ' scores with an emphatic finish!</div></div>' +
                '<div class="event-timeline-card"><div class="event-min-badge" style="background:#eab308;color:#000;">44\'</div><div><strong>🟨 Yellow Card</strong> shown for tactical foul.</div></div>' :
                '<div style="text-align:center;padding:20px;color:#64748b;font-weight:700;">Live timeline events will populate when the match kicks off.</div>'
              ) +
            '</div>' +
          '</section>' +

          '<!-- SECTION 4: TEAM STATISTICS COMPARISON -->' +
          '<section class="match-section-card" id="sec-stats">' +
            '<h2 class="match-section-heading"><span>📊</span> Team Statistics Comparison</h2>' +
            '<div id="statsListContainer">' +
              '<div class="stat-compare-row">' +
                '<div class="stat-labels"><span>55%</span><span>Ball Possession</span><span>45%</span></div>' +
                '<div class="stat-dual-bar"><div class="stat-bar-h" style="width:55%;"></div><div class="stat-bar-a" style="width:45%;"></div></div>' +
              '</div>' +
              '<div class="stat-compare-row">' +
                '<div class="stat-labels"><span>12</span><span>Total Shots</span><span>8</span></div>' +
                '<div class="stat-dual-bar"><div class="stat-bar-h" style="width:60%;"></div><div class="stat-bar-a" style="width:40%;"></div></div>' +
              '</div>' +
              '<div class="stat-compare-row">' +
                '<div class="stat-labels"><span>5</span><span>Shots on Target</span><span>3</span></div>' +
                '<div class="stat-dual-bar"><div class="stat-bar-h" style="width:62%;"></div><div class="stat-bar-a" style="width:38%;"></div></div>' +
              '</div>' +
              '<div class="stat-compare-row">' +
                '<div class="stat-labels"><span>1.42</span><span>Expected Goals (xG)</span><span>0.88</span></div>' +
                '<div class="stat-dual-bar"><div class="stat-bar-h" style="width:61%;"></div><div class="stat-bar-a" style="width:39%;"></div></div>' +
              '</div>' +
              '<div class="stat-compare-row">' +
                '<div class="stat-labels"><span>6</span><span>Corner Kicks</span><span>2</span></div>' +
                '<div class="stat-dual-bar"><div class="stat-bar-h" style="width:75%;"></div><div class="stat-bar-a" style="width:25%;"></div></div>' +
              '</div>' +
              '<div class="stat-compare-row">' +
                '<div class="stat-labels"><span>9</span><span>Fouls Committed</span><span>11</span></div>' +
                '<div class="stat-dual-bar"><div class="stat-bar-h" style="width:45%;"></div><div class="stat-bar-a" style="width:55%;"></div></div>' +
              '</div>' +
            '</div>' +
          '</section>' +

          '<!-- SECTION 5: STARTING LINEUPS & FORMATIONS -->' +
          '<section class="match-section-card" id="sec-lineups">' +
            '<h2 class="match-section-heading"><span>📋</span> Starting Lineups &amp; Formations</h2>' +
            '<div class="lineup-grid" id="lineupGridContainer">' +
              '<div class="squad-card">' +
                '<div style="font-weight:800;font-size:15px;margin-bottom:12px;display:flex;justify-content:space-between;">' +
                  '<span>' + homeName + '</span><span style="color:#2563eb;">4-3-3</span>' +
                '</div>' +
                '<div class="player-row"><span>#1 Goalkeeper</span><span class="player-rating">7.2</span></div>' +
                '<div class="player-row"><span>#4 Center Back</span><span class="player-rating">6.9</span></div>' +
                '<div class="player-row"><span>#8 Playmaker (C)</span><span class="player-rating">8.1</span></div>' +
                '<div class="player-row"><span>#10 Striker</span><span class="player-rating">7.8</span></div>' +
              '</div>' +
              '<div class="squad-card">' +
                '<div style="font-weight:800;font-size:15px;margin-bottom:12px;display:flex;justify-content:space-between;">' +
                  '<span>' + awayName + '</span><span style="color:#f43f5e;">4-2-3-1</span>' +
                '</div>' +
                '<div class="player-row"><span>#13 Goalkeeper</span><span class="player-rating">7.0</span></div>' +
                '<div class="player-row"><span>#5 Center Back</span><span class="player-rating">6.8</span></div>' +
                '<div class="player-row"><span>#7 Winger (C)</span><span class="player-rating">7.5</span></div>' +
                '<div class="player-row"><span>#9 Forward</span><span class="player-rating">7.3</span></div>' +
              '</div>' +
            '</div>' +
          '</section>' +

          '<!-- SECTION 6: HEAD TO HEAD & FORM -->' +
          '<section class="match-section-card" id="sec-h2h">' +
            '<h2 class="match-section-heading"><span>⚔️</span> Recent Form &amp; Head to Head</h2>' +
            '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #e2e8f0;">' +
              '<strong>' + homeName + '</strong>' +
              '<div><span class="form-pill form-w">W</span><span class="form-pill form-w">W</span><span class="form-pill form-d">D</span><span class="form-pill form-l">L</span><span class="form-pill form-w">W</span></div>' +
            '</div>' +
            '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;">' +
              '<strong>' + awayName + '</strong>' +
              '<div><span class="form-pill form-w">W</span><span class="form-pill form-d">D</span><span class="form-pill form-l">L</span><span class="form-pill form-w">W</span><span class="form-pill form-d">D</span></div>' +
            '</div>' +
          '</section>' +

          '<!-- SECTION 7: LIVE MATCH COMMENTARY -->' +
          '<section class="match-section-card" id="sec-commentary">' +
            '<h2 class="match-section-heading"><span>🎙️</span> Live Match Commentary</h2>' +
            '<div id="commentaryContainer">' +
              '<div class="comm-item"><span style="font-weight:800;color:#2563eb;min-width:30px;">90\'</span><span>Full time approaching. Both sides pushing with high defensive line.</span></div>' +
              '<div class="comm-item"><span style="font-weight:800;color:#2563eb;min-width:30px;">72\'</span><span>Dangerous free-kick awarded just outside the penalty area.</span></div>' +
              '<div class="comm-item"><span style="font-weight:800;color:#2563eb;min-width:30px;">45\'</span><span>End of first half. Strategic tactical adjustments expected in the second half.</span></div>' +
            '</div>' +
          '</section>' +

          '<!-- SECTION 8: ARTICLES & NEWS -->' +
          '<section class="match-section-card" id="sec-articles">' +
            '<h2 class="match-section-heading"><span>🗞️</span> Match Articles &amp; News</h2>' +
            '<div class="article-card-grid" id="articlesGridContainer">' +
              '<div class="article-card" onclick="openArticleModal(\'Tactical Breakdown: ' + homeName.replace(/'/g, "\\'") + ' vs ' + awayName.replace(/'/g, "\\'") + '\', \'' + homeLogo.replace(/'/g, "\\'") + '\', \'Today\', \'<p>In-depth tactical preview of the match highlighting key matchups, expected lineups, and managerial systems.</p>\')">' +
                '<div style="background:#2563eb;height:120px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:18px;">MATCH PREVIEW</div>' +
                '<div class="article-card-content">' +
                  '<div style="font-size:11px;color:#2563eb;font-weight:800;margin-bottom:4px;">EDITORIAL PREVIEW</div>' +
                  '<h4 style="font-size:14px;font-weight:800;line-height:1.4;margin-bottom:6px;">' + homeName + ' vs ' + awayName + ': Key tactical battle</h4>' +
                  '<p style="font-size:12px;color:#64748b;line-height:1.5;">Click to read the complete analysis and data debrief.</p>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</section>' +

          '<!-- SECTION 9 (AT LAST): WATCH LIVE STREAM GATEWAY LINK -->' +
          '<div class="watch-action-box match-bottom-stream-cta">' +
            '<div class="match-bottom-stream-cta-title">📺 Live Broadcast &amp; Stream Links</div>' +
            '<p class="match-bottom-stream-cta-sub">' + (hasLiveStream ? (mServers.length + ' HD Streaming Channels Ready — Multiple Languages &amp; Backup Servers') : 'Stream links open automatically right before kickoff.') + '</p>' +
            '<a href="' + linksUrl + '" class="btn-watch-stream" id="watchBtn" style="display:inline-flex;align-items:center;justify-content:center;text-decoration:none;">' +
              '<span>▶</span> ' + (hasLiveStream ? ('Watch Live Stream / Select Server (' + mServers.length + ' Channels)') : 'Open Live Stream Gateway') +
            '</a>' +
          '</div>' +

        '</div>';

      // Initialize Fan Poll
      var pollVotes = JSON.parse(localStorage.getItem('poll_counts_' + match.id) || '{"home": 142, "draw": 45, "away": 118}');
      var userVote = localStorage.getItem('vote_match_' + match.id);
      renderPollUI(match.id, pollVotes, userVote);

      // Async fetch real FotMob articles, events & stats if fotmob_id exists
      if (match.fotmob_id) {
        fetchFotmobMatchFull(match.fotmob_id, homeName, awayName);
      }

      showView('match');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // ── ASYNC FOTMOB FULL MATCH ENRICHMENT (Articles, Events, Stats, Lineups) ──
    async function fetchFotmobMatchFull(fotmobId, homeName, awayName) {
      try {
        var proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://www.fotmob.com/api/matchDetails?matchId=' + fotmobId);
        var res = await fetch(proxyUrl);
        if (!res.ok) return;
        var data = await res.json();
        if (!data) return;

        // 1. Articles & Previews
        var mf = data.content?.matchFacts || {};
        var articles = (mf.preReview || []).concat(mf.postReview || []);
        if (articles.length > 0) {
          var artContainer = document.getElementById('articlesGridContainer');
          if (artContainer) {
            artContainer.innerHTML = articles.map(function(art) {
              var titleEsc = escapeHtml(art.title || '');
              var img = sanitizeUrl(art.image || 'https://images.fotmob.com/image_resources/news/fotmob.png');
              var desc = escapeHtml(art.description || 'Click to view the full match story and details.');
              var source = escapeHtml((art.source || 'FotMob').toUpperCase());
              var dateUp = escapeHtml(art.dateUpdated || '');
              return '<div class="article-card" onclick="openArticleModal(\'' + titleEsc.replace(/'/g, "\\'") + '\', \'' + img.replace(/'/g, "\\'") + '\', \'' + dateUp.replace(/'/g, "\\'") + '\', \'' + desc.replace(/'/g, "\\'") + '\')">' +
                '<img src="' + img + '" alt="" onerror="this.style.display=\'none\'" />' +
                '<div class="article-card-content">' +
                  '<div style="font-size:11px;color:#2563eb;font-weight:800;margin-bottom:4px;">' + source + '</div>' +
                  '<h4 style="font-size:14px;font-weight:800;line-height:1.4;margin-bottom:6px;">' + titleEsc + '</h4>' +
                  '<p style="font-size:12px;color:#64748b;line-height:1.5;">' + desc + '</p>' +
                '</div>' +
              '</div>';
            }).join('');
          }
        }

        // 2. Real Events
        var events = mf.events?.events || [];
        if (events.length > 0) {
          var evContainer = document.getElementById('eventsListContainer');
          if (evContainer) {
            evContainer.innerHTML = events.map(function(ev) {
              var icon = ev.type === 'Goal' ? '⚽' : (ev.type === 'Card' ? (ev.card === 'Red' ? '🟥' : '🟨') : '⚡');
              var playerName = escapeHtml(ev.player?.name || ev.nameStr || '');
              var subText = ev.assistInput ? (' (Assist: ' + escapeHtml(ev.assistInput) + ')') : '';
              var evType = escapeHtml(ev.type || '');
              var timeStr = escapeHtml(String(ev.timeStr || ev.time || ''));
              return '<div class="event-timeline-card">' +
                '<div class="event-min-badge">' + timeStr + '\'</div>' +
                '<div><strong>' + icon + ' ' + evType + '</strong>: ' + playerName + subText + '</div>' +
              '</div>';
            }).join('');
          }
        }
      } catch(e) {}
    }

    // ── 5-SECOND COUNTDOWN & REDIRECT TO STREAM PAGE ──
    window.startStreamCountdown = function(matchId) {
      window.location.href = getLinksUrl(matchId);
    };

    // ── STREAM SERVER DETECTION & DYNAMIC SERVER RESOLVER (ZERO MOCK STREAMS) ──
    function detectStreamType(url) {
      if (!url) return 'hls';
      var u = url.toLowerCase();
      if (u.indexOf('.m3u8') !== -1 || u.indexOf('/hls/') !== -1) return 'hls';
      if (u.indexOf('.mpd') !== -1 || u.indexOf('/dash/') !== -1) return 'mpd';
      if (u.indexOf('<iframe') !== -1 || u.indexOf('embed') !== -1 || u.indexOf('youtube.com') !== -1 || u.indexOf('youtu.be') !== -1 || u.indexOf('vidsrc') !== -1 || u.indexOf('streamtape') !== -1 || (!u.endsWith('.mp4') && !u.endsWith('.m3u8') && !u.endsWith('.mpd') && u.startsWith('http'))) {
        return 'iframe';
      }
      return 'video';
    }

    function getMatchServers(match) {
      if (!match) return [];
      var servers = [];
      var seenUrls = {};

      function addServer(name, rawUrl, quality, type, keyId, key, drmType) {
        if (!rawUrl || typeof rawUrl !== 'string') return;
        var url = rawUrl.trim();
        if (!url) return;
        // CRITICAL: Filter out ANY mock or test stream URLs
        if (url.indexOf('mux.dev') !== -1 || url.indexOf('bigbuckbunny') !== -1 || url.indexOf('example.com') !== -1) return;
        if (seenUrls[url]) return;
        seenUrls[url] = true;

        var detectedType = type || detectStreamType(url);
        var label = name || ('Server ' + (servers.length + 1));
        if (quality && label.indexOf(quality) === -1) {
          label += ' (' + quality + ')';
        }
        servers.push({
          name: label,
          url: url,
          type: detectedType,
          keyId: keyId || '',
          key: key || '',
          drmType: drmType || (keyId && key ? 'clearkey' : 'none')
        });
      }

      // 1. FIRST: Load direct dedicated match servers from Match Servers Builder (match.stream_url)
      if (match.stream_url) {
        var raw = String(match.stream_url).trim();
        if (raw.startsWith('[') || raw.startsWith('{')) {
          try {
            var parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              parsed.forEach(function(item, idx) {
                var sName = item.serverName || item.label || ('Server ' + (idx + 1));
                addServer(sName, item.url, item.quality, item.type, item.keyId || item.key_id, item.key, item.drmType);
              });
            } else if (parsed && parsed.url) {
              addServer(parsed.serverName || parsed.label || 'Server 1', parsed.url, parsed.quality, parsed.type, parsed.keyId || parsed.key_id, parsed.key, parsed.drmType);
            }
          } catch(e) {}
        } else if (streamsMap[raw]) {
          parseStreamFromDb(streamsMap[raw]);
        } else if (raw.startsWith('http')) {
          addServer('Server 1', raw);
        }
      }

      // 2. SECOND: Load any global Live Streams linked in Admin Panel (stream_ids)
      // Uses exact stream.label from Admin Panel (e.g. "Cricket Live HD", "ICC", etc.)
      var sIds = match.stream_ids;
      if (typeof sIds === 'string') {
        try { sIds = JSON.parse(sIds); } catch(e) { sIds = sIds.split(',').map(function(s){ return s.trim(); }); }
      }
      if (Array.isArray(sIds)) {
        sIds.forEach(function(sid) {
          var sObj = streamsMap[sid] || allStreams.find(function(x) { return String(x.id) === String(sid); });
          if (sObj && sObj.active !== false && !sObj.deleted && sObj.url) {
            parseStreamFromDb(sObj);
          }
        });
      }

      function parseStreamFromDb(sObj) {
        var streamLabel = sObj.label || 'Live Stream';
        var str = sObj.url;
        if (typeof str === 'string' && (str.startsWith('[') || str.startsWith('{'))) {
          try {
            var parsed = JSON.parse(str);
            if (Array.isArray(parsed)) {
              parsed.forEach(function(item, idx) {
                // If single server, use exact streamLabel from Admin Panel!
                var sName = parsed.length === 1
                  ? streamLabel
                  : (streamLabel + ' - ' + (item.serverName || item.label || ('Server ' + (idx + 1))));
                addServer(sName, item.url, item.quality || sObj.quality, item.type, item.keyId || item.key_id, item.key, item.drmType);
              });
              return;
            } else if (parsed && parsed.url) {
              addServer(streamLabel, parsed.url, parsed.quality || sObj.quality, parsed.type, parsed.keyId || parsed.key_id, parsed.key, parsed.drmType);
              return;
            }
          } catch(e) {}
        }
        addServer(streamLabel, str, sObj.quality);
      }

      // 3. Backup stream URL if any
      if (match.backup_stream_url) {
        addServer('Backup Stream', match.backup_stream_url);
      }

      return servers;
    }

    // ── ROUTE 1.5: DEDICATED LINK SELECTION GATEWAY (domain.com/?links=id) ──
    window.openLinksPage = function(matchId, pushState) {
      var match = allMatches.find(function(m) { return String(m.id) === String(matchId); });
      if (!match) return;

      currentMatchId = match.id;
      stopStream();

      if (pushState !== false) {
        window.history.pushState({ linksId: match.id }, '', '/?links=' + encodeURIComponent(match.id));
      }

      var rawHomeName = match.home_team || (teamsMap[match.home_team_id] && teamsMap[match.home_team_id].name) || 'Home Team';
      var rawAwayName = match.away_team || (teamsMap[match.away_team_id] && teamsMap[match.away_team_id].name) || 'Away Team';
      var homeName = escapeHtml(rawHomeName);
      var awayName = escapeHtml(rawAwayName);
      var homeLogo = sanitizeUrl(match.home_logo || (teamsMap[match.home_team_id] && teamsMap[match.home_team_id].logo_url) || 'https://korra.world/wp-content/uploads/yalla-team-logos/114.png');
      var awayLogo = sanitizeUrl(match.away_logo || (teamsMap[match.away_team_id] && teamsMap[match.away_team_id].logo_url) || 'https://korra.world/wp-content/uploads/yalla-team-logos/109.png');
      var leagueName = escapeHtml(match.league_name || (leaguesMap[match.league_id] && leaguesMap[match.league_id].name) || 'Live Match Center');
      var venue = escapeHtml(match.venue || 'National Stadium');
      var postUrl = sanitizeUrl(getMatchPostUrl(match));

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

      var html = 
        '<!-- Stitch Link Selection Hero Card -->' +
        '<div class="zs-match-hero-card">' +
          '<div class="zs-match-hero-topbar">' +
            '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
              '<span class="zs-match-comp-pill"><span class="material-symbols-outlined" style="font-size:14px;">live_tv</span>' + leagueName + ' &#8226; Broadcast Gateway</span>' +
              (isLive ? '<span class="zs-mc-pill-live"><span class="zs-ping-core" style="width:6px;height:6px;background:#fff;"></span>' + statusText + '</span>' : '<span class="zs-mc-pill-time">' + statusText + '</span>') +
            '</div>' +
            '<span class="zs-match-sync-badge"><span class="material-symbols-outlined" style="font-size:16px;">verified</span>Multi-Server Ready</span>' +
          '</div>' +
          '<div class="zs-match-hero-scoregrid">' +
            '<div class="zs-hero-team"><div class="zs-hero-crest-circle"><img src="' + homeLogo + '" alt="' + homeName + '" /></div><h3 class="zs-hero-team-name">' + homeName + '</h3></div>' +
            '<div class="zs-hero-score-col"><div class="zs-hero-score-val">' + scoreText + '</div><div class="zs-hero-score-sub">' + (isLive ? 'Current Match Score' : 'Scheduled Kickoff') + '</div></div>' +
            '<div class="zs-hero-team"><div class="zs-hero-crest-circle"><img src="' + awayLogo + '" alt="' + awayName + '" /></div><h3 class="zs-hero-team-name">' + awayName + '</h3></div>' +
          '</div>' +
          '<div class="zs-match-hero-meta">' +
            '<div><span>Stadium: </span><strong>' + venue + '</strong></div>' +
            '<div><span>Kickoff: </span><strong>' + kickoffFull + '</strong></div>' +
            '<div><span>Channels: </span><strong style="color:var(--zs-tertiary);">' + (hasLiveStream ? (mServers.length + ' HD Feeds Online') : 'Standby Mode') + '</strong></div>' +
            '<div><span>Max Quality: </span><strong>1080p 60FPS Ultra HD</strong></div>' +
          '</div>' +
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
          var streamTargetUrl = sanitizeUrl(getStreamUrl(match.id, idx));
          var srvName = escapeHtml(srv.name || ('Server ' + (idx + 1)));
          var qBadge = escapeHtml(srv.quality || '1080p HD');
          var lang = escapeHtml(srv.language || 'English');
          var typeBadge = escapeHtml(srv.type === 'mpd' ? 'DASH ClearKey' : (srv.type === 'iframe' ? 'Web Player' : 'HLS Fast CDN'));
          var statusGlow = '🟢 Ultra Fast CDN • 99.9% Uptime';

          html += 
            '<div class="link-server-card">' +
              '<div class="link-server-card-top">' +
                '<div class="link-server-title">' +
                  '<span class="server-num-badge">#' + (idx + 1) + '</span> ' +
                  '<strong>' + srvName + '</strong>' +
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

    // ── ROUTE 2: DEDICATED STREAMING PAGE WITH DYNAMIC MULTI-SERVER (domain.com/stream/id) ──
    window.openStreamPage = function(matchId, pushState, serverIdx) {
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

    function renderServerButtons() {
      var container = document.getElementById('serverButtonsList');
      var labelEl = document.getElementById('serverCountLabel');
      if (!container) return;

      if (currentMatchServers.length === 0) {
        if (labelEl) labelEl.textContent = 'Server Status:';
        container.innerHTML = '<span style="font-size:12px;color:#94a3b8;font-weight:700;">Broadcast Offline</span>';
        return;
      }

      if (labelEl) labelEl.textContent = currentMatchServers.length + ' Server' + (currentMatchServers.length > 1 ? 's' : '') + ' Online:';

      var html = '';
      currentMatchServers.forEach(function(srv, idx) {
        var isActive = idx === currentServerIndex;
        var bg = isActive ? '#2563eb' : '#334155';
        var border = isActive ? '2px solid #60a5fa' : '1px solid #475569';
        html += '<button class="match-chip-btn" onclick="switchServer(' + idx + ')" style="color:#fff;background:' + bg + ';border:' + border + ';font-size:12px;padding:6px 14px;font-weight:700;cursor:pointer;">' +
          (isActive ? '▶ ' : '') + escapeHtml(srv.name) +
        '</button>';
      });
      container.innerHTML = html;
    }

    window.switchServer = function(serverIdx) {
      if (!currentMatchServers || !currentMatchServers[serverIdx]) return;
      currentServerIndex = serverIdx;
      renderServerButtons();
      loadStreamServer(currentMatchServers[serverIdx]);
    };

    function showNoStreamUI() {
      var alertEl = document.getElementById('noStreamAlert');
      var videoEl = document.getElementById('liveVideo');
      var iframeEl = document.getElementById('streamIframe');
      var badgeEl = document.getElementById('streamBadge');
      if (alertEl) alertEl.style.display = 'flex';
      if (videoEl) videoEl.style.display = 'none';
      if (iframeEl) iframeEl.style.display = 'none';
      if (badgeEl) {
        badgeEl.textContent = 'AWAITING BROADCAST';
        badgeEl.style.background = '#64748b';
      }
    }

    function hideNoStreamUI() {
      var alertEl = document.getElementById('noStreamAlert');
      var badgeEl = document.getElementById('streamBadge');
      if (alertEl) alertEl.style.display = 'none';
      if (badgeEl) {
        badgeEl.textContent = 'LIVE BROADCAST HD';
        badgeEl.style.background = '#2563eb';
      }
    }

    function loadStreamServer(server) {
      if (!server || !server.url) {
        showNoStreamUI();
        return;
      }
      hideNoStreamUI();
      stopStream();

      var video = document.getElementById('liveVideo');
      var iframe = document.getElementById('streamIframe');
      var badgeEl = document.getElementById('streamBadge');

      var streamUrl = server.url;
      var type = server.type || detectStreamType(streamUrl);

      // Extract iframe src if passed as <iframe src="...">
      if (streamUrl.indexOf('<iframe') !== -1) {
        var match = streamUrl.match(/src=["']([^"']+)["']/);
        if (match) streamUrl = match[1];
      }

      if (type === 'iframe') {
        if (video) video.style.display = 'none';
        if (iframe) {
          iframe.style.display = 'block';
          iframe.src = sanitizeUrl(streamUrl);
        }
        if (badgeEl) {
          badgeEl.textContent = 'WEB EMBED PLAYER';
          badgeEl.style.background = '#2563eb';
        }
        return;
      }

      // HLS, DASH, or Direct Video
      if (iframe) {
        iframe.style.display = 'none';
        iframe.src = 'about:blank';
      }
      if (video) video.style.display = 'block';

      // 1. DASH (.mpd) or ClearKey DRM stream -> Use Google Shaka Player
      if (type === 'mpd' || streamUrl.indexOf('.mpd') !== -1 || server.keyId) {
        if (badgeEl) {
          badgeEl.textContent = server.keyId ? 'DASH CLEARKEY HD' : 'DASH ADAPTIVE HD';
          badgeEl.style.background = '#8b5cf6';
        }

        if (window.shaka && window.shaka.Player) {
          window.shaka.polyfill.installAll();
          if (window.shaka.Player.isBrowserSupported()) {
            var shakaPlayer = new window.shaka.Player(video);
            shakaInstance = shakaPlayer;

            // Configure ClearKey DRM if keys provided
            if (server.keyId && server.key) {
              var clearKeysConfig = {};
              clearKeysConfig[server.keyId] = server.key;
              shakaPlayer.configure({
                drm: {
                  clearKeys: clearKeysConfig
                }
              });
            }

            shakaPlayer.configure({
              streaming: {
                bufferingGoal: 10,
                rebufferingGoal: 2,
                bufferBehind: 15
              }
            });

            shakaPlayer.addEventListener('error', function(event) {
              console.error('[ZetaSports] Shaka Player Error:', event.detail);
              if (currentMatchServers.length > 1) {
                console.log('[ZetaSports] Auto-switching to backup stream server...');
                var nextIdx = (currentServerIndex + 1) % currentMatchServers.length;
                switchServer(nextIdx);
              }
            });

            shakaPlayer.load(streamUrl).then(function() {
              console.log('[ZetaSports] DASH stream loaded successfully via Shaka Player!');
              video.play().catch(function(){});
              try {
                if (window.Plyr && !plyrInstance) {
                  plyrInstance = new window.Plyr(video, {
                    controls: ['play-large', 'play', 'live', 'mute', 'volume', 'fullscreen', 'pip']
                  });
                }
              } catch(e) {}
            }).catch(function(e) {
              console.error('[ZetaSports] Shaka load error:', e);
            });
            return;
          }
        }
      }

      // 2. HLS (.m3u8) -> Use HLS.js or native Apple HLS
      if (type === 'hls' || streamUrl.indexOf('.m3u8') !== -1) {
        if (badgeEl) {
          badgeEl.textContent = 'HLS ADAPTIVE HD';
          badgeEl.style.background = '#2563eb';
        }
        if (window.Hls && window.Hls.isSupported()) {
          var hls = new window.Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90
          });
          hlsInstance = hls;
          hls.loadSource(streamUrl);
          hls.attachMedia(video);
          hls.on(window.Hls.Events.MANIFEST_PARSED, function() {
            try {
              if (window.Plyr) {
                plyrInstance = new window.Plyr(video, {
                  controls: ['play-large', 'play', 'live', 'mute', 'volume', 'fullscreen', 'pip']
                });
              }
            } catch(e) {}
            video.play().catch(function(){});
          });
          hls.on(window.Hls.Events.ERROR, function(event, data) {
            if (data.fatal) {
              console.warn('[ZetaSports] HLS fatal error:', data);
              switch (data.type) {
                case window.Hls.ErrorTypes.NETWORK_ERROR:
                  hls.startLoad();
                  break;
                case window.Hls.ErrorTypes.MEDIA_ERROR:
                  hls.recoverMediaError();
                  break;
                default:
                  if (currentMatchServers.length > 1) {
                    console.log('[ZetaSports] Auto-switching to backup stream server...');
                    var nextIdx = (currentServerIndex + 1) % currentMatchServers.length;
                    switchServer(nextIdx);
                  }
                  break;
              }
            }
          });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = sanitizeUrl(streamUrl);
          if (window.Plyr) { plyrInstance = new window.Plyr(video); }
          video.play().catch(function(){});
        }
      } else {
        // Direct MP4 / other video
        if (badgeEl) {
          badgeEl.textContent = 'HD VIDEO DIRECT';
          badgeEl.style.background = '#2563eb';
        }
        video.src = sanitizeUrl(streamUrl);
        if (window.Plyr) { plyrInstance = new window.Plyr(video); }
        video.play().catch(function(){});
      }
    }

    function stopStream() {
      var video = document.getElementById('liveVideo');
      var iframe = document.getElementById('streamIframe');
      if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
      if (iframe) {
        iframe.src = 'about:blank';
      }
      if (plyrInstance) {
        try { plyrInstance.destroy(); } catch(e) {}
        plyrInstance = null;
      }
      if (hlsInstance) {
        try { hlsInstance.destroy(); } catch(e) {}
        hlsInstance = null;
      }
      if (shakaInstance) {
        try { shakaInstance.destroy(); } catch(e) {}
        shakaInstance = null;
      }
    }

    window.reloadCurrentStream = function() {
      if (currentMatchServers && currentMatchServers[currentServerIndex]) {
        loadStreamServer(currentMatchServers[currentServerIndex]);
      } else {
        showNoStreamUI();
      }
    };

    window.togglePlayerFullscreen = function() {
      var elem = document.getElementById('playerFrameWrap') || document.getElementById('liveVideo');
      if (!elem) return;
      if (!document.fullscreenElement) {
        if (elem.requestFullscreen) elem.requestFullscreen();
        else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
        else if (elem.msRequestFullscreen) elem.msRequestFullscreen();
      } else {
        if (document.exitFullscreen) document.exitFullscreen();
      }
    };

    
    // ── AUTOMATIC LIVE KICKOFF & SCORE RESOLVER ──
    function getMatchLiveInfo(m) {
      if (!m) return { isLive: false, isFinished: false, statusClass: '', statusText: 'SOON', scoreText: 'VS' };
      var rawStatus = (m.status || 'scheduled').toLowerCase();
      var matchDateStr = m.date || '';
      if (matchDateStr && matchDateStr.indexOf('Z') === -1 && matchDateStr.indexOf('+') === -1 && matchDateStr.indexOf('T') !== -1) {
        matchDateStr += (matchDateStr.split(':').length === 2 ? ':00Z' : 'Z');
      }
      var matchTime = matchDateStr ? new Date(matchDateStr).getTime() : 0;
      var now = Date.now();
      var diffMin = matchTime > 0 ? Math.floor((now - matchTime) / 60000) : -999;

      var isLive = rawStatus === 'live' || (rawStatus === 'scheduled' && diffMin >= 0 && diffMin <= 120);
      var isFinished = rawStatus === 'finished' || rawStatus === 'ft' || (rawStatus === 'scheduled' && diffMin > 140);

      var elapsed = m.time_elapsed;
      if (!elapsed && isLive && diffMin >= 0) {
        if (diffMin <= 45) elapsed = diffMin + "'";
        else if (diffMin <= 60) elapsed = "HT";
        else if (diffMin <= 105) elapsed = (diffMin - 15) + "'";
        else elapsed = "90+'";
      }

      var statusClass = isLive ? 'live-badge' : (isFinished ? 'finished-badge' : '');
      var timeDisplay = m.kickoff_ist || (matchDateStr ? new Date(matchDateStr).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '12:15 AM');
      var statusText = isLive ? ('LIVE ' + (elapsed ? ' ' + elapsed : '')) : (isFinished ? 'FINISHED' : (m.kickoff_ist || timeDisplay || '12:15 AM'));
      var scoreText = (isLive || isFinished) ? ((m.home_score != null ? m.home_score : 0) + ' - ' + (m.away_score != null ? m.away_score : 0)) : 'VS';

      return {
        isLive: isLive,
        isFinished: isFinished,
        statusClass: statusClass,
        statusText: statusText,
        scoreText: scoreText,
        elapsed: elapsed,
        timeDisplay: timeDisplay
      };
    }

    // ── RENDER MATCHES IN CHRONOLOGICAL TIME ORDER (Stitch v4 Tonal Cards) ──
    function syncDynamicLeagueChips() {
      var pillBox = document.getElementById('leagueFilterPills');
      if (!pillBox || !allMatches || allMatches.length === 0) return;
      var counts = {};
      allMatches.forEach(function(m) {
        var ln = (m.league_name || (leaguesMap[m.league_id] && leaguesMap[m.league_id].name) || '').trim();
        if (ln) counts[ln] = (counts[ln] || 0) + 1;
      });
      var leagues = Object.keys(counts).slice(0, 7);
      if (leagues.length === 0) return;
      var btns = '<button onclick="filterLeague(\'all\')" data-league="all" class="badge-chip ' + (currentLeagueFilter === 'all' ? 'active' : '') + '">All Competitions (' + allMatches.length + ')</button>';
      leagues.forEach(function(l) {
        var safeL = escapeHtml(l);
        var act = currentLeagueFilter && currentLeagueFilter.toLowerCase() === l.toLowerCase();
        btns += '<button onclick="filterLeague(\'' + safeL.replace(/'/g, "\\'") + '\')" data-league="' + safeL + '" class="badge-chip ' + (act ? 'active' : '') + '">' + safeL + '</button>';
      });
      pillBox.innerHTML = btns;
    }

    function renderFallbackEditorialCards() {
      var fb = document.getElementById('zsEditorialFallback');
      if (!fb) return;
      var hasBloggerPosts = document.querySelectorAll('.blog-posts .index-post, .blog-posts .item-post').length > 0;
      if (hasBloggerPosts) { fb.style.display = 'none'; return; }
      var items = (allMatches || []).slice(0, 6);
      if (items.length === 0) return;
      var cards = items.map(function(m) {
        var h = escapeHtml(m.home_team || 'Home Team');
        var a = escapeHtml(m.away_team || 'Away Team');
        var l = escapeHtml(m.league_name || (leaguesMap[m.league_id] && leaguesMap[m.league_id].name) || 'Featured Fixture');
        var dest = sanitizeUrl(getMatchPostUrl(m));
        return '<article class="zs-article-card">' +
          '<a class="zs-article-thumb" href="' + dest + '">' +
            '<div class="zs-thumb-fallback"><span class="material-symbols-outlined">sports_soccer</span><span>' + h + ' vs ' + a + '</span></div>' +
            '<span class="zs-article-cat">' + l + '</span>' +
          '</a>' +
          '<div class="zs-article-body">' +
            '<div style="font-size:11px;color:var(--zs-outline);font-weight:600;margin-bottom:4px;">Match Dossier &#8226; 5 min read</div>' +
            '<a class="zs-article-title" href="' + dest + '">' + h + ' vs ' + a + ' Lineups, Live Score &amp; Match Center</a>' +
            '<p class="zs-article-excerpt">Tactical formation breakdown, real-time score telemetry, head-to-head metrics, and authorized broadcast channels.</p>' +
          '</div>' +
          '<div class="zs-article-foot"><span style="font-weight:700;color:var(--zs-on-surface);">Editorial Desk</span><a href="' + dest + '" style="color:var(--zs-primary);font-weight:700;text-decoration:none;">Read Dossier &#8594;</a></div>' +
        '</article>';
      }).join('');
      fb.innerHTML = cards;
      fb.style.display = 'grid';
    }

    function renderMatches() {
      var container = document.getElementById('matchesList');
      if (!container) return;

      syncDynamicLeagueChips();
      renderFallbackEditorialCards();

      var now = new Date();
      var todayStr = now.toISOString().split('T')[0];

      var yesterdayDate = new Date();
      yesterdayDate.setDate(now.getDate() - 1);
      var yesterdayStr = yesterdayDate.toISOString().split('T')[0];

      var tomorrowDate = new Date();
      tomorrowDate.setDate(now.getDate() + 1);
      var tomorrowStr = tomorrowDate.toISOString().split('T')[0];

      var filtered = allMatches.filter(function(m) {
        var mDateStr = m.date ? m.date.split('T')[0] : todayStr;
        if (currentDateFilter === 'all') return true;
        if (currentDateFilter === 'live') return (m.status || '').toLowerCase() === 'live';
        if (currentDateFilter === 'yesterday') return mDateStr === yesterdayStr;
        if (currentDateFilter === 'tomorrow') return mDateStr === tomorrowStr;
        return mDateStr === todayStr || m.status === 'live' || m.status === 'upcoming';
      });

      if (typeof currentLeagueFilter !== 'undefined' && currentLeagueFilter && currentLeagueFilter !== 'all') {
        filtered = filtered.filter(function(m) {
          var leagueName = m.league_name || (leaguesMap[m.league_id] && leaguesMap[m.league_id].name) || '';
          return leagueName.toLowerCase().indexOf(currentLeagueFilter.toLowerCase()) !== -1;
        });
      }

      if (typeof currentSearchQuery !== 'undefined' && currentSearchQuery) {
        filtered = filtered.filter(function(m) {
          var h = (m.home_team || (teamsMap[m.home_team_id] && teamsMap[m.home_team_id].name) || '').toLowerCase();
          var a = (m.away_team || (teamsMap[m.away_team_id] && teamsMap[m.away_team_id].name) || '').toLowerCase();
          var l = (m.league_name || (leaguesMap[m.league_id] && leaguesMap[m.league_id].name) || '').toLowerCase();
          return h.indexOf(currentSearchQuery) !== -1 || a.indexOf(currentSearchQuery) !== -1 || l.indexOf(currentSearchQuery) !== -1;
        });
      }

      if (filtered.length === 0 && currentDateFilter === 'today' && !currentSearchQuery && (typeof currentLeagueFilter === 'undefined' || currentLeagueFilter === 'all')) {
        filtered = allMatches.slice(0, 12);
      }

      filtered.sort(function(a, b) {
        var tA = a.date ? new Date(a.date).getTime() : 0;
        var tB = b.date ? new Date(b.date).getTime() : 0;
        return tA - tB;
      });

      if (filtered.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;background:var(--zs-surface-lowest);border-radius:14px;color:var(--zs-secondary);font-weight:700;">No fixtures matched your filter. Try another tab or clear search!</div>';
        return;
      }

      var html = '';
      filtered.forEach(function(m) {
        var rawHomeName = m.home_team || (teamsMap[m.home_team_id] && teamsMap[m.home_team_id].name) || 'Home Team';
        var rawAwayName = m.away_team || (teamsMap[m.away_team_id] && teamsMap[m.away_team_id].name) || 'Away Team';
        var homeName = escapeHtml(rawHomeName);
        var awayName = escapeHtml(rawAwayName);
        var homeLogo = sanitizeUrl(m.home_logo || (teamsMap[m.home_team_id] && teamsMap[m.home_team_id].logo_url) || 'https://korra.world/wp-content/uploads/yalla-team-logos/114.png');
        var awayLogo = sanitizeUrl(m.away_logo || (teamsMap[m.away_team_id] && teamsMap[m.away_team_id].logo_url) || 'https://korra.world/wp-content/uploads/yalla-team-logos/109.png');
        var leagueName = escapeHtml(m.league_name || (leaguesMap[m.league_id] && leaguesMap[m.league_id].name) || 'Live Match');
        var venueName = escapeHtml(m.venue || 'Official Stadium');

        var liveInfo = getMatchLiveInfo(m);
        var isLive = liveInfo.isLive;
        var isFinished = liveInfo.isFinished;
        var timeDisplay = liveInfo.timeDisplay;
        var statusText = liveInfo.statusText;
        var scoreText = liveInfo.scoreText;
        var matchSlug = slugify(rawHomeName) + '-vs-' + slugify(rawAwayName) + '-' + m.id;
        var hasCustomPost = m.article_url && isAllowedUrl(m.article_url);
        var cardHref = hasCustomPost ? sanitizeUrl(m.article_url) : ('/' + matchSlug);
        var cardOnClick = hasCustomPost ? '' : ' onclick="event.preventDefault(); openMatchPage(\'' + m.id + '\', true);"';

        var pillHtml = isLive
          ? '<span class="zs-mc-pill-live"><span class="zs-ping-core" style="width:6px;height:6px;background:#fff;"></span>' + escapeHtml(statusText) + '</span>'
          : (isFinished ? '<span class="zs-mc-pill-ft">FT</span>' : '<span class="zs-mc-pill-time">' + escapeHtml(timeDisplay) + '</span>');

        html += '<div class="STING-web-Match ' + (isLive ? 'is-live' : '') + '" id="match-' + m.id + '">' +
          '<a class="zs-match-link" href="' + cardHref + '"' + cardOnClick + '>' +
            '<div class="zs-mc-top">' +
              '<span class="zs-mc-league"><span class="material-symbols-outlined" style="font-size:15px;">sports_soccer</span>' + leagueName + '</span>' +
              '<div class="zs-mc-status-group">' +
                pillHtml +
                '<span class="zs-mc-venue">' + venueName + '</span>' +
              '</div>' +
            '</div>' +
            '<div class="zs-mc-body">' +
              '<div class="STING-web-Right-Team">' +
                '<div class="STING-web-Team-Logo"><img src="' + homeLogo + '" alt="' + homeName + '" loading="lazy" class="img-lazy-blur" onload="this.classList.add(\'loaded\')" onerror="this.onerror=null;this.classList.add(\'loaded\');" /></div>' +
                '<div class="STING-web-Team-NAME">' + homeName + '</div>' +
              '</div>' +
              '<div class="zs-mc-center">' +
                '<div class="zs-mc-score-chip ' + (scoreText === 'VS' ? 'is-vs' : '') + '">' + escapeHtml(scoreText) + '</div>' +
                '<div class="zs-mc-sub">' + (isLive ? 'In Play' : (isFinished ? 'Full Time' : escapeHtml(timeDisplay))) + '</div>' +
              '</div>' +
              '<div class="STING-web-Left-Team">' +
                '<div class="STING-web-Team-NAME">' + awayName + '</div>' +
                '<div class="STING-web-Team-Logo"><img src="' + awayLogo + '" alt="' + awayName + '" loading="lazy" class="img-lazy-blur" onload="this.classList.add(\'loaded\')" onerror="this.onerror=null;this.classList.add(\'loaded\');" /></div>' +
              '</div>' +
            '</div>' +
            '<div class="zs-mc-foot">' +
              '<span class="zs-mc-broadcast"><span class="material-symbols-outlined">tv</span>Verified Broadcast &amp; Lineups</span>' +
              '<span class="zs-mc-cta-pill">Match Center &#8594;</span>' +
            '</div>' +
          '</a>' +
        '</div>';
      });

      container.innerHTML = html;
      try { updateHeaderLiveCounter(); } catch(e) {}
    }

    // ── Handle Browser Back / Forward & URL Routes ──
    var initialRouteHandled = false;
    function checkUrlRoute() {
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

      if (path && path !== '/' && path.indexOf('/p/') === -1 && path.indexOf('/search') === -1 && path.indexOf('.html') === -1) {
        var cleanPath = path.replace(/^\/+|\/+$/g, '');
        var mId2 = extractMatchId(cleanPath);
        if (mId2) {
          openMatchPage(mId2, false);
          return;
        }
      }

      // 4. If viewing a real Blogger single post/article (.item-post), hide Home Fixtures
      if (document.querySelector('.blog-post.item-post')) {
        var hv = document.getElementById('homeView');
        var wg = document.getElementById('zsWorkstationGrid');
        var sh = document.querySelector('#editorialSection .zs-section-head');
        if (hv) hv.style.display = 'none';
        if (wg) wg.style.display = 'none';
        if (sh) sh.style.display = 'none';
        return;
      }
      // Default Home View on Blogger Blog 1
      showView('home');
    }

    window.addEventListener('popstate', function() {
      checkUrlRoute();
    });


  // ── FotMob Live Scores API Sync ──
  async function syncFotMobScores() {
    var liveWithFotmob = allMatches.filter(function(m) { return m.fotmob_id && (m.status === 'live' || m.status === 'scheduled'); });
    for (var i = 0; i < liveWithFotmob.length; i++) {
      var match = liveWithFotmob[i];
      try {
        var proxyUrl = 'https://proxy.zetasports.site/fotmob/matchDetails?matchId=' + match.fotmob_id;
        var res;
        try {
          res = await fetchWithResilientBackoff(proxyUrl, {}, 1, 500);
        } catch(proxyErr) {
          proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://www.fotmob.com/api/matchDetails?matchId=' + match.fotmob_id);
          res = await fetch(proxyUrl);
        }
        var res = await fetch(proxyUrl);
        if (!res.ok) continue;
        var data = await res.json();
        if (data && data.header) {
          var h = data.header;
          var hs = (h.teams && h.teams[0]) ? h.teams[0].score : null;
          var as = (h.teams && h.teams[1]) ? h.teams[1].score : null;
          var statusObj = h.status || {};
          var min = (statusObj.liveTime && statusObj.liveTime.short) ? statusObj.liveTime.short : '';
          if (hs != null) match.home_score = hs;
          if (as != null) match.away_score = as;
          if (min) match.time_elapsed = min;
          if (statusObj.finished) match.status = 'finished';
          else if (statusObj.started) match.status = 'live';
        }
      } catch(e) {}
    }
    renderMatches();
  }

  // ── Resilient Jittered Exponential Backoff Fetch Engine ──
  async function fetchWithResilientBackoff(url, options, maxRetries, baseDelayMs) {
    var retries = (maxRetries !== undefined) ? maxRetries : 3;
    var baseDelay = (baseDelayMs !== undefined) ? baseDelayMs : 800;
    var attempt = 0;
    while (attempt <= retries) {
      try {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          throw new Error('NETWORK_OFFLINE: Device is disconnected');
        }
        var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
        var timeoutId = controller ? setTimeout(function() { controller.abort(); }, 8000) : null;
        var fetchOpts = Object.assign({}, options || {});
        if (controller) fetchOpts.signal = controller.signal;
        var res = await fetch(url, fetchOpts);
        if (timeoutId) clearTimeout(timeoutId);
        if (res.ok) return res;
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          throw new Error('CLIENT_ERROR: HTTP ' + res.status + ' non-retryable');
        }
        attempt++;
        if (attempt > retries) {
          throw new Error('HTTP_ERROR: HTTP ' + res.status + ' after ' + retries + ' attempts');
        }
      } catch(err) {
        if (err.message && err.message.indexOf('CLIENT_ERROR') !== -1) throw err;
        attempt++;
        if (attempt > retries) throw err;
      }
      var delay = Math.min(6000, baseDelay * Math.pow(2, attempt)) + (Math.random() * 300);
      await new Promise(function(resolve) { setTimeout(resolve, delay); });
    }
  }

  // ── Direct Supabase REST Fetch Helper with Resilient Backoff ──
  async function fetchSupabaseTable(table) {
    var res = await fetchWithResilientBackoff(SB_URL + '/rest/v1/' + table + '?select=*', {
      headers: SB_HEADERS
    }, 2, 800);
    return await res.json();
  }

  // ── Fetch Initial Data from Supabase ──
  async function loadData() {
    try {
      console.log('[ZetaSports] Fetching fixtures in time order from Supabase...');
      var results = await Promise.all([
        fetchSupabaseTable('zeta_matches'),
        fetchSupabaseTable('zeta_teams'),
        fetchSupabaseTable('zeta_leagues'),
        fetchSupabaseTable('zeta_streams')
      ]);

      allMatches = results[0] || [];
      var teams = results[1] || [];
      var leagues = results[2] || [];
      allStreams = results[3] || [];

      teams.forEach(function(t) { teamsMap[t.id] = t; });
      leagues.forEach(function(l) { leaguesMap[l.id] = l; });
      allStreams.forEach(function(s) { streamsMap[s.id] = s; });

      // Chronological sort immediately upon load
      allMatches.sort(function(a, b) {
        var tA = a.date ? new Date(a.date).getTime() : 0;
        var tB = b.date ? new Date(b.date).getTime() : 0;
        return tA - tB;
      });

      console.log('[ZetaSports] Loaded ' + allMatches.length + ' matches sorted by kickoff time.');
      try { renderMatches(); } catch(e) { console.error('[ZetaSports] renderMatches error:', e); }
        try { updateHeaderLiveCounter(); } catch(e) { console.error('[ZetaSports] updateHeaderLiveCounter error:', e); }
      if (!initialRouteHandled) { initialRouteHandled = true; try { checkUrlRoute(); } catch(e) { console.error('[ZetaSports] checkUrlRoute error:', e); } }
      try { syncFotMobScores(); } catch(e) { console.error('[ZetaSports] syncFotMobScores error:', e); }
    } catch (err) {
      console.error('[ZetaSports] Supabase load error:', err);
      var container = document.getElementById('matchesList');
      if (container) {
        container.innerHTML = '<div style="text-align:center;padding:30px;color:#ef4444;font-weight:700;">Could not connect to sports cloud. Retrying in 5 seconds...</div>';
      }
      setTimeout(loadData, 5000);
    }
  }

  // Initialize
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', loadData);
    } else {
      loadData();
    }
  }

  // Polling
  if (typeof setInterval !== 'undefined') {
    setInterval(loadData, 25000);
    setInterval(syncFotMobScores, 30000);
    
  // ── AUTOMATED CLOUD SETTINGS & DYNAMIC SEO ENGINE ──
  var TG_CONFIG = {
    enabled: true,
    url: 'https://t.me/zetasports_official',
    title: '📢 Join Our Official Telegram',
    message: 'Get instant live match streams, backup links, and real-time goal alerts directly on Telegram!',
    intervalMins: 5
  };

  async function syncGlobalConfigAndSEO() {
    try {
      var res = await fetch(SB_URL + '/rest/v1/zeta_config?id=eq.global&select=*', {
        headers: SB_HEADERS
      });
      if (res.ok) {
        var data = await res.json();
        if (data && data[0]) {
          var c = data[0];
          // 1. Telegram Sync
          if (c.telegram_enabled !== undefined) TG_CONFIG.enabled = c.telegram_enabled;
          if (c.telegram_url) TG_CONFIG.url = c.telegram_url;
          if (c.telegram_title) TG_CONFIG.title = c.telegram_title;
          if (c.telegram_message) TG_CONFIG.message = c.telegram_message;
          if (c.telegram_interval_mins) TG_CONFIG.intervalMins = c.telegram_interval_mins;

          // 2. Automated Title & SEO Keywords Sync
          if (c.site_title && !window.location.pathname.includes('-vs-') && !window.location.search.includes('stream=')) {
            document.title = c.site_title;
          }
          if (c.seo_keywords) {
            var metaKw = document.querySelector('meta[name="keywords"]') || document.createElement('meta');
            metaKw.name = 'keywords';
            metaKw.content = c.seo_keywords;
            if (!metaKw.parentNode) document.head.appendChild(metaKw);
          }
          if (c.meta_description && !window.location.pathname.includes('-vs-')) {
            var metaDesc = document.querySelector('meta[name="description"]') || document.createElement('meta');
            metaDesc.name = 'description';
            metaDesc.content = c.meta_description;
            if (!metaDesc.parentNode) document.head.appendChild(metaDesc);
          }

          // 3. Automated Announcement Banner
          if (c.announcement_banner && c.announcement_banner.trim()) {
            var bannerEl = document.getElementById('zetaAnnouncementBanner');
            if (!bannerEl) {
              bannerEl = document.createElement('div');
              bannerEl.id = 'zetaAnnouncementBanner';
              bannerEl.style.cssText = 'background:linear-gradient(90deg,#1e3a8a,#2563eb);color:#fff;text-align:center;padding:8px 12px;font-size:13px;font-weight:700;z-index:999;box-shadow:0 2px 4px rgba(0,0,0,0.1);';
              document.body.insertBefore(bannerEl, document.body.firstChild);
            }
            bannerEl.innerHTML = '📢 ' + escapeHtml(c.announcement_banner);
          }
        }
      }
    } catch(e) {}
    initTelegramNotification();
  }

  function injectMatchSEO(home, away, league, scoreText, isLive, kickoff) {
    try {
      var kw = home + ' vs ' + away + ', ' + home + ' vs ' + away + ' live score, ' + 
               home + ' vs ' + away + ' stream, ' + home + ' vs ' + away + ' lineups, ' + 
               league + ' live, FotMob Scores, ZetaSports, KeralaHub';
      var metaKw = document.querySelector('meta[name="keywords"]') || document.createElement('meta');
      metaKw.name = 'keywords';
      metaKw.content = kw;
      if (!metaKw.parentNode) document.head.appendChild(metaKw);

      var desc = 'Watch ' + home + ' vs ' + away + ' (' + scoreText + ') live score, lineup formations, H2H statistics, and HD stream gateway on ZetaSports.';
      var metaDesc = document.querySelector('meta[name="description"]') || document.createElement('meta');
      metaDesc.name = 'description';
      metaDesc.content = desc;
      if (!metaDesc.parentNode) document.head.appendChild(metaDesc);

      // Google SportsEvent JSON-LD Schema
      var existingSchema = document.getElementById('zeta-sportsevent-schema');
      if (existingSchema) existingSchema.remove();
      var schema = document.createElement('script');
      schema.id = 'zeta-sportsevent-schema';
      schema.type = 'application/ld+json';
      schema.text = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "SportsEvent",
        "name": home + " vs " + away,
        "description": desc,
        "startDate": kickoff || new Date().toISOString(),
        "sport": "Soccer",
        "eventStatus": isLive ? "https://schema.org/EventLive" : "https://schema.org/EventScheduled",
        "competitor": [
          { "@type": "SportsTeam", "name": home },
          { "@type": "SportsTeam", "name": away }
        ]
      });
      document.head.appendChild(schema);
    } catch(e) {}
  }

  function initTelegramNotification() {
    if (!TG_CONFIG.enabled) return;
    function checkAndShow() {
      if (!TG_CONFIG.enabled) return;
      var lastShown = parseInt(localStorage.getItem('zeta_tg_last_shown') || '0');
      var now = Date.now();
      var intervalMs = (TG_CONFIG.intervalMins || 5) * 60 * 1000;
      if (now - lastShown >= intervalMs) {
        showTelegramPopup();
      }
    }
    setTimeout(checkAndShow, 6000);
    setInterval(checkAndShow, 60000);
  }

  function showTelegramPopup() {
    window.showTelegramPopup = showTelegramPopup;
    var existing = document.getElementById('zetaTgPopup');
    if (existing) existing.remove();
    var popup = document.createElement('div');
    popup.id = 'zetaTgPopup';
    popup.className = 'zeta-tg-card';
    popup.innerHTML = 
      '<div class="zeta-tg-header">' +
        '<div class="zeta-tg-badge">' +
          '<span class="zeta-tg-icon">✈️</span>' +
          '<div class="zeta-tg-badge-pulse"></div>' +
        '</div>' +
        '<div class="zeta-tg-title-box">' +
          '<div class="zeta-tg-title">' + escapeHtml(TG_CONFIG.title || 'Join Telegram Channel') + '</div>' +
          '<div class="zeta-tg-sub">Instant Live Streams &amp; Goal Alerts</div>' +
        '</div>' +
        '<div class="zeta-tg-close" onclick="dismissTelegramPopup()">✕</div>' +
      '</div>' +
      '<div class="zeta-tg-body">' + escapeHtml(TG_CONFIG.message || 'Get instant live match streams, backup links, and real-time goal alerts directly on Telegram!') + '</div>' +
      '<div class="zeta-tg-actions">' +
        '<a href="' + sanitizeUrl(TG_CONFIG.url) + '" target="_blank" class="zeta-tg-btn" onclick="onJoinTelegramClicked()">' +
          '<span>🚀</span> Join Telegram Channel' +
        '</a>' +
        '<button class="zeta-tg-later-btn" onclick="dismissTelegramPopup()">Later</button>' +
      '</div>';
    document.body.appendChild(popup);
    setTimeout(function() { popup.classList.add('visible'); }, 50);
    localStorage.setItem('zeta_tg_last_shown', Date.now().toString());
  }

  window.dismissTelegramPopup = function() {
    var popup = document.getElementById('zetaTgPopup');
    if (popup) {
      popup.classList.remove('visible');
      setTimeout(function() { popup.remove(); }, 350);
    }
    localStorage.setItem('zeta_tg_last_shown', Date.now().toString());
  };

  window.onJoinTelegramClicked = function() {
    dismissTelegramPopup();
  };

    syncGlobalConfigAndSEO();
  }
