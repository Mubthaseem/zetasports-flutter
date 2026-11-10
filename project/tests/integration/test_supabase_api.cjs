/**
 * Integration Test Suite: Supabase REST API & Config Endpoints
 */
const assert = require('assert');

async function testSupabaseIntegration() {
  console.log('Running Integration Tests: Supabase REST API...');
  
  const SB_URL = 'https://udlncusvhmydivtjkjcy.supabase.co';
  const SB_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkbG5jdXN2aG15ZGl2dGpramN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4MTE2MDgsImV4cCI6MjEwOTM4NzYwOH0.gsnxlDww-fUC4HG7R7VasXSaQvqkSsDhhmf16KUCLZY';

  const res = await fetch(`${SB_URL}/rest/v1/zeta_config?id=eq.global&select=*`, {
    headers: {
      'apikey': SB_ANON_KEY,
      'Authorization': `Bearer ${SB_ANON_KEY}`
    }
  });

  assert.strictEqual(res.status, 200, 'Supabase REST API should return 200 OK');
  const data = await res.json();
  assert.ok(Array.isArray(data) && data.length > 0, 'zeta_config should return array with global row');
  assert.ok(data[0].site_title, 'zeta_config must contain site_title');
  assert.ok(data[0].seo_keywords, 'zeta_config must contain seo_keywords');

  console.log('✔ All Integration API Tests Passed! Response:', data[0].site_title);
}

testSupabaseIntegration().catch(err => {
  console.error('Integration test failed:', err);
  process.exit(1);
});
