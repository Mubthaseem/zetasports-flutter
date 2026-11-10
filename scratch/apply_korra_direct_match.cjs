const fs = require('fs');
const path = require('path');

const file = path.resolve('zetasports-korra-blogger-theme.xml');
let content = fs.readFileSync(file, 'utf8');

// 1. Add fetchDirectMatch above openMatchPage
const targetHeader = `    // ── ROUTE 1: DEDICATED MATCH DETAILS & 8 SECTIONS (domain.com/team1-vs-team2-id) ──
    window.openMatchPage = function(matchId, pushState) {
      var match = allMatches.find(function(m) { return String(m.id) === String(matchId); });
      if (!match) return;`;

const replacementHeader = `    // ── Direct Match Fetcher for Stream & Gateway Deep Links ──
    async function fetchDirectMatch(matchId, cb) {
      try {
        var res = await fetch(SB_URL + '/rest/v1/zeta_matches?id=eq.' + encodeURIComponent(matchId) + '&select=*', {
          headers: SB_HEADERS
        });
        if (res.ok) {
          var data = await res.json();
          if (data && data[0]) {
            var m = data[0];
            allMatches.push(m);
            if (typeof cb === 'function') {
              cb(m);
            }
            return;
          }
        }
      } catch (err) {
        console.error('[ZetaSports] Direct match fetch error:', err);
      }
    }

    // ── ROUTE 1: DEDICATED MATCH DETAILS & 8 SECTIONS (domain.com/team1-vs-team2-id) ──
    window.openMatchPage = function(matchId, pushState) {
      var match = allMatches.find(function(m) { return String(m.id) === String(matchId); });
      if (!match) {
        fetchDirectMatch(matchId, function() {
          window.openMatchPage(matchId, pushState);
        });
        return;
      }`;

// 2. Patch openLinksPage
const targetLinks = `    // ── ROUTE 1.5: DEDICATED LINK SELECTION GATEWAY (domain.com/?links=id) ──
    window.openLinksPage = function(matchId, pushState) {
      var match = allMatches.find(function(m) { return String(m.id) === String(matchId); });
      if (!match) return;`;

const replacementLinks = `    // ── ROUTE 1.5: DEDICATED LINK SELECTION GATEWAY (domain.com/?links=id) ──
    window.openLinksPage = function(matchId, pushState) {
      var match = allMatches.find(function(m) { return String(m.id) === String(matchId); });
      if (!match) {
        fetchDirectMatch(matchId, function() {
          window.openLinksPage(matchId, pushState);
        });
        return;
      }`;

// 3. Patch openStreamPage
const targetStream = `    // ── ROUTE 2: DEDICATED STREAMING PAGE WITH DYNAMIC MULTI-SERVER (domain.com/stream/id) ──
    window.openStreamPage = function(matchId, pushState, serverIdx) {
      var match = allMatches.find(function(m) { return String(m.id) === String(matchId); });
      if (!match) return;`;

const replacementStream = `    // ── ROUTE 2: DEDICATED STREAMING PAGE WITH DYNAMIC MULTI-SERVER (domain.com/stream/id) ──
    window.openStreamPage = function(matchId, pushState, serverIdx) {
      var match = allMatches.find(function(m) { return String(m.id) === String(matchId); });
      if (!match) {
        fetchDirectMatch(matchId, function() {
          window.openStreamPage(matchId, pushState, serverIdx);
        });
        return;
      }`;

let norm = content.replace(/\r\n/g, '\n');
let t1 = targetHeader.replace(/\r\n/g, '\n');
let t2 = targetLinks.replace(/\r\n/g, '\n');
let t3 = targetStream.replace(/\r\n/g, '\n');

if (norm.includes(t1) && norm.includes(t2) && norm.includes(t3)) {
  norm = norm.replace(t1, replacementHeader.replace(/\r\n/g, '\n'));
  norm = norm.replace(t2, replacementLinks.replace(/\r\n/g, '\n'));
  norm = norm.replace(t3, replacementStream.replace(/\r\n/g, '\n'));
  fs.writeFileSync(file, norm, 'utf8');
  console.log('SUCCESS: Patched zetasports-korra-blogger-theme.xml with fetchDirectMatch');
} else {
  console.error('Target patterns not found in zetasports-korra-blogger-theme.xml:', {
    hasT1: norm.includes(t1),
    hasT2: norm.includes(t2),
    hasT3: norm.includes(t3)
  });
}
