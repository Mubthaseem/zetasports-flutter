import fs from 'fs';
import vm from 'vm';

let korra = fs.readFileSync('zetasports-korra-blogger-theme.xml', 'utf8');

// 1. Fix filterLeague in korra
if (!korra.includes('window.filterLeague =')) {
  const insertAfter = 'window.filterDate = function(day) {';
  const filterLeagueCode = `window.filterLeague = function(league) {
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
  korra = korra.replace(insertAfter, filterLeagueCode + insertAfter);
  console.log('✔ Injected filterLeague into korra');
}

// 2. Fix showTelegramPopup declaration to function declaration so hoisted
if (korra.includes('window.showTelegramPopup = function() {')) {
  korra = korra.replace('window.showTelegramPopup = function() {', 'function showTelegramPopup() {\n    window.showTelegramPopup = showTelegramPopup;');
  console.log('✔ Hoisted showTelegramPopup in korra');
}

// 3. Ensure renderMatches fallback so korra never shows empty/stuck skeleton if today has 0 matches
const oldKorraFilter = `return mDateStr === todayStr || m.status === 'live' || m.status === 'upcoming' || allMatches.length <= 10;`;
const newKorraFilter = `return mDateStr === todayStr || m.status === 'live' || m.status === 'upcoming';
      });

      // Filter by League
      if (typeof currentLeagueFilter !== 'undefined' && currentLeagueFilter && currentLeagueFilter !== 'all') {
        filtered = filtered.filter(function(m) {
          var leagueName = m.league_name || (leaguesMap[m.league_id] && leaguesMap[m.league_id].name) || '';
          return leagueName.toLowerCase().indexOf(currentLeagueFilter.toLowerCase()) !== -1;
        });
      }

      // If no matches on today's calendar date, fallback to showing available active/recent matches so the UI is never blank
      if (filtered.length === 0 && currentDateFilter === 'today' && (typeof currentLeagueFilter === 'undefined' || currentLeagueFilter === 'all')) {
        filtered = allMatches.slice(0, 10);`;

if (korra.includes(oldKorraFilter) && !korra.includes('// If no matches on today\'s calendar date')) {
  korra = korra.replace(oldKorraFilter, newKorraFilter);
  console.log('✔ Injected league filter & fallback in korra renderMatches');
}

fs.writeFileSync('zetasports-korra-blogger-theme.xml', korra, 'utf8');
console.log('✔ zetasports-korra-blogger-theme.xml updated successfully');
