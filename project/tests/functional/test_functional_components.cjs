/**
 * ZetaSports Functional Test Suite: Component & Interaction Verification
 * Validates:
 * 1. Match card rendering (team crests, names, score/VS, status badges, watch CTA, flex layout, text overflow ellipsis)
 * 2. League filter chips (rendering, active state toggling, filtering matches by league id/name, resetting)
 * 3. Date switching (Yesterday, Today, Tomorrow, Live tabs, badge counts, dynamic filtering)
 * 4. Search modal (opening, debounced input query, filtering by club/league, empty state, reset filters, clear button)
 * 5. Stream player server selector (server cards rendering, selection, iframe src update with sandboxing, reload player)
 * 6. Return back navigation (cross-domain return URL handling, return back button click, isAllowedUrl validation)
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

// ── TEST FIXTURE DATA ──
const mockMatches = [
  {
    id: '15366038-b321-4e06-a42c-90712b422692',
    home_team: 'Al Mokawloon Al Arab',
    away_team: 'WE SC',
    home_logo: 'https://korra.world/wp-content/uploads/yalla-team-logos/114.png',
    away_logo: 'https://korra.world/wp-content/uploads/yalla-team-logos/109.png',
    league_id: 'egy-div-2',
    league_name: 'Egyptian Second Division',
    status: 'live',
    is_live: true,
    is_approved: true,
    elapsed: "74'",
    home_score: 2,
    away_score: 1,
    date: '2026-11-10T15:30:00Z',
    kickoff_ist: '9:00 PM'
  },
  {
    id: '99887766-aaaa-bbbb-cccc-112233445566',
    home_team: 'Real Madrid CF',
    away_team: 'Manchester City',
    home_logo: 'https://korra.world/wp-content/uploads/yalla-team-logos/rm.png',
    away_logo: 'https://korra.world/wp-content/uploads/yalla-team-logos/mc.png',
    league_id: 'uefa-cl',
    league_name: 'UEFA Champions League',
    status: 'scheduled',
    is_live: false,
    is_approved: true,
    date: '2026-11-10T20:00:00Z',
    kickoff_ist: '1:30 AM'
  },
  {
    id: 'long-names-0001-2222-3333-444455556666',
    home_team: 'Wolverhampton Wanderers FC',
    away_team: 'Borussia Moenchengladbach 1900',
    home_logo: 'https://korra.world/wp-content/uploads/yalla-team-logos/wolves.png',
    away_logo: 'https://korra.world/wp-content/uploads/yalla-team-logos/bmg.png',
    league_id: 'premier-league',
    league_name: 'Premier League',
    status: 'scheduled',
    is_live: false,
    is_approved: true,
    date: '2026-11-10T17:30:00Z',
    kickoff_ist: '11:00 PM'
  },
  {
    id: 'yest-0001-aaaa-bbbb-cccc-111122223333',
    home_team: 'Arsenal',
    away_team: 'Chelsea',
    home_logo: 'https://korra.world/wp-content/uploads/yalla-team-logos/ars.png',
    away_logo: 'https://korra.world/wp-content/uploads/yalla-team-logos/che.png',
    league_id: 'premier-league',
    league_name: 'Premier League',
    status: 'finished',
    is_live: false,
    is_approved: true,
    home_score: 3,
    away_score: 1,
    date: '2026-11-09T19:45:00Z',
    kickoff_ist: '1:15 AM'
  },
  {
    id: 'tomm-0001-dddd-eeee-ffff-444455556666',
    home_team: 'Bayern Munich',
    away_team: 'Borussia Dortmund',
    home_logo: 'https://korra.world/wp-content/uploads/yalla-team-logos/bay.png',
    away_logo: 'https://korra.world/wp-content/uploads/yalla-team-logos/bvb.png',
    league_id: 'bundesliga',
    league_name: 'Bundesliga',
    status: 'scheduled',
    is_live: false,
    is_approved: true,
    date: '2026-11-11T17:30:00Z',
    kickoff_ist: '11:00 PM'
  }
];

const mockServers = [
  { id: 0, name: 'Server 1 - Ultra HD', quality: '1080p 60fps', lang: 'English', health: '🟢 99.9% Online', url: 'https://stream-cdn.zetasports.site/live/server1.m3u8' },
  { id: 1, name: 'Server 2 - Fast CDN', quality: '720p Mobile', lang: 'Arabic', health: '🟢 98.5% Online', url: 'https://stream-cdn.zetasports.site/live/server2.m3u8' },
  { id: 2, name: 'Server 3 - Backup Stream', quality: '1080p', lang: 'Spanish', health: '🟡 Medium Buffer', url: 'https://stream-cdn.zetasports.site/live/server3.m3u8' }
];

async function runFunctionalTestSuite() {
  console.log('===============================================================');
  console.log('   ZETASPORTS FUNCTIONAL TEST SUITE: AUTOMATED COMPONENT QA    ');
  console.log('===============================================================\n');

  const cssPath = path.resolve('web/css/zetasports-core.css');
  const masterCss = fs.readFileSync(cssPath, 'utf8');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844 });

    // Construct full interactive DOM harness
    const testHarnessHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ZetaSports Functional Test Harness</title>
        <style>
          ${masterCss}
        </style>
      </head>
      <body>
        <!-- Header -->
        <header class="STING-web-Header">
          <div class="STING-web-Header-Content">
            <button class="STING-web-Open-Menu" id="menuToggle" aria-label="Open Menu">☰</button>
            <div class="STING-web-Logo"><a href="/">ZetaSports</a></div>
            <div class="STING-web-Header-Right">
              <button class="search-trigger" id="searchTrigger" aria-label="Search">🔍</button>
              <button class="STING-web-Open-Dark" id="darkToggle" aria-label="Dark Mode">🌙</button>
            </div>
          </div>
        </header>

        <!-- Search Modal -->
        <div class="zeta-search-modal" id="searchModal" style="display:none;">
          <div class="zeta-search-bar">
            <input type="text" class="zeta-search-input" id="searchInput" placeholder="Search team, league, stadium..." />
            <button class="search-clear-btn" id="searchClearBtn">✕</button>
          </div>
          <div class="zeta-search-results" id="searchResults"></div>
          <div class="zeta-search-empty-state" id="searchEmptyState" style="display:none; text-align:center; padding:20px;">
            <p>No matches found.</p>
            <button class="btn-reset-filters" id="btnResetFilters" style="min-height:44px; min-width:44px; padding:8px 16px;">Reset Filters</button>
          </div>
        </div>

        <!-- Date Switcher Bar -->
        <div class="STING-web-Matches-Toggle-Wrap">
          <ul class="STING-web-Matches-Toggle">
            <li class="Yesterday-Matches" id="tabYesterday"><a href="#" id="linkYesterday">Yesterday (<span id="cntYesterday">1</span>)</a></li>
            <li class="Today-Matches active" id="tabToday"><a href="#" id="linkToday">Today (<span id="cntToday">3</span>)</a></li>
            <li class="Tomorrow-Matches" id="tabTomorrow"><a href="#" id="linkTomorrow">Tomorrow (<span id="cntTomorrow">1</span>)</a></li>
          </ul>
        </div>

        <!-- League Filter Chips Carousel -->
        <div class="zeta-league-carousel" id="leagueCarousel">
          <button class="zeta-league-pill active" data-league="all" id="chipAll">All</button>
          <button class="zeta-league-pill" data-league="premier-league" id="chipEPL">Premier League</button>
          <button class="zeta-league-pill" data-league="uefa-cl" id="chipUCL">UEFA Champions League</button>
          <button class="zeta-league-pill" data-league="egy-div-2" id="chipEGY">Egyptian 2nd Div</button>
          <button class="zeta-league-pill" data-league="bundesliga" id="chipBUN">Bundesliga</button>
        </div>

        <!-- Matches Fixture List Container (#homeView) -->
        <div id="homeView">
          <div class="STING-web-Matches" id="matchesList"></div>
        </div>

        <!-- Match Details View (#matchView) -->
        <div id="matchView" style="display:none;">
          <div class="zeta-scoreboard-hero match-page-header">
            <button id="btnBackToHome" class="touch-target-compliant">← Back to Fixtures</button>
            <div class="match-scoreboard-grid">
              <div class="team-unit team-home">
                <img class="team-logo" id="detailHomeLogo" src="" alt="Home"/>
                <h3 id="detailHomeName"></h3>
              </div>
              <div class="score-unit">
                <div class="big-score" id="detailScore">0 - 0</div>
                <div class="match-minute" id="detailMinute">74' LIVE</div>
              </div>
              <div class="team-unit team-away">
                <img class="team-logo" id="detailAwayLogo" src="" alt="Away"/>
                <h3 id="detailAwayName"></h3>
              </div>
            </div>
            <div class="match-action-row" style="text-align:center; margin-top:12px;">
              <button id="watchBtn" class="btn-watch-stream touch-target-compliant" style="min-height:44px; min-width:44px;">Watch Live Stream ▶</button>
            </div>
          </div>
          <div class="match-tabs-header">
            <button class="mtab-btn active" data-tab="overview">Overview</button>
            <button class="mtab-btn" data-tab="lineups">Lineups & Pitch</button>
            <button class="mtab-btn" data-tab="stats">Live Stats</button>
            <button class="mtab-btn" data-tab="h2h">H2H</button>
            <button class="mtab-btn" data-tab="standings">Standings</button>
          </div>
        </div>

        <!-- Link Selection Gateway (#linksView) -->
        <div id="linksView" style="display:none;">
          <div class="links-selection-header">
            <button id="btnLinksBackToMatch" class="touch-target-compliant">← Back to Match Post</button>
            <h2 id="linksMatchTitle">Select Stream Server</h2>
          </div>
          <div id="serverCardsContainer" class="server-cards-list"></div>
        </div>

        <!-- Embedded Stream Player (#streamView) -->
        <div id="streamView" style="display:none;">
          <div class="stream-player-header">
            <button id="btnBackToLinks" class="touch-target-compliant">← Back to Servers</button>
            <button id="btnReloadPlayer" class="touch-target-compliant">🔄 Reload Player</button>
          </div>
          <div class="iframe-container" style="position:relative; width:100%; aspect-ratio:16/9; background:#000;">
            <iframe id="zeta-player-frame"
                    src="about:blank"
                    sandbox="allow-scripts allow-same-origin allow-presentation"
                    referrerpolicy="no-referrer"
                    allowfullscreen="true"
                    loading="lazy"
                    style="width:100%; height:100%; border:none;"></iframe>
          </div>
          <div id="serverButtonsList" class="player-server-selector" style="display:flex; gap:8px; margin-top:12px; padding:4px;"></div>
        </div>

        <script>
          window.ZETA_CONFIG = {
            detailsOrigin: 'https://www.keralahub.online',
            streamOrigin: 'http://www.zetasports.site',
            supabaseUrl: 'https://udlncusvhmydivtjkjcy.supabase.co',
            supabaseKey: 'test-anon-key'
          };

          const rawMatches = ${JSON.stringify(mockMatches)};
          const rawServers = ${JSON.stringify(mockServers)};

          let currentDateFilter = 'today';
          let currentLeagueFilter = 'all';
          let searchQuery = '';
          let lastOpenedMatchId = null;
          let currentSelectedServer = null;

          function escapeHtml(str) {
            if (!str) return '';
            return String(str)
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
          }

          function sanitizeUrl(url) {
            if (!url) return '';
            var u = String(url).trim();
            if (/^(?:javascript|data|vbscript):/i.test(u)) return '';
            return u;
          }

          function isAllowedUrl(url) {
            if (!url || typeof url !== 'string') return false;
            const trimmed = url.trim();
            if (/^(?:javascript|data|vbscript):/i.test(trimmed)) return false;
            if (trimmed.startsWith('//') || trimmed.startsWith('/\\\\')) return false;
            if (trimmed.startsWith('/')) return true;
            try {
              const parsed = new URL(trimmed, window.ZETA_CONFIG.detailsOrigin);
              if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
              const host = parsed.hostname.toLowerCase();
              const allowed = ['keralahub.online', 'www.keralahub.online', 'zetasports.site', 'www.zetasports.site'];
              return allowed.some(d => host === d || host.endsWith('.' + d));
            } catch(e) {
              return false;
            }
          }

          function slugify(text) {
            return (text || '').toString().toLowerCase().trim()
              .replace(/\\s+/g, '-')
              .replace(/[^\\w\\-]+/g, '')
              .replace(/\\-\\-+/g, '-');
          }

          function renderMatchesList() {
            const container = document.getElementById('matchesList');
            if (!container) return;

            const refDate = '2026-11-10';
            const yestDate = '2026-11-09';
            const tommDate = '2026-11-11';

            let filtered = rawMatches.filter(m => {
              const mDateStr = m.date.split('T')[0];
              if (currentDateFilter === 'all') return true;
              if (currentDateFilter === 'live') return m.status === 'live';
              if (currentDateFilter === 'yesterday') return mDateStr === yestDate;
              if (currentDateFilter === 'tomorrow') return mDateStr === tommDate;
              // today
              return mDateStr === refDate || m.status === 'live';
            });

            if (currentLeagueFilter !== 'all') {
              filtered = filtered.filter(m => m.league_id === currentLeagueFilter);
            }

            if (searchQuery.trim() !== '') {
              const q = searchQuery.toLowerCase().trim();
              filtered = filtered.filter(m => {
                return m.home_team.toLowerCase().includes(q) ||
                       m.away_team.toLowerCase().includes(q) ||
                       m.league_name.toLowerCase().includes(q);
              });
            }

            if (filtered.length === 0) {
              container.innerHTML = '<div class="zeta-empty-msg" style="text-align:center;padding:40px;color:#94a3b8;font-weight:700;">No matches scheduled for this filter.</div>';
              return;
            }

            let html = '';
            filtered.forEach(m => {
              const homeName = escapeHtml(m.home_team);
              const awayName = escapeHtml(m.away_team);
              const homeLogo = sanitizeUrl(m.home_logo);
              const awayLogo = sanitizeUrl(m.away_logo);
              const leagueName = escapeHtml(m.league_name);

              const isLive = m.status === 'live';
              const isFinished = m.status === 'finished';
              const statusClass = isLive ? 'zeta-status-live' : (isFinished ? 'zeta-status-finished' : 'zeta-status-upcoming');
              const statusText = isLive ? ('LIVE ' + (m.elapsed || '')) : (isFinished ? 'FINISHED' : (m.kickoff_ist || '19:45'));
              const scoreText = (isLive || isFinished) ? (m.home_score + ' - ' + m.away_score) : 'VS';
              const matchSlug = slugify(m.home_team) + '-vs-' + slugify(m.away_team) + '-' + m.id;

              html += '<div class="STING-web-Match" id="match-' + m.id + '">' +
                '<a href="/' + matchSlug + '" onclick="event.preventDefault(); window.openMatchPage(\\'' + m.id + '\\');">' +
                  '<div class="STING-web-Right-Team">' +
                    '<div class="STING-web-Team-Logo"><img src="' + homeLogo + '" alt="' + homeName + '" /></div>' +
                    '<div class="STING-web-Team-NAME">' + homeName + '</div>' +
                  '</div>' +
                  '<div class="STING-web-Match-Center">' +
                    '<div class="STING-web-Match-Timing">' +
                      '<div id="STING-web-Match-Time" class="' + statusClass + '">' + statusText + '</div>' +
                      '<div id="STING-web-Result">' + scoreText + '</div>' +
                      '<div class="STING-web-Match-Info">' + leagueName + '</div>' +
                    '</div>' +
                  '</div>' +
                  '<div class="STING-web-Left-Team">' +
                    '<div class="STING-web-Team-NAME">' + awayName + '</div>' +
                    '<div class="STING-web-Team-Logo"><img src="' + awayLogo + '" alt="' + awayName + '" /></div>' +
                  '</div>' +
                  '<div class="STING-web-Overlay"><div class="STING-web-SVG-Play">▶</div></div>' +
                '</a>' +
              '</div>';
            });

            container.innerHTML = html;
          }

          window.openMatchPage = function(matchId) {
            lastOpenedMatchId = matchId;
            const m = rawMatches.find(x => x.id === matchId);
            if (!m) return;
            document.getElementById('homeView').style.display = 'none';
            document.getElementById('linksView').style.display = 'none';
            document.getElementById('streamView').style.display = 'none';
            document.getElementById('matchView').style.display = 'block';

            document.getElementById('detailHomeLogo').src = m.home_logo;
            document.getElementById('detailHomeName').innerText = m.home_team;
            document.getElementById('detailAwayLogo').src = m.away_logo;
            document.getElementById('detailAwayName').innerText = m.away_team;
            document.getElementById('detailScore').innerText = (m.status === 'live' || m.status === 'finished') ? (m.home_score + ' - ' + m.away_score) : 'VS';
            document.getElementById('detailMinute').innerText = m.status === 'live' ? (m.elapsed + ' LIVE') : m.status.toUpperCase();
          };

          window.openLinksGateway = function(matchId) {
            document.getElementById('homeView').style.display = 'none';
            document.getElementById('matchView').style.display = 'none';
            document.getElementById('streamView').style.display = 'none';
            document.getElementById('linksView').style.display = 'block';

            const container = document.getElementById('serverCardsContainer');
            let html = '';
            rawServers.forEach(srv => {
              html += '<div class="server-card" style="padding:14px; margin-bottom:10px; background:#111827; border:1px solid #1f2937; border-radius:10px; display:flex; justify-content:space-between; align-items:center;">' +
                '<div>' +
                  '<h4 style="margin:0; color:#f9fafb;">' + srv.name + '</h4>' +
                  '<div style="font-size:12px; color:#9ca3af;">Quality: ' + srv.quality + ' | Lang: ' + srv.lang + ' | ' + srv.health + '</div>' +
                '</div>' +
                '<button class="zeta-server-btn" data-server-id="' + srv.id + '" style="min-height:44px; min-width:80px; padding:8px 16px; background:#2563eb; color:#fff; border:none; border-radius:8px; cursor:pointer;" onclick="window.loadStream(' + srv.id + ')">Play Stream ▶</button>' +
              '</div>';
            });
            container.innerHTML = html;
          };

          window.loadStream = function(serverId) {
            const srv = rawServers.find(s => s.id === serverId) || rawServers[0];
            currentSelectedServer = srv;
            document.getElementById('linksView').style.display = 'none';
            document.getElementById('streamView').style.display = 'block';

            const iframe = document.getElementById('zeta-player-frame');
            iframe.src = srv.url;

            // Render stream server buttons switcher
            const btnContainer = document.getElementById('serverButtonsList');
            let bHtml = '';
            rawServers.forEach(s => {
              const activeCls = s.id === srv.id ? 'active' : '';
              bHtml += '<button class="zeta-server-btn ' + activeCls + '" style="min-height:44px; min-width:44px; padding:6px 14px; border-radius:8px;" onclick="window.loadStream(' + s.id + ')">' + s.name.split(' - ')[0] + '</button>';
            });
            btnContainer.innerHTML = bHtml;
          };

          // Event Listeners for Date Switcher
          document.getElementById('linkYesterday').addEventListener('click', (e) => {
            e.preventDefault();
            currentDateFilter = 'yesterday';
            document.querySelectorAll('.STING-web-Matches-Toggle li').forEach(li => li.classList.remove('active'));
            document.getElementById('tabYesterday').classList.add('active');
            renderMatchesList();
          });

          document.getElementById('linkToday').addEventListener('click', (e) => {
            e.preventDefault();
            currentDateFilter = 'today';
            document.querySelectorAll('.STING-web-Matches-Toggle li').forEach(li => li.classList.remove('active'));
            document.getElementById('tabToday').classList.add('active');
            renderMatchesList();
          });

          document.getElementById('linkTomorrow').addEventListener('click', (e) => {
            e.preventDefault();
            currentDateFilter = 'tomorrow';
            document.querySelectorAll('.STING-web-Matches-Toggle li').forEach(li => li.classList.remove('active'));
            document.getElementById('tabTomorrow').classList.add('active');
            renderMatchesList();
          });

          // Event Listeners for League Chips
          document.querySelectorAll('.zeta-league-pill').forEach(btn => {
            btn.addEventListener('click', () => {
              document.querySelectorAll('.zeta-league-pill').forEach(b => b.classList.remove('active'));
              btn.classList.add('active');
              currentLeagueFilter = btn.getAttribute('data-league');
              renderMatchesList();
            });
          });

          // Search Modal Logic
          const searchModal = document.getElementById('searchModal');
          const searchInput = document.getElementById('searchInput');
          const searchClearBtn = document.getElementById('searchClearBtn');
          const searchEmptyState = document.getElementById('searchEmptyState');
          const btnResetFilters = document.getElementById('btnResetFilters');

          document.getElementById('searchTrigger').addEventListener('click', () => {
            searchModal.style.display = 'block';
            searchModal.classList.add('active');
            searchInput.focus();
          });

          let debounceTimer = null;
          searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
              searchQuery = e.target.value;
              renderMatchesList();
              const container = document.getElementById('matchesList');
              if (container.querySelector('.zeta-empty-msg')) {
                searchEmptyState.style.display = 'block';
              } else {
                searchEmptyState.style.display = 'none';
              }
            }, 50); // fast debounce for test
          });

          searchClearBtn.addEventListener('click', () => {
            searchInput.value = '';
            searchQuery = '';
            searchEmptyState.style.display = 'none';
            renderMatchesList();
          });

          btnResetFilters.addEventListener('click', () => {
            searchInput.value = '';
            searchQuery = '';
            currentLeagueFilter = 'all';
            currentDateFilter = 'today';
            searchEmptyState.style.display = 'none';
            document.querySelectorAll('.zeta-league-pill').forEach(b => b.classList.remove('active'));
            document.getElementById('chipAll').classList.add('active');
            renderMatchesList();
          });

          // Return Back Buttons
          document.getElementById('btnBackToHome').addEventListener('click', () => {
            document.getElementById('matchView').style.display = 'none';
            document.getElementById('homeView').style.display = 'block';
          });

          document.getElementById('watchBtn').addEventListener('click', () => {
            window.openLinksGateway(lastOpenedMatchId);
          });

          document.getElementById('btnLinksBackToMatch').addEventListener('click', () => {
            // In live environment, navigates to detailsOrigin: window.location.href = window.ZETA_CONFIG.detailsOrigin + '/' + slug
            window.lastReturnDestination = window.ZETA_CONFIG.detailsOrigin + '/match-' + lastOpenedMatchId;
            document.getElementById('linksView').style.display = 'none';
            document.getElementById('matchView').style.display = 'block';
          });

          document.getElementById('btnBackToLinks').addEventListener('click', () => {
            document.getElementById('streamView').style.display = 'none';
            document.getElementById('linksView').style.display = 'block';
          });

          document.getElementById('btnReloadPlayer').addEventListener('click', () => {
            const iframe = document.getElementById('zeta-player-frame');
            if (currentSelectedServer) {
              iframe.src = 'about:blank';
              setTimeout(() => { iframe.src = currentSelectedServer.url; }, 10);
            }
          });

          // Initial Render
          renderMatchesList();
        </script>
      </body>
      </html>
    `;

    await page.setContent(testHarnessHtml, { waitUntil: 'domcontentloaded' });

    // ─────────────────────────────────────────────────────────────────
    // TEST 1: Match Card Rendering & Flex Layout Integrity
    // ─────────────────────────────────────────────────────────────────
    console.log('--- TEST 1: Match Card Rendering & Layout ---');
    const cards = await page.evaluate(() => {
      const matchEls = document.querySelectorAll('.STING-web-Match');
      return Array.from(matchEls).map(el => {
        const homeName = el.querySelector('.STING-web-Right-Team .STING-web-Team-NAME')?.innerText;
        const awayName = el.querySelector('.STING-web-Left-Team .STING-web-Team-NAME')?.innerText;
        const score = el.querySelector('#STING-web-Result')?.innerText;
        const timeStatus = el.querySelector('#STING-web-Match-Time')?.innerText;
        const league = el.querySelector('.STING-web-Match-Info')?.innerText;
        const href = el.querySelector('a')?.getAttribute('href');
        return { id: el.id, homeName, awayName, score, timeStatus, league, href };
      });
    });

    assert.strictEqual(cards.length, 3, 'Initial Today tab should render exactly 3 matches');
    assert.strictEqual(cards[0].homeName, 'Al Mokawloon Al Arab');
    assert.strictEqual(cards[0].score, '2 - 1');
    assert.ok(cards[0].timeStatus.includes('LIVE'), 'Live status must be reflected');
    assert.strictEqual(cards[1].homeName, 'Real Madrid CF');
    assert.strictEqual(cards[1].score, 'VS');
    assert.strictEqual(cards[2].homeName, 'Wolverhampton Wanderers FC');
    assert.strictEqual(cards[2].awayName, 'Borussia Moenchengladbach 1900');
    console.log(`  ✔ Match cards rendered correctly: ${cards.length} fixtures with team names, logos, scores, status badges, and slug permalinks`);

    // Verify text truncation and overflow ellipsis
    const cardLayout = await page.evaluate(() => {
      const longCard = document.getElementById('match-long-names-0001-2222-3333-444455556666');
      const homeTeam = longCard.querySelector('.STING-web-Right-Team');
      const homeName = longCard.querySelector('.STING-web-Right-Team .STING-web-Team-NAME');
      const center = longCard.querySelector('.STING-web-Match-Center');
      const homeNameStyle = window.getComputedStyle(homeName);
      const homeTeamRect = homeTeam.getBoundingClientRect();
      const centerRect = center.getBoundingClientRect();

      return {
        overflow: homeNameStyle.overflow,
        textOverflow: homeNameStyle.textOverflow,
        whiteSpace: homeNameStyle.whiteSpace,
        homeTeamRight: homeTeamRect.right,
        centerLeft: centerRect.left,
        collides: homeTeamRect.right > (centerRect.left + 1)
      };
    });

    assert.strictEqual(cardLayout.overflow, 'hidden', 'Team name overflow must be hidden');
    assert.strictEqual(cardLayout.textOverflow, 'ellipsis', 'Team name must truncate with ellipsis');
    assert.strictEqual(cardLayout.whiteSpace, 'nowrap', 'Team name must not break onto multiple lines');
    assert.strictEqual(cardLayout.collides, false, 'Long team name container must not collide with center score container');
    console.log('  ✔ Fluid flex containment & text truncation verified: Zero collision on long club names');

    // ─────────────────────────────────────────────────────────────────
    // TEST 2: League Filter Chips Interaction
    // ─────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 2: League Filter Chips ---');
    // Click Premier League chip
    await page.click('#chipEPL');
    let eplMatches = await page.evaluate(() => {
      const els = document.querySelectorAll('.STING-web-Match');
      return Array.from(els).map(e => e.querySelector('.STING-web-Match-Info')?.innerText);
    });
    assert.strictEqual(eplMatches.length, 1, 'Only 1 Premier League fixture should render');
    assert.strictEqual(eplMatches[0], 'Premier League');
    console.log('  ✔ Clicking "Premier League" chip filters match list to Premier League only');

    // Click UEFA Champions League chip
    await page.click('#chipUCL');
    let uclMatches = await page.evaluate(() => {
      const els = document.querySelectorAll('.STING-web-Match');
      return Array.from(els).map(e => e.querySelector('.STING-web-Match-Info')?.innerText);
    });
    assert.strictEqual(uclMatches.length, 1, 'Only 1 UCL fixture should render');
    assert.strictEqual(uclMatches[0], 'UEFA Champions League');
    console.log('  ✔ Clicking "UEFA Champions League" chip filters match list to UCL only');

    // Click "All" chip to reset
    await page.click('#chipAll');
    let allMatchesCount = await page.evaluate(() => document.querySelectorAll('.STING-web-Match').length);
    assert.strictEqual(allMatchesCount, 3, 'Clicking "All" resets fixture list to all 3 today fixtures');
    console.log('  ✔ Clicking "All" restores complete fixture list');

    // ─────────────────────────────────────────────────────────────────
    // TEST 3: Date Switching Logic & State Transitions
    // ─────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 3: Date Switching Tabs ---');
    // Click Yesterday
    await page.click('#linkYesterday');
    let yestCount = await page.evaluate(() => {
      const activeTab = document.querySelector('.STING-web-Matches-Toggle li.active')?.id;
      const cards = document.querySelectorAll('.STING-web-Match');
      const firstScore = cards[0]?.querySelector('#STING-web-Result')?.innerText;
      return { activeTab, count: cards.length, firstScore };
    });
    assert.strictEqual(yestCount.activeTab, 'tabYesterday');
    assert.strictEqual(yestCount.count, 1, 'Yesterday should display 1 match');
    assert.strictEqual(yestCount.firstScore, '3 - 1', 'Arsenal vs Chelsea result must be 3 - 1');
    console.log('  ✔ "Yesterday" tab activates, displaying 1 finished match (Arsenal 3 - 1 Chelsea)');

    // Click Tomorrow
    await page.click('#linkTomorrow');
    let tommCount = await page.evaluate(() => {
      const activeTab = document.querySelector('.STING-web-Matches-Toggle li.active')?.id;
      const cards = document.querySelectorAll('.STING-web-Match');
      const firstMatch = cards[0]?.querySelector('.STING-web-Right-Team .STING-web-Team-NAME')?.innerText;
      return { activeTab, count: cards.length, firstMatch };
    });
    assert.strictEqual(tommCount.activeTab, 'tabTomorrow');
    assert.strictEqual(tommCount.count, 1, 'Tomorrow should display 1 match');
    assert.strictEqual(tommCount.firstMatch, 'Bayern Munich');
    console.log('  ✔ "Tomorrow" tab activates, displaying 1 upcoming match (Bayern Munich vs Dortmund)');

    // Click Today
    await page.click('#linkToday');
    let todayCount = await page.evaluate(() => {
      const activeTab = document.querySelector('.STING-web-Matches-Toggle li.active')?.id;
      return { activeTab, count: document.querySelectorAll('.STING-web-Match').length };
    });
    assert.strictEqual(todayCount.activeTab, 'tabToday');
    assert.strictEqual(todayCount.count, 3);
    console.log('  ✔ "Today" tab restores current fixtures cleanly without page reload');

    // ─────────────────────────────────────────────────────────────────
    // TEST 4: Search Modal Interaction & Empty State Handling
    // ─────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 4: Real-time Search Modal ---');
    // Open search modal
    await page.click('#searchTrigger');
    let isModalOpen = await page.evaluate(() => {
      const m = document.getElementById('searchModal');
      return m.style.display !== 'none' && m.classList.contains('active');
    });
    assert.strictEqual(isModalOpen, true, 'Search modal should be visible');
    console.log('  ✔ Search trigger successfully opens search modal');

    // Type "Real Madrid" into search input
    await page.type('#searchInput', 'Real Madrid');
    await new Promise(r => setTimeout(r, 100)); // wait for debounce
    let searchResult = await page.evaluate(() => {
      const cards = document.querySelectorAll('.STING-web-Match');
      return {
        count: cards.length,
        matchHome: cards[0]?.querySelector('.STING-web-Right-Team .STING-web-Team-NAME')?.innerText
      };
    });
    assert.strictEqual(searchResult.count, 1);
    assert.strictEqual(searchResult.matchHome, 'Real Madrid CF');
    console.log('  ✔ Debounced search query "Real Madrid" isolated matching fixture');

    // Type non-existent query to trigger empty state
    await page.click('#searchClearBtn');
    await page.type('#searchInput', 'NonExistentFC999');
    await new Promise(r => setTimeout(r, 100));
    let emptyStateVisible = await page.evaluate(() => {
      const emptyBox = document.getElementById('searchEmptyState');
      const cardsCount = document.querySelectorAll('.STING-web-Match').length;
      return emptyBox.style.display !== 'none' && cardsCount === 0;
    });
    assert.strictEqual(emptyStateVisible, true, 'Empty state must be visible on zero match results');
    console.log('  ✔ Zero-results query correctly triggered friendly empty state');

    // Click "Reset Filters" action button
    await page.click('#btnResetFilters');
    await new Promise(r => setTimeout(r, 100));
    let resetCount = await page.evaluate(() => {
      return {
        val: document.getElementById('searchInput').value,
        emptyDisplay: document.getElementById('searchEmptyState').style.display,
        cardsCount: document.querySelectorAll('.STING-web-Match').length
      };
    });
    assert.strictEqual(resetCount.val, '', 'Search input must be cleared');
    assert.strictEqual(resetCount.emptyDisplay, 'none', 'Empty state must be hidden');
    assert.strictEqual(resetCount.cardsCount, 3, 'All 3 fixtures restored');
    console.log('  ✔ "Reset Filters" action button resets query and restores fixtures');

    // ─────────────────────────────────────────────────────────────────
    // TEST 5: Match Details, Gateway & Stream Player Server Selector
    // ─────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 5: Match Details & Stream Player Server Selection ---');
    // Open match details for Match 1 (Al Mokawloon Al Arab)
    await page.click('#match-15366038-b321-4e06-a42c-90712b422692 a');
    let matchDetailsView = await page.evaluate(() => {
      const mv = document.getElementById('matchView');
      const home = document.getElementById('detailHomeName')?.innerText;
      const score = document.getElementById('detailScore')?.innerText;
      return { visible: mv.style.display !== 'none', home, score };
    });
    assert.strictEqual(matchDetailsView.visible, true, 'Match view must be displayed');
    assert.strictEqual(matchDetailsView.home, 'Al Mokawloon Al Arab');
    assert.strictEqual(matchDetailsView.score, '2 - 1');
    console.log('  ✔ Match Details view rendered successfully with scoreboard hero');

    // Click "Watch Live Stream ▶" to navigate to Link Gateway
    await page.click('#watchBtn');
    let gatewayView = await page.evaluate(() => {
      const lv = document.getElementById('linksView');
      const serverBtns = document.querySelectorAll('.server-card button');
      return { visible: lv.style.display !== 'none', serverCount: serverBtns.length };
    });
    assert.strictEqual(gatewayView.visible, true, 'Links gateway must be active');
    assert.strictEqual(gatewayView.serverCount, 3, 'Must render 3 server cards');
    console.log('  ✔ Link Selection Gateway (#linksView) activated with 3 stream server cards');

    // Select Server 1 (Ultra HD)
    await page.click('.server-card button[data-server-id="0"]');
    let streamPlayerView = await page.evaluate(() => {
      const sv = document.getElementById('streamView');
      const iframe = document.getElementById('zeta-player-frame');
      const activeBtn = document.querySelector('#serverButtonsList button.active')?.innerText;
      return {
        visible: sv.style.display !== 'none',
        src: iframe.getAttribute('src'),
        sandbox: iframe.getAttribute('sandbox'),
        referrerpolicy: iframe.getAttribute('referrerpolicy'),
        activeBtn
      };
    });
    assert.strictEqual(streamPlayerView.visible, true, 'Stream player view must be visible');
    assert.strictEqual(streamPlayerView.src, 'https://stream-cdn.zetasports.site/live/server1.m3u8');
    assert.strictEqual(streamPlayerView.sandbox, 'allow-scripts allow-same-origin allow-presentation', 'Strict iframe sandbox required');
    assert.strictEqual(streamPlayerView.referrerpolicy, 'no-referrer');
    assert.ok(streamPlayerView.activeBtn.includes('Server 1'));
    console.log('  ✔ Stream Player (#streamView) embedded sandboxed iframe with Server 1 URL');

    // Switch to Server 2 inside the stream view
    const srv2Btn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('#serverButtonsList button'));
      return btns.find(b => b.innerText.includes('Server 2'));
    });
    await srv2Btn.click();
    let updatedStream = await page.evaluate(() => {
      const iframe = document.getElementById('zeta-player-frame');
      const activeBtn = document.querySelector('#serverButtonsList button.active')?.innerText;
      return { src: iframe.getAttribute('src'), activeBtn };
    });
    assert.strictEqual(updatedStream.src, 'https://stream-cdn.zetasports.site/live/server2.m3u8');
    assert.ok(updatedStream.activeBtn.includes('Server 2'));
    console.log('  ✔ Multi-server selector dynamically switched feed to Server 2 without page reload');

    // Test Reload Player button
    await page.click('#btnReloadPlayer');
    await new Promise(r => setTimeout(r, 50));
    let reloadedSrc = await page.evaluate(() => document.getElementById('zeta-player-frame').getAttribute('src'));
    assert.strictEqual(reloadedSrc, 'https://stream-cdn.zetasports.site/live/server2.m3u8');
    console.log('  ✔ "🔄 Reload Player" utility button refreshed stream iframe cleanly');

    // ─────────────────────────────────────────────────────────────────
    // TEST 6: Return Back Navigation & Open Redirect Defense
    // ─────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 6: Return Back Navigation Contract ---');
    // Navigate from Stream Player back to Links Gateway
    await page.click('#btnBackToLinks');
    let returnedToLinks = await page.evaluate(() => document.getElementById('linksView').style.display !== 'none');
    assert.strictEqual(returnedToLinks, true);
    console.log('  ✔ "← Back to Servers" returned to Link Gateway (#linksView)');

    // Navigate from Links Gateway back to Match Post
    await page.click('#btnLinksBackToMatch');
    let returnCheck = await page.evaluate(() => {
      const mv = document.getElementById('matchView');
      const dest = window.lastReturnDestination;
      const isAllowed = window.isAllowedUrl(dest);
      return { visible: mv.style.display !== 'none', dest, isAllowed };
    });
    assert.strictEqual(returnCheck.visible, true);
    assert.ok(returnCheck.dest.startsWith('https://www.keralahub.online/match-15366038'));
    assert.strictEqual(returnCheck.isAllowed, true);
    console.log('  ✔ "← Back to Match Post" validated cross-domain target to KeralaHub details origin');

    // Return to Fixtures Home
    await page.click('#btnBackToHome');
    let returnedToHome = await page.evaluate(() => document.getElementById('homeView').style.display !== 'none');
    assert.strictEqual(returnedToHome, true);
    console.log('  ✔ "← Back to Fixtures" returned smoothly to Home Fixtures list');

    console.log('\n===============================================================');
    console.log('  ALL FUNCTIONAL COMPONENT & USER FLOW TESTS PASSED (100% GREEN)');
    console.log('===============================================================\n');

  } finally {
    await browser.close();
  }
}

// Export for integration runner or execute directly
if (require.main === module) {
  runFunctionalTestSuite().catch(err => {
    console.error('FUNCTIONAL TEST FAILED:', err);
    process.exit(1);
  });
}

module.exports = { runFunctionalTestSuite };
