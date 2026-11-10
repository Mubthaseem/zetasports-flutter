# Cybersecurity & Anti-Exploitation Standards

**Standard:** OWASP Top 10 & Application Security Verification Standard (ASVS)  
**Author:** Senior Cybersecurity Engineer  
**Version:** 3.6.0  

---

## 1. Zero Token & Secret Leak Guarantee

All theme files, client-side bundles, and public URLs must adhere to strict credential isolation:
- **No Service Role Keys**: Never embed `service_role` or elevated database secrets in Blogger XML templates or client JavaScript.
- **Scraped URL Sanitization**: Never expose raw database connection strings or scraper authorization tokens in query parameters.
- **Automated Scanning**: The verification script `node scripts/verify_colorify_parity.cjs` scans all XML and JS files for high-entropy tokens and API keys prior to any release.

---

## 2. Input Sanitization & XSS Defenses

Dynamic payloads retrieved from external APIs (FotMob, streaming servers, commentator feeds) undergo mandatory escaping before DOM insertion:

### 1. HTML Escaping Function
```javascript
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
```
*Enforced across team crest names, stadium titles, referee labels, commentary feeds, and announcements.*

### 2. URL Protocol Sanitization
```javascript
function sanitizeUrl(url) {
  if (typeof url !== 'string') return '#';
  url = url.trim();
  if (/^javascript:/i.test(url) || /^data:/i.test(url) || /^vbscript:/i.test(url)) {
    return '#';
  }
  return url;
}
```
*Protects stream link buttons, navigation menus, and external partner links from script injection.*

---

## 3. Iframe Player Sandboxing

All embedded stream iframes are isolated with restricted permissions to prevent parent-window hijacking, pop-unders, or unauthorized top-level navigation:

```html
<iframe 
  id="streamIframe" 
  sandbox="allow-scripts allow-same-origin allow-presentation allow-fullscreen"
  referrerpolicy="no-referrer"
  allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
  src="about:blank">
</iframe>
```
- Disallows `allow-top-navigation` to prevent shady stream hosts from redirecting the user away from ZetaSports.
- Disallows `allow-modals` and `allow-popups` to block unwanted spam popups.
- Enforces `referrerpolicy="no-referrer"` to protect user privacy.
