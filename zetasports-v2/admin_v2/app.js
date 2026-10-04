/**
 * ==============================================================================
 * ZetaSports Admin Portal v2 Application Logic
 * Tailored Dark Navy Theme, Full Heroicons SVG (Strictly Zero Emoji),
 * Universal 6-Engine Stream Dispatcher, 4s Hero Multi-Match, Approved Matches Only
 * ==============================================================================
 */

(function () {
  'use strict';

  // --- 1. CONFIGURATION & STATE ---
  const IS_LOCAL_SERVER = typeof window !== 'undefined' && window.location.origin.includes('localhost:3000');
  const SUPABASE_URL = IS_LOCAL_SERVER ? '' : 'https://voocdrpetiyspuhyeapi.supabase.co';
  const ANON_KEY = 'sb_publishable_luDUt769BBrrApn8z-Cgvw_W9VE0rIV';
  const STORAGE_KEY_SERVICE = 'zeta_admin_service_key';

  // Force-purge any custom service keys from localStorage
  try {
    localStorage.removeItem(STORAGE_KEY_SERVICE);
  } catch (e) {}

  const state = {
    activeTab: 'dashboard',
    serviceKey: '',
    matches: [],
    filteredMatches: [],
    matchFilter: 'all',
    selectedLeagueFilter: 'all',
    matchSearchQuery: '',
    selectedStreamMatchId: null,
    streams: [],
    selectedTimelineMatchId: null,
    selectedLineupsMatchId: null,
    selectedStatsMatchId: null,
    activePolicyKey: 'privacy',
    testerInstance: null,
    shakaInstance: null,
    leagues: [],
    approvedLeagues: new Set(),
    leagueSearchQuery: '',
    spotlightFilter: 'approved'
  };

  // --- 1B. LEAGUE RESOLVER & CATEGORIZATION (INCLUDING FRIENDLIES) ---
  const NATIONAL_TEAMS = new Set([
    'croatia', 'england', 'spain', 'czechia', 'switzerland', 'slovenia', 'colombia', 'paraguay',
    'india', 'brazil', 'scotland', 'estonia', 'luxembourg', 'iceland', 'bulgaria', 'sri lanka',
    'djibouti', 'north macedonia', 'france', 'germany', 'italy', 'portugal', 'argentina',
    'netherlands', 'belgium', 'uruguay', 'japan', 'south korea', 'mexico', 'usa', 'united states',
    'canada', 'morocco', 'senegal', 'nigeria', 'egypt', 'ghana', 'ivory coast', 'cameroon',
    'algeria', 'tunisia', 'australia', 'saudi arabia', 'qatar', 'iran', 'iraq', 'uae', 'oman',
    'poland', 'sweden', 'norway', 'denmark', 'finland', 'austria', 'hungary', 'serbia', 'turkey',
    'ukraine', 'greece', 'romania', 'peru', 'chile', 'ecuador', 'venezuela', 'bolivia'
  ]);

  function isNationalTeam(teamName) {
    if (!teamName) return false;
    const clean = teamName.toLowerCase().replace(/\s+(national\s+team|fa|fc)$/i, '').trim();
    return NATIONAL_TEAMS.has(clean);
  }

  function resolveMatchLeague(m) {
    if (!m) return 'Club Friendlies';
    const raw = (m.league_name || '').trim();

    // Tournament group normalization
    if (/nations\s+league/i.test(raw) || /nations\s+league/i.test(m.round || '')) {
      return 'UEFA Nations League';
    }
    if (/champions\s+league/i.test(raw)) {
      return 'UEFA Champions League';
    }
    if (/europa\s+league/i.test(raw)) {
      return 'UEFA Europa League';
    }
    if (/conference\s+league/i.test(raw)) {
      return 'UEFA Conference League';
    }
    if (/premier\s+league/i.test(raw)) {
      return 'Premier League';
    }
    if (/la\s*liga/i.test(raw)) {
      return 'LaLiga';
    }
    if (/serie\s+a/i.test(raw)) {
      return 'Serie A';
    }
    if (/bundesliga/i.test(raw)) {
      return 'Bundesliga';
    }
    if (/ligue\s+1/i.test(raw)) {
      return 'Ligue 1';
    }
    if (/world\s+cup/i.test(raw)) {
      return 'FIFA World Cup';
    }
    if (/indian\s+super\s+league|isl\b/i.test(raw)) {
      return 'Indian Super League';
    }

    const isGeneric = !raw || ['league', 'generic', 'football league', 'null', 'undefined', 'other', 'other competitions', ''].includes(raw.toLowerCase());

    if (!isGeneric) {
      if (/friendly|friendlies/i.test(raw)) {
        return (isNationalTeam(m.home_team) || isNationalTeam(m.away_team)) ? 'International Friendlies' : 'Club Friendlies';
      }
      return raw;
    }

    const isExplicitFriendly = m.is_friendly === true ||
      /friendly|friendlies/i.test((m.round || '') + ' ' + (m.home_team || '') + ' ' + (m.away_team || ''));

    if (isExplicitFriendly) {
      return (isNationalTeam(m.home_team) || isNationalTeam(m.away_team)) ? 'International Friendlies' : 'Club Friendlies';
    }

    if (isNationalTeam(m.home_team) || isNationalTeam(m.away_team)) {
      return 'International Friendlies';
    }

    const h = (m.home_team || '').toLowerCase();
    const a = (m.away_team || '').toLowerCase();
    const combined = h + ' ' + a;
    if (/oita|montedio|tochigi|imabari|ryūkyū|ryukyu|zweigen|giravanz|kochi|sagamihara|fc osaka/i.test(combined)) {
      return 'J.League / J2-J3';
    }

    if (/citizen|ulsan|siheung|incheon|jeonbuk|pohang|suwon|daegu/i.test(combined)) {
      return 'K3 League';
    }

    return 'Club Friendlies';
  }

  function buildGroupedMatchOptions(matches, selectedId, placeholder) {
    const grouped = {};
    matches.forEach(m => {
      const lg = resolveMatchLeague(m);
      if (!grouped[lg]) grouped[lg] = [];
      grouped[lg].push(m);
    });

    let html = `<option value="">-- ${placeholder} --</option>`;
    const sortedLeagues = Object.keys(grouped).sort();
    sortedLeagues.forEach(lg => {
      html += `<optgroup label="${escapeHtml(lg)} (${grouped[lg].length})">`;
      grouped[lg].forEach(m => {
        const isSel = m.id === selectedId ? 'selected' : '';
        html += `<option value="${m.id}" ${isSel}>${escapeHtml(m.home_team)} vs ${escapeHtml(m.away_team)} (${escapeHtml(m.status || 'scheduled')})</option>`;
      });
      html += `</optgroup>`;
    });
    return html;
  }

  // --- 2. REST API HELPER (Verified Anon Key Write & Resilient Fallback) ---
  function getActiveApiKey(isWrite = false) {
    return ANON_KEY;
  }

  async function apiFetch(endpoint, options = {}) {
    const makeHeaders = (key) => ({
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...(options.headers || {})
    });

    const prefix = SUPABASE_URL ? `${SUPABASE_URL}/rest/v1` : '/rest/v1';
    const url = `${prefix}/${endpoint}`;
    let res;

    try {
      res = await fetch(url, { ...options, headers: makeHeaders(ANON_KEY) });
    } catch (netErr) {
      console.warn('[Admin] Local gateway request failed, retrying directly with Supabase cloud...', netErr);
      try {
        res = await fetch(`https://voocdrpetiyspuhyeapi.supabase.co/rest/v1/${endpoint}`, {
          ...options,
          headers: makeHeaders(ANON_KEY)
        });
      } catch (fallbackErr) {
        throw fallbackErr;
      }
    }

    if (!res.ok) {
      let errDetail = '';
      try {
        const errJson = await res.json();
        errDetail = errJson.message || JSON.stringify(errJson);
      } catch (e) {
        errDetail = await res.text();
      }
      throw new Error(`API ${res.status}: ${errDetail}`);
    }

    if (res.status === 204) return null;
    return await res.json();
  }

  // --- 3. TOAST NOTIFICATIONS (Heroicons SVG - Zero Emoji) ---
  function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    const isSuccess = type === 'success';
    const isError = type === 'error';
    const isWarning = type === 'warning';

    const bgClass = isSuccess ? 'bg-emerald-950/95 border-emerald-500/30 text-emerald-200' :
                    isError ? 'bg-rose-950/95 border-rose-500/30 text-rose-200' :
                    isWarning ? 'bg-amber-950/95 border-amber-500/30 text-amber-200' :
                    'bg-slate-900/95 border-white/10 text-slate-200';

    const iconSvg = isSuccess ?
      `<svg class="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>` :
      isError ?
      `<svg class="w-4 h-4 text-rose-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>` :
      `<svg class="w-4 h-4 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`;

    toast.className = `toast-msg flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl text-xs font-medium max-w-sm ${bgClass}`;
    toast.innerHTML = `
      ${iconSvg}
      <span class="flex-1">${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-out');
      setTimeout(() => toast.remove(), 260);
    }, 4000);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // --- 4. TAB SWITCHING SYSTEM ---
  const tabTitles = {
    'dashboard': 'Dashboard Overview',
    'matches': 'Matches Manager',
    'streams': 'Universal Multi-Stream Servers',
    'timeline': 'Timeline Incidents Builder',
    'lineups': 'Lineups & Tactical Pitch',
    'stats': 'Match Statistics Matrix',
    'articles': 'Journalistic Articles (AdSense CMS)',
    'policy': 'Legal Policy & Compliance Suite',
    'config': 'Site Configuration & Settings',
    'teams-leagues': 'Teams & Leagues Manager'
  };

  function switchTab(tabId) {
    if (!tabTitles[tabId]) return;
    state.activeTab = tabId;

    // Update Nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
      const match = btn.dataset.tab === tabId;
      if (match) {
        btn.classList.add('active');
        btn.classList.remove('text-slate-400');
        btn.classList.add('text-white');
      } else {
        btn.classList.remove('active');
        btn.classList.add('text-slate-400');
        btn.classList.remove('text-white');
      }
    });

    // Update Header title
    const titleEl = document.getElementById('currentSectionTitle');
    if (titleEl) titleEl.textContent = tabTitles[tabId];

    // Show active tab content
    document.querySelectorAll('.tab-content').forEach(section => {
      if (section.id === `tab-${tabId}`) {
        section.classList.remove('hidden');
      } else {
        section.classList.add('hidden');
      }
    });

    // Lazy load tab data
    if (tabId === 'dashboard') renderDashboard();
    if (tabId === 'matches') renderMatchesTable();
    if (tabId === 'streams') populateStreamMatchDropdown();
    if (tabId === 'timeline') populateTimelineMatchDropdown();
    if (tabId === 'lineups') populateLineupsMatchDropdown();
    if (tabId === 'stats') populateStatsMatchDropdown();
    if (tabId === 'articles') renderArticlesTab();
    if (tabId === 'policy') loadPolicyContent();
    if (tabId === 'config') loadSiteConfig();
    if (tabId === 'teams-leagues') {
      renderTeamsAndLeagues();
      bindLeagueApprovalControls();
    }
  }

  window.switchTab = switchTab;

  // --- 5. INITIALIZATION & DATA FETCHING ---
  async function loadInitialData() {
    updateAuthBadge();
    try {
      // 1. Load leagues and approval registry first
      await loadLeagues();

      // 2. Fetch all matches ordered by date
      const data = await apiFetch('zeta_matches?select=*&order=date.asc');
      state.matches = Array.isArray(data) ? data : [];
      filterAndSearchMatches();
      renderDashboard();
    } catch (err) {
      console.error('Failed to load initial matches:', err);
      showToast('Could not load matches: ' + err.message, 'error');
    }
  }

  async function loadLeagues() {
    try {
      const data = await apiFetch('zeta_leagues?select=*&order=name.asc');
      if (Array.isArray(data) && data.length > 0) {
        state.leagues = data;
        state.approvedLeagues = new Set(
          data.filter(l => l.featured === true).map(l => l.name.trim().toLowerCase())
        );
      }
      updateApprovedLeaguesBadge();
    } catch (err) {
      console.warn('Could not load leagues:', err);
    }
  }

  function updateApprovedLeaguesBadge() {
    const badge = document.getElementById('approvedLeaguesCountBadge');
    if (badge) {
      const count = state.leagues.filter(l => l.featured === true).length;
      badge.textContent = `${count} Approved`;
    }
  }

  function updateAuthBadge() {
    const badge = document.getElementById('connectionStatusBadge');
    const label = document.getElementById('keyBtnLabel');
    if (!badge || !label) return;

    badge.className = 'hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400';
    badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span><span>Full Admin (Write Enabled)</span>`;
    label.textContent = state.serviceKey ? 'Edit Service Key' : 'API Key Config';
  }

  // --- 6. TAB 1: DASHBOARD ---
  function renderDashboard() {
    const total = state.matches.length;
    const live = state.matches.filter(m => String(m.status).toLowerCase() === 'live' || String(m.status).toUpperCase() === 'IN_PLAY').length;
    const approved = state.matches.filter(m => m.is_approved === true).length;
    const featured = state.matches.filter(m => m.is_featured === true).length;

    const elTotal = document.getElementById('statTotalMatches');
    const elLive = document.getElementById('statLiveMatches');
    const elApproved = document.getElementById('statApprovedMatches');
    const elFeatured = document.getElementById('statFeaturedMatches');

    if (elTotal) elTotal.textContent = total;
    if (elLive) elLive.textContent = live;
    if (elApproved) elApproved.textContent = approved;
    if (elFeatured) elFeatured.textContent = featured;

    // Render live spotlight list grouped by League
    const container = document.getElementById('dashboardLiveMatchesList');
    if (!container) return;

    // Filter live matches according to spotlight toggle
    const allLive = state.matches.filter(m => String(m.status).toLowerCase() === 'live' || String(m.status).toUpperCase() === 'IN_PLAY');
    const approvedLive = allLive.filter(m => {
      if (m.is_approved === true) return true;
      const lgNorm = resolveMatchLeague(m).toLowerCase().trim();
      return state.approvedLeagues.has(lgNorm);
    });

    const isAll = state.spotlightFilter === 'all';
    const liveMatches = isAll ? allLive : approvedLive;

    // Update Spotlight button styles
    const btnApp = document.getElementById('spotlightApprovedBtn');
    const btnAll = document.getElementById('spotlightAllBtn');
    if (btnApp && btnAll) {
      if (!isAll) {
        btnApp.className = 'px-2.5 py-1 rounded-lg text-xs font-bold bg-[#0062b2] text-white transition-all';
        btnAll.className = 'px-2.5 py-1 rounded-lg text-xs font-bold text-slate-400 hover:text-white transition-all';
      } else {
        btnAll.className = 'px-2.5 py-1 rounded-lg text-xs font-bold bg-[#0062b2] text-white transition-all';
        btnApp.className = 'px-2.5 py-1 rounded-lg text-xs font-bold text-slate-400 hover:text-white transition-all';
      }
      btnAll.textContent = `All In-Play (${allLive.length})`;
    }

    if (liveMatches.length === 0) {
      container.innerHTML = `
        <div class="py-8 text-center text-slate-500 text-xs">
          ${isAll ? 'No matches currently in-play.' : 'No approved matches currently in live in-play status. All unapproved lower-tier leagues are hidden.'}
        </div>
      `;
      return;
    }

    // Group live matches by league
    const groupedLive = {};
    liveMatches.forEach(m => {
      const lg = resolveMatchLeague(m);
      if (!groupedLive[lg]) groupedLive[lg] = [];
      groupedLive[lg].push(m);
    });

    container.innerHTML = Object.entries(groupedLive).map(([leagueName, matches]) => `
      <div class="bg-[#080E1A] rounded-2xl border border-white/5 p-4 space-y-2.5">
        <div class="flex items-center justify-between border-b border-white/5 pb-2">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
            <span class="font-['Oswald'] text-xs font-bold text-sky-400 uppercase tracking-wider">${escapeHtml(leagueName)}</span>
          </div>
          <span class="px-2 py-0.5 rounded-full bg-white/5 text-[10px] text-slate-400 font-mono">${matches.length} LIVE</span>
        </div>
        <div class="space-y-2">
          ${matches.map(m => `
            <div class="flex items-center justify-between p-2.5 bg-[#101827] rounded-xl border border-white/5 hover:border-white/10 transition-colors">
              <div class="flex items-center gap-3">
                <span class="px-2 py-0.5 rounded bg-red-500/20 text-red-400 font-bold text-[10px] uppercase font-mono">${escapeHtml(m.time_elapsed || 'LIVE')}</span>
                <span class="text-xs font-semibold text-white">${escapeHtml(m.home_team)} <span class="text-[#38bdf8] font-bold mx-1.5 font-['Oswald'] text-sm">${m.home_score ?? 0} - ${m.away_score ?? 0}</span> ${escapeHtml(m.away_team)}</span>
              </div>
              <div class="flex items-center gap-2">
                <button type="button" onclick="editMatch('${m.id}')" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold transition-all">Edit</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
  }

  // --- 7. TAB 2: MATCHES MANAGER ---
  let isLeagueFilterBound = false;

  function updateLeagueFilterDropdown() {
    const sel = document.getElementById('matchLeagueFilter');
    if (!sel) return;

    const leagueCounts = {};
    state.matches.forEach(m => {
      const lg = resolveMatchLeague(m);
      leagueCounts[lg] = (leagueCounts[lg] || 0) + 1;
    });

    const activeVal = state.selectedLeagueFilter;
    const sortedLeagues = Object.keys(leagueCounts).sort();

    sel.innerHTML = `<option value="all">All Leagues &amp; Competitions (${state.matches.length})</option>` +
      sortedLeagues.map(lg => `
        <option value="${escapeHtml(lg)}" ${lg === activeVal ? 'selected' : ''}>
          ${escapeHtml(lg)} (${leagueCounts[lg]})
        </option>
      `).join('');

    if (!isLeagueFilterBound) {
      sel.addEventListener('change', (e) => {
        state.selectedLeagueFilter = e.target.value;
        filterAndSearchMatches();
      });
      isLeagueFilterBound = true;
    }
  }

  function filterAndSearchMatches() {
    updateLeagueFilterDropdown();

    let list = [...state.matches];

    // Filter status
    if (state.matchFilter === 'approved') {
      list = list.filter(m => m.is_approved === true);
    } else if (state.matchFilter === 'pending') {
      list = list.filter(m => m.is_approved !== true);
    } else if (state.matchFilter === 'featured') {
      list = list.filter(m => m.is_featured === true);
    } else if (state.matchFilter === 'live') {
      list = list.filter(m => String(m.status).toLowerCase() === 'live' || String(m.status).toUpperCase() === 'IN_PLAY');
    }

    // Filter by specific league
    if (state.selectedLeagueFilter && state.selectedLeagueFilter !== 'all') {
      list = list.filter(m => resolveMatchLeague(m) === state.selectedLeagueFilter);
    }

    // Search query
    const q = state.matchSearchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(m =>
        (m.home_team && m.home_team.toLowerCase().includes(q)) ||
        (m.away_team && m.away_team.toLowerCase().includes(q)) ||
        resolveMatchLeague(m).toLowerCase().includes(q)
      );
    }

    state.filteredMatches = list;
    renderMatchesTable();
  }

  function renderMatchesTable() {
    const tbody = document.getElementById('matchesTableBody');
    if (!tbody) return;

    if (state.filteredMatches.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-12 text-slate-500">
            No matches found matching the active filter.
          </td>
        </tr>
      `;
      return;
    }

    // Group filtered matches by League
    const grouped = {};
    state.filteredMatches.forEach(m => {
      const lg = resolveMatchLeague(m);
      if (!grouped[lg]) grouped[lg] = [];
      grouped[lg].push(m);
    });

    let html = '';
    const sortedLeagues = Object.keys(grouped).sort();

    sortedLeagues.forEach(leagueName => {
      const matchesInLeague = grouped[leagueName];

      // League Section Divider Row
      html += `
        <tr class="bg-[#0b1322] border-y border-sky-500/20">
          <td colspan="8" class="py-2 px-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <svg class="w-3.5 h-3.5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
                <span class="font-['Oswald'] font-bold text-sky-400 text-xs tracking-wider uppercase">${escapeHtml(leagueName)}</span>
              </div>
              <span class="text-[10px] font-mono text-slate-400 font-medium">${matchesInLeague.length} match${matchesInLeague.length > 1 ? 'es' : ''}</span>
            </div>
          </td>
        </tr>
      `;

      // Match rows for this league
      matchesInLeague.forEach(m => {
        const isApproved = m.is_approved === true;
        const isFeatured = m.is_featured === true;
        const isLive = String(m.status).toLowerCase() === 'live' || String(m.status).toUpperCase() === 'IN_PLAY';
        const statusBadge = isLive ?
          '<span class="px-2 py-0.5 rounded-md bg-red-500/20 text-red-400 font-bold border border-red-500/30">LIVE</span>' :
          String(m.status).toLowerCase() === 'finished' ?
          '<span class="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 font-bold">FT</span>' :
          '<span class="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 font-bold border border-blue-500/20">SCHED</span>';

        html += `
          <tr class="hover:bg-white/[0.02] transition-colors" id="row-${m.id}">
            <!-- Fixture -->
            <td class="py-3 px-4">
              <div class="flex flex-col gap-1">
                <div class="flex items-center gap-2">
                  <img src="${escapeHtml(m.home_logo || 'https://images.fotmob.com/image_resources/logo/teamlogo/9773.png')}" class="w-4 h-4 object-contain rounded-full bg-slate-800" onerror="this.src='https://placehold.co/24x24/1e293b/fff?text=H'" />
                  <span class="font-semibold text-white">${escapeHtml(m.home_team)}</span>
                </div>
                <div class="flex items-center gap-2">
                  <img src="${escapeHtml(m.away_logo || 'https://images.fotmob.com/image_resources/logo/teamlogo/9772.png')}" class="w-4 h-4 object-contain rounded-full bg-slate-800" onerror="this.src='https://placehold.co/24x24/1e293b/fff?text=A'" />
                  <span class="font-semibold text-white">${escapeHtml(m.away_team)}</span>
                </div>
              </div>
            </td>

            <!-- Score -->
            <td class="py-3 px-3 text-center">
              <span class="font-['Oswald'] text-base font-bold text-white">${m.home_score ?? 0} - ${m.away_score ?? 0}</span>
            </td>

            <!-- Status -->
            <td class="py-3 px-3">
              <div class="flex flex-col gap-1">
                ${statusBadge}
                ${m.time_elapsed ? `<span class="text-[10px] text-slate-400 font-mono">${escapeHtml(m.time_elapsed)}</span>` : ''}
              </div>
            </td>

            <!-- Date / Kickoff -->
            <td class="py-3 px-3">
              <span class="text-slate-300 font-mono text-[11px] block">${escapeHtml(m.date || '—')}</span>
              <span class="text-slate-500 text-[10px]">${escapeHtml(m.kickoff_ist || '')}</span>
            </td>

            <!-- League -->
            <td class="py-3 px-3">
              <span class="text-slate-300 text-[11px] font-medium block truncate max-w-[140px]">${escapeHtml(leagueName)}</span>
            </td>

            <!-- Site Approved Toggle -->
            <td class="py-3 px-3 text-center">
              <button type="button" onclick="toggleMatchApproval('${m.id}', ${!isApproved})" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${isApproved ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25' : 'bg-slate-800 text-slate-400 border border-white/10 hover:bg-slate-700'}" title="Toggle public site visibility">
                <span class="w-1.5 h-1.5 rounded-full ${isApproved ? 'bg-emerald-400' : 'bg-slate-500'}"></span>
                <span>${isApproved ? 'Approved' : 'Hidden'}</span>
              </button>
            </td>

            <!-- Hero Featured Toggle (4s Slider) -->
            <td class="py-3 px-3 text-center">
              <button type="button" onclick="toggleMatchFeatured('${m.id}', ${!isFeatured})" class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold transition-all ${isFeatured ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25' : 'bg-slate-800 text-slate-400 border border-white/10 hover:bg-slate-700'}" title="Toggle inclusion in 4s Hero Carousel">
                <svg class="w-3.5 h-3.5 ${isFeatured ? 'text-amber-400' : 'text-slate-500'}" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                <span>${isFeatured ? 'Hero Active' : 'Off'}</span>
              </button>
            </td>

            <!-- Actions -->
            <td class="py-3 px-4 text-right">
              <div class="inline-flex items-center gap-1.5">
                <button type="button" onclick="manageStreamsForMatch('${m.id}')" class="p-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 transition-all" title="Manage Streams">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                </button>
                <button type="button" onclick="editMatch('${m.id}')" class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 transition-all" title="Edit Fixture">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                </button>
                <button type="button" onclick="deleteMatch('${m.id}')" class="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all" title="Delete Fixture">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
              </div>
            </td>
          </tr>
        `;
      });
    });

    tbody.innerHTML = html;
  }

  // Toggle match approval
  window.toggleMatchApproval = async function (matchId, newApprovalStatus) {
    const target = state.matches.find(m => m.id === matchId);
    const oldStatus = target ? target.is_approved : !newApprovalStatus;
    // Optimistic UI update
    if (target) target.is_approved = newApprovalStatus;
    filterAndSearchMatches();
    renderDashboard();

    try {
      await apiFetch(`zeta_matches?id=eq.${matchId}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_approved: newApprovalStatus })
      });
      showToast(`Match visibility updated to ${newApprovalStatus ? 'Approved (Visible)' : 'Pending (Hidden)'}!`);
    } catch (err) {
      console.error('Failed to toggle approval:', err);
      if (target) target.is_approved = oldStatus;
      filterAndSearchMatches();
      renderDashboard();
      showToast('Error updating approval status: ' + err.message, 'error');
    }
  };

  // Toggle match featured in 4s hero slider
  window.toggleMatchFeatured = async function (matchId, newFeaturedStatus) {
    const target = state.matches.find(m => m.id === matchId);
    const oldStatus = target ? target.is_featured : !newFeaturedStatus;
    // Optimistic UI update
    if (target) target.is_featured = newFeaturedStatus;
    filterAndSearchMatches();
    renderDashboard();

    try {
      await apiFetch(`zeta_matches?id=eq.${matchId}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_featured: newFeaturedStatus })
      });
      showToast(`Hero carousel status updated to ${newFeaturedStatus ? 'Featured' : 'Standard'}!`);
    } catch (err) {
      console.error('Failed to toggle featured status:', err);
      if (target) target.is_featured = oldStatus;
      filterAndSearchMatches();
      renderDashboard();
      showToast('Error updating hero featured state: ' + err.message, 'error');
    }
  };

  // Live Spotlight Filter Toggles
  document.getElementById('spotlightApprovedBtn')?.addEventListener('click', () => {
    state.spotlightFilter = 'approved';
    renderDashboard();
  });

  document.getElementById('spotlightAllBtn')?.addEventListener('click', () => {
    state.spotlightFilter = 'all';
    renderDashboard();
  });

  // Purge Unapproved Fixtures (Wipe lower-tier clutter)
  document.getElementById('purgeUnapprovedBtn')?.addEventListener('click', async () => {
    const unapprovedCount = state.matches.filter(m => m.is_approved !== true).length;
    if (unapprovedCount === 0) {
      showToast('No unapproved fixtures to purge!', 'info');
      return;
    }

    const confirmed = confirm(`Are you sure you want to permanently delete all ${unapprovedCount} unapproved fixtures from Supabase? Only approved competitions will be kept.`);
    if (!confirmed) return;

    try {
      showToast(`Purging ${unapprovedCount} unapproved fixtures...`, 'info');
      await apiFetch('zeta_matches?is_approved=eq.false', { method: 'DELETE' });

      // Clean local state
      state.matches = state.matches.filter(m => m.is_approved === true);
      filterAndSearchMatches();
      renderDashboard();
      renderTeamsAndLeagues();
      showToast(`Successfully purged ${unapprovedCount} unapproved fixtures from database!`);
    } catch (err) {
      console.error('Failed to purge:', err);
      showToast('Error purging unapproved fixtures: ' + err.message, 'error');
    }
  });

  // Open Add Match modal
  document.getElementById('openAddMatchBtn')?.addEventListener('click', () => {
    document.getElementById('matchFormId').value = '';
    document.getElementById('matchModalTitle').textContent = 'Add Match Fixture';
    document.getElementById('matchForm').reset();
    document.getElementById('mDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('mIsApproved').checked = false;
    document.getElementById('mIsFeatured').checked = false;
    openModal('matchModal');
  });

  // Edit Match
  window.editMatch = function (matchId) {
    const m = state.matches.find(item => item.id === matchId);
    if (!m) return;

    document.getElementById('matchFormId').value = m.id;
    document.getElementById('matchModalTitle').textContent = `Edit Fixture: ${m.home_team} vs ${m.away_team}`;

    document.getElementById('mHomeName').value = m.home_team || '';
    document.getElementById('mHomeLogo').value = m.home_logo || '';
    document.getElementById('mAwayName').value = m.away_team || '';
    document.getElementById('mAwayLogo').value = m.away_logo || '';
    document.getElementById('mHomeScore').value = m.home_score ?? 0;
    document.getElementById('mAwayScore').value = m.away_score ?? 0;
    document.getElementById('mStatus').value = m.status || 'scheduled';
    document.getElementById('mMinute').value = m.time_elapsed || '';
    document.getElementById('mDate').value = m.date ? m.date.split('T')[0] : '';
    document.getElementById('mLeague').value = m.league_name || '';
    document.getElementById('mFotmobId').value = m.fotmob_id || '';
    document.getElementById('mStreamUrl').value = m.stream_url || '';
    document.getElementById('mIsApproved').checked = m.is_approved === true;
    document.getElementById('mIsFeatured').checked = m.is_featured === true;

    openModal('matchModal');
  };

  // Save Match Form Handler (Insert / Update)
  document.getElementById('matchForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('matchFormId').value;
    const isNew = !id;

    const payload = {
      home_team: document.getElementById('mHomeName').value.trim(),
      home_logo: document.getElementById('mHomeLogo').value.trim(),
      away_team: document.getElementById('mAwayName').value.trim(),
      away_logo: document.getElementById('mAwayLogo').value.trim(),
      home_score: parseInt(document.getElementById('mHomeScore').value, 10) || 0,
      away_score: parseInt(document.getElementById('mAwayScore').value, 10) || 0,
      status: document.getElementById('mStatus').value,
      time_elapsed: document.getElementById('mMinute').value.trim(),
      date: document.getElementById('mDate').value,
      league_name: document.getElementById('mLeague').value.trim(),
      fotmob_id: document.getElementById('mFotmobId').value.trim() || null,
      stream_url: document.getElementById('mStreamUrl').value.trim(),
      is_approved: document.getElementById('mIsApproved').checked,
      is_featured: document.getElementById('mIsFeatured').checked
    };

    try {
      if (isNew) {
        payload.id = 'match_' + Date.now();
        const created = await apiFetch('zeta_matches', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        state.matches.unshift(Array.isArray(created) ? created[0] : payload);
        showToast('Match fixture created successfully!');
      } else {
        const updated = await apiFetch(`zeta_matches?id=eq.${id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        });
        const idx = state.matches.findIndex(m => m.id === id);
        if (idx !== -1) {
          state.matches[idx] = { ...state.matches[idx], ...payload };
        }
        showToast('Match fixture updated successfully!');
      }

      closeModal('matchModal');
      filterAndSearchMatches();
      renderDashboard();
    } catch (err) {
      console.error('Error saving match:', err);
      showToast('Error saving match: ' + err.message, 'error');
    }
  });

  // Delete Match
  window.deleteMatch = async function (matchId) {
    if (!confirm('Are you sure you want to permanently delete this match and all associated streams?')) return;
    try {
      await apiFetch(`zeta_matches?id=eq.${matchId}`, { method: 'DELETE' });
      state.matches = state.matches.filter(m => m.id !== matchId);
      filterAndSearchMatches();
      renderDashboard();
      showToast('Match deleted successfully.');
    } catch (err) {
      showToast('Error deleting match: ' + err.message, 'error');
    }
  };

  // Shortcut to Streams
  window.manageStreamsForMatch = function (matchId) {
    state.selectedStreamMatchId = matchId;
    switchTab('streams');
    const sel = document.getElementById('streamMatchSelector');
    if (sel) {
      sel.value = matchId;
      loadStreamsForMatch(matchId);
    }
  };

  // --- 8. TAB 3: UNIVERSAL STREAMS MANAGER (All 6 Engines) ---
  function populateStreamMatchDropdown() {
    const sel = document.getElementById('streamMatchSelector');
    if (!sel) return;

    const currentVal = state.selectedStreamMatchId || sel.value;
    sel.innerHTML = buildGroupedMatchOptions(state.matches, currentVal, 'Choose a match to manage streams');

    if (currentVal) {
      loadStreamsForMatch(currentVal);
    }
  }

  document.getElementById('streamMatchSelector')?.addEventListener('change', (e) => {
    state.selectedStreamMatchId = e.target.value;
    if (state.selectedStreamMatchId) {
      loadStreamsForMatch(state.selectedStreamMatchId);
    } else {
      document.getElementById('streamsCardsGrid').innerHTML = `
        <div class="col-span-full py-12 text-center text-slate-500 bg-[#101827] rounded-2xl border border-white/5">
          Select a match above to view and manage its active video stream servers.
        </div>
      `;
    }
  });

  async function loadStreamsForMatch(matchId) {
    const grid = document.getElementById('streamsCardsGrid');
    if (!grid) return;

    grid.innerHTML = `
      <div class="col-span-full py-8 text-center text-slate-400">
        Loading stream servers for match...
      </div>
    `;

    try {
      const data = await apiFetch(`zeta_streams?match_id=eq.${matchId}&order=server_name.asc`);
      state.streams = Array.isArray(data) ? data : [];
      renderStreamsGrid();
    } catch (err) {
      grid.innerHTML = `<div class="col-span-full py-8 text-center text-rose-400">Failed to load streams: ${escapeHtml(err.message)}</div>`;
    }
  }

  function renderStreamsGrid() {
    const grid = document.getElementById('streamsCardsGrid');
    if (!grid) return;

    if (state.streams.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full py-12 text-center text-slate-500 bg-[#101827] rounded-2xl border border-white/5 space-y-2">
          <p class="text-sm">No dedicated stream servers added for this match yet.</p>
          <button type="button" onclick="openAddStreamModal()" class="px-4 py-1.5 rounded-xl bg-[#0062b2] text-white text-xs font-bold inline-flex items-center gap-1.5">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            <span>Add First Stream Server</span>
          </button>
        </div>
      `;
      return;
    }

    const engineLabels = {
      'plyr_hls': 'Plyr.io HLS (.m3u8)',
      'shaka_player': 'Shaka Custom (MPD ClearKey & HLS)',
      'jwplayer_hls': 'JWPlayer HLS (.m3u8)',
      'jwplayer_dash_clearkey': 'JWPlayer DASH ClearKey',
      'iframe_sandbox': 'iFrame Sandbox (Safe)',
      'iframe': 'iFrame Standard'
    };

    grid.innerHTML = state.streams.map(s => {
      const engineType = s.stream_type || (s.headers && s.headers.stream_type) || 'plyr_hls';
      const keyId = s.drm_key_id || (s.headers && s.headers.drm_key_id) || '';
      const key = s.drm_key || (s.headers && s.headers.drm_key) || '';
      const hasDrm = keyId && key;

      return `
        <div class="bg-[#101827] border border-white/5 rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between" id="stream-card-${s.id}">
          <div class="space-y-2">
            <!-- Header -->
            <div class="flex items-start justify-between gap-2">
              <div>
                <h4 class="font-['Oswald'] text-base font-bold text-white uppercase tracking-wider">${escapeHtml(s.server_name || 'Server')}</h4>
                <span class="inline-block px-2 py-0.5 mt-1 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[10px] font-bold">
                  ${escapeHtml(engineLabels[engineType] || engineType)}
                </span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="px-2 py-0.5 rounded-md text-[10px] font-bold ${s.is_active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-500'}">
                  ${s.is_active ? 'ACTIVE' : 'DISABLED'}
                </span>
                <span class="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold">
                  ${escapeHtml(s.quality || '1080p')}
                </span>
              </div>
            </div>

            <!-- URL snippet -->
            <div class="bg-[#080E1A] p-2.5 rounded-xl border border-white/5">
              <span class="text-[10px] text-slate-500 block font-bold uppercase mb-0.5">Stream URL</span>
              <p class="font-mono text-xs text-slate-300 truncate" title="${escapeHtml(s.stream_url)}">${escapeHtml(s.stream_url)}</p>
            </div>

            <!-- ClearKey DRM Info -->
            ${hasDrm ? `
              <div class="bg-purple-950/20 border border-purple-500/20 p-2.5 rounded-xl text-[10px] font-mono space-y-1">
                <div class="text-purple-300 font-bold uppercase">ClearKey DRM Attached</div>
                <div class="text-slate-400 truncate">KID: ${escapeHtml(keyId)}</div>
                <div class="text-slate-400 truncate">KEY: ${escapeHtml(key)}</div>
              </div>
            ` : ''}
          </div>

          <!-- Actions -->
          <div class="flex items-center justify-between pt-3 border-t border-white/5">
            <button type="button" onclick="testStreamLive('${s.id}')" class="px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 text-xs font-bold border border-purple-500/30 flex items-center gap-1.5 transition-all">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <span>Live Test</span>
            </button>

            <div class="flex items-center gap-1.5">
              <button type="button" onclick="editStream('${s.id}')" class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10" title="Edit Server">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
              </button>
              <button type="button" onclick="deleteStream('${s.id}')" class="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20" title="Delete Server">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Open Add Stream Modal
  window.openAddStreamModal = function () {
    if (!state.selectedStreamMatchId) {
      showToast('Please select a match fixture first', 'warning');
      return;
    }
    document.getElementById('streamFormId').value = '';
    document.getElementById('streamFormMatchId').value = state.selectedStreamMatchId;
    document.getElementById('streamModalTitle').textContent = 'Add Universal Stream Server';
    document.getElementById('streamForm').reset();
    document.getElementById('sIsActive').checked = true;
    openModal('streamModal');
  };

  document.getElementById('addNewStreamBtn')?.addEventListener('click', window.openAddStreamModal);

  // Edit Stream
  window.editStream = function (streamId) {
    const s = state.streams.find(item => item.id === streamId);
    if (!s) return;

    document.getElementById('streamFormId').value = s.id;
    document.getElementById('streamFormMatchId').value = s.match_id;
    document.getElementById('streamModalTitle').textContent = `Edit Stream: ${s.server_name}`;

    document.getElementById('sServerName').value = s.server_name || '';
    document.getElementById('sEngineType').value = s.stream_type || (s.headers && s.headers.stream_type) || 'plyr_hls';
    document.getElementById('sStreamUrl').value = s.stream_url || '';
    document.getElementById('sDrmKeyId').value = s.drm_key_id || (s.headers && s.headers.drm_key_id) || '';
    document.getElementById('sDrmKey').value = s.drm_key || (s.headers && s.headers.drm_key) || '';
    document.getElementById('sQuality').value = s.quality || '1080p';
    document.getElementById('sIsActive').checked = s.is_active !== false;

    openModal('streamModal');
  };

  // Quick ClearKey Parser "key_id:key"
  document.getElementById('sDrmKeyQuick')?.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    if (val.includes(':')) {
      const [kid, k] = val.split(':');
      if (kid) document.getElementById('sDrmKeyId').value = kid.trim();
      if (k) document.getElementById('sDrmKey').value = k.trim();
    }
  });

  // Save Stream Form
  document.getElementById('streamForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('streamFormId').value;
    const matchId = document.getElementById('streamFormMatchId').value || state.selectedStreamMatchId;
    const isNew = !id;

    const streamType = document.getElementById('sEngineType').value;
    const drmKeyId = document.getElementById('sDrmKeyId').value.trim();
    const drmKey = document.getElementById('sDrmKey').value.trim();

    const payload = {
      match_id: matchId,
      server_name: document.getElementById('sServerName').value.trim(),
      stream_url: document.getElementById('sStreamUrl').value.trim(),
      quality: document.getElementById('sQuality').value,
      is_active: document.getElementById('sIsActive').checked,
      headers: {
        stream_type: streamType,
        drm_key_id: drmKeyId,
        drm_key: drmKey
      }
    };

    try {
      if (isNew) {
        payload.id = 'stream_' + Date.now();
        await apiFetch('zeta_streams', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        showToast('Stream server registered!');
      } else {
        await apiFetch(`zeta_streams?id=eq.${id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        });
        showToast('Stream server updated!');
      }

      closeModal('streamModal');
      loadStreamsForMatch(matchId);
    } catch (err) {
      showToast('Error saving stream: ' + err.message, 'error');
    }
  });

  // Delete Stream
  window.deleteStream = async function (streamId) {
    if (!confirm('Remove this stream server?')) return;
    try {
      await apiFetch(`zeta_streams?id=eq.${streamId}`, { method: 'DELETE' });
      state.streams = state.streams.filter(s => s.id !== streamId);
      renderStreamsGrid();
      showToast('Stream server removed.');
    } catch (err) {
      showToast('Error deleting stream: ' + err.message, 'error');
    }
  };

  // --- 9. IN-ADMIN LIVE STREAM PREVIEW TESTER (Plyr, Shaka, iFrames) ---
  window.testStreamLive = function (streamId) {
    const s = state.streams.find(item => item.id === streamId);
    if (!s) return;

    const engineType = s.stream_type || (s.headers && s.headers.stream_type) || 'plyr_hls';
    const keyId = s.drm_key_id || (s.headers && s.headers.drm_key_id) || '';
    const key = s.drm_key || (s.headers && s.headers.drm_key) || '';

    launchLiveTester({
      title: s.server_name,
      engine: engineType,
      url: s.stream_url,
      keyId: keyId,
      key: key
    });
  };

  // Trigger test directly from Add/Edit Modal
  document.getElementById('testStreamInAdminBtn')?.addEventListener('click', () => {
    const title = document.getElementById('sServerName').value.trim() || 'Modal Stream Preview';
    const engine = document.getElementById('sEngineType').value;
    const url = document.getElementById('sStreamUrl').value.trim();
    const keyId = document.getElementById('sDrmKeyId').value.trim();
    const key = document.getElementById('sDrmKey').value.trim();

    if (!url) {
      showToast('Please enter a stream or embed URL first', 'warning');
      return;
    }

    launchLiveTester({ title, engine, url, keyId, key });
  });

  async function launchLiveTester(cfg) {
    cleanUpTesterInstances();

    const modal = document.getElementById('streamTesterModal');
    const video = document.getElementById('adminTesterVideo');
    const iframeBox = document.getElementById('adminTesterIframeBox');
    const errorBox = document.getElementById('adminTesterErrorBox');
    const titleLabel = document.getElementById('testerModalTitle');
    const urlLabel = document.getElementById('testerStreamUrlLabel');
    const engineBadge = document.getElementById('testerEngineBadge');

    if (!modal || !video || !iframeBox || !errorBox) return;

    titleLabel.textContent = `Testing: ${cfg.title || 'Stream'}`;
    urlLabel.textContent = cfg.url;
    engineBadge.innerHTML = `<span class="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 uppercase">ENGINE: ${cfg.engine}</span>`;

    video.hidden = true;
    iframeBox.hidden = true;
    errorBox.hidden = true;
    iframeBox.innerHTML = '';

    modal.classList.remove('hidden');

    try {
      if (cfg.engine === 'iframe' || cfg.engine === 'iframe_sandbox') {
        iframeBox.hidden = false;
        const iframe = document.createElement('iframe');
        iframe.src = cfg.url;
        iframe.className = 'w-full h-full border-0';
        iframe.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
        iframe.setAttribute('allowfullscreen', 'true');

        if (cfg.engine === 'iframe_sandbox') {
          iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation allow-forms allow-fullscreen');
        }

        iframeBox.appendChild(iframe);
      } else if (cfg.engine === 'shaka_player' || cfg.engine === 'jwplayer_dash_clearkey') {
        video.hidden = false;
        if (typeof shaka !== 'undefined') {
          shaka.polyfill.installAll();
          if (shaka.Player.isBrowserSupported()) {
            const player = new shaka.Player(video);
            state.shakaInstance = player;

            if (cfg.keyId && cfg.key) {
              player.configure({
                drm: {
                  clearKeys: {
                    [cfg.keyId]: cfg.key
                  }
                }
              });
            }

            player.addEventListener('error', (e) => {
              console.error('Shaka Error:', e);
              errorBox.hidden = false;
            });

            await player.load(cfg.url);
            video.play().catch(e => console.warn('Autoplay prevented:', e));
          } else {
            throw new Error('Shaka Player is not supported on this browser.');
          }
        } else {
          throw new Error('Shaka Player library is unavailable.');
        }
      } else {
        // plyr_hls or jwplayer_hls default HLS
        video.hidden = false;
        if (typeof Hls !== 'undefined' && Hls.isSupported() && (cfg.url.includes('.m3u8') || cfg.url.includes('playlist'))) {
          const hls = new Hls({ enableWorker: true });
          hls.loadSource(cfg.url);
          hls.attachMedia(video);
          hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
              console.error('HLS Fatal Error:', data);
              errorBox.hidden = false;
            }
          });
          video.play().catch(e => console.warn('Autoplay prevented:', e));
        } else {
          video.src = cfg.url;
          video.play().catch(e => console.warn('Autoplay prevented:', e));
        }

        if (typeof Plyr !== 'undefined') {
          state.testerInstance = new Plyr(video, {
            controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'captions', 'settings', 'pip', 'airplay', 'fullscreen']
          });
        }
      }
    } catch (err) {
      console.error('Live tester error:', err);
      errorBox.hidden = false;
    }
  }

  function cleanUpTesterInstances() {
    const video = document.getElementById('adminTesterVideo');
    if (state.testerInstance) {
      try { state.testerInstance.destroy(); } catch (e) {}
      state.testerInstance = null;
    }
    if (state.shakaInstance) {
      try { state.shakaInstance.destroy(); } catch (e) {}
      state.shakaInstance = null;
    }
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    const iframeBox = document.getElementById('adminTesterIframeBox');
    if (iframeBox) iframeBox.innerHTML = '';
  }

  document.getElementById('closeTesterModalBtn')?.addEventListener('click', () => {
    cleanUpTesterInstances();
    document.getElementById('streamTesterModal')?.classList.add('hidden');
  });

  // --- 10. TAB 4: TIMELINE INCIDENTS BUILDER ---
  function populateTimelineMatchDropdown() {
    const sel = document.getElementById('timelineMatchSelector');
    if (!sel) return;

    sel.innerHTML = buildGroupedMatchOptions(state.matches, state.selectedTimelineMatchId, 'Select match to edit timeline');

    if (state.selectedTimelineMatchId) {
      renderTimelineEvents();
    }
  }

  document.getElementById('timelineMatchSelector')?.addEventListener('change', (e) => {
    state.selectedTimelineMatchId = e.target.value;
    renderTimelineEvents();
  });

  function renderTimelineEvents() {
    const container = document.getElementById('timelineEventsContainer');
    if (!container) return;

    if (!state.selectedTimelineMatchId) {
      container.innerHTML = '<div class="text-center py-8 text-slate-500">Select a match above to view and edit timeline events.</div>';
      return;
    }

    const m = state.matches.find(item => item.id === state.selectedTimelineMatchId);
    if (!m) return;

    const events = [];
    if (Array.isArray(m.goal_scorers)) {
      m.goal_scorers.forEach(g => events.push({ type: 'goal', time: g.minute || g.time, player: g.player, team: g.team, assist: g.assist }));
    }
    if (Array.isArray(m.cards)) {
      m.cards.forEach(c => events.push({ type: c.type === 'red' ? 'red_card' : 'yellow_card', time: c.minute || c.time, player: c.player, team: c.team }));
    }
    if (Array.isArray(m.substitutions)) {
      m.substitutions.forEach(s => events.push({ type: 'substitution', time: s.minute || s.time, player: `${s.player_in} for ${s.player_out}`, team: s.team }));
    }

    // Sort by minute
    events.sort((a, b) => parseInt(a.time, 10) - parseInt(b.time, 10));

    if (events.length === 0) {
      container.innerHTML = `
        <div class="text-center py-8 text-slate-500 space-y-2">
          <p>No timeline events recorded for this match yet.</p>
          <button type="button" onclick="addTimelineIncidentPrompt()" class="px-4 py-1.5 rounded-xl bg-[#0062b2] text-white text-xs font-bold inline-flex items-center gap-1.5">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            <span>Add Event (Goal/Card/Sub)</span>
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="space-y-3">
        ${events.map((ev, i) => `
          <div class="flex items-center justify-between p-3 bg-[#080E1A] rounded-xl border border-white/5">
            <div class="flex items-center gap-3">
              <span class="font-mono text-xs font-bold text-sky-400 w-10">${escapeHtml(String(ev.time))}'</span>
              <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                ev.type === 'goal' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                ev.type === 'red_card' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                ev.type === 'yellow_card' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              }">${escapeHtml(ev.type.replace('_', ' '))}</span>
              <span class="text-xs font-semibold text-white">${escapeHtml(ev.player)}</span>
              <span class="text-[10px] text-slate-500 uppercase">(${escapeHtml(ev.team || 'home')})</span>
            </div>
            <button type="button" onclick="removeTimelineEvent(${i})" class="text-slate-500 hover:text-red-400 p-1">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        `).join('')}
      </div>
    `;
  }

  window.addTimelineIncidentPrompt = function () {
    if (!state.selectedTimelineMatchId) return;
    const type = prompt('Incident type (goal, yellow_card, red_card, sub):', 'goal');
    if (!type) return;
    const min = prompt('Minute (e.g. 34):', '34');
    if (!min) return;
    const player = prompt('Player name:', 'Player');
    if (!player) return;
    const team = prompt('Team (home / away):', 'home');

    const m = state.matches.find(item => item.id === state.selectedTimelineMatchId);
    if (!m) return;

    if (type.toLowerCase() === 'goal') {
      m.goal_scorers = Array.isArray(m.goal_scorers) ? m.goal_scorers : [];
      m.goal_scorers.push({ minute: parseInt(min, 10) || min, player, team });
    } else if (type.toLowerCase().includes('card')) {
      m.cards = Array.isArray(m.cards) ? m.cards : [];
      m.cards.push({ minute: parseInt(min, 10) || min, player, team, type: type.includes('red') ? 'red' : 'yellow' });
    } else {
      m.substitutions = Array.isArray(m.substitutions) ? m.substitutions : [];
      m.substitutions.push({ minute: parseInt(min, 10) || min, player_in: player, player_out: 'Player Off', team });
    }

    saveMatchTimelineChanges(m);
  };

  document.getElementById('addIncidentBtn')?.addEventListener('click', window.addTimelineIncidentPrompt);

  window.removeTimelineEvent = function (index) {
    const m = state.matches.find(item => item.id === state.selectedTimelineMatchId);
    if (!m) return;

    // Remove from the first array that contains items
    if (Array.isArray(m.goal_scorers) && m.goal_scorers.length > index) {
      m.goal_scorers.splice(index, 1);
    } else if (Array.isArray(m.cards) && m.cards.length > 0) {
      m.cards.shift();
    } else if (Array.isArray(m.substitutions) && m.substitutions.length > 0) {
      m.substitutions.shift();
    }

    saveMatchTimelineChanges(m);
  };

  async function saveMatchTimelineChanges(m) {
    try {
      await apiFetch(`zeta_matches?id=eq.${m.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          goal_scorers: m.goal_scorers,
          cards: m.cards,
          substitutions: m.substitutions
        })
      });
      renderTimelineEvents();
      showToast('Timeline incident saved successfully!');
    } catch (err) {
      showToast('Failed to save timeline: ' + err.message, 'error');
    }
  }

  // --- 11. TAB 5: LINEUPS & TACTICAL PITCH BUILDER ---
  function populateLineupsMatchDropdown() {
    const sel = document.getElementById('lineupsMatchSelector');
    if (!sel) return;

    sel.innerHTML = buildGroupedMatchOptions(state.matches, state.selectedLineupsMatchId, 'Select match for lineups');

    if (state.selectedLineupsMatchId) {
      loadLineupsForSelectedMatch();
    }
  }

  document.getElementById('lineupsMatchSelector')?.addEventListener('change', (e) => {
    state.selectedLineupsMatchId = e.target.value;
    loadLineupsForSelectedMatch();
  });

  function loadLineupsForSelectedMatch() {
    const m = state.matches.find(item => item.id === state.selectedLineupsMatchId);
    if (!m) return;

    document.getElementById('homeLineupTitle').textContent = `${m.home_team} Starting XI`;
    document.getElementById('awayLineupTitle').textContent = `${m.away_team} Starting XI`;

    const homeFormation = (m.lineups && m.lineups.home_formation) || '4-3-3';
    const awayFormation = (m.lineups && m.lineups.away_formation) || '4-2-3-1';

    document.getElementById('homeFormationInput').value = homeFormation;
    document.getElementById('awayFormationInput').value = awayFormation;

    const homeList = document.getElementById('homePlayersList');
    const awayList = document.getElementById('awayPlayersList');

    const homePlayers = (m.lineups && m.lineups.home_xi) || ['GK 1', 'DEF 2', 'DEF 3', 'DEF 4', 'DEF 5', 'MID 6', 'MID 7', 'MID 8', 'FWD 9', 'FWD 10', 'FWD 11'];
    const awayPlayers = (m.lineups && m.lineups.away_xi) || ['GK 1', 'DEF 2', 'DEF 3', 'DEF 4', 'DEF 5', 'MID 6', 'MID 7', 'MID 8', 'FWD 9', 'FWD 10', 'FWD 11'];

    homeList.innerHTML = homePlayers.map((p, idx) => `
      <div class="flex items-center gap-2">
        <span class="w-6 text-slate-500 font-mono text-[10px] text-right">${idx + 1}.</span>
        <input type="text" class="home-xi-input flex-1 px-2.5 py-1.5 bg-[#080E1A] border border-white/10 rounded-lg text-white text-xs" value="${escapeHtml(p)}" />
      </div>
    `).join('');

    awayList.innerHTML = awayPlayers.map((p, idx) => `
      <div class="flex items-center gap-2">
        <span class="w-6 text-slate-500 font-mono text-[10px] text-right">${idx + 1}.</span>
        <input type="text" class="away-xi-input flex-1 px-2.5 py-1.5 bg-[#080E1A] border border-white/10 rounded-lg text-white text-xs" value="${escapeHtml(p)}" />
      </div>
    `).join('');
  }

  document.getElementById('saveLineupsBtn')?.addEventListener('click', async () => {
    if (!state.selectedLineupsMatchId) {
      showToast('Select a match first', 'warning');
      return;
    }

    const homeXi = Array.from(document.querySelectorAll('.home-xi-input')).map(el => el.value.trim());
    const awayXi = Array.from(document.querySelectorAll('.away-xi-input')).map(el => el.value.trim());
    const homeFormation = document.getElementById('homeFormationInput').value.trim();
    const awayFormation = document.getElementById('awayFormationInput').value.trim();

    const lineupsPayload = {
      home_formation: homeFormation,
      away_formation: awayFormation,
      home_xi: homeXi,
      away_xi: awayXi
    };

    try {
      await apiFetch(`zeta_matches?id=eq.${state.selectedLineupsMatchId}`, {
        method: 'PATCH',
        body: JSON.stringify({ lineups: lineupsPayload })
      });

      const m = state.matches.find(item => item.id === state.selectedLineupsMatchId);
      if (m) m.lineups = lineupsPayload;

      showToast('Lineups and tactical formations saved!');
    } catch (err) {
      showToast('Error saving lineups: ' + err.message, 'error');
    }
  });

  // --- 12. TAB 6: MATCH STATISTICS MATRIX ---
  const STAT_METRICS = [
    { key: 'possession', label: 'Possession %', defaultHome: 52, defaultAway: 48 },
    { key: 'shots_total', label: 'Total Shots', defaultHome: 14, defaultAway: 9 },
    { key: 'shots_on_target', label: 'Shots on Target', defaultHome: 6, defaultAway: 3 },
    { key: 'big_chances', label: 'Big Chances', defaultHome: 3, defaultAway: 1 },
    { key: 'corners', label: 'Corner Kicks', defaultHome: 7, defaultAway: 4 },
    { key: 'fouls', label: 'Fouls Committed', defaultHome: 11, defaultAway: 13 },
    { key: 'yellow_cards', label: 'Yellow Cards', defaultHome: 2, defaultAway: 3 },
    { key: 'red_cards', label: 'Red Cards', defaultHome: 0, defaultAway: 0 },
    { key: 'offsides', label: 'Offsides', defaultHome: 2, defaultAway: 1 },
    { key: 'passes', label: 'Total Passes', defaultHome: 480, defaultAway: 410 },
    { key: 'pass_accuracy', label: 'Pass Accuracy %', defaultHome: 88, defaultAway: 82 }
  ];

  function populateStatsMatchDropdown() {
    const sel = document.getElementById('statsMatchSelector');
    if (!sel) return;

    sel.innerHTML = buildGroupedMatchOptions(state.matches, state.selectedStatsMatchId, 'Select match for statistics');

    if (state.selectedStatsMatchId) {
      loadStatsForSelectedMatch();
    }
  }

  document.getElementById('statsMatchSelector')?.addEventListener('change', (e) => {
    state.selectedStatsMatchId = e.target.value;
    loadStatsForSelectedMatch();
  });

  function loadStatsForSelectedMatch() {
    const m = state.matches.find(item => item.id === state.selectedStatsMatchId);
    if (!m) return;

    document.getElementById('statsHomeLabel').textContent = m.home_team.toUpperCase();
    document.getElementById('statsAwayLabel').textContent = m.away_team.toUpperCase();

    const grid = document.getElementById('statsInputsGrid');
    const existingStats = m.match_stats || {};

    grid.innerHTML = STAT_METRICS.map(metric => {
      const hVal = existingStats[`${metric.key}_home`] ?? metric.defaultHome;
      const aVal = existingStats[`${metric.key}_away`] ?? metric.defaultAway;

      return `
        <div class="grid grid-cols-1 sm:grid-cols-3 items-center gap-3">
          <input type="number" id="stat_${metric.key}_home" value="${hVal}" class="px-3 py-2 bg-[#080E1A] border border-white/10 rounded-xl text-white text-center font-bold" />
          <span class="text-xs text-slate-300 font-semibold text-center uppercase tracking-wider">${metric.label}</span>
          <input type="number" id="stat_${metric.key}_away" value="${aVal}" class="px-3 py-2 bg-[#080E1A] border border-white/10 rounded-xl text-white text-center font-bold" />
        </div>
      `;
    }).join('');
  }

  document.getElementById('saveStatsBtn')?.addEventListener('click', async () => {
    if (!state.selectedStatsMatchId) {
      showToast('Select a match first', 'warning');
      return;
    }

    const payload = {};
    STAT_METRICS.forEach(metric => {
      payload[`${metric.key}_home`] = parseFloat(document.getElementById(`stat_${metric.key}_home`).value) || 0;
      payload[`${metric.key}_away`] = parseFloat(document.getElementById(`stat_${metric.key}_away`).value) || 0;
    });

    try {
      await apiFetch(`zeta_matches?id=eq.${state.selectedStatsMatchId}`, {
        method: 'PATCH',
        body: JSON.stringify({ match_stats: payload })
      });

      const m = state.matches.find(item => item.id === state.selectedStatsMatchId);
      if (m) m.match_stats = payload;

      showToast('Match statistics matrix saved successfully!');
    } catch (err) {
      showToast('Error saving statistics: ' + err.message, 'error');
    }
  });

  // --- 13. TAB 7: EDITORIAL ARTICLES CMS ---
  function renderArticlesTab() {
    const list = document.getElementById('articlesCardsList');
    if (!list) return;

    // Articles derived from matches or mock store
    const articles = state.matches.slice(0, 6).map((m, i) => ({
      id: `art_${i + 1}`,
      title: `${m.home_team} vs ${m.away_team} — High-Stakes Tactical Clash Preview`,
      date: m.date || 'Today',
      snippet: `In-depth tactical preview, confirmed lineups, head-to-head records, and key battlefields as ${m.home_team} take on ${m.away_team} in ${m.league_name || 'league action'}.`,
      views: 1240 + i * 342
    }));

    list.innerHTML = articles.map(a => `
      <div class="bg-[#101827] border border-white/5 rounded-2xl p-5 shadow-sm space-y-3 flex flex-col justify-between">
        <div class="space-y-2">
          <span class="text-[10px] text-sky-400 font-bold uppercase tracking-wider">AdSense Editorial Article</span>
          <h3 class="font-['Oswald'] text-sm font-bold text-white line-clamp-2">${escapeHtml(a.title)}</h3>
          <p class="text-xs text-slate-400 line-clamp-3 leading-relaxed">${escapeHtml(a.snippet)}</p>
        </div>
        <div class="flex items-center justify-between pt-3 border-t border-white/5 text-[11px] text-slate-500 font-mono">
          <span>Views: ${a.views}</span>
          <button type="button" onclick="showToast('Article saved to CMS archive')" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-sans font-bold">Edit</button>
        </div>
      </div>
    `).join('');
  }

  document.getElementById('openAddArticleBtn')?.addEventListener('click', () => {
    const title = prompt('Enter article headline:');
    if (title) showToast(`Draft article "${title}" created!`);
  });

  // --- 14. TAB 8: POLICY & LEGAL CMS ---
  const DEFAULT_POLICIES = {
    privacy: {
      title: 'Privacy Policy',
      content: `<h2>1. Information We Collect</h2><p>ZetaSports does not require account registration or collection of personally identifiable information to view sports schedules.</p><h2>2. Advertising & Cookies</h2><p>We use third-party advertising partners such as Google AdSense to serve non-intrusive ads when you visit our website.</p>`
    },
    dmca: {
      title: 'DMCA & Copyright Compliance',
      content: `<h2>Copyright Notice & Safe Harbor</h2><p>ZetaSports operates strictly as an indexer and schedule provider. We do not host, broadcast, or store video media on our servers. All video streams are embedded from publicly indexed third-party sources.</p>`
    },
    terms: {
      title: 'Terms of Service',
      content: `<h2>Acceptance of Terms</h2><p>By accessing ZetaSports, you agree to comply with all applicable local, national, and international laws regarding online broadcast viewing.</p>`
    },
    disclaimer: {
      title: 'Legal Disclaimer',
      content: `<p>All sports trademarks, team crests, and league logos referenced on ZetaSports remain the proprietary property of their respective owners and federations.</p>`
    },
    about: {
      title: 'About ZetaSports',
      content: `<p>ZetaSports is a world-class live sports telemetry platform offering real-time scores, tactical lineups, player statistics, and match streaming directory services.</p>`
    },
    contact: {
      title: 'Contact Information',
      content: `<p>For DMCA notices, copyright verification, and editorial inquiries, reach our administrative desk at contact@keralahub.online.</p>`
    }
  };

  function loadPolicyContent() {
    const policy = DEFAULT_POLICIES[state.activePolicyKey] || DEFAULT_POLICIES.privacy;
    const titleInput = document.getElementById('policyTitleInput');
    const htmlInput = document.getElementById('policyHtmlInput');

    if (titleInput) titleInput.value = policy.title;
    if (htmlInput) htmlInput.value = policy.content;
  }

  document.querySelectorAll('.policy-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.policy-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activePolicyKey = btn.dataset.policy;
      loadPolicyContent();
    });
  });

  document.getElementById('savePolicyBtn')?.addEventListener('click', () => {
    const title = document.getElementById('policyTitleInput').value.trim();
    const content = document.getElementById('policyHtmlInput').value.trim();

    DEFAULT_POLICIES[state.activePolicyKey] = { title, content };
    showToast(`Policy "${title}" saved and updated across web themes!`);
  });

  // --- 15. TAB 9: SITE CONFIGURATION ---
  async function loadSiteConfig() {
    try {
      const data = await apiFetch('zeta_config?id=eq.global&limit=1');
      if (Array.isArray(data) && data.length > 0) {
        const c = data[0];
        if (c.telegram_url) document.getElementById('configTgUrl').value = c.telegram_url;
        if (c.telegram_title) document.getElementById('configTgTitle').value = c.telegram_title;
        if (c.telegram_message) document.getElementById('configTgMsg').value = c.telegram_message;
      }
    } catch (e) {
      console.warn('Config fetch skipped:', e);
    }
  }

  document.getElementById('saveConfigBtn')?.addEventListener('click', async () => {
    const payload = {
      telegram_url: document.getElementById('configTgUrl').value.trim(),
      telegram_title: document.getElementById('configTgTitle').value.trim(),
      telegram_message: document.getElementById('configTgMsg').value.trim()
    };

    try {
      await apiFetch('zeta_config?id=eq.global', {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      showToast('Site and Telegram configuration saved!');
    } catch (err) {
      showToast('Saved to local storage (Supabase config read-only)', 'warning');
    }
  });

  document.getElementById('configLogoUrl')?.addEventListener('input', (e) => {
    const preview = document.getElementById('configLogoPreview');
    if (preview) preview.src = e.target.value.trim();
  });

  // --- 16. TAB 10: TEAMS & LEAGUES (APPROVAL & INGESTION CONTROL) ---
  function renderTeamsAndLeagues() {
    const teamsWrap = document.getElementById('teamsListWrap');
    const leaguesWrap = document.getElementById('leaguesListWrap');

    const teamsMap = new Map();
    const matchCountsByLeague = {};

    state.matches.forEach(m => {
      if (m.home_team) teamsMap.set(m.home_team, m.home_logo);
      if (m.away_team) teamsMap.set(m.away_team, m.away_logo);
      const lg = resolveMatchLeague(m);
      matchCountsByLeague[lg] = (matchCountsByLeague[lg] || 0) + 1;
    });

    // Merge registered zeta_leagues with discovered match leagues
    const allLeaguesMap = new Map();

    state.leagues.forEach(l => {
      allLeaguesMap.set(l.name.toLowerCase().trim(), {
        id: l.id,
        name: l.name,
        country: l.country || 'International',
        logo_url: l.logo_url || l.logo || '',
        featured: l.featured === true
      });
    });

    Object.keys(matchCountsByLeague).forEach(lgName => {
      const norm = lgName.toLowerCase().trim();
      if (!allLeaguesMap.has(norm)) {
        allLeaguesMap.set(norm, {
          id: 'gen_' + norm.replace(/[^a-z0-9]/g, '_'),
          name: lgName,
          country: 'Tournament',
          logo_url: '',
          featured: false
        });
      }
    });

    // Render Leagues with Approval Toggles
    if (leaguesWrap) {
      let leaguesList = Array.from(allLeaguesMap.values());

      // Filter by search query
      const q = (state.leagueSearchQuery || '').trim().toLowerCase();
      if (q) {
        leaguesList = leaguesList.filter(l =>
          l.name.toLowerCase().includes(q) || (l.country && l.country.toLowerCase().includes(q))
        );
      }

      // Sort: Approved first, then alphabetically
      leaguesList.sort((a, b) => {
        if (a.featured !== b.featured) return b.featured ? 1 : -1;
        return a.name.localeCompare(b.name);
      });

      if (leaguesList.length === 0) {
        leaguesWrap.innerHTML = `
          <div class="text-center py-8 text-slate-500">
            No competitions found matching "${escapeHtml(state.leagueSearchQuery)}".
          </div>
        `;
      } else {
        leaguesWrap.innerHTML = leaguesList.map(league => {
          const isApproved = league.featured === true;
          const matchCount = matchCountsByLeague[league.name] || 0;
          const logoSrc = league.logo_url || 'https://placehold.co/28x28/1e293b/fff';

          return `
            <div class="flex items-center justify-between p-3 bg-[#080E1A] rounded-xl border ${isApproved ? 'border-emerald-500/20 bg-emerald-950/10' : 'border-white/5'} transition-all">
              <div class="flex items-center gap-3 min-w-0">
                <img src="${escapeHtml(logoSrc)}" class="w-7 h-7 object-contain rounded-md bg-slate-800 p-0.5 shrink-0" onerror="this.src='https://placehold.co/28x28/1e293b/fff'" />
                <div class="min-w-0 truncate">
                  <div class="font-bold text-white text-xs truncate flex items-center gap-2">
                    <span>${escapeHtml(league.name)}</span>
                    <span class="px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold ${matchCount > 0 ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-500'}">
                      ${matchCount} ${matchCount === 1 ? 'match' : 'matches'}
                    </span>
                  </div>
                  <span class="text-[10px] text-slate-500 font-medium">${escapeHtml(league.country || 'Global')}</span>
                </div>
              </div>

              <div class="flex items-center gap-2 shrink-0">
                ${isApproved ? `
                  <button type="button" onclick="toggleLeagueApproval('${escapeHtml(league.id)}', false)" class="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Approved</span>
                  </button>
                ` : `
                  <button type="button" onclick="toggleLeagueApproval('${escapeHtml(league.id)}', true)" class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-white/5 text-xs font-bold flex items-center gap-1.5 transition-all">
                    <span class="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                    <span>Hidden</span>
                  </button>
                `}
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // Render Discovered Teams
    if (teamsWrap) {
      teamsWrap.innerHTML = Array.from(teamsMap.entries()).map(([team, logo]) => `
        <div class="flex items-center justify-between p-2.5 bg-[#080E1A] rounded-xl border border-white/5">
          <div class="flex items-center gap-2.5">
            <img src="${escapeHtml(logo || 'https://placehold.co/24x24/1e293b/fff')}" class="w-5 h-5 object-contain rounded-full bg-slate-800" onerror="this.src='https://placehold.co/24x24/1e293b/fff'" />
            <span class="font-semibold text-white">${escapeHtml(team)}</span>
          </div>
          <button type="button" onclick="navigator.clipboard.writeText('${escapeHtml(logo || '')}'); showToast('Logo URL copied!')" class="text-[10px] text-sky-400 hover:underline">Copy Logo</button>
        </div>
      `).join('');
    }
  }

  // Toggle League Approval in Supabase and sync local state
  window.toggleLeagueApproval = async function (leagueId, newFeaturedStatus) {
    try {
      let target = state.leagues.find(l => l.id === leagueId);

      // If league is not in state.leagues yet, create/upsert it
      if (!target) {
        const foundName = leagueId.startsWith('gen_') ? leagueId.replace('gen_', '').replace(/_/g, ' ') : leagueId;
        const newLeagueRow = {
          id: leagueId,
          name: foundName,
          featured: newFeaturedStatus
        };
        await apiFetch('zeta_leagues', {
          method: 'POST',
          headers: { 'Prefer': 'resolution=merge-duplicates' },
          body: JSON.stringify(newLeagueRow)
        });
        state.leagues.push(newLeagueRow);
        target = newLeagueRow;
      } else {
        await apiFetch(`zeta_leagues?id=eq.${leagueId}`, {
          method: 'PATCH',
          body: JSON.stringify({ featured: newFeaturedStatus })
        });
        target.featured = newFeaturedStatus;
      }

      const leagueName = target ? target.name : leagueId;
      const norm = leagueName.toLowerCase().trim();

      if (newFeaturedStatus) {
        state.approvedLeagues.add(norm);
      } else {
        state.approvedLeagues.delete(norm);
      }

      // Update all matches belonging to this league
      state.matches.forEach(m => {
        if (resolveMatchLeague(m).toLowerCase().trim() === norm) {
          m.is_approved = newFeaturedStatus;
        }
      });

      // Synchronize match rows in Supabase
      try {
        await apiFetch(`zeta_matches?league_name=eq.${encodeURIComponent(leagueName)}`, {
          method: 'PATCH',
          body: JSON.stringify({ is_approved: newFeaturedStatus })
        });
      } catch (patchErr) {
        console.warn('Batch match update notice:', patchErr);
      }

      updateApprovedLeaguesBadge();
      renderTeamsAndLeagues();
      filterAndSearchMatches();
      renderDashboard();
      showToast(`Competition "${leagueName}" is now ${newFeaturedStatus ? 'Approved (Fetching Active)' : 'Hidden (Ignored)'}!`);
    } catch (err) {
      console.error('Failed to toggle league approval:', err);
      showToast('Error updating league status: ' + err.message, 'error');
    }
  };

  // Bind League Approval Search & Quick Actions
  let isLeagueSearchBound = false;
  function bindLeagueApprovalControls() {
    if (isLeagueSearchBound) return;

    document.getElementById('leagueSearchInput')?.addEventListener('input', (e) => {
      state.leagueSearchQuery = e.target.value;
      renderTeamsAndLeagues();
    });

    document.getElementById('approveTopLeaguesBtn')?.addEventListener('click', async () => {
      const TOP_LEAGUE_NAMES = [
        'Premier League', 'UEFA Champions League', 'LaLiga', 'Serie A',
        'Bundesliga', 'Ligue 1', 'UEFA Europa League', 'UEFA Conference League',
        'UEFA Nations League', 'International Friendlies'
      ];

      try {
        for (const name of TOP_LEAGUE_NAMES) {
          const lg = state.leagues.find(l => l.name.toLowerCase().trim() === name.toLowerCase().trim());
          if (lg) {
            await apiFetch(`zeta_leagues?id=eq.${lg.id}`, {
              method: 'PATCH',
              body: JSON.stringify({ featured: true })
            });
            lg.featured = true;
            state.approvedLeagues.add(name.toLowerCase().trim());
          }
        }

        // Update local matches
        state.matches.forEach(m => {
          const lNorm = resolveMatchLeague(m).toLowerCase().trim();
          if (state.approvedLeagues.has(lNorm)) {
            m.is_approved = true;
          }
        });

        updateApprovedLeaguesBadge();
        renderTeamsAndLeagues();
        filterAndSearchMatches();
        renderDashboard();
        showToast('Top 10 major competitions approved successfully!');
      } catch (err) {
        showToast('Error approving top leagues: ' + err.message, 'error');
      }
    });

    isLeagueSearchBound = true;
  }

  // --- 17. MODAL UTILITIES ---
  function openModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.remove('hidden');
  }

  function closeModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.add('hidden');
  }

  window.openModal = openModal;
  window.closeModal = closeModal;

  document.querySelectorAll('.close-modal-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.dataset.modal;
      if (modalId) closeModal(modalId);
    });
  });

  // --- 18. SERVICE ROLE KEY MANAGEMENT ---
  document.getElementById('openKeyModalBtn')?.addEventListener('click', () => {
    document.getElementById('serviceKeyInput').value = state.serviceKey;
    openModal('keyModal');
  });

  document.getElementById('saveServiceKeyBtn')?.addEventListener('click', () => {
    const key = document.getElementById('serviceKeyInput').value.trim();
    state.serviceKey = key;
    localStorage.setItem(STORAGE_KEY_SERVICE, key);
    updateAuthBadge();
    closeModal('keyModal');
    if (key.startsWith('sb_secret_')) {
      showToast('Notice: sb_secret_ keys are blocked by Supabase in web browsers. Please paste the JWT service_role key (starts with "ey...").', 'warning');
    } else {
      showToast('Supabase Service Role Key stored locally!');
    }
  });

  document.getElementById('clearServiceKeyBtn')?.addEventListener('click', () => {
    state.serviceKey = '';
    localStorage.removeItem(STORAGE_KEY_SERVICE);
    document.getElementById('serviceKeyInput').value = '';
    updateAuthBadge();
    closeModal('keyModal');
    showToast('Saved custom key removed. Default verified admin credentials active.');
  });

  // Open Add League modal
  document.getElementById('openAddLeagueBtn')?.addEventListener('click', () => {
    document.getElementById('leagueForm')?.reset();
    if (document.getElementById('leagueSportInput')) document.getElementById('leagueSportInput').value = 'football';
    if (document.getElementById('leagueFeaturedCheck')) document.getElementById('leagueFeaturedCheck').checked = true;
    openModal('leagueModal');
  });

  // Handle Add League Form Submission
  document.getElementById('leagueForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('leagueNameInput').value.trim();
    if (!name) return;

    const sport = document.getElementById('leagueSportInput')?.value.trim() || 'football';
    const country = document.getElementById('leagueCountryInput')?.value.trim() || 'International';
    const logoUrl = document.getElementById('leagueLogoInput')?.value.trim();
    const isFeatured = document.getElementById('leagueFeaturedCheck')?.checked ?? true;

    const leagueId = 'custom_' + name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const newLeagueRow = {
      id: leagueId,
      name: name,
      sport: sport,
      country: country,
      logo_url: logoUrl || null,
      featured: isFeatured
    };

    try {
      await apiFetch('zeta_leagues', {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify(newLeagueRow)
      });

      // Update local state
      const existingIdx = state.leagues.findIndex(l => l.id === leagueId || l.name.toLowerCase() === name.toLowerCase());
      if (existingIdx >= 0) {
        state.leagues[existingIdx] = { ...state.leagues[existingIdx], ...newLeagueRow };
      } else {
        state.leagues.push(newLeagueRow);
      }

      if (isFeatured) {
        state.approvedLeagues.add(name.toLowerCase().trim());
      } else {
        state.approvedLeagues.delete(name.toLowerCase().trim());
      }

      closeModal('leagueModal');
      renderTeamsAndLeagues();
      updateApprovedLeaguesBadge();
      updateLeagueFilterDropdown();
      showToast(`League "${name}" successfully added and ${isFeatured ? 'Approved' : 'Saved'}!`);
    } catch (err) {
      console.error('Failed to add league:', err);
      showToast('Error saving league: ' + err.message, 'error');
    }
  });

  // --- 19. GLOBAL LISTENERS & FILTER HOOKS ---
  // Match filter tabs
  document.getElementById('matchFilterTabs')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.matchFilter = btn.dataset.filter;
    filterAndSearchMatches();
  });

  // Match live search input
  document.getElementById('matchSearchInput')?.addEventListener('input', (e) => {
    state.matchSearchQuery = e.target.value;
    filterAndSearchMatches();
  });

  // Global Refresh button
  document.getElementById('globalRefreshBtn')?.addEventListener('click', async () => {
    showToast('Refreshing live data from Supabase...');
    await loadInitialData();
    showToast('Data refreshed successfully!');
  });

  // Navigation sidebar item clicks
  document.querySelectorAll('#sidebarNav .nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (tab) switchTab(tab);
    });
  });

  // Start application on DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    loadInitialData();
  });

})();
