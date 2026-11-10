/**
 * Logic Test Suite: Edge Cases, Null Safety & Dynamic SEO Generation
 */
const assert = require('assert');

function generateMatchSEO(home, away, league, scoreText, isLive, kickoff) {
  const h = home || 'Home Team';
  const a = away || 'Away Team';
  const l = league || 'Football';
  const s = scoreText || 'vs';

  const kw = `${h} vs ${a}, ${h} vs ${a} live score, ${h} vs ${a} stream, ${h} vs ${a} lineups, ${l} live, FotMob Scores, ZetaSports, KeralaHub`;
  const desc = `Watch ${h} vs ${a} (${s}) live score, lineup formations, H2H statistics, and HD stream gateway on ZetaSports.`;
  
  const schema = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    "name": `${h} vs ${a}`,
    "description": desc,
    "startDate": kickoff || new Date().toISOString(),
    "sport": "Soccer",
    "eventStatus": isLive ? "https://schema.org/EventLive" : "https://schema.org/EventScheduled"
  };

  return { kw, desc, schema };
}

function runLogicTests() {
  console.log('Running Logic & Edge Case Tests...');

  // Edge Case 1: Standard input
  const seo1 = generateMatchSEO('Arsenal', 'Chelsea', 'Premier League', '2 - 1', true, '2026-11-10T19:45:00Z');
  assert.ok(seo1.kw.includes('Arsenal vs Chelsea live score'));
  assert.strictEqual(seo1.schema.eventStatus, 'https://schema.org/EventLive');

  // Edge Case 2: Null / Empty values
  const seo2 = generateMatchSEO(null, undefined, '', null, false, null);
  assert.ok(seo2.kw.includes('Home Team vs Away Team'));
  assert.ok(seo2.desc.includes('(vs)'));
  assert.strictEqual(seo2.schema.eventStatus, 'https://schema.org/EventScheduled');
  assert.ok(seo2.schema.startDate, 'Fallback start date must be present');

  console.log('✔ All Logic & Edge Case Tests Passed!');
}

runLogicTests();
