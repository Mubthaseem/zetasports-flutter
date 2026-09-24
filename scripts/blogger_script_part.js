// ── VIEW SWITCHERS & ROUTING ──
    window.goHome = function() {
      window.history.pushState(null, '', '/');
      document.title = 'ZetaSports — Live Football Scores, Today Matches & Streams';
      showView('home');
      stopStream();
    };

    window.returnToMatch = function() {
      if (currentMatchId) {
        window.openMatchPage(currentMatchId, true);
      } else {
        goHome();
      }
    };

    function showView(viewName) {
      document.getElementById('homeView').style.display = viewName === 'home' ? 'block' : 'none';
      document.getElementById('matchView').style.display = viewName === 'match' ? 'block' : 'none';
      document.getElementById('streamView').style.display = viewName === 'stream' ? 'block' : 'none';
    }

    function extractMatchId(str) {
      if (!str) return null;
      var uuidRegex = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;
      var match = str.match(uuidRegex);
      if (match) return match[0];

      for (var i = 0; i < allMatches.length; i++) {
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

      var contentBox = document.getElementById('modalArticleContent');
      contentBox.innerHTML = 
        (image ? '<img src="' + image + '" class="modal-article-img" alt="" />' : '') +
        '<div style="padding:20px;">' +
          '<div style="font-size:12px;color:#64748b;font-weight:700;margin-bottom:6px;">' + (date || 'FotMob Editorial Match Report') + '</div>' +
          '<h2 style="font-size:20px;font-weight:900;line-height:1.4;margin-bottom:14px;">' + title + '</h2>' +
          '<div class="modal-article-body">' + fullHtml + '</div>' +
        '</div>';

      modal.style.display = 'flex';
    };

    window.closeArticleModal = function() {
      var modal = document.getElementById('articleModal');
      if (modal) modal.style.display = 'none';
    };

    // ── ROUTE 1: DEDICATED MATCH DETAILS & 8 SECTIONS (domain.com/team1-vs-team2-id) ──
    window.openMatchPage = function(matchId, pushState) {
      var match = allMatches.find(function(m) { return String(m.id) === String(matchId); });
      if (!match) return;

      currentMatchId = match.id;
      var mServers = getMatchServers(match);
      var hasLiveStream = mServers.length > 0;
      stopStream();

      var homeName = match.home_team || (teamsMap[match.home_team_id] && teamsMap[match.home_team_id].name) || 'Home Team';
      var awayName = match.away_team || (teamsMap[match.away_team_id] && teamsMap[match.away_team_id].name) || 'Away Team';
      var homeLogo = match.home_logo || (teamsMap[match.home_team_id] && teamsMap[match.home_team_id].logo_url) || 'https://korra.world/wp-content/uploads/yalla-team-logos/114.png';
      var awayLogo = match.away_logo || (teamsMap[match.away_team_id] && teamsMap[match.away_team_id].logo_url) || 'https://korra.world/wp-content/uploads/yalla-team-logos/109.png';
      var leagueName = match.league_name || (leaguesMap[match.league_id] && leaguesMap[match.league_id].name) || 'Live Football Match';

      var matchSlug = slugify(homeName) + '-vs-' + slugify(awayName) + '-' + match.id;
      if (pushState !== false) {
        window.history.pushState({ matchId: match.id }, '', '/' + matchSlug);
      }
      document.title = homeName + ' vs ' + awayName + ' — Live Score, News & Stream | ZetaSports';

      var liveInfo = getMatchLiveInfo(match);
      var isLive = liveInfo.isLive;
      var statusClass = liveInfo.statusClass;
      var statusText = liveInfo.statusText;
      var scoreText = liveInfo.scoreText;
      var kickoffFull = match.date ? new Date(match.date).toLocaleString() : 'TBD';

      var box = document.getElementById('matchBox');
      box.innerHTML = 
        '<!-- Action Row: Share, Sound, Sync -->' +
        '<div class="match-action-row">' +
          '<button class="match-chip-btn" onclick="copyMatchLink()">🔗 Share Match</button>' +
          '<div style="display:flex;gap:6px;">' +
            '<button class="match-chip-btn" onclick="playGoalWhistle()">🔔 Goal Alert</button>' +
            '<button class="match-chip-btn" onclick="syncLiveMatchData(\'' + (match.fotmob_id || '') + '\')">⚡ Live Refresh</button>' +
          '</div>' +
        '</div>' +

        '<!-- Section 1: Scoreboard Header -->' +
        '<div class="match-page-header">' +
          '<div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#93c5fd;font-weight:700;margin-bottom:4px;">' + leagueName + '</div>' +
          '<h1 style="font-size:22px;font-weight:800;">' + homeName + ' vs ' + awayName + '</h1>' +
          '<div style="margin-top:8px;"><span id="STING-web-Match-Time" class="' + statusClass + '">' + statusText + '</span></div>' +
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
          '<div class="match-meta-item"><span>Referee:</span><strong>' + (match.referee || 'FIFA Licensed') + '</strong></div>' +
          '<div class="match-meta-item"><span>Kickoff Date:</span><strong>' + kickoffFull + '</strong></div>' +
          '<div class="match-meta-item"><span>Broadcast:</span><strong>1080p 60FPS HD</strong></div>' +
        '</div>' +

        '<!-- Section 2: 7 Interactive Navigation Tabs -->' +
        '<div class="match-tabs-header">' +
          '<button class="mtab-btn active" id="mtab-overview" onclick="switchMatchTab(\'overview\')">📌 Overview</button>' +
          '<button class="mtab-btn" id="mtab-timeline" onclick="switchMatchTab(\'timeline\')">⏱️ Timeline</button>' +
          '<button class="mtab-btn" id="mtab-stats" onclick="switchMatchTab(\'stats\')">📊 Statistics</button>' +
          '<button class="mtab-btn" id="mtab-lineups" onclick="switchMatchTab(\'lineups\')">📋 Lineups</button>' +
          '<button class="mtab-btn" id="mtab-h2h" onclick="switchMatchTab(\'h2h\')">⚔️ H2H &amp; Form</button>' +
          '<button class="mtab-btn" id="mtab-commentary" onclick="switchMatchTab(\'commentary\')">🎙️ Commentary</button>' +
          '<button class="mtab-btn" id="mtab-articles" onclick="switchMatchTab(\'articles\')">📰 Articles &amp; News</button>' +
        '</div>' +

        '<!-- TAB PANE 1: OVERVIEW -->' +
        '<div class="mtab-pane active" id="mpane-overview">' +
          '<div class="watch-action-box" style="border-radius:14px;margin-bottom:14px;">' +
            '<button class="btn-watch-stream" id="watchBtn" onclick="startStreamCountdown(\'' + match.id + '\')">' +
              '<span>▶</span> ' + (hasLiveStream ? ('Watch Live Stream HD (' + mServers.length + ' Server' + (mServers.length > 1 ? 's' : '') + ' Online)') : 'Live Match Stream (Starts at Kickoff)') +
            '</button>' +

            '<div class="countdown-box" id="countdownBox">' +
              '<div style="font-size:15px;font-weight:800;">Connecting to Live HD Broadcast Server...</div>' +
              '<div style="font-size:13px;color:#64748b;margin-top:4px;">Redirecting you to stream player at <code>/stream/' + match.id + '</code> in:</div>' +
              '<div class="countdown-timer-circle" id="countTimer">5</div>' +
              '<div class="progress-bar-wrap"><div class="progress-bar-fill" id="countBar"></div></div>' +
              '<div style="font-size:12px;color:#64748b;font-weight:600;">Preparing HD adaptive video feed with zero delay...</div>' +
            '</div>' +
          '</div>' +

          '<!-- Fan Prediction Poll (Feature #1) -->' +
          '<div class="poll-container" id="pollContainer"></div>' +

          '<!-- Match Preview -->' +
          '<div class="match-news-card">' +
            '<div class="match-news-title"><span>📰</span> Match Overview &amp; Tactical Preview</div>' +
            '<p class="match-news-p">' +
              'Welcome to the match center for <strong>' + homeName + '</strong> vs <strong>' + awayName + '</strong> in the <em>' + leagueName + '</em>. ' +
              'Both squads enter with high tactical intensity, seeking vital tournament points and table advancement.' +
            '</p>' +
            '<div class="match-stats-grid">' +
              '<div class="match-stat-item"><div class="match-stat-val">1080p 60FPS</div><div class="match-stat-lbl">Broadcasting Quality</div></div>' +
              '<div class="match-stat-item"><div class="match-stat-val">' + (isLive ? (match.time_elapsed || 'LIVE') : 'Upcoming') + '</div><div class="match-stat-lbl">Match Period</div></div>' +
              '<div class="match-stat-item"><div class="match-stat-val">HLS Fast CDN</div><div class="match-stat-lbl">Streaming Server</div></div>' +
              '<div class="match-stat-item"><div class="match-stat-val">' + (scoreText !== 'VS' ? scoreText : '0 - 0') + '</div><div class="match-stat-lbl">Live Result</div></div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<!-- TAB PANE 2: TIMELINE / EVENTS -->' +
        '<div class="mtab-pane" id="mpane-timeline">' +
          '<div id="eventsListContainer">' +
            '<div class="event-timeline-card"><div class="event-min-badge">1\'</div><div><strong>Match Kickoff</strong> • Whistle blown at ' + (match.venue || 'Stadium') + '</div></div>' +
            (isLive || match.status === 'finished' ? 
              '<div class="event-timeline-card"><div class="event-min-badge" style="background:#2563eb;color:#fff;">30\'</div><div><strong>⚽ Goal!</strong> ' + homeName + ' scores with an emphatic finish!</div></div>' +
              '<div class="event-timeline-card"><div class="event-min-badge" style="background:#eab308;color:#000;">44\'</div><div><strong>🟨 Yellow Card</strong> shown for tactical foul.</div></div>' :
              '<div style="text-align:center;padding:30px;color:#64748b;font-weight:700;">Live timeline events will populate when the match kicks off.</div>'
            ) +
          '</div>' +
        '</div>' +

        '<!-- TAB PANE 3: STATISTICS -->' +
        '<div class="mtab-pane" id="mpane-stats">' +
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
        '</div>' +

        '<!-- TAB PANE 4: LINEUPS -->' +
        '<div class="mtab-pane" id="mpane-lineups">' +
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
        '</div>' +

        '<!-- TAB PANE 5: HEAD TO HEAD & FORM -->' +
        '<div class="mtab-pane" id="mpane-h2h">' +
          '<div class="match-news-card">' +
            '<div class="match-news-title"><span>⚔️</span> Recent Form &amp; Head to Head</div>' +
            '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #e2e8f0;">' +
              '<strong>' + homeName + '</strong>' +
              '<div><span class="form-pill form-w">W</span><span class="form-pill form-w">W</span><span class="form-pill form-d">D</span><span class="form-pill form-l">L</span><span class="form-pill form-w">W</span></div>' +
            '</div>' +
            '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;">' +
              '<strong>' + awayName + '</strong>' +
              '<div><span class="form-pill form-w">W</span><span class="form-pill form-d">D</span><span class="form-pill form-l">L</span><span class="form-pill form-w">W</span><span class="form-pill form-d">D</span></div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<!-- TAB PANE 6: COMMENTARY -->' +
        '<div class="mtab-pane" id="mpane-commentary">' +
          '<div id="commentaryContainer">' +
            '<div class="comm-item"><span style="font-weight:800;color:#2563eb;min-width:30px;">90\'</span><span>Full time approaching. Both sides pushing with high defensive line.</span></div>' +
            '<div class="comm-item"><span style="font-weight:800;color:#2563eb;min-width:30px;">72\'</span><span>Dangerous free-kick awarded just outside the penalty area.</span></div>' +
            '<div class="comm-item"><span style="font-weight:800;color:#2563eb;min-width:30px;">45\'</span><span>End of first half. Strategic tactical adjustments expected in the second half.</span></div>' +
          '</div>' +
        '</div>' +

        '<!-- TAB PANE 7: ARTICLES & FOTMOB NEWS -->' +
        '<div class="mtab-pane" id="mpane-articles">' +
          '<div class="article-card-grid" id="articlesGridContainer">' +
            '<div class="article-card" onclick="openArticleModal(\'Tactical Breakdown: ' + homeName + ' vs ' + awayName + '\', \'' + homeLogo + '\', \'Today\', \'<p>In-depth tactical preview of the match highlighting key matchups, expected lineups, and managerial systems.</p>\')">' +
              '<div style="background:#2563eb;height:120px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:18px;">MATCH PREVIEW</div>' +
              '<div class="article-card-content">' +
                '<div style="font-size:11px;color:#2563eb;font-weight:800;margin-bottom:4px;">EDITORIAL PREVIEW</div>' +
                '<h4 style="font-size:14px;font-weight:800;line-height:1.4;margin-bottom:6px;">' + homeName + ' vs ' + awayName + ': Key tactical battle</h4>' +
                '<p style="font-size:12px;color:#64748b;line-height:1.5;">Click to read the complete analysis and data debrief.</p>' +
              '</div>' +
            '</div>' +
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
              var titleEsc = (art.title || '').replace(/"/g, '&quot;').replace(/'/g, "\\'");
              var img = art.image || 'https://images.fotmob.com/image_resources/news/fotmob.png';
              var desc = (art.description || 'Click to view the full match story and details.').replace(/'/g, "\\'");
              return '<div class="article-card" onclick="openArticleModal(\'' + titleEsc + '\', \'' + img + '\', \'' + (art.dateUpdated || '') + '\', \'<p>' + desc + '</p>\')">' +
                '<img src="' + img + '" alt="" onerror="this.style.display=\'none\'" />' +
                '<div class="article-card-content">' +
                  '<div style="font-size:11px;color:#2563eb;font-weight:800;margin-bottom:4px;">' + (art.source || 'FotMob').toUpperCase() + '</div>' +
                  '<h4 style="font-size:14px;font-weight:800;line-height:1.4;margin-bottom:6px;">' + (art.title || '') + '</h4>' +
                  '<p style="font-size:12px;color:#64748b;line-height:1.5;">' + (art.description || '') + '</p>' +
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
              var playerName = ev.player?.name || ev.nameStr || '';
              var subText = ev.assistInput ? (' (Assist: ' + ev.assistInput + ')') : '';
              return '<div class="event-timeline-card">' +
                '<div class="event-min-badge">' + (ev.timeStr || ev.time || '') + '\'</div>' +
                '<div><strong>' + icon + ' ' + (ev.type || '') + '</strong>: ' + playerName + subText + '</div>' +
              '</div>';
            }).join('');
          }
        }
      } catch(e) {}
    }

    // ── 5-SECOND COUNTDOWN & REDIRECT TO STREAM PAGE ──
    window.startStreamCountdown = function(matchId) {
      var btn = document.getElementById('watchBtn');
      var box = document.getElementById('countdownBox');
      if (btn) btn.style.display = 'none';
      if (box) box.style.display = 'block';

      var count = 5;
      var timerEl = document.getElementById('countTimer');
      var barEl = document.getElementById('countBar');
      if (timerEl) timerEl.textContent = count;
      if (barEl) barEl.style.width = '100%';

      var interval = setInterval(function() {
        count--;
        if (timerEl) timerEl.textContent = count;
        if (barEl) barEl.style.width = (count / 5 * 100) + '%';
        if (count <= 0) {
          clearInterval(interval);
          openStreamPage(matchId, true);
        }
      }, 1000);
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

    // ── ROUTE 2: DEDICATED STREAMING PAGE WITH DYNAMIC MULTI-SERVER (domain.com/stream/id) ──
    window.openStreamPage = function(matchId, pushState) {
      var match = allMatches.find(function(m) { return String(m.id) === String(matchId); });
      if (!match) return;

      currentMatchId = match.id;
      if (pushState !== false) {
        window.history.pushState({ streamId: match.id }, '', '/stream/' + match.id);
      }

      var homeName = match.home_team || (teamsMap[match.home_team_id] && teamsMap[match.home_team_id].name) || 'Home Team';
      var awayName = match.away_team || (teamsMap[match.away_team_id] && teamsMap[match.away_team_id].name) || 'Away Team';
      var title = homeName + ' vs ' + awayName + ' — Live Stream HD';

      document.title = 'Live Stream: ' + title + ' | ZetaSports';
      var titleEl = document.getElementById('streamTitle');
      if (titleEl) titleEl.textContent = title;

      showView('stream');
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Resolve real servers matching Admin Panel 1:1
      currentMatchServers = getMatchServers(match);
      currentServerIndex = 0;

      renderServerButtons();

      if (currentMatchServers.length === 0) {
        // ZERO MOCK STREAMS: Display clean broadcast offline notice
        stopStream();
        showNoStreamUI();
      } else {
        hideNoStreamUI();
        loadStreamServer(currentMatchServers[0]);
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
          (isActive ? '▶ ' : '') + srv.name +
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
          iframe.src = streamUrl;
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
          video.src = streamUrl;
          if (window.Plyr) { plyrInstance = new window.Plyr(video); }
          video.play().catch(function(){});
        }
      } else {
        // Direct MP4 / other video
        if (badgeEl) {
          badgeEl.textContent = 'HD VIDEO DIRECT';
          badgeEl.style.background = '#2563eb';
        }
        video.src = streamUrl;
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

    // ── RENDER MATCHES IN CHRONOLOGICAL TIME ORDER (Earliest Kickoff First) ──
    function renderMatches() {
      var container = document.getElementById('matchesList');
      if (!container) return;

      var now = new Date();
      var todayStr = now.toISOString().split('T')[0];

      var yesterdayDate = new Date();
      yesterdayDate.setDate(now.getDate() - 1);
      var yesterdayStr = yesterdayDate.toISOString().split('T')[0];

      var tomorrowDate = new Date();
      tomorrowDate.setDate(now.getDate() + 1);
      var tomorrowStr = tomorrowDate.toISOString().split('T')[0];

      // Filter by Tab
      var filtered = allMatches.filter(function(m) {
        var mDateStr = m.date ? m.date.split('T')[0] : todayStr;
        if (currentDateFilter === 'all') return true;
        if (currentDateFilter === 'live') return m.status === 'live';
        if (currentDateFilter === 'yesterday') return mDateStr === yesterdayStr || m.status === 'finished';
        if (currentDateFilter === 'tomorrow') return mDateStr === tomorrowStr;
        return mDateStr === todayStr || m.status === 'live' || m.status === 'upcoming' || allMatches.length <= 10;
      });

      // ── CRITICAL: STRICT CHRONOLOGICAL SORT BY KICKOFF TIME (Earliest First) ──
      filtered.sort(function(a, b) {
        var tA = a.date ? new Date(a.date).getTime() : 0;
        var tB = b.date ? new Date(b.date).getTime() : 0;
        return tA - tB;
      });

      if (filtered.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;font-weight:700;">No matches scheduled for this date. Check another tab!</div>';
        return;
      }

      var html = '';
      filtered.forEach(function(m) {
        var homeName = m.home_team || (teamsMap[m.home_team_id] && teamsMap[m.home_team_id].name) || 'Home Team';
        var awayName = m.away_team || (teamsMap[m.away_team_id] && teamsMap[m.away_team_id].name) || 'Away Team';
        var homeLogo = m.home_logo || (teamsMap[m.home_team_id] && teamsMap[m.home_team_id].logo_url) || 'https://korra.world/wp-content/uploads/yalla-team-logos/114.png';
        var awayLogo = m.away_logo || (teamsMap[m.away_team_id] && teamsMap[m.away_team_id].logo_url) || 'https://korra.world/wp-content/uploads/yalla-team-logos/109.png';
        var leagueName = m.league_name || (leaguesMap[m.league_id] && leaguesMap[m.league_id].name) || 'Live Match';

        var liveInfo = getMatchLiveInfo(m);
        var isLive = liveInfo.isLive;
        var statusClass = liveInfo.statusClass;
        var timeDisplay = liveInfo.timeDisplay;
        var statusText = liveInfo.statusText;
        var scoreText = liveInfo.scoreText;
        var matchSlug = slugify(homeName) + '-vs-' + slugify(awayName) + '-' + m.id;

        // Clicking redirects to dedicated match page: domain.com/{team1}-vs-{team2}-{id}
        html += '<div class="STING-web-Match" id="match-' + m.id + '">' +
          '<a href="/' + matchSlug + '" onclick="event.preventDefault(); openMatchPage(\'' + m.id + '\', true);">' +
            '<div class="STING-web-Right-Team">' +
              '<div class="STING-web-Team-Logo"><img src="' + homeLogo + '" alt="' + homeName + '" loading="lazy" class="img-lazy-blur" onload="this.classList.add(\'loaded\')" onerror="this.onerror=null;this.classList.add(\'loaded\');" /></div>' +
              '<div class="STING-web-Team-NAME">' + homeName + '</div>' +
            '</div>' +
            '<div class="STING-web-Match-Center">' +
              '<div class="STING-web-Match-Timing">' +
                '<div id="STING-web-Match-Time" class="' + statusClass + '">' + statusText + '</div>' +
                '<div id="STING-web-Result">' + scoreText + '</div>' +
                '<div class="STING-web-Match-Info">' + leagueName + ' (' + timeDisplay + ')</div>' +
              '</div>' +
            '</div>' +
            '<div class="STING-web-Left-Team">' +
              '<div class="STING-web-Team-NAME">' + awayName + '</div>' +
              '<div class="STING-web-Team-Logo"><img src="' + awayLogo + '" alt="' + awayName + '" loading="lazy" class="img-lazy-blur" onload="this.classList.add(\'loaded\')" onerror="this.onerror=null;this.classList.add(\'loaded\');" /></div>' +
            '</div>' +
            '<div class="STING-web-Overlay"><div class="STING-web-SVG-Play">▶</div></div>' +
          '</a>' +
        '</div>';
      });

      container.innerHTML = html;
    }

    // ── Handle Browser Back / Forward & URL Routes ──
    function checkUrlRoute() {
      var path = window.location.pathname || '';
      var params = new URLSearchParams(window.location.search);
      var streamParam = params.get('stream');
      var matchParam = params.get('match');

      // 1. Stream Route: /stream/{match-id} or ?stream={match-id}
      if (path.indexOf('/stream/') !== -1 || streamParam) {
        var sId = streamParam || extractMatchId(path.split('/stream/')[1]);
        if (sId) {
          openStreamPage(sId, false);
          return;
        }
      }

      // 2. Match Route: ?match=... or /{team1}-vs-{team2}-{match-id}
      if (matchParam) {
        var mId = extractMatchId(matchParam);
        if (mId) {
          openMatchPage(mId, false);
          return;
        }
      }

      if (path && path !== '/' && path.indexOf('/p/') === -1 && path.indexOf('/search') === -1) {
        var cleanPath = path.replace(/^\/+|\/+$/g, '');
        var mId2 = extractMatchId(cleanPath);
        if (mId2) {
          openMatchPage(mId2, false);
          return;
        }
      }

      showView('home');
    }

    window.addEventListener('popstate', function() {
      checkUrlRoute();
    });
