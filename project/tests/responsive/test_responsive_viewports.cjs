/**
 * Responsive Test Suite: Viewport Dimensions, Touch Targets, Collision Guards & Theme Verification
 */
const assert = require('assert');
const fs = require('fs');

function testResponsiveCSS() {
  console.log('Running Responsive Tests: Collision Guards & Viewports...');

  const masterCss = fs.readFileSync('web/css/zetasports-core.css', 'utf8');

  // 1. Verify responsive media queries are present
  assert.ok(masterCss.includes('@media screen and (max-width: 768px)'), 'Mobile 768px breakpoint must exist');
  assert.ok(masterCss.includes('@media (max-width: 600px)'), 'Scoreboard 600px mobile collision scaling must exist');
  assert.ok(masterCss.includes('@media screen and (min-width: 769px) and (max-width: 1024px)'), 'Tablet breakpoint must exist');

  // 2. Verify touch target compliance rules
  assert.ok(masterCss.includes('min-height: 44px') || masterCss.includes('min-height: var(--zeta-touch-min, 44px)'), '44px minimum touch targets must be defined');
  assert.ok(masterCss.includes('--zeta-touch-min: 44px'), '--zeta-touch-min token must be 44px');

  // 3. Verify zero-overflow safety rules
  assert.ok(masterCss.includes('overflow-x: hidden'), 'overflow-x hidden guard must be active');

  // 4. Verify 104% mobile card collision resolution
  assert.ok(masterCss.includes('flex: 1 1 0%'), 'flex: 1 1 0% must be defined for fluid team card containment');
  assert.ok(masterCss.includes('min-width: 0'), 'min-width: 0 must override intrinsic text box blowout');
  assert.ok(masterCss.includes('text-overflow: ellipsis'), 'text-overflow ellipsis must be active on team names');

  // 5. Verify Scoreboard Hero non-transparent background
  assert.ok(masterCss.includes('#111827'), 'Scoreboard must have #111827 solid fallback');
  assert.ok(masterCss.includes('linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'), 'Scoreboard must have dark gradient header');

  // 6. Verify Design System Tokens
  const requiredTokens = [
    '--zeta-dark-bg:', '--zeta-dark-card:', '--zeta-dark-surface-raised:',
    '--zeta-dark-border:', '--zeta-accent:', '--zeta-action-blue:',
    '--zeta-dark-text:', '--zeta-dark-muted:', '--zeta-live-green:',
    '--zeta-text-display-xl:', '--zeta-text-h1:', '--zeta-text-h2:',
    '--zeta-space-1:', '--zeta-space-2:', '--zeta-space-4:', '--zeta-space-6:',
    '--zeta-radius-md:', '--zeta-radius-lg:', '--zeta-shadow-lg:', '--zeta-touch-min:'
  ];
  for (const token of requiredTokens) {
    assert.ok(masterCss.includes(token), `Design system token must exist: ${token}`);
  }

  // 7. Verify Korra Theme Iframe Sandboxing & Touch Targets
  const korraXml = fs.readFileSync('zetasports-korra-blogger-theme.xml', 'utf8');
  assert.ok(korraXml.includes('sandbox="allow-scripts allow-same-origin allow-presentation"'), 'Korra stream player iframe must be sandboxed');
  assert.ok(korraXml.includes('zeta-server-btn'), 'Korra server switcher must use zeta-server-btn touch class');

  // 8. Verify Colorify Theme Permalink Hydration & Scoreboard Contrast
  const colorifyXml = fs.readFileSync('zetasports-colorify-blogger-theme.xml', 'utf8');
  assert.ok(colorifyXml.includes('window.openMatchPage = async function'), 'Colorify openMatchPage must be async for permalink hydration');
  assert.ok(colorifyXml.includes('background:linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'), 'Colorify matchBox must render dark gradient scoreboard');

  // 9. Verify packaged deliverables in project/src/
  assert.ok(fs.existsSync('project/src/css/zetasports-core.css'), 'Packaged core CSS must exist');
  assert.ok(fs.existsSync('project/src/themes/zetasports-colorify-blogger-theme.xml'), 'Packaged Colorify theme must exist');
  assert.ok(fs.existsSync('project/src/themes/zetasports-korra-blogger-theme.xml'), 'Packaged Korra theme must exist');

  console.log('✔ All Responsive Collision, Viewport & Deliverable Verification Tests Passed!');
}

testResponsiveCSS();
