/**
 * Security Test Suite: Adversarial Input Sanitization & XSS Defense
 */
const assert = require('assert');

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeUrl(url) {
  if (typeof url !== 'string') return '#';
  url = url.trim();
  if (/^javascript:/i.test(url) || /^data:/i.test(url) || /^vbscript:/i.test(url)) {
    return '#';
  }
  return url;
}

function runSecurityTests() {
  console.log('Running Security Tests: Adversarial Sanitization...');

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
  }

  // 2. URL Protocol Sanitization Tests
  const dangerousUrls = [
    'javascript:alert(1)',
    'JAVASCRIPT:/*--></title></style>*/<script>alert(1)</script>',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    ' javascript:alert(document.cookie)'
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

  console.log('✔ All Security Sanitization Tests Passed!');
}

runSecurityTests();
