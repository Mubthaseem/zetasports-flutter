/**
 * Security Test Suite: Adversarial Input Sanitization, XSS Defense & Open Redirect Protection
 */
const assert = require('assert');
const { escapeHtml, sanitizeUrl, isAllowedUrl } = require('../../src/core/sanitizer.js');

function runSecurityTests() {
  console.log('Running Security Tests: Adversarial Sanitization & Redirect Defense...');

  // 1. XSS Escaping Tests
  const xssPayloads = [
    '<script>alert("xss")</script>',
    '<img src=x onerror=alert(1)>',
    '"><script src=evil.com></script>',
    '\' onfocus="alert(1)" autofocus'
  ];

  for (const p of xssPayloads) {
    const escaped = escapeHtml(p);
    assert.ok(!escaped.includes('<script>'), `Payload must be escaped: ${p}`);
    assert.ok(!escaped.includes('<img'), `Img tag must be escaped: ${p}`);
    assert.ok(!escaped.includes('"'), `Quotes must be escaped: ${p}`);
    assert.ok(!escaped.includes("'"), `Single quotes must be escaped: ${p}`);
  }

  // 2. URL Protocol Sanitization Tests
  const dangerousUrls = [
    'javascript:alert(1)',
    'JAVASCRIPT:/*--></title></style>*/<script>alert(1)</script>',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    ' javascript:alert(document.cookie)',
    '//attacker.com/malicious',
    '/\\attacker.com/bypass'
  ];

  for (const u of dangerousUrls) {
    const sanitized = sanitizeUrl(u);
    assert.strictEqual(sanitized, '#', `Dangerous URL must be neutralized to #: ${u}`);
  }

  const safeUrls = [
    'https://www.keralahub.online',
    'http://www.zetasports.site',
    'https://t.me/zetasports_official'
  ];

  for (const u of safeUrls) {
    assert.strictEqual(sanitizeUrl(u), u, `Safe URL must be preserved: ${u}`);
  }

  // 3. Open Redirect & isAllowedUrl Validation
  const allowedUrls = [
    'https://www.keralahub.online/match-123',
    'http://www.zetasports.site/?stream=123',
    'https://keralahub.online/today',
    '/stream/123',
    '/?links=123'
  ];

  for (const u of allowedUrls) {
    assert.strictEqual(isAllowedUrl(u), true, `Legitimate URL must be permitted: ${u}`);
  }

  const blockedRedirects = [
    '//attacker.com',
    '/\\attacker.com',
    '//keralahub.online.attacker.com',
    'https://evil-stream.com',
    'javascript:alert(1)'
  ];

  for (const u of blockedRedirects) {
    assert.strictEqual(isAllowedUrl(u), false, `Malicious or external URL must be blocked: ${u}`);
  }

  console.log('✔ All Security Sanitization & Redirect Defense Tests Passed!');
}

runSecurityTests();
