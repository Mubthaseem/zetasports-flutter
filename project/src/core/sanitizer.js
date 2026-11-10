/**
 * ZetaSports Security Sanitizer Module
 * Enforces XSS escaping, dangerous protocol neutralization, and open-redirect defense.
 */

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeUrl(url) {
  if (typeof url !== 'string') return '#';
  const trimmed = url.trim();
  if (/^(?:javascript|data|vbscript):/i.test(trimmed)) return '#';
  if (trimmed.startsWith('//') || trimmed.startsWith('/\\')) return '#';
  return trimmed;
}

function isAllowedUrl(url, detailsOrigin = 'https://www.keralahub.online', streamOrigin = 'http://www.zetasports.site') {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (/^(?:javascript|data|vbscript):/i.test(trimmed)) return false;
  if (trimmed.startsWith('//') || trimmed.startsWith('/\\')) return false;
  if (trimmed.startsWith('/')) return true;
  try {
    const parsed = new URL(trimmed, detailsOrigin);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname.toLowerCase();
    const allowed = ['keralahub.online', 'www.keralahub.online', 'zetasports.site', 'www.zetasports.site'];
    if (detailsOrigin) {
      try { allowed.push(new URL(detailsOrigin).hostname.toLowerCase()); } catch(e){}
    }
    if (streamOrigin) {
      try { allowed.push(new URL(streamOrigin).hostname.toLowerCase()); } catch(e){}
    }
    return allowed.some(function(d) {
      return hostname === d || hostname.endsWith('.' + d);
    });
  } catch(e) {
    return false;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { escapeHtml, sanitizeUrl, isAllowedUrl };
}
