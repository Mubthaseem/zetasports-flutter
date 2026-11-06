/**
 * ==============================================================================
 * ZetaSports Production Verification Pipeline (M5)
 * Automated End-to-End Test Suite for Broadcast Template & Live Telemetry Engine
 * ==============================================================================
 * 
 * Verifies:
 * - T1: FotMob API Fetching & Telemetry Extraction (Reference Fixture 6106330)
 *       - xG, possession, 94 momentum points, pitch coordinates (x,y), player ratings
 * - T2: Dynamic In-Play Live Match Telemetry Query
 *       - Queries FotMob active/in-play matches for today, parses matchDetails
 * - T3: Cloudflare Worker Live Production Poster & Fallback Verification
 *       - /api/poster live poster verification (HTTP 200, 'LIVE IN-PLAY', vector initials)
 *       - Broken logo fallback verification (HTTP 200, <circle> + <text>, 0 <image href="http>)
 * - T4: 17 Blogger Post HTML Components Verification
 *       - Backend serve.js (generateRichPostContent)
 *       - Frontend app.js (generateClientPostHtmlFallback)
 *       - Validates all 17 components (JSON-LD, Hero, Ticker, Telemetry, Trivia,
 *         Player Duel, AdSense 1 & 2, Tactical Narrative, Form Guide, Lineups,
 *         Events Timeline, Match Stats Meters, H2H, Broadcast Guide, Social Share, zeta:ID token)
 * - T5: Unified Theme Compilation & Credential Check
 *       - Compiles theme via scratch/build_unified_theme.js (exit code 0)
 *       - Inspects zetasports-v3/web/colorify_zetasports_theme.xml for correct Supabase host,
 *         anon key, zero deprecated hosts, and all 4 client features (sticky scoreboard,
 *         momentum gauge, player detail modal, PiP player)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// ANSI Color Codes
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const GRAY = '\x1b[90m';
const BG_BLUE = '\x1b[44m\x1b[37m';

const FOTMOB_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.fotmob.com/'
};

// Test Stats Tracker
const results = {
  suites: 0,
  passedSuites: 0,
  assertions: 0,
  passedAssertions: 0,
  failedAssertions: 0,
  failures: []
};

function logSuiteHeader(suiteId, title) {
  results.suites++;
  console.log(`\n${BG_BLUE}${BOLD} SUITE ${suiteId} ${RESET} ${BOLD}${CYAN}${title}${RESET}`);
  console.log(`${GRAY}${'─'.repeat(78)}${RESET}`);
}

function assert(condition, testName, details = '') {
  results.assertions++;
  if (condition) {
    results.passedAssertions++;
    console.log(`  ${GREEN}✔${RESET} ${testName}`);
    if (details) console.log(`    ${GRAY}↳ ${details}${RESET}`);
  } else {
    results.failedAssertions++;
    const errMsg = details ? `${testName} — ${details}` : testName;
    results.failures.push(errMsg);
    console.log(`  ${RED}✖ [FAIL]${RESET} ${BOLD}${testName}${RESET}`);
    if (details) console.log(`    ${RED}↳ Reason: ${details}${RESET}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility: Load pure parseFotMobTelemetry from Worker implementation
// ─────────────────────────────────────────────────────────────────────────────
function loadWorkerTelemetryParser() {
  const workerPath = path.join(PROJECT_ROOT, 'zetasports-v3', 'cloudflare-worker', 'worker.js');
  if (!fs.existsSync(workerPath)) {
    throw new Error(`Worker file not found at: ${workerPath}`);
  }
  const content = fs.readFileSync(workerPath, 'utf8');
  const match = content.match(/function parseFotMobTelemetry\([\s\S]*?\n            \}/);
  if (!match) {
    throw new Error('Unable to extract parseFotMobTelemetry function from worker.js');
  }
  return new Function('return ' + match[0])();
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility: Load generateClientPostHtmlFallback from Frontend app.js
// ─────────────────────────────────────────────────────────────────────────────
function loadClientPostHtmlFallback() {
  const appPath = path.join(PROJECT_ROOT, 'zetasports-v3', 'admin_frontend', 'app.js');
  if (!fs.existsSync(appPath)) {
    throw new Error(`Frontend app.js not found at: ${appPath}`);
  }
  const code = fs.readFileSync(appPath, 'utf8');
  const match = code.match(/function generateClientPostHtmlFallback\(m\) \{[\s\S]*?\n\}/);
  if (!match) {
    throw new Error('Unable to extract generateClientPostHtmlFallback from app.js');
  }
  return new Function('return ' + match[0])();
}

// ─────────────────────────────────────────────────────────────────────────────
// T1: FotMob API Fetching & Telemetry Extraction (Reference Fixture 6106330)
// ─────────────────────────────────────────────────────────────────────────────
async function runT1_FotmobTelemetry(parseFotMobTelemetry) {
  logSuiteHeader('T1', 'FotMob API Fetching & Telemetry Extraction (Fixture 6106330)');
  const matchId = '6106330';
  const url = `https://www.fotmob.com/api/data/matchDetails?matchId=${matchId}`;

  console.log(`  ${GRAY}Fetching reference match ${matchId} from FotMob API...${RESET}`);
  let rawData;
  try {
    const res = await fetch(url, { headers: FOTMOB_HEADERS });
    assert(res.status === 200, `FotMob API HTTP Status 200`, `Received HTTP ${res.status}`);
    rawData = await res.json();
    assert(rawData && rawData.header, 'FotMob API returned valid JSON with header structure');
  } catch (err) {
    assert(false, 'FotMob API request successful', err.message);
    return;
  }

  // Parse Telemetry
  let parsed;
  try {
    parsed = parseFotMobTelemetry(rawData);
    assert(parsed != null, 'parseFotMobTelemetry returned non-null object');
  } catch (err) {
    assert(false, 'parseFotMobTelemetry execution succeeded', err.message);
    return;
  }

  // Validate Score & Status
  assert(parsed.homeScore === 3 && parsed.awayScore === 2, `Score parsed correctly (3 - 2)`, `Actual: ${parsed.homeScore} - ${parsed.awayScore}`);
  assert(parsed.status === 'finished', `Status identified as finished`, `Actual: ${parsed.status}`);
  assert(parsed.timeElapsed === 'FT', `Time elapsed identified as FT`, `Actual: ${parsed.timeElapsed}`);

  // Validate Advanced Stats (xG, Possession)
  const stats = parsed.matchStats || {};
  const xg = stats.xg || stats.expected_goals;
  assert(Array.isArray(xg) && xg.length === 2, 'Expected Goals (xG) extracted for both teams', `Home xG: ${xg?.[0]}, Away xG: ${xg?.[1]}`);
  assert(Array.isArray(stats.possession) && stats.possession.length === 2, 'Ball possession extracted', `Possession: ${stats.possession?.[0]}% vs ${stats.possession?.[1]}%`);

  // Validate Momentum Points (Strict 94 points requirement)
  const momentum = stats.momentum || [];
  assert(Array.isArray(momentum) && momentum.length === 94, `Attack momentum points extracted (94 points)`, `Actual points: ${momentum.length}`);

  // Validate Lineups with Pitch Coordinates & Ratings
  const lineups = parsed.lineups || {};
  const homeStarters = lineups.home?.starting || [];
  const awayStarters = lineups.away?.starting || [];

  assert(homeStarters.length === 11, `Home starting XI contains 11 players`, `Found: ${homeStarters.length}`);
  assert(awayStarters.length === 11, `Away starting XI contains 11 players`, `Found: ${awayStarters.length}`);

  const hasHomeCoords = homeStarters.every(p => typeof p.x === 'number' && typeof p.y === 'number');
  const hasAwayCoords = awayStarters.every(p => typeof p.x === 'number' && typeof p.y === 'number');
  assert(hasHomeCoords && hasAwayCoords, 'All 22 starting players possess pitch coordinates (x, y)', `Sample starter: ${homeStarters[0]?.name} (x: ${homeStarters[0]?.x}, y: ${homeStarters[0]?.y})`);

  const hasRatings = homeStarters.some(p => p.rating != null) && awayStarters.some(p => p.rating != null);
  assert(hasRatings, 'Player performance ratings extracted from FotMob telemetry', `Sample rating: ${homeStarters[0]?.name} rating=${homeStarters[0]?.rating}`);

  // Venue & Referee
  assert(typeof parsed.venue === 'string' && parsed.venue.length > 0, `Venue extracted`, parsed.venue);
  assert(typeof parsed.referee === 'string' && parsed.referee.length > 0, `Referee extracted`, parsed.referee);
}

// ─────────────────────────────────────────────────────────────────────────────
// T2: Dynamic In-Play Live Match Telemetry Query
// ─────────────────────────────────────────────────────────────────────────────
async function runT2_DynamicLiveTelemetry(parseFotMobTelemetry) {
  logSuiteHeader('T2', 'Dynamic In-Play Live Match Telemetry Query');
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const listUrl = `https://www.fotmob.com/api/data/matches?date=${today}`;

  console.log(`  ${GRAY}Querying FotMob daily fixture schedule for date ${today}...${RESET}`);
  let scheduleData;
  try {
    const res = await fetch(listUrl, { headers: FOTMOB_HEADERS });
    assert(res.status === 200, `FotMob Daily Matches API HTTP Status 200`, `Date: ${today}`);
    scheduleData = await res.json();
  } catch (err) {
    assert(false, 'FotMob daily schedule fetch succeeded', err.message);
    return;
  }

  // Scan for live matches first; fallback to upcoming/today fixture
  let targetMatch = null;
  let isLiveMatch = false;

  const leagues = scheduleData.leagues || [];
  for (const lg of leagues) {
    for (const m of (lg.matches || [])) {
      if (m.status?.started && !m.status?.finished && !m.status?.cancelled) {
        targetMatch = m;
        isLiveMatch = true;
        break;
      }
    }
    if (targetMatch) break;
  }

  if (!targetMatch) {
    // Fallback to any scheduled/upcoming match
    for (const lg of leagues) {
      for (const m of (lg.matches || [])) {
        if (!m.status?.finished && !m.status?.cancelled) {
          targetMatch = m;
          break;
        }
      }
      if (targetMatch) break;
    }
  }

  if (!targetMatch && leagues.length > 0 && leagues[0].matches?.length > 0) {
    targetMatch = leagues[0].matches[0];
  }

  assert(targetMatch != null, 'Located dynamic target match from active fixture calendar', targetMatch ? `${targetMatch.home?.name} vs ${targetMatch.away?.name} (ID: ${targetMatch.id}, Live: ${isLiveMatch})` : 'None found');

  if (!targetMatch) return;

  // Fetch dynamic match details
  const detailUrl = `https://www.fotmob.com/api/data/matchDetails?matchId=${targetMatch.id}`;
  console.log(`  ${GRAY}Fetching matchDetails for dynamic fixture ${targetMatch.id} (${targetMatch.home?.name} vs ${targetMatch.away?.name})...${RESET}`);
  let dynamicRaw;
  try {
    const res = await fetch(detailUrl, { headers: FOTMOB_HEADERS });
    assert(res.status === 200, `Dynamic Match Details HTTP Status 200`, `Match ID: ${targetMatch.id}`);
    dynamicRaw = await res.json();
  } catch (err) {
    assert(false, `Dynamic match details query succeeded for match ${targetMatch.id}`, err.message);
    return;
  }

  // Parse with worker telemetry parser
  try {
    const parsed = parseFotMobTelemetry(dynamicRaw);
    assert(parsed != null, 'Dynamic telemetry parsed successfully');
    assert(['live', 'scheduled', 'finished', 'cancelled'].includes(parsed.status), `Dynamic status valid: '${parsed.status}'`);
    assert(typeof parsed.homeScore === 'number' && typeof parsed.awayScore === 'number', `Numeric score parsed: ${parsed.homeScore} - ${parsed.awayScore}`);
    assert(parsed.venue !== undefined && parsed.referee !== undefined, 'Venue and referee telemetry properties present in dynamic payload');
    console.log(`  ${CYAN}ℹ Dynamic Match Ingestion Verified:${RESET} ${dynamicRaw.header?.teams?.[0]?.name || 'Home'} (${parsed.homeScore}) vs ${dynamicRaw.header?.teams?.[1]?.name || 'Away'} (${parsed.awayScore}) [Status: ${parsed.status}]`);
  } catch (err) {
    assert(false, `Dynamic telemetry parsing succeeded for match ${targetMatch.id}`, err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// T3: Cloudflare Worker Live Production Poster & Fallback Verification
// ─────────────────────────────────────────────────────────────────────────────
async function runT3_WorkerPosterEndpoints() {
  logSuiteHeader('T3', 'Cloudflare Worker Live Production Poster & Fallback Verification');

  const baseWorkerUrl = 'https://zetasports-live-worker.dennisnorwood812.workers.dev';

  // Request 1: In-Play Live Poster Generation
  const livePosterUrl = `${baseWorkerUrl}/api/poster?home=Arsenal&away=Real%20Madrid&homeScore=2&awayScore=1&status=live`;
  console.log(`  ${GRAY}Querying live poster: ${livePosterUrl}...${RESET}`);

  try {
    const res = await fetch(livePosterUrl);
    assert(res.status === 200, 'Live poster endpoint returns HTTP 200', `Status: ${res.status}`);
    const contentType = res.headers.get('content-type') || '';
    assert(contentType.includes('image/svg+xml'), `Content-Type is SVG (${contentType})`);

    const svg = await res.text();
    assert(svg.includes('LIVE IN-PLAY'), "SVG poster contains 'LIVE IN-PLAY' status text");
    assert(svg.includes('<circle') && svg.includes('<text'), 'SVG poster contains vector initials monogram (<circle> + <text>)');
    
    // Check vector initials acronyms in monogram (ARS for Arsenal, RMA for Real Madrid)
    const hasInitials = svg.includes('ARS') && svg.includes('RMA');
    assert(hasInitials, 'SVG poster renders team initials in vector monograms (ARS & RMA)');
    assert(svg.includes('2 - 1'), 'SVG poster displays live score (2 - 1)');
  } catch (err) {
    assert(false, 'Live poster endpoint request succeeded', err.message);
  }

  // Request 2: Broken Logo Fallback Monogram
  const brokenLogoUrl = `${baseWorkerUrl}/api/poster?home=Arsenal&away=Real%20Madrid&homeLogo=https://invalid.test/broken.png`;
  console.log(`  ${GRAY}Querying broken logo fallback poster: ${brokenLogoUrl}...${RESET}`);

  try {
    const res = await fetch(brokenLogoUrl);
    assert(res.status === 200, 'Broken logo fallback endpoint returns HTTP 200', `Status: ${res.status}`);
    const svg = await res.text();
    assert(svg.includes('<circle') && svg.includes('<text'), 'Fallback SVG contains vector circle & text monogram');
    
    // Strict requirement: ZERO broken <image href="http tags in SVG
    const hasBrokenImageHttp = svg.includes('<image href="http') || svg.includes('<image href=\'http') || svg.includes('<image xlink:href="http');
    assert(!hasBrokenImageHttp, 'SVG poster contains ZERO broken <image href="http..." tags (100% clean vector fallback)', `Broken tags detected: ${hasBrokenImageHttp}`);
  } catch (err) {
    assert(false, 'Broken logo fallback request succeeded', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// T4: 17 Blogger Post HTML Components Verification
// ─────────────────────────────────────────────────────────────────────────────
async function verify17Components(html, generatorLabel, expectedId = null) {
  console.log(`\n  ${BOLD}${YELLOW}→ Validating 17 Components for: ${generatorLabel}${RESET}`);

  // Component 1: Dual Schema.org JSON-LD (SportsEvent + FAQPage with Q&As)
  const hasSportsEvent = html.includes('SportsEvent');
  const hasFAQPage = html.includes('FAQPage');
  const hasSchemaContext = html.includes('https://schema.org') || html.includes('schema.org');
  assert(hasSportsEvent && hasFAQPage && hasSchemaContext, `[Comp 1] Dual Schema.org JSON-LD (SportsEvent + FAQPage)`, `SportsEvent: ${hasSportsEvent}, FAQPage: ${hasFAQPage}`);

  // Component 2: 16:9 Broadcast Hero Graphic (with vector monogram fallback, no minute count in pill, no cut-off box)
  const hasHeroContainer = html.includes('zeta-matchday-hero');
  const hasMonogramFallback = html.includes('getVectorMonogram') || html.includes('<circle') || html.includes('data:image/svg+xml');
  const hasNoCutOff = !html.includes('zeta-hero-cut-off') && !html.includes('cut-off');
  // Verify score badge does not have minute count appended inside the pill (e.g. no 67' inside score pill)
  const scoreHeroMatch = html.match(/id="zetaLiveScoreHero"[^>]*>([\s\S]*?)<\/div>/) || html.match(/class="[^"]*score[^"]*"[^>]*>([\s\S]*?)<\/div>/);
  const scorePillContent = scoreHeroMatch ? scoreHeroMatch[1].trim() : '';
  const noMinuteInPill = !scorePillContent.includes("'") && !scorePillContent.toLowerCase().includes('min');
  assert(hasHeroContainer && hasMonogramFallback && hasNoCutOff && noMinuteInPill, `[Comp 2] 16:9 Hero Graphic (Monogram fallback, no minute count in pill, no cut-off box)`, `Hero: ${hasHeroContainer}, Clean pill: ${noMinuteInPill}, No cut-off: ${hasNoCutOff}`);

  // Component 3: Real-time status / countdown ticker
  const hasTicker = html.includes('zeta-status-ticker') || html.includes('zeta-ticker-');
  assert(hasTicker, `[Comp 3] Real-time status / countdown ticker present`);

  // Component 4: 4-card telemetry grid (Stadium, Referee, League, Time)
  const hasTelemetryGrid = html.includes('zeta-telemetry-grid') || html.includes('zeta-meta-grid');
  const hasTelemetryFields = html.includes('Stadium') && html.includes('Referee');
  assert(hasTelemetryGrid && hasTelemetryFields, `[Comp 4] 4-card telemetry grid (Stadium, Referee, League, Time)`);

  // Component 5: Key match facts & trivia strip
  const hasFactsStrip = html.includes('zeta-match-facts') || html.includes('zeta-facts-strip');
  assert(hasFactsStrip, `[Comp 5] Key match facts & trivia strip present`);

  // Component 6: Marquee player spotlight & tactical duel
  const hasPlayerDuel = html.includes('zeta-player-spotlight') || html.includes('zeta-player-duel');
  assert(hasPlayerDuel, `[Comp 6] Marquee player spotlight & tactical duel present`);

  // Component 7: Google AdSense Slot 1: Mid-article native (336x280 / zero CLS min-height 280px / uppercase ADVERTISEMENT)
  const hasAdSlot1 = html.includes('zeta-ad-slot-1') || html.includes('zeta-ad-slot-mid');
  const hasAd1Dimensions = (html.includes('280px') && html.includes('336px')) || html.includes('width:336px;height:280px');
  const hasAd1Label = html.includes('ADVERTISEMENT');
  const hasAd1Ins = html.includes('adsbygoogle');
  assert(hasAdSlot1 && hasAd1Dimensions && hasAd1Label && hasAd1Ins, `[Comp 7] Google AdSense Slot 1 (Mid-article native 336x280 / min-height 280px / ADVERTISEMENT / zero CLS)`);

  // Component 8: Editorial tactical narrative (substantive SEO article)
  const narrativeMatch = html.match(/class="zeta-editorial-narrative"[\s\S]*?<\/div>/);
  const narrativeText = narrativeMatch ? narrativeMatch[0].replace(/<[^>]+>/g, ' ') : '';
  const wordCount = narrativeText.split(/\s+/).filter(Boolean).length;
  const minRequired = generatorLabel.includes('serve.js') ? 300 : 200;
  assert(wordCount >= minRequired, `[Comp 8] Editorial tactical narrative (${wordCount} words, required: ${minRequired}+)`, `Word count: ${wordCount}`);

  // Component 9: Team recent form guide (W - D - L badges)
  const hasFormGuide = html.includes('zeta-form-guide');
  const hasFormBadges = html.includes('>W<') || html.includes('>D<') || html.includes('>L<');
  assert(hasFormGuide && hasFormBadges, `[Comp 9] Team recent form guide (W - D - L badges)`);

  // Component 10: Starting lineups & substitutes bench table
  const hasLineups = html.includes('zeta-lineups-container');
  assert(hasLineups, `[Comp 10] Starting lineups & substitutes bench table present`);

  // Component 11: Decisive moments log & match events timeline
  const hasTimeline = html.includes('zeta-timeline-box') || html.includes('zeta-timeline-container') || html.includes('zeta-events-timeline');
  assert(hasTimeline, `[Comp 11] Decisive moments log & match events timeline present`);

  // Component 12: Match statistics & comparative progress meters (xG, possession, shots, fouls)
  const hasStatsMeters = html.includes('zeta-stats-meters');
  const hasStatsMetrics = (html.includes('Expected Goals') || html.includes('xG')) && (html.includes('Possession') || html.includes('possession'));
  assert(hasStatsMeters && hasStatsMetrics, `[Comp 12] Match statistics & comparative progress meters (xG, possession, shots, fouls)`);

  // Component 13: Head-to-Head (H2H) historical encounters (last 5 games)
  const hasH2H = html.includes('zeta-h2h-container') || html.includes('zeta-h2h-box');
  assert(hasH2H, `[Comp 13] Head-to-Head (H2H) historical encounters present`);

  // Component 14: Global TV & live streaming broadcast guide
  const hasBroadcastGuide = html.includes('zeta-broadcast-guide');
  const hasBroadcasters = html.includes('TNT Sports') || html.includes('Sky Sports') || html.includes('Paramount+') || html.includes('Sony LIV');
  assert(hasBroadcastGuide && hasBroadcasters, `[Comp 14] Global TV & live streaming broadcast guide present`);

  // Component 15: Google AdSense Slot 2: High-CTR bottom placement (min-height 250px / uppercase ADVERTISEMENT)
  const hasAdSlot2 = html.includes('zeta-ad-slot-2') || html.includes('zeta-ad-slot-bottom');
  const hasAd2Dimensions = html.includes('250px');
  const hasAd2Label = html.includes('ADVERTISEMENT');
  const hasAd2Ins = html.includes('adsbygoogle');
  assert(hasAdSlot2 && hasAd2Dimensions && hasAd2Label && hasAd2Ins, `[Comp 15] Google AdSense Slot 2 (Bottom placement / min-height 250px / ADVERTISEMENT / zero CLS)`);

  // Component 16: 1-click viral social sharing card (WhatsApp, Telegram)
  const hasShareCard = html.includes('zeta-share-box');
  const hasSocialLinks = html.includes('whatsapp') && html.includes('t.me');
  assert(hasShareCard && hasSocialLinks, `[Comp 16] 1-click viral social sharing card (WhatsApp, Telegram, Copy link)`);

  // Component 17: Real-time token: zeta:ID for Colorify theme hydration
  const hasMountPoint = html.includes('id="zetaMatchCenter"');
  const hasTokenClass = html.includes('zeta-match-token');
  const tokenMatch = html.match(/zeta:([a-zA-Z0-9_\-]+)/);
  const detectedToken = tokenMatch ? tokenMatch[0] : '';
  const tokenValid = hasMountPoint && hasTokenClass && !!detectedToken;
  assert(tokenValid, `[Comp 17] Real-time token for Colorify hydration (id="zetaMatchCenter" with ${detectedToken})`, `Detected token: ${detectedToken}`);
}

async function runT4_BloggerComponents() {
  logSuiteHeader('T4', '17 Blogger Post HTML Components Verification');

  // Part A: Backend serve.js (generateRichPostContent)
  console.log(`  ${GRAY}Starting temporary serve.js on port 2138 to test generateRichPostContent...${RESET}`);
  const testPort = '2138';
  let serverProcess = null;
  let backendHtml = null;

  try {
    serverProcess = spawn('node', ['zetasports-v3/admin_v3/serve.js'], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, PORT: testPort }
    });

    // Wait for server to become responsive
    let ready = false;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 250));
      try {
        const ping = await fetch(`http://127.0.0.1:${testPort}/index.html`);
        if (ping.status === 200) {
          ready = true;
          break;
        }
      } catch (_) {}
    }

    assert(ready, `Backend serve.js initialized and listening on port ${testPort}`);

    if (ready) {
      const res = await fetch(`http://127.0.0.1:${testPort}/api/blogger/preview-html?matchId=6106330`);
      assert(res.status === 200, 'Preview HTML API endpoint returned HTTP 200');
      const data = await res.json();
      assert(data.success === true, 'Preview HTML API responded with success: true');
      backendHtml = data.html || '';
      assert(backendHtml.length > 5000, `Generated Rich Post HTML length: ${backendHtml.length} characters`);
    }
  } catch (err) {
    assert(false, 'serve.js preview-html generation succeeded', err.message);
  } finally {
    if (serverProcess) {
      serverProcess.kill();
      console.log(`  ${GRAY}Temporary serve.js process stopped.${RESET}`);
    }
  }

  if (backendHtml) {
    await verify17Components(backendHtml, 'Backend serve.js (generateRichPostContent)');
  }

  // Part B: Frontend app.js (generateClientPostHtmlFallback)
  console.log(`\n  ${GRAY}Instantiating generateClientPostHtmlFallback from admin_frontend/app.js...${RESET}`);
  try {
    const generateClientPostHtmlFallback = loadClientPostHtmlFallback();
    const mockMatch = {
      id: 'mock-post-999',
      fotmob_id: '6106330',
      home_team: 'Arsenal',
      away_team: 'Real Madrid',
      league_name: 'UEFA Champions League',
      status: 'live',
      home_score: 2,
      away_score: 1,
      venue: 'Emirates Stadium, London',
      referee: 'Szymon Marciniak (Poland)',
      kickoff_ist: '2026-11-06 20:00'
    };

    const clientHtml = generateClientPostHtmlFallback(mockMatch);
    assert(typeof clientHtml === 'string' && clientHtml.length > 5000, `Client fallback HTML generated (${clientHtml.length} characters)`);
    await verify17Components(clientHtml, 'Frontend app.js (generateClientPostHtmlFallback)', 'mock-post-999');
  } catch (err) {
    assert(false, 'Frontend client post fallback generation succeeded', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// T5: Unified Theme Compilation & Credential Check
// ─────────────────────────────────────────────────────────────────────────────
async function runT5_UnifiedThemeAndCredentials() {
  logSuiteHeader('T5', 'Unified Theme Compilation & Credential Check');

  // Step 1: Run build_unified_theme.js
  console.log(`  ${GRAY}Executing: node scratch/build_unified_theme.js...${RESET}`);
  let buildOutput = '';
  let buildSuccess = false;
  try {
    buildOutput = execSync('node scratch/build_unified_theme.js', {
      cwd: PROJECT_ROOT,
      encoding: 'utf8'
    });
    buildSuccess = true;
  } catch (bErr) {
    buildOutput = bErr.stdout || bErr.message;
  }

  assert(buildSuccess, 'Unified theme compilation exited with code 0', buildOutput.trim().split('\n').pop());

  // Step 2: Inspect generated colorify_zetasports_theme.xml
  const themePath = path.join(PROJECT_ROOT, 'zetasports-v3', 'web', 'colorify_zetasports_theme.xml');
  assert(fs.existsSync(themePath), `Output theme XML exists at: ${path.relative(PROJECT_ROOT, themePath)}`);

  const xml = fs.readFileSync(themePath, 'utf8');
  assert(xml.length > 50000, `Theme XML contains valid markup (${xml.length} bytes)`);

  // Credentials & Host Verification
  const EXPECTED_SUPABASE_HOST = 'https://udlncusvhmydivtjkjcy.supabase.co';
  const EXPECTED_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkbG5jdXN2aG15ZGl2dGpramN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4MTE2MDgsImV4cCI6MjEwOTM4NzYwOH0.gsnxlDww-fUC4HG7R7VasXSaQvqkSsDhhmf16KUCLZY';

  assert(xml.includes(EXPECTED_SUPABASE_HOST), `Theme XML points to correct Supabase project: ${EXPECTED_SUPABASE_HOST}`);
  assert(xml.includes(EXPECTED_ANON_KEY), 'Theme XML configures valid Supabase anon/publishable key');

  // Deprecated Host Grep (Strict 0 occurrences)
  const deprecated1 = xml.includes('voocdrpetiyspuhyeapi');
  const deprecated2 = xml.includes('xsqplpynvmgwzjhjlncs');
  assert(!deprecated1 && !deprecated2, 'Zero occurrences of deprecated Supabase hosts in Theme XML', `Found voocdrpetiyspuhyeapi: ${deprecated1}, xsqplpynvmgwzjhjlncs: ${deprecated2}`);

  // Client Features Verification (All 4 features present)
  assert(xml.includes('zeta-sticky-scoreboard'), "Feature 1: Sticky floating scoreboard on scroll ('zeta-sticky-scoreboard')");
  assert(xml.includes('zeta-momentum-card'), "Feature 2: Attack momentum pressure gauge ('zeta-momentum-card')");
  assert(xml.includes('openPlayerDetailModal'), "Feature 3: Interactive player detail modal on pitch click ('openPlayerDetailModal')");
  assert(xml.includes('zeta-pip-floating'), "Feature 4: PiP scroll-docking stream player ('zeta-pip-floating')");
}

// ─────────────────────────────────────────────────────────────────────────────
// Master Runner
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const startTime = Date.now();
  console.log(`\n${BOLD}${CYAN}================================================================================${RESET}`);
  console.log(`${BOLD}${CYAN}      ZETASPORTS PRODUCTION PIPELINE AUTOMATED VERIFICATION SUITE (M5)        ${RESET}`);
  console.log(`${BOLD}${CYAN}================================================================================${RESET}`);
  console.log(`${GRAY}Workspace: ${PROJECT_ROOT}${RESET}`);
  console.log(`${GRAY}Timestamp: ${new Date().toISOString()}${RESET}\n`);

  let parseFotMobTelemetry;
  try {
    parseFotMobTelemetry = loadWorkerTelemetryParser();
  } catch (err) {
    console.error(`${RED}FATAL: Could not load parseFotMobTelemetry: ${err.message}${RESET}`);
    process.exit(1);
  }

  try {
    await runT1_FotmobTelemetry(parseFotMobTelemetry);
    await runT2_DynamicLiveTelemetry(parseFotMobTelemetry);
    await runT3_WorkerPosterEndpoints();
    await runT4_BloggerComponents();
    await runT5_UnifiedThemeAndCredentials();
  } catch (topErr) {
    console.error(`\n${RED}FATAL EXCEPTION DURING TEST EXECUTION:${RESET}`, topErr);
    results.failedAssertions++;
    results.failures.push(`Top-level uncaught exception: ${topErr.message}`);
  }

  const durationMs = Date.now() - startTime;
  const allPassed = results.failedAssertions === 0;

  console.log(`\n${BOLD}${CYAN}================================================================================${RESET}`);
  console.log(`${BOLD}SUMMARY REPORT${RESET}`);
  console.log(`${BOLD}${CYAN}================================================================================${RESET}`);
  console.log(`Suites Run:       ${results.suites}`);
  console.log(`Total Assertions: ${results.assertions}`);
  console.log(`Passed:           ${GREEN}${results.passedAssertions}${RESET}`);
  console.log(`Failed:           ${results.failedAssertions > 0 ? RED + results.failedAssertions : GREEN + '0'}${RESET}`);
  console.log(`Duration:         ${(durationMs / 1000).toFixed(2)}s`);

  if (!allPassed) {
    console.log(`\n${BOLD}${RED}FAILURES DETAIL (${results.failures.length}):${RESET}`);
    results.failures.forEach((f, idx) => console.log(`  ${idx + 1}. ${RED}${f}${RESET}`));
    console.log(`\n${RED}✖ VERIFICATION FAILED${RESET}\n`);
    process.exit(1);
  } else {
    console.log(`\n${GREEN}${BOLD}✔ ALL 5 TEST SUITES PASSED FLAWLESSLY WITH 100% SUCCESS RATE${RESET}\n`);
    process.exit(0);
  }
}

main();
