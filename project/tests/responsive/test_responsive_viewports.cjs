/**
 * Responsive Test Suite: Viewport Dimensions, Touch Targets & Overflow Validation
 */
const assert = require('assert');
const fs = require('fs');

function testResponsiveCSS() {
  console.log('Running Responsive Tests: Collision Guards & Viewports...');

  const masterCss = fs.readFileSync('web/css/zetasports-core.css', 'utf8');

  // Verify responsive media queries are present
  assert.ok(masterCss.includes('@media screen and (max-width: 768px)'), 'Mobile 768px breakpoint must exist');
  assert.ok(masterCss.includes('@media (max-width: 600px)'), 'Scoreboard 600px mobile collision scaling must exist');
  assert.ok(masterCss.includes('@media screen and (min-width: 769px) and (max-width: 1024px)'), 'Tablet breakpoint must exist');

  // Verify touch target compliance rules
  assert.ok(masterCss.includes('min-height: 44px'), '44px minimum touch targets must be defined');

  // Verify zero-overflow safety rules
  assert.ok(masterCss.includes('overflow-x: hidden'), 'overflow-x hidden guard must be active');

  console.log('✔ All Responsive Collision & Viewport Tests Passed!');
}

testResponsiveCSS();
