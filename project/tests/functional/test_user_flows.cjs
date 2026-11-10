/**
 * Functional Test Suite: Core User Navigation & Flows
 */
const assert = require('assert');

function testNavigationRouting() {
  console.log('Running Functional Tests: Navigation & Routing...');
  
  // Test Match ID regex extraction
  const url1 = 'https://www.keralahub.online/al-mokawloon-al-arab-vs-we-sc-15366038-b321-4e06-a42c-90712b422692';
  const matchIdRegex = /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i;
  const match1 = url1.match(matchIdRegex);
  
  assert.ok(match1, 'Match UUID should be extracted from slug URL');
  assert.strictEqual(match1[1], '15366038-b321-4e06-a42c-90712b422692', 'Extracted UUID must match exactly');
  
  // Test Link selection parameter
  const url2 = 'https://www.keralahub.online/?links=15366038-b321-4e06-a42c-90712b422692';
  const linksParam = new URL(url2).searchParams.get('links');
  assert.strictEqual(linksParam, '15366038-b321-4e06-a42c-90712b422692', 'Query param links must be resolved');

  console.log('✔ All Functional Navigation Tests Passed!');
}

testNavigationRouting();
