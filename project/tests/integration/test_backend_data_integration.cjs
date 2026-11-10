/**
 * Integration & Security Test Suite for ZetaSports Backend Data Pipeline
 * Validates:
 * 1. Supabase PostgREST endpoints & anon key authentication
 * 2. Date filter logic (Yesterday, Today, Tomorrow strict day partitions)
 * 3. Fallback endpoints, FotMob telemetry parsing, and Exponential Backoff resilience
 * 4. Cross-domain navigation contract (window.ZETA_CONFIG, isAllowedUrl, open redirect & protocol-relative protection)
 */

const assert = require('assert');

// ── 1. CONFIGURATION & CONSTANTS ──
const SB_URL = 'https://udlncusvhmydivtjkjcy.supabase.co';
const SB_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkbG5jdXN2aG15ZGl2dGpramN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4MTE2MDgsImV4cCI6MjEwOTM4NzYwOH0.gsnxlDww-fUC4HG7R7VasXSaQvqkSsDhhmf16KUCLZY';

const ZETA_CONFIG = {
  detailsOrigin: 'https://www.keralahub.online',
  streamOrigin: 'http://www.zetasports.site',
  DETAILS_DOMAIN: 'www.keralahub.online',
  STREAM_DOMAIN: 'www.zetasports.site',
  supabaseUrl: SB_URL,
  supabaseKey: SB_ANON_KEY
};

// ── 2. CROSS-DOMAIN SECURITY VALIDATION: isAllowedUrl ──
function isAllowedUrl(url, config = ZETA_CONFIG) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (/^(?:javascript|data|vbscript):/i.test(trimmed)) return false;
  // Strict prevention of protocol-relative and backslash bypasses
  if (trimmed.startsWith('//') || trimmed.startsWith('/\\')) return false;
  if (trimmed.startsWith('/')) return true;
  try {
    const parsed = new URL(trimmed, config.detailsOrigin);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname.toLowerCase();
    const allowed = ['keralahub.online', 'www.keralahub.online', 'zetasports.site', 'www.zetasports.site'];
    if (config) {
      if (config.detailsOrigin) {
        try { allowed.push(new URL(config.detailsOrigin).hostname.toLowerCase()); } catch(e){}
      }
      if (config.streamOrigin) {
        try { allowed.push(new URL(config.streamOrigin).hostname.toLowerCase()); } catch(e){}
      }
    }
    return allowed.some(function(d) {
      return hostname === d || hostname.endsWith('.' + d);
    });
  } catch(e) {
    return false;
  }
}

// ── 3. DATE FILTER PARTITION LOGIC ──
function filterMatchesByDate(matches, dateFilter, referenceDate = new Date('2026-11-10T12:00:00Z')) {
  const now = referenceDate;
  const todayStr = now.toISOString().split('T')[0];

  const yesterdayDate = new Date(now.getTime());
  yesterdayDate.setUTCDate(now.getUTCDate() - 1);
  const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

  const tomorrowDate = new Date(now.getTime());
  tomorrowDate.setUTCDate(now.getUTCDate() + 1);
  const tomorrowStr = tomorrowDate.toISOString().split('T')[0];

  return matches.filter(function(m) {
    const mDateStr = (m.date || m.match_time) ? (m.date || m.match_time).split('T')[0] : todayStr;
    if (dateFilter === 'all') return true;
    if (dateFilter === 'live') return m.status === 'live' || m.is_live === true;
    if (dateFilter === 'yesterday') return mDateStr === yesterdayStr;
    if (dateFilter === 'tomorrow') return mDateStr === tomorrowStr;
    // Default 'today'
    return mDateStr === todayStr || m.status === 'live' || m.is_live === true;
  });
}

// ── 4. RESILIENT EXPONENTIAL BACKOFF RETRY ENGINE ──
async function fetchWithResilientBackoff(fetchFn, maxRetries = 3, baseDelayMs = 20) {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      const response = await fetchFn(attempt);
      if (response.ok) {
        return response;
      }
      // Client errors (400, 401, 403, 404) are NOT retryable
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        throw new Error(`CLIENT_ERROR: HTTP ${response.status} - Not retryable.`);
      }
      attempt++;
      if (attempt > maxRetries) {
        throw new Error(`HTTP_ERROR: Server returned status ${response.status} after ${maxRetries} attempts.`);
      }
    } catch (err) {
      if (err.message && err.message.startsWith('CLIENT_ERROR')) {
        throw err;
      }
      attempt++;
      if (attempt > maxRetries) {
        throw err;
      }
    }
    const exponentialDelay = Math.min(2000, baseDelayMs * Math.pow(2, attempt));
    const jitter = Math.random() * 10;
    await new Promise(r => setTimeout(r, exponentialDelay + jitter));
  }
}

// ── 5. FOTMOB TELEMETRY PARSER ──
function parseFotMobTelemetry(raw) {
  if (!raw || !raw.header) return null;
  const header = raw.header;
  const status = header.status || {};
  const teams = header.teams || [];

  return {
    homeScore: teams[0]?.score ?? null,
    awayScore: teams[1]?.score ?? null,
    isStarted: Boolean(status.started),
    isFinished: Boolean(status.finished),
    isLive: Boolean(status.started && !status.finished),
    liveMinute: status.liveTime?.short ?? (status.finished ? 'FT' : "0'"),
    period: status.scoreStr ?? ''
  };
}

// ── 6. TEST RUNNER ──
async function runAllBackendVerificationTests() {
  console.log('===============================================================');
  console.log('   ZETASPORTS BACKEND INTEGRATION & SECURITY VERIFICATION      ');
  console.log('===============================================================\n');

  // TEST 1: Supabase PostgREST Endpoint Verification with anon key
  console.log('--- TEST 1: Supabase PostgREST Endpoints & Anon Key Auth ---');
  const headers = {
    'apikey': SB_ANON_KEY,
    'Authorization': `Bearer ${SB_ANON_KEY}`,
    'Accept': 'application/json'
  };

  const endpoints = [
    { path: '/rest/v1/matches?select=*&limit=3', name: 'Canonical Matches (/matches)' },
    { path: '/rest/v1/zeta_matches?select=*&limit=3', name: 'Legacy Matches (/zeta_matches)' },
    { path: '/rest/v1/leagues?select=*&limit=3', name: 'Canonical Leagues (/leagues)' },
    { path: '/rest/v1/zeta_leagues?select=*&limit=3', name: 'Legacy Leagues (/zeta_leagues)' },
    { path: '/rest/v1/stream_links?select=*&limit=3', name: 'Canonical Stream Links (/stream_links)' },
    { path: '/rest/v1/zeta_streams?select=*&limit=3', name: 'Legacy Streams (/zeta_streams)' },
    { path: '/rest/v1/zeta_config?id=eq.global&select=*', name: 'Global CMS Config (/zeta_config)' }
  ];

  for (const ep of endpoints) {
    const res = await fetch(`${SB_URL}${ep.path}`, { headers });
    assert.strictEqual(res.status, 200, `Endpoint ${ep.name} should return HTTP 200 OK, got ${res.status}`);
    const data = await res.json();
    assert.ok(Array.isArray(data), `Endpoint ${ep.name} payload must be an array`);
    console.log(`  ✔ ${ep.name}: HTTP 200 OK (returned ${data.length} records)`);
  }

  // TEST 2: Date Filter Partitioning
  console.log('\n--- TEST 2: Strict Date Filter Logic (Yesterday, Today, Tomorrow) ---');
  const refDate = new Date('2026-11-10T12:00:00Z'); // Current simulation baseline
  const testFixtures = [
    { id: 'm-old-1', home_team: 'Ancient FC', away_team: 'Historic United', date: '2026-11-01T15:00:00Z', status: 'finished' },
    { id: 'm-old-2', home_team: 'Last Week City', away_team: 'Retro Athletic', date: '2026-11-08T18:00:00Z', status: 'finished' },
    { id: 'm-yest-1', home_team: 'Arsenal', away_team: 'Chelsea', date: '2026-11-09T20:00:00Z', status: 'finished' },
    { id: 'm-yest-2', home_team: 'Milan', away_team: 'Inter', date: '2026-11-09T19:45:00Z', status: 'finished' },
    { id: 'm-today-1', home_team: 'Real Madrid', away_team: 'Barcelona', date: '2026-11-10T20:00:00Z', status: 'scheduled' },
    { id: 'm-today-live', home_team: 'Liverpool', away_team: 'Man City', date: '2026-11-10T16:30:00Z', status: 'live', is_live: true },
    { id: 'm-tomm-1', home_team: 'Bayern', away_team: 'Dortmund', date: '2026-11-11T17:30:00Z', status: 'scheduled' },
    { id: 'm-tomm-2', home_team: 'PSG', away_team: 'Marseille', date: '2026-11-11T20:00:00Z', status: 'scheduled' },
    { id: 'm-next-week', home_team: 'Future Stars', away_team: 'Later Town', date: '2026-11-18T15:00:00Z', status: 'scheduled' }
  ];

  // A. Yesterday filter test: MUST ONLY return matches from 2026-11-09 (NOT 2026-11-01 or 2026-11-08)
  const yesterdayMatches = filterMatchesByDate(testFixtures, 'yesterday', refDate);
  assert.strictEqual(yesterdayMatches.length, 2, 'Yesterday must return exactly 2 matches from 2026-11-09');
  assert.deepStrictEqual(yesterdayMatches.map(m => m.id), ['m-yest-1', 'm-yest-2']);
  console.log('  ✔ "Yesterday" filter strictly shows preceding calendar day (2026-11-09) and rejects 2026-11-08 and 2026-11-01 historic games');

  // B. Today filter test: MUST return today's matches (2026-11-10) and active live matches
  const todayMatches = filterMatchesByDate(testFixtures, 'today', refDate);
  assert.strictEqual(todayMatches.length, 2, 'Today must return exactly 2 matches');
  assert.deepStrictEqual(todayMatches.map(m => m.id), ['m-today-1', 'm-today-live']);
  console.log('  ✔ "Today" filter strictly returns current day fixtures (2026-11-10) and live matches');

  // C. Tomorrow filter test: MUST return tomorrow's matches (2026-11-11)
  const tomorrowMatches = filterMatchesByDate(testFixtures, 'tomorrow', refDate);
  assert.strictEqual(tomorrowMatches.length, 2, 'Tomorrow must return exactly 2 matches');
  assert.deepStrictEqual(tomorrowMatches.map(m => m.id), ['m-tomm-1', 'm-tomm-2']);
  console.log('  ✔ "Tomorrow" filter strictly returns upcoming matches (2026-11-11) and excludes distant future games');

  // TEST 3: Fallback Endpoints, FotMob Parsing & Resilient Retry Engine
  console.log('\n--- TEST 3: FotMob Telemetry Parsing & Resilient Backoff ---');
  const mockFotMobPayload = {
    header: {
      status: { started: true, finished: false, scoreStr: '1 - 0', liveTime: { short: "34'" } },
      teams: [
        { name: 'Al Mokawloon Al Arab', score: 1 },
        { name: 'WE SC', score: 0 }
      ]
    }
  };
  const parsedTelemetry = parseFotMobTelemetry(mockFotMobPayload);
  assert.strictEqual(parsedTelemetry.homeScore, 1);
  assert.strictEqual(parsedTelemetry.awayScore, 0);
  assert.strictEqual(parsedTelemetry.isLive, true);
  assert.strictEqual(parsedTelemetry.liveMinute, "34'");
  console.log('  ✔ FotMob telemetry parser accurately converts upstream JSON to ZetaSports domain model');

  // Test exponential backoff recovery: simulate 2 transient failures (503) followed by success (200)
  let attemptCount = 0;
  const simulatedFlakyFetch = async (attempt) => {
    attemptCount++;
    if (attempt < 2) {
      return { ok: false, status: 503 };
    }
    return { ok: true, status: 200, json: async () => ({ status: 'success' }) };
  };
  const backoffResult = await fetchWithResilientBackoff(simulatedFlakyFetch, 3, 10);
  assert.strictEqual(backoffResult.status, 200);
  assert.strictEqual(attemptCount, 3); // Failed at 0, failed at 1, succeeded at 2
  console.log('  ✔ Exponential backoff successfully recovered after 2 transient 503 errors');

  // Test non-retryable 404 client error: should throw immediately without wasteful retries
  let clientErrAttempts = 0;
  try {
    await fetchWithResilientBackoff(async () => {
      clientErrAttempts++;
      return { ok: false, status: 404 };
    }, 3, 10);
    assert.fail('Should have thrown on 404');
  } catch (err) {
    assert.strictEqual(clientErrAttempts, 1, 'Client error 404 must not be retried');
    console.log('  ✔ Client errors (404/400) immediately abort without retry penalty');
  }

  // TEST 4: Cross-Domain Navigation & Open Redirect Protection
  console.log('\n--- TEST 4: Cross-Domain Navigation Contract & Redirection Security ---');
  assert.strictEqual(ZETA_CONFIG.detailsOrigin, 'https://www.keralahub.online');
  assert.strictEqual(ZETA_CONFIG.streamOrigin, 'http://www.zetasports.site');

  const safeNavigationTargets = [
    'https://www.keralahub.online/',
    'https://www.keralahub.online/al-mokawloon-vs-we-sc-15366038',
    'http://www.zetasports.site/?matchId=15366038&view=links',
    'http://www.zetasports.site/?stream=15366038&server=0',
    '/?links=15366038',
    '/stream/15366038',
    '/arsenal-vs-chelsea-123'
  ];

  for (const url of safeNavigationTargets) {
    assert.strictEqual(isAllowedUrl(url), true, `URL must be allowed: ${url}`);
  }
  console.log('  ✔ All genuine cross-domain internal routes and whitelisted domains are permitted');

  const adversarialTargets = [
    // Protocol-relative attacks
    '//attacker.com',
    '//evil.org/phishing',
    '//www.keralahub.online.attacker.com',
    '//zetasports.site.hacker.com',
    // Backslash-relative evasion
    '/\\attacker.com',
    '/\\www.keralahub.online',
    // Pseudo-protocols
    'javascript:alert(document.cookie)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    // External unauthorized domains
    'https://malicious-sports.com/stream',
    'http://phishing-login.com',
    'https://notkeralahub.online'
  ];

  for (const url of adversarialTargets) {
    assert.strictEqual(isAllowedUrl(url), false, `Adversarial URL must be BLOCKED: ${url}`);
  }
  console.log('  ✔ All 12 adversarial open redirect, protocol-relative, and script injection vectors strictly neutralized');

  console.log('\n===============================================================');
  console.log('  ALL BACKEND INTEGRATION & SECURITY TESTS PASSED (100% GREEN)  ');
  console.log('===============================================================\n');
}

runAllBackendVerificationTests().catch(err => {
  console.error('FATAL TEST FAILURE:', err);
  process.exit(1);
});
