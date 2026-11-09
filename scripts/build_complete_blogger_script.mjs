import fs from 'fs';
import vm from 'vm';

console.log('Building complete, self-contained scripts/blogger_script_part.js...');

let existingPart = fs.readFileSync('scripts/blogger_script_part.js', 'utf8');

// Ensure the top setup has DB config, global state, dark mode, date & league filters
const topSetup = `
  // ── Database & State Configuration ──
  var SB_URL = 'https://voocdrpetiyspuhyeapi.supabase.co';
  var SB_KEY = 'sb_publishable_luDUt769BBrrApn8z-Cgvw_W9VE0rIV';
  var SB_HEADERS = {
    'apikey': SB_KEY,
    'Authorization': 'Bearer ' + SB_KEY
  };

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
      .replace(/\\s+/g, '-')
      .replace(/[^\\w\\-]+/g, '')
      .replace(/\\-\\-+/g, '-');
  }

  // ── Dark / Night Mode ──
  window.toggleNightMode = function() {
    var isNight = document.body.classList.toggle('Night');
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('zeta_night', isNight ? '1' : '0');
    }
    var dt = document.getElementById('darkToggle');
    if (dt) dt.textContent = isNight ? '☀️' : '🌙';
  };

  if (typeof localStorage !== 'undefined' && localStorage.getItem('zeta_night') === '1') {
    document.body.classList.add('Night');
    var dt = document.getElementById('darkToggle');
    if (dt) dt.textContent = '☀️';
  }

  // ── Date Filters Switcher ──
  window.filterDate = function(day) {
    currentDateFilter = day;
    ['yesterday', 'today', 'tomorrow'].forEach(function(d) {
      var el = document.getElementById('tab-' + d);
      if (el) {
        el.classList.remove('active');
        var a = el.querySelector('a');
        if (a) {
          a.classList.remove('active');
          a.style.background = '';
          a.style.color = '';
        }
      }
    });
    var activeTab = document.getElementById('tab-' + day);
    if (activeTab) {
      activeTab.classList.add('active');
      var a = activeTab.querySelector('a');
      if (a) {
        a.classList.add('active');
        a.style.background = '#0062b2';
        a.style.color = '#fff';
      }
    }
    renderMatches();
  };

  // ── League Filter Switcher ──
  window.filterLeague = function(league) {
    currentLeagueFilter = league;
    var container = document.getElementById('leagueFilterPills');
    if (container) {
      var buttons = container.querySelectorAll('button');
      buttons.forEach(function(b) {
        b.classList.remove('active');
        b.style.background = '#f1f5f9';
        b.style.color = '#334155';
      });
      buttons.forEach(function(b) {
        var txt = b.textContent.trim().toLowerCase();
        if (txt === league.toLowerCase() || (league === 'Indian Super League' && txt === 'isl')) {
          b.classList.add('active');
          b.style.background = '#0062b2';
          b.style.color = '#fff';
        }
      });
    }
    renderMatches();
  };
`;

// Ensure bottom loader has syncFotMobScores, fetchSupabaseTable, loadData, polling
const bottomLoader = `
  // ── FotMob Live Scores API Sync ──
  async function syncFotMobScores() {
    var liveWithFotmob = allMatches.filter(function(m) { return m.fotmob_id && (m.status === 'live' || m.status === 'scheduled'); });
    for (var i = 0; i < liveWithFotmob.length; i++) {
      var match = liveWithFotmob[i];
      try {
        var proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://www.fotmob.com/api/matchDetails?matchId=' + match.fotmob_id);
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

  // ── Direct Supabase REST Fetch Helper ──
  async function fetchSupabaseTable(table) {
    var res = await fetch(SB_URL + '/rest/v1/' + table + '?select=*', {
      headers: SB_HEADERS
    });
    if (!res.ok) throw new Error('Supabase ' + table + ' returned HTTP ' + res.status);
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
      try { checkUrlRoute(); } catch(e) { console.error('[ZetaSports] checkUrlRoute error:', e); }
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
  }
`;

// Check if topSetup is already present
if (!existingPart.includes('var SB_URL =')) {
  // Insert topSetup right after security helpers
  const marker = 'return \'\';\n  }';
  const idx = existingPart.indexOf(marker);
  if (idx !== -1) {
    existingPart = existingPart.substring(0, idx + marker.length) + '\n' + topSetup + '\n' + existingPart.substring(idx + marker.length);
  } else {
    existingPart = topSetup + '\n' + existingPart;
  }
  console.log('✔ Injected top database & filter setup');
}

// Check if bottomLoader is already present
if (!existingPart.includes('async function loadData()')) {
  existingPart = existingPart + '\n' + bottomLoader;
  console.log('✔ Injected bottom data fetcher and polling engine');
}

// Ensure renderMatches handles league filtering and fallback gracefully
if (!existingPart.includes('currentLeagueFilter && currentLeagueFilter !== \'all\'')) {
  const targetFilterStr = `var filtered = allMatches.filter(function(m) {
        var mDateStr = m.date ? m.date.split('T')[0] : todayStr;
        if (currentDateFilter === 'all') return true;
        if (currentDateFilter === 'live') return m.status === 'live';
        if (currentDateFilter === 'yesterday') return mDateStr === yesterdayStr || m.status === 'finished';
        if (currentDateFilter === 'tomorrow') return mDateStr === tomorrowStr;
        return mDateStr === todayStr || m.status === 'live' || m.status === 'upcoming' || allMatches.length <= 10;
      });`;

  const enhancedFilterStr = `var filtered = allMatches.filter(function(m) {
        var mDateStr = m.date ? m.date.split('T')[0] : todayStr;
        if (currentDateFilter === 'all') return true;
        if (currentDateFilter === 'live') return m.status === 'live';
        if (currentDateFilter === 'yesterday') return mDateStr === yesterdayStr || m.status === 'finished';
        if (currentDateFilter === 'tomorrow') return mDateStr === tomorrowStr;
        return mDateStr === todayStr || m.status === 'live' || m.status === 'upcoming';
      });

      // Filter by League
      if (currentLeagueFilter && currentLeagueFilter !== 'all') {
        filtered = filtered.filter(function(m) {
          var leagueName = m.league_name || (leaguesMap[m.league_id] && leaguesMap[m.league_id].name) || '';
          return leagueName.toLowerCase().indexOf(currentLeagueFilter.toLowerCase()) !== -1;
        });
      }

      // If no matches on today's calendar date, fallback to showing available active/recent matches so the UI is never blank
      if (filtered.length === 0 && currentDateFilter === 'today' && currentLeagueFilter === 'all') {
        filtered = allMatches.slice(0, 10);
      }`;

  if (existingPart.includes(targetFilterStr)) {
    existingPart = existingPart.replace(targetFilterStr, enhancedFilterStr);
    console.log('✔ Enhanced renderMatches with league filtering & graceful non-empty fallback');
  }
}

// Test syntax with VM
new vm.Script(existingPart);
console.log('✔ Complete scripts/blogger_script_part.js syntax is 100% valid!');

fs.writeFileSync('scripts/blogger_script_part.js', existingPart, 'utf8');
console.log('✔ Wrote updated scripts/blogger_script_part.js successfully.');

