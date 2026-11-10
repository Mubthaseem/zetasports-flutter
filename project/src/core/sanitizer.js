/**
 * ZetaSports Security Sanitizer Module
 * Enforces XSS escaping and dangerous protocol neutralization.
 */

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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { escapeHtml, sanitizeUrl };
}
