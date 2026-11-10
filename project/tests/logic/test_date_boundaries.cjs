/**
 * Logic Test Suite 1: Date Boundary, UTC Rollover, Leap Year & Timezone Offset Testing
 */
const assert = require('assert');
const {
  isLeapYear,
  getDaysInMonth,
  getDateKey,
  getCalendarBoundaries,
  isSameCalendarDay,
  filterMatchesByDate
} = require('../../src/core/date_filter.js');

function runDateBoundaryTests() {
  console.log('\n======================================================');
  console.log(' [LOGIC TEST SUITE 1/4] Date Boundary & Calendar Isolation');
  console.log('======================================================');

  let passedAssertions = 0;

  // --------------------------------------------------------------------------
  // TEST CASE 1: Leap Year Calculation & Month Length Accuracy
  // --------------------------------------------------------------------------
  console.log('\n[TC-1.1] Testing Leap Year Gregorian Calculations...');
  assert.strictEqual(isLeapYear(2024), true, '2024 must be recognized as a leap year');
  assert.strictEqual(isLeapYear(2028), true, '2028 must be recognized as a leap year');
  assert.strictEqual(isLeapYear(2000), true, '2000 (divisible by 400) must be a leap year');
  assert.strictEqual(isLeapYear(1900), false, '1900 (divisible by 100 but not 400) must NOT be a leap year');
  assert.strictEqual(isLeapYear(2023), false, '2023 must not be a leap year');
  assert.strictEqual(isLeapYear(2025), false, '2025 must not be a leap year');
  assert.strictEqual(isLeapYear(2026), false, '2026 must not be a leap year');
  passedAssertions += 7;

  assert.strictEqual(getDaysInMonth(2024, 2), 29, 'February 2024 must contain 29 days');
  assert.strictEqual(getDaysInMonth(2023, 2), 28, 'February 2023 must contain 28 days');
  assert.strictEqual(getDaysInMonth(2026, 2), 28, 'February 2026 must contain 28 days');
  assert.strictEqual(getDaysInMonth(2024, 1), 31, 'January 2024 must contain 31 days');
  assert.strictEqual(getDaysInMonth(2024, 4), 30, 'April 2024 must contain 30 days');
  passedAssertions += 5;
  console.log(`  ✔ Passed: Leap year algorithms verified across century & non-century boundaries.`);

  // --------------------------------------------------------------------------
  // TEST CASE 2: Leap Day Calendar Boundaries (Feb 28 -> Feb 29 -> Mar 1)
  // --------------------------------------------------------------------------
  console.log('\n[TC-1.2] Testing Leap Day Rollover Boundaries (Feb 28 - Mar 1)...');
  
  // Leap Year 2024: Reference on Feb 29
  const leapDayRef = new Date('2024-02-29T12:00:00.000Z');
  const leapBoundaries = getCalendarBoundaries(leapDayRef, 0);
  assert.strictEqual(leapBoundaries.yesterday, '2024-02-28', 'Yesterday of Feb 29 2024 must be Feb 28');
  assert.strictEqual(leapBoundaries.today, '2024-02-29', 'Today must be Feb 29 2024');
  assert.strictEqual(leapBoundaries.tomorrow, '2024-03-01', 'Tomorrow of Feb 29 2024 must be Mar 01');
  passedAssertions += 3;

  // Leap Year 2024: Reference on Mar 1
  const postLeapRef = new Date('2024-03-01T12:00:00.000Z');
  const postLeapBoundaries = getCalendarBoundaries(postLeapRef, 0);
  assert.strictEqual(postLeapBoundaries.yesterday, '2024-02-29', 'Yesterday of Mar 01 in leap year must be Feb 29');
  assert.strictEqual(postLeapBoundaries.today, '2024-03-01', 'Today must be Mar 01');
  assert.strictEqual(postLeapBoundaries.tomorrow, '2024-03-02', 'Tomorrow must be Mar 02');
  passedAssertions += 3;

  // Non-Leap Year 2023: Reference on Mar 1
  const nonLeapRef = new Date('2023-03-01T12:00:00.000Z');
  const nonLeapBoundaries = getCalendarBoundaries(nonLeapRef, 0);
  assert.strictEqual(nonLeapBoundaries.yesterday, '2023-02-28', 'Yesterday of Mar 01 in non-leap year must be Feb 28');
  passedAssertions += 1;
  console.log(`  ✔ Passed: Leap day transitions verify flawless Feb 28 -> 29 -> Mar 1 stepping.`);

  // --------------------------------------------------------------------------
  // TEST CASE 3: Midnight UTC Rollover (23:59:59Z vs 00:00:00Z)
  // --------------------------------------------------------------------------
  console.log('\n[TC-1.3] Testing Midnight UTC Rollover Precision...');
  
  const refDate = new Date('2026-11-10T12:00:00.000Z');
  const boundaries = getCalendarBoundaries(refDate, 0);
  assert.strictEqual(boundaries.yesterday, '2026-11-09');
  assert.strictEqual(boundaries.today, '2026-11-10');
  assert.strictEqual(boundaries.tomorrow, '2026-11-11');
  passedAssertions += 3;

  const matchPreMidnight = {
    id: 'm-pre-midnight',
    home_team: 'Arsenal',
    away_team: 'Chelsea',
    date: '2026-11-09T23:59:59.000Z',
    status: 'scheduled'
  };

  const matchExactMidnight = {
    id: 'm-exact-midnight',
    home_team: 'Liverpool',
    away_team: 'Everton',
    date: '2026-11-10T00:00:00.000Z',
    status: 'scheduled'
  };

  const matchPostMidnight = {
    id: 'm-post-midnight',
    home_team: 'Real Madrid',
    away_team: 'Barcelona',
    date: '2026-11-10T00:00:01.000Z',
    status: 'scheduled'
  };

  const matchNextNight = {
    id: 'm-next-night',
    home_team: 'PSG',
    away_team: 'Marseille',
    date: '2026-11-10T23:59:59.000Z',
    status: 'scheduled'
  };

  const matchTomorrowMidnight = {
    id: 'm-tomorrow-midnight',
    home_team: 'Bayern',
    away_team: 'Dortmund',
    date: '2026-11-11T00:00:00.000Z',
    status: 'scheduled'
  };

  const testBatch = [
    matchPreMidnight,
    matchExactMidnight,
    matchPostMidnight,
    matchNextNight,
    matchTomorrowMidnight
  ];

  // Filter for Yesterday (2026-11-09)
  const yesterdayList = filterMatchesByDate(testBatch, 'yesterday', refDate, 0);
  assert.strictEqual(yesterdayList.length, 1, 'Yesterday must match exactly 1 match (PreMidnight)');
  assert.strictEqual(yesterdayList[0].id, 'm-pre-midnight', 'PreMidnight (23:59:59Z) belongs to Yesterday');
  passedAssertions += 2;

  // Filter for Today (2026-11-10)
  const todayList = filterMatchesByDate(testBatch, 'today', refDate, 0);
  assert.strictEqual(todayList.length, 3, 'Today must match exactly 3 matches (00:00:00Z, 00:00:01Z, 23:59:59Z)');
  const todayIds = todayList.map(m => m.id);
  assert.ok(todayIds.includes('m-exact-midnight'), 'Exact midnight belongs to Today');
  assert.ok(todayIds.includes('m-post-midnight'), 'Post midnight belongs to Today');
  assert.ok(todayIds.includes('m-next-night'), 'Next night belongs to Today');
  assert.ok(!todayIds.includes('m-pre-midnight'), 'PreMidnight must NOT leak into Today');
  assert.ok(!todayIds.includes('m-tomorrow-midnight'), 'Tomorrow midnight must NOT leak into Today');
  passedAssertions += 6;

  // Filter for Tomorrow (2026-11-11)
  const tomorrowList = filterMatchesByDate(testBatch, 'tomorrow', refDate, 0);
  assert.strictEqual(tomorrowList.length, 1, 'Tomorrow must match exactly 1 match (TomorrowMidnight)');
  assert.strictEqual(tomorrowList[0].id, 'm-tomorrow-midnight');
  passedAssertions += 2;
  console.log(`  ✔ Passed: Midnight UTC rollover isolates 23:59:59Z from 00:00:00Z with zero leakage.`);

  // --------------------------------------------------------------------------
  // TEST CASE 4: Timezone Offset Adjustments (IST, EST, JST, Hawaii)
  // --------------------------------------------------------------------------
  console.log('\n[TC-1.4] Testing Timezone Offset Adjustments across Global Regions...');
  
  // Late evening UTC kickoff: 2026-11-10 20:00:00 UTC
  const lateUtcKickoff = '2026-11-10T20:00:00.000Z';
  
  // UTC (offset 0): still Nov 10
  assert.strictEqual(getDateKey(lateUtcKickoff, 0), '2026-11-10');
  
  // IST (+5:30 = +330 min): Nov 10 20:00 + 5.5h = Nov 11 01:30 AM -> belongs to Nov 11!
  assert.strictEqual(getDateKey(lateUtcKickoff, 330), '2026-11-11');

  // Tokyo JST (+9:00 = +540 min): Nov 10 20:00 + 9h = Nov 11 05:00 AM -> belongs to Nov 11!
  assert.strictEqual(getDateKey(lateUtcKickoff, 540), '2026-11-11');

  // New York EST (-5:00 = -300 min): Nov 10 20:00 - 5h = Nov 10 15:00 -> still Nov 10!
  assert.strictEqual(getDateKey(lateUtcKickoff, -300), '2026-11-10');

  // Early morning UTC kickoff: 2026-11-11 03:00:00 UTC
  const earlyUtcKickoff = '2026-11-11T03:00:00.000Z';

  // UTC: Nov 11
  assert.strictEqual(getDateKey(earlyUtcKickoff, 0), '2026-11-11');

  // New York EST (-300 min): Nov 11 03:00 - 5h = Nov 10 22:00 -> belongs to Nov 10!
  assert.strictEqual(getDateKey(earlyUtcKickoff, -300), '2026-11-10');

  // Honolulu Hawaii (-10:00 = -600 min): Nov 11 03:00 - 10h = Nov 10 17:00 -> belongs to Nov 10!
  assert.strictEqual(getDateKey(earlyUtcKickoff, -600), '2026-11-10');
  passedAssertions += 7;
  console.log(`  ✔ Passed: Timezone offsets correctly project UTC timestamps into local dates.`);

  // --------------------------------------------------------------------------
  // TEST CASE 5: Strict Mutual Exclusivity (No Contamination Across Tabs)
  // --------------------------------------------------------------------------
  console.log('\n[TC-1.5] Testing Strict Mutual Exclusivity Between Date Tabs...');
  
  // Set up 100 pseudo matches scattered across -3 days to +3 days
  const syntheticMatches = [];
  const baseEpoch = new Date('2026-11-10T12:00:00.000Z').getTime();
  for (let i = -72; i <= 72; i += 2) {
    syntheticMatches.push({
      id: `match-hour-${i}`,
      home_team: `Team ${i}`,
      away_team: `Opponent ${i}`,
      date: new Date(baseEpoch + (i * 3600 * 1000)).toISOString(),
      status: 'scheduled'
    });
  }

  const yList = filterMatchesByDate(syntheticMatches, 'yesterday', refDate, 0);
  const tList = filterMatchesByDate(syntheticMatches, 'today', refDate, 0);
  const mList = filterMatchesByDate(syntheticMatches, 'tomorrow', refDate, 0);

  const yIds = new Set(yList.map(m => m.id));
  const tIds = new Set(tList.map(m => m.id));
  const mIds = new Set(mList.map(m => m.id));

  // Assert empty intersection
  const yAndT = [...yIds].filter(id => tIds.has(id));
  assert.strictEqual(yAndT.length, 0, 'Yesterday and Today must have 0 overlapping matches');

  const tAndM = [...tIds].filter(id => mIds.has(id));
  assert.strictEqual(tAndM.length, 0, 'Today and Tomorrow must have 0 overlapping matches');

  const yAndM = [...yIds].filter(id => mIds.has(id));
  assert.strictEqual(yAndM.length, 0, 'Yesterday and Tomorrow must have 0 overlapping matches');
  passedAssertions += 3;

  console.log(`  ✔ Passed: Zero contamination between Yesterday (${yList.length}), Today (${tList.length}), and Tomorrow (${mList.length}).`);
  console.log(`\n✔ SUITE 1 COMPLETE: All ${passedAssertions} assertions passed successfully!`);

  return { passed: true, assertions: passedAssertions };
}

if (require.main === module) {
  runDateBoundaryTests();
}

module.exports = { runDateBoundaryTests };
