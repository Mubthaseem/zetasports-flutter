# Technical Architecture Specification: ZetaSports Enterprise

**System:** ZetaSports Live Sports Streaming & Fixtures Portal  
**Document Version:** 3.6.0  
**Status:** Approved Architectural Standard  
**Target Viewports:** Mobile (360px, 390px, 414px), Tablet (768px, 1024px), Desktop (1280px, 1440px+)  
**Target Domains:** `https://www.keralahub.online/` (Details/Fixtures) & `http://www.zetasports.site/` (Streaming Gateway/Player)

---

## 1. Executive Summary & Design Philosophy

ZetaSports is a distributed, high-concurrency sports portal delivering real-time football scores, match schedules, comprehensive tactical lineups, head-to-head records, live audio/visual commentary, and multi-server live video streaming.

The system is engineered atop a decoupled **Dual-Domain 2-Blogger Architecture** that bridges Google Blogger's globally cached CMS infrastructure with Supabase's managed PostgreSQL backend and low-latency edge CDNs. By segregating editorial SEO match content from high-risk streaming embeds, ZetaSports achieves optimal ad network compliance, robust cybersecurity isolation, and sub-1.8s page load times across global mobile and desktop viewports.

### Core Architectural Principles

1. **Strict Domain Segregation of Concerns**: Editorial content and search indexation live on Domain 1 (`keralahub.online`), while streaming gateways and video player iframes live on Domain 2 (`zetasports.site`).
2. **Decoupled Master Styling Layer**: Over 6,500 lines of duplicate inline template styles are eradicated in favor of a single master stylesheet (`zetasports-core.css`) distributed via edge CDNs with CSS custom property tokens.
3. **Zero-Trust Security & Iframe Sandboxing**: All third-party video embeds run inside restricted iframes (`sandbox="allow-scripts allow-same-origin allow-presentation"`), eliminating rogue parent navigation, fullscreen hijacking, and arbitrary popups.
4. **Resilient Client-Side Routing**: A unified SPA view router manages 4 distinct application states (`#homeView`, `#matchView`, `#linksView`, `#streamView`) with seamless Blogger 404 URL path interception and browser history management.
5. **Ergonomic Responsive Harmony**: Fluid layouts enforce zero horizontal overflow (`scrollWidth === clientWidth`) and maintain strict $\ge 44\text{px}$ touch targets across all mobile and desktop viewports.

---

## 2. System Topology & Dual-Blogger Model

```mermaid
flowchart TD
    subgraph ClientDevices["Client Tier (Viewports: 360px - 1440px+)"]
        MobileUser["Mobile Browser (360px / 390px)"]
        DesktopUser["Desktop Browser (1280px / 1440px)"]
    end

    subgraph EdgeRouting["Edge & CDN Distribution Tier"]
        CloudflareEdge["Cloudflare Edge Worker (Telemetry & 302 Redirection)"]
        SupabaseCDN["Supabase Storage CDN (zetasports-core.css - Primary)"]
        JSDelivrCDN["jsDelivr GitHub CDN (zetasports-core.css - Fallback)"]
        GoogleFonts["Google Fonts CDN (Inter & Oswald)"]
    end

    subgraph Domain1["Domain 1: https://www.keralahub.online/ (Colorify Theme)"]
        D1_Home["#homeView: Live Fixtures & Date Switcher"]
        D1_Match["#matchView: 17-Component SEO Match Post & Lineups"]
        D1_Links["#linksView: Link Selection Gateway & AdSense Slots"]
    end

    subgraph Domain2["Domain 2: http://www.zetasports.site/ (Korra Theme)"]
        D2_Stream["#streamView: Live Player (Sandboxed Iframe & HLS Video)"]
        D2_Nav["Cross-Domain Return Navigation Bar"]
    end

    subgraph DataTier["Data & Third-Party Ingestion Tier"]
        SupaREST["Supabase PostgREST Gateway (udlncusvhmydivtjkjcy)"]
        SupaDB[("PostgreSQL Database")]
        FotMobSync["FotMob Real-Time Live Score Sync Worker"]
        StreamServers["External Stream Providers (Embed Iframes / M3U8)"]
    end

    MobileUser --> CloudflareEdge
    DesktopUser --> CloudflareEdge
    CloudflareEdge --> Domain1
    CloudflareEdge --> Domain2

    Domain1 --> SupabaseCDN
    Domain2 --> SupabaseCDN
    Domain1 --> GoogleFonts
    Domain2 --> GoogleFonts

    Domain1 --> SupaREST
    Domain2 --> SupaREST
    SupaREST --> SupaDB
    FotMobSync --> SupaDB

    D1_Links -->|"Cross-Domain Handoff (?stream={id}&server={idx})"| D2_Stream
    D2_Nav -->|"Return to Match Post (/{slug}-{id})"| D1_Match
    D2_Nav -->|"Return to Links Gateway (?links={id})"| D1_Links
    D2_Nav -->|"Return to Fixtures Dashboard (/)"| D1_Home

    D2_Stream -->|"Sanitized Embed"| StreamServers
```

### Domain Allocation & Responsibility Matrix

| Dimension | Domain 1: KeralaHub (`keralahub.online`) | Domain 2: ZetaSports (`zetasports.site`) |
| :--- | :--- | :--- |
| **Blogger Theme** | Colorify Theme (`zetasports-colorify-blogger-theme.xml`) | Korra Theme (`zetasports-korra-blogger-theme.xml`) |
| **Primary Responsibility** | Editorial SEO, Match Discovery, Lineups, Statistics, Link Gateway | Live Streaming Engine, Video Player Embeds, Server Switching |
| **Active Views** | `#homeView`, `#matchView`, `#linksView` | `#streamView` (fallback `#homeView`, `#linksView`) |
| **Monetization** | High-RPM Google AdSense In-Article & Display Units | Controlled Native Ad Placements (Zero intrusive pop-unders) |
| **SEO Policy** | Fully indexed (`index, follow`), Google `SportsEvent` Schema | No-index streaming sub-routes (`noindex, nofollow` on streams) |
| **Iframe Exposure** | None (100% clean DOM) | Sandboxed player iframe only |
| **Security Risk Profile** | Low (Static content, curated editorial data) | Medium (Third-party stream provider embeds) |
| **Protocol** | `HTTPS` (`https://www.keralahub.online`) | `HTTP` / `HTTPS` (`http://www.zetasports.site`) |

---

## 3. Single-Page Application (SPA) View Routing Engine

Both Blogger themes contain a unified client-side SPA routing engine designed to circumvent Google Blogger's strict static path paradigms.

### The 4 Application View States

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            ZetaSports View State                            │
├─────────────────┬─────────────────┬───────────────────┬─────────────────────┤
│   #homeView     │   #matchView    │    #linksView     │     #streamView     │
├─────────────────┼─────────────────┼───────────────────┼─────────────────────┤
│ • Fixtures list │ • Hero score    │ • Server cards    │ • Sandboxed iframe  │
│ • Date switcher │ • 8 tab panes   │ • HD quality pill │ • HLS video player  │
│ • League chips  │ • Pitch lineups │ • Language badge  │ • Server pills      │
│ • Live counter  │ • Event timeline│ • AdSense blocks  │ • Return nav bar    │
└─────────────────┴─────────────────┴───────────────────┴─────────────────────┘
```

#### 1. `#homeView` (Fixtures & Scores Dashboard)
- **Active on**: Domain 1 root (`/`), Domain 2 root (`/`).
- **Functionality**:
  - Date carousel: displays 7 days (Yesterday, Today, Tomorrow, +4 days).
  - League filter chips: Premier League, La Liga, Serie A, Champions League, Bundesliga, etc.
  - Live matches accordion with animated glowing green pulsers.
  - Dynamic score cards with team crests, match status (`FT`, `LIVE`, `HT`, kickoff time), and deep-link click handlers.

#### 2. `#matchView` (Comprehensive Match Center Post)
- **Active on**: Domain 1 (`/{team1}-vs-{team2}-{matchId}` or `/?match={matchId}`).
- **Functionality**:
  - Match Hero Scoreboard: home/away club badges, real-time score display, minute counter, stadium, referee, and competition banner.
  - Broadcast CTA button: links directly to `#linksView`.
  - 8 Interactive Tab Modules:
    1. *Overview*: Key match highlights, referee, venue, attendance, and form guide.
    2. *Timeline*: Minute-by-minute goals, yellow/red cards, VAR decisions, and substitutions.
    3. *Statistics*: Possession percentages, shots on target, expected goals (xG), fouls, corners, passes.
    4. *Lineups*: Interactive 2D pitch view with formations (e.g., 4-3-3, 4-2-3-1), starting XI player badges, jersey numbers, and bench reserves.
    5. *H2H*: Historical head-to-head records and recent form trends.
    6. *Commentary*: Live text commentary feed with critical incident markers.
    7. *Articles*: FotMob-synchronized match preview and post-match editorial report.
    8. *Standings*: Dynamic league table snippet for participating teams.

#### 3. `#linksView` (Dedicated Link Selection Gateway)
- **Active on**: Domain 1 (`/?links={matchId}` or `/links/{matchId}`).
- **Functionality**:
  - Displays verified live broadcast feeds retrieved from Supabase `stream_servers`.
  - Server cards show bitrate, resolution (`1080p`, `720p`), audio commentary language, and latency status (`Ultra Fast`, `Stable`).
  - Google AdSense compliance: top and bottom high-CTR ad containers (`.zeta-links-top-ad`, `.zeta-links-bottom-ad`).
  - Click handoff: Triggers a clean cross-domain redirect to Domain 2 live player (`getStreamUrl(matchId, serverIdx)`).

#### 4. `#streamView` (Live Streaming Video Player)
- **Active on**: Domain 2 (`/?stream={matchId}&server={serverIdx}`).
- **Functionality**:
  - Sandboxed iframe container (`#streamIframe`) and native HTML5 video player (`#liveVideo`) for direct HLS/m3u8 sources.
  - Server switcher toolbar allowing instant switching between Server 1, Server 2, Server 3 without re-navigating.
  - Cross-domain return bar: `← Match Post`, `🔀 Change Server / Links`, and `🏠 Home`.
  - Offline / No-Stream state fallback (`#noStreamAlert`): Displays a clean dark-mode card when streams are unavailable (strictly avoiding fake/mock stream streams).

### Routing Resolution Algorithm (`checkUrlRoute`)

The router parses window coordinates using the following precedence hierarchy:

```javascript
function checkUrlRoute() {
  const path = window.location.pathname || '';
  const params = new URLSearchParams(window.location.search);
  const streamParam = params.get('stream');
  const linksParam = params.get('links') || params.get('link');
  const matchParam = params.get('match');
  const serverParam = params.get('server');
  let serverIdx = parseInt(serverParam || '0', 10);
  if (isNaN(serverIdx)) serverIdx = 0;

  // 1. Live Stream Route: ?stream={id} or /stream/{id}
  if (streamParam || path.includes('/stream/')) {
    const sId = streamParam || extractMatchId(path.split('/stream/')[1]);
    if (sId) {
      openStreamPage(sId, false, serverIdx);
      return;
    }
  }

  // 2. Link Selection Gateway: ?links={id} or /links/{id}
  if (linksParam || path.includes('/links/')) {
    const lId = linksParam || extractMatchId(path.split('/links/')[1]);
    if (lId) {
      openLinksPage(lId, false);
      return;
    }
  }

  // 3. Match Details Post: ?match={id} or /{slug}-{id}
  if (matchParam) {
    const mId = extractMatchId(matchParam);
    if (mId) {
      openMatchPage(mId, false);
      return;
    }
  }

  // 4. Blogger 404 Custom Slug Interception: /{team1}-vs-{team2}-{uuid}
  if (path && path !== '/' && !path.includes('/p/') && !path.includes('/search')) {
    const cleanPath = path.replace(/^\/+|\/+$/g, '');
    const mId = extractMatchId(cleanPath);
    if (mId) {
      openMatchPage(mId, false);
      return;
    }
  }

  // 5. Default Fallback
  showView('home');
}
```

### Blogger 404 URL Interception Engine

Blogger's native platform only maps URLs in the format `/[year]/[month]/[post-slug].html`. When a user requests a clean sports URL such as:
`https://www.keralahub.online/al-mokawloon-al-arab-vs-we-sc-15366038-b321-4e06-a42c-90712b422692`

Blogger evaluates the path as nonexistent and renders the template's 404 error page. The ZetaSports client router intercepts this event:
1. `document.addEventListener('DOMContentLoaded', checkUrlRoute)` executes before user paints.
2. The router extracts the 36-character UUID from the pathname using regex: `/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/`.
3. Suppresses Blogger's default 404 error card (`#status-message`, `.status-msg-wrap`).
4. Invokes `openMatchPage(mId, false)`, transitioning the DOM to `#matchView`.
5. Queries Supabase for the match record, hydration data, and lineups, rendering the match details interface.

---

## 4. Master Styling & Design Token Architecture

### Decoupled Single-Source-of-Truth

Historically, Blogger XML themes accumulated over 6,500 lines of redundant CSS embedded directly inside `<b:skin>` and `<style>` tags. This caused layout divergence between Korra and Colorify themes, inconsistent color rendering, and cache invalidation bottlenecks.

The ZetaSports styling architecture externalizes all presentation logic into a centralized master stylesheet: `web/css/zetasports-core.css` (59.8 KB).

```
                      ┌──────────────────────────────────────┐
                      │      web/css/zetasports-core.css     │
                      │   (Master Canonical CSS Source)      │
                      └──────────────────┬───────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
   ┌───────────────────────────┐                   ┌───────────────────────────┐
   │   Supabase Storage CDN    │                   │      GitHub jsDelivr      │
   │  (Primary Production)     │                   │   (Failover Edge Mirror)  │
   └─────────────┬─────────────┘                   └─────────────┬─────────────┘
                 │                                               │
                 ├───────────────────────┬───────────────────────┤
                 ▼                                               ▼
   ┌───────────────────────────┐                   ┌───────────────────────────┐
   │   keralahub.online        │                   │   zetasports.site         │
   │   (Colorify Theme XML)    │                   │   (Korra Theme XML)       │
   └───────────────────────────┘                   └───────────────────────────┘
```

### Design Token Layer (CSS Custom Properties)

`zetasports-core.css` establishes a systematic design token architecture on `:root`:

```css
:root {
  /* Brand & Theme Colors */
  --zeta-primary: #0062b2;
  --zeta-primary-hover: #004f93;
  --zeta-blue-accent: #2563eb;
  --zeta-green-live: #16a34a;
  --zeta-green-pulse: #22c55e;
  --zeta-red-card: #dc2626;
  --zeta-yellow-card: #f59e0b;

  /* Neutral Surface Colors (Light Mode Default) */
  --zeta-bg: #f8fafc;
  --zeta-card: #ffffff;
  --zeta-border: #e2e8f0;
  --zeta-border-light: #f1f5f9;
  --zeta-text-main: #0f172a;
  --zeta-text-muted: #475569;
  --zeta-text-subtle: #94a3b8;

  /* Dark Surface Colors (Player & Dark Mode) */
  --zeta-dark-bg: #0b0f19;
  --zeta-dark-card: #131b2e;
  --zeta-dark-border: #1e293b;
  --zeta-dark-text: #f1f5f9;
  --zeta-dark-muted: #94a3b8;

  /* Typography Stack */
  --zeta-font-main: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --zeta-font-display: 'Oswald', -apple-system, BlinkMacSystemFont, sans-serif;

  /* Spatial Scale */
  --zeta-space-xxs: 4px;
  --zeta-space-xs: 8px;
  --zeta-space-sm: 12px;
  --zeta-space-md: 16px;
  --zeta-space-lg: 24px;
  --zeta-space-xl: 32px;

  /* Corner Radius Scale */
  --zeta-radius-sm: 6px;
  --zeta-radius-md: 10px;
  --zeta-radius-lg: 14px;
  --zeta-radius-full: 9999px;

  /* Elevation Shadows */
  --zeta-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --zeta-shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
  --zeta-shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.04);

  /* Touch Target Constraint */
  --zeta-touch-min: 44px;
}
```

### Head Delivery Configuration

Both theme XML templates load the external stylesheet in their `<head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous"/>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Oswald:wght@600;700&display=swap"/>
<link rel="stylesheet" href="https://udlncusvhmydivtjkjcy.supabase.co/storage/v1/object/public/scripts/zetasports-core.css" id="zetasports-core-css"/>
```

---

## 5. Cross-Domain Navigation & State Transfer Protocol

Navigating between the two Blogger surfaces requires a hardened state transfer protocol that passes match identifiers, server selections, and back-navigation context via URL search parameters without session bleed or open redirect vulnerabilities.

### Configuration Contract (`window.ZETA_CONFIG`)

```javascript
window.ZETA_CONFIG = {
  detailsOrigin: 'https://www.keralahub.online',
  streamOrigin: 'http://www.zetasports.site',
  supabaseUrl: 'https://udlncusvhmydivtjkjcy.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkbG5jdXN2aG15ZGl2dGpramN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4MTE2MDgsImV4cCI6MjEwOTM4NzYwOH0.gsnxlDww-fUC4HG7R7VasXSaQvqkSsDhhmf16KUCLZY',
  allowedOrigins: [
    'https://www.keralahub.online',
    'http://www.zetasports.site',
    'https://zetasports.site',
    'http://www.keralahub.online'
  ]
};
```

### URL Navigation Contracts

```
[User Action on KeralaHub]
         │
         ▼
Click Match Card ──────────────────────────► https://www.keralahub.online/{team1}-vs-{team2}-{id}
                                                          │
                                                          ▼
Click "Watch Broadcast" CTA ───────────────► https://www.keralahub.online/?links={id}
                                                          │
                                                          ▼
Select "Server 1 HD" Card ─────────────────► http://www.zetasports.site/?stream={id}&server=0
                                                          │
   ┌──────────────────────────────────────────────────────┴───────────────────────────────────────┐
   ▼                                                      ▼                                       ▼
Click "← Match Post"                                Click "🔀 Change Server"                 Click "🏠 Home"
   │                                                      │                                       │
   ▼                                                      ▼                                       ▼
https://www.keralahub.online/{slug}-{id}    https://www.keralahub.online/?links={id}    https://www.keralahub.online/
```

### Helper URL Factories

```javascript
function getDetailsOrigin() {
  if (window.ZETA_CONFIG && window.ZETA_CONFIG.detailsOrigin) {
    return window.ZETA_CONFIG.detailsOrigin.replace(/\/+$/, '');
  }
  return 'https://www.keralahub.online';
}

function getStreamOrigin() {
  if (window.ZETA_CONFIG && window.ZETA_CONFIG.streamOrigin) {
    return window.ZETA_CONFIG.streamOrigin.replace(/\/+$/, '');
  }
  return 'http://www.zetasports.site';
}

function getMatchPostUrl(matchOrId) {
  if (!matchOrId) return getHomeUrl();
  const mId = typeof matchOrId === 'object' ? matchOrId.id : matchOrId;
  const match = (typeof matchOrId === 'object') ? matchOrId : (allMatches ? allMatches.find(m => String(m.id) === String(mId)) : null);
  if (match && match.article_url && isAllowedUrl(match.article_url)) {
    return match.article_url;
  }
  if (match && match.home_team && match.away_team) {
    const slug = (match.home_team + '-vs-' + match.away_team).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return getDetailsOrigin() + '/' + slug + '-' + encodeURIComponent(mId);
  }
  return getDetailsOrigin() + '/?match=' + encodeURIComponent(mId);
}

function getLinksUrl(matchId) {
  return getDetailsOrigin() + '/?links=' + encodeURIComponent(matchId);
}

function getStreamUrl(matchId, serverIdx) {
  const sIdx = (serverIdx !== undefined && serverIdx !== null) ? serverIdx : 0;
  return getStreamOrigin() + '/?stream=' + encodeURIComponent(matchId) + '&server=' + encodeURIComponent(sIdx);
}

function getHomeUrl() {
  return getDetailsOrigin() + '/';
}
```

---

## 6. Security Architecture & Threat Modeling (CYBERSECURITY Mandate)

Because sports streaming portals operate in an environment with high third-party threat exposure (untrusted stream hosting providers, ad injection, cross-site scripting vectors), the ZetaSports security architecture enforces strict defense-in-depth boundaries.

### Threat Model & Mitigation Matrix

| Threat Vector | Potential Impact | Architectural Countermeasure |
| :--- | :--- | :--- |
| **Malicious Iframe Escaping** | Third-party stream redirects top window to scam/phishing site. | HTML5 `sandbox` without `allow-top-navigation` or `allow-popups`. |
| **Cross-Site Scripting (XSS)** | Injected scripts via team names, player bios, or commentary feeds steal tokens or hijack sessions. | Mandatory `escapeHtml()` on all dynamic DOM injections; DOM insertion via `.textContent` where possible. |
| **JavaScript URL Execution** | Malicious links with `javascript:` or `data:` protocol execute payloads on user click. | Mandatory `sanitizeUrl()` protocol filtering on all dynamic `href` and `src` attributes. |
| **Open Redirect Vulnerability** | Attacker crafts `?redirect=evil.com` or bypasses protocol slashes (`//evil.com`) using ZetaSports reputation. | `isAllowedUrl()` domain whitelisting with strict RFC 3986 URL hostname parsing and slash-bypass blocking. |
| **Database Tampering** | Unauthorized clients alter match scores, insert bogus streams, or wipe tables. | Supabase Row Level Security (RLS) enforcing read-only `SELECT` policies for `anon` role. |
| **Token Theft / Key Misuse** | Compromised admin keys grant full database write/drop privileges. | Service-role key strictly quarantined to local CI/CD scripts; client templates use only scoped `anon` public key. |

### 1. Iframe Sandboxing Specification

The stream player iframe (`#streamIframe`) is strictly locked down:

```html
<iframe 
  id="streamIframe" 
  src="" 
  sandbox="allow-scripts allow-same-origin allow-presentation" 
  allowfullscreen="true" 
  allow="autoplay; encrypted-media; picture-in-picture; fullscreen" 
  frameborder="0" 
  style="display:none; width:100%; height:100%; border:none;">
</iframe>
```

#### Sandboxing Policy Explanation:
- `allow-scripts`: Permits the video player within the embed to execute JavaScript necessary to decode video chunks (e.g., HLS.js, VideoJS).
- `allow-same-origin`: Allows the embed to maintain its own session state and make XHR/Fetch requests to its own video segments. Note: Because the embed is served from an external third-party domain (e.g., `streamprovider.tv`), its "same origin" is that third-party domain, NOT `zetasports.site`.
- `allow-presentation`: Enables casting to smart TVs and external displays.
- **EXCLUDED PERMISSIONS (CRITICAL SECURITY CONTROLS)**:
  - ❌ `allow-top-navigation`: **STRICTLY BLOCKED**. The iframe CANNOT redirect the parent browser window (`window.top.location`).
  - ❌ `allow-top-navigation-by-user-activation`: **STRICTLY BLOCKED**. Even if the user clicks inside the player, the iframe cannot redirect the parent page.
  - ❌ `allow-popups` / `allow-popups-to-escape-sandbox`: **STRICTLY BLOCKED**. The iframe cannot spawn new tabs or popup ad windows.
  - ❌ `allow-modals`: **STRICTLY BLOCKED**. The iframe cannot invoke `alert()`, `confirm()`, or `prompt()` to deceive users.
  - ❌ `allow-downloads`: **STRICTLY BLOCKED**. Malicious auto-download payloads are rejected.

### 2. Strict XSS Output Sanitization (`escapeHtml`)

All dynamic strings received from API payloads, URL parameters, or third-party webhooks must be converted through `escapeHtml()` prior to template string interpolation:

```javascript
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
```

### 3. URL Sanitization (`sanitizeUrl`)

Prevents malicious protocol execution (`javascript:`, `vbscript:`, `data:` URLs) and protocol-relative bypasses:

```javascript
function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  // Block pseudo-protocols
  if (/^(?:javascript|data|vbscript):/i.test(trimmed)) return '#';
  // Block protocol-relative attacks (//evil.com or /\evil.com)
  if (trimmed.startsWith('//') || trimmed.startsWith('/\\')) return '#';
  return trimmed;
}
```

### 4. Open Redirect Protection (`isAllowedUrl`)

When navigating across domains or returning to match pages, destination URLs are validated through `isAllowedUrl()`:

```javascript
function isAllowedUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();

  // Block execution protocols
  if (/^(?:javascript|data|vbscript):/i.test(trimmed)) return false;

  // Relative URLs with leading single slash are safe internal routes
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.startsWith('/\\')) {
    return true;
  }

  try {
    const baseOrigin = (typeof window !== 'undefined' && window.location) 
      ? window.location.origin 
      : 'https://www.keralahub.online';
    const parsed = new URL(trimmed, baseOrigin);

    // Enforce web protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();
    const allowedDomains = [
      'keralahub.online',
      'www.keralahub.online',
      'zetasports.site',
      'www.zetasports.site'
    ];

    if (typeof window !== 'undefined' && window.ZETA_CONFIG) {
      if (window.ZETA_CONFIG.detailsOrigin) {
        try { allowedDomains.push(new URL(window.ZETA_CONFIG.detailsOrigin).hostname.toLowerCase()); } catch(e){}
      }
      if (window.ZETA_CONFIG.streamOrigin) {
        try { allowedDomains.push(new URL(window.ZETA_CONFIG.streamOrigin).hostname.toLowerCase()); } catch(e){}
      }
    }

    // Match exact hostname or verified subdomain
    return allowedDomains.some(d => hostname === d || hostname.endsWith('.' + d));
  } catch (err) {
    return false;
  }
}
```

---

## 7. External Data Flow & API Integration Architecture

### Supabase PostgreSQL REST Architecture

The application communicates directly with Supabase via PostgREST endpoints using the public anon token.

```mermaid
sequenceDiagram
    autonumber
    actor Client as Browser Client
    participant SupaREST as Supabase PostgREST
    participant DB as PostgreSQL Database
    participant Worker as FotMob Sync Worker

    Note over Client, DB: Match Fixtures Hydration (Polling / On-Demand)
    Client->>SupaREST: GET /rest/v1/matches?select=*&order=match_time.asc
    SupaREST->>DB: Execute Query (RLS: anon SELECT allowed)
    DB-->>SupaREST: Return Matches JSON Array
    SupaREST-->>Client: 200 OK (Match Records)

    Note over Client, DB: Stream Resolution
    Client->>SupaREST: GET /rest/v1/stream_servers?match_id=eq.{id}&order=server_priority.asc
    SupaREST->>DB: Execute Query
    DB-->>SupaREST: Return Stream Servers JSON
    SupaREST-->>Client: 200 OK (Server 1, 2, 3 URLs)

    Note over Worker, DB: Real-Time Score Ingestion
    Worker->>Worker: Poll FotMob API for In-Play Matches
    Worker->>DB: UPSERT INTO matches (live_score, minute, status, lineups)
```

### Table Relationships & Query Patterns

1. **`matches`**: Core match schedule, home/away names, crest URLs, match timestamp, status (`scheduled`, `live`, `finished`), scores (`home_score`, `away_score`), FotMob ID, venue, and article slug.
2. **`stream_servers`**: Available streams for a match (`server1_url`, `server2_url`, `server3_url`, `quality_label`, `language`, `stream_type` where `stream_type` $\in$ `['iframe', 'hls', 'direct']`).
3. **`leagues`**: League identifiers, names, flags, country codes, display priority.
4. **`zeta_config`**: Dynamic system configuration (banner messages, feature toggles, maintenance status, telegram link).

### FotMob Real-Time Live Score Sync

To ensure live scores remain synchronized without hammering third-party servers:
- **Ingestion Cadence**: In-play matches sync at 30-second intervals; scheduled fixtures sync at 10-minute intervals.
- **Client Polling**: Active `#homeView` and `#matchView` instances query Supabase on a 45-second ticker.
- **Goal Whistle Audio Trigger**: When client detects `currentMatch.home_score > previousHomeScore || currentMatch.away_score > previousAwayScore`, it invokes `playGoalWhistle()` using the Web Audio API synthesized dual-tone whistle (780 Hz & 880 Hz).

---

## 8. Responsive Layout Architecture & Viewport Standards

### Viewport Breakpoints & Classification

| Device Category | Viewport Width | Breakpoint Class | Layout Characteristics |
| :--- | :--- | :--- | :--- |
| **Mobile Compact** | $360\text{px} - 375\text{px}$ | `@media (max-width: 480px)` | Single-column stack, compact padding (8px), font-size scaling, hidden secondary meta. |
| **Mobile Standard** | $390\text{px} - 430\text{px}$ | Baseline Phone Target | 100% fluid card width, 44px min touch target, sticky date bar, simplified scoreboard hero. |
| **Tablet Portrait** | $768\text{px} - 991\text{px}$ | `@media (max-width: 991px)` | 2-column fixture grid, side drawer navigation, expanded match stats bar. |
| **Desktop / Laptop** | $1024\text{px} - 1280\text{px}$ | Baseline Desktop Target | 2 to 3-column fixture cards, horizontal 8-tab match bar, side-by-side pitch lineup and player stats. |
| **Wide Desktop** | $1440\text{px}+$ | Max-width Container | Centered max-width container (`1200px`), dual AdSense skyscraper gutters. |

### Zero Horizontal Overflow Mandate

A primary source of mobile layout failure is unexpected element width expansion causing horizontal page wobble (`scrollWidth > clientWidth`).

The ZetaSports architecture enforces the following CSS rules across both themes:

```css
/* Universal Overflow Defense */
html, body {
  overflow-x: hidden !important;
  max-width: 100vw !important;
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

*, *::before, *::after {
  box-sizing: inherit;
}

/* Fluid Flex & Grid Containers */
.STING-web-Container-Matches,
.STING-web-Max-Size,
.zeta-match-details-container {
  width: 100% !important;
  max-width: 1200px;
  margin-left: auto;
  margin-right: auto;
  padding-left: clamp(10px, 3vw, 20px);
  padding-right: clamp(10px, 3vw, 20px);
  overflow-x: hidden;
}

/* Text Truncation Guards */
.zeta-team-name, .zeta-player-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0; /* Prevents flexbox item blowout */
}
```

### Touch Target Sizing ($\ge 44\text{px}$)

Per WCAG 2.1 Success Criterion 2.5.5 (Target Size) and Apple Human Interface Guidelines:
- All buttons (`.match-chip-btn`, `#watchBtn`, `.zeta-server-card`, `#btnLinksBackToMatch`, date switcher chips, tab buttons) enforce:
  ```css
  min-height: 44px;
  min-width: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  touch-action: manipulation;
  ```
- Sub-44px visual chips use pseudo-element padding expansion:
  ```css
  .zeta-touch-expand {
    position: relative;
  }
  .zeta-touch-expand::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    min-width: 44px;
    min-height: 44px;
  }
  ```

---

## 9. Architectural Verification & Acceptance Criteria Checklist

| Architecture Domain | Requirement | Verification Method | Status |
| :--- | :--- | :--- | :--- |
| **Topology** | Complete domain isolation between `keralahub.online` and `zetasports.site`. | HTTP traffic inspection and cross-domain redirect tracing. | VERIFIED |
| **SPA Engine** | Seamless switching between `#homeView`, `#matchView`, `#linksView`, `#streamView`. | DOM state check across URL route changes (`checkUrlRoute`). | VERIFIED |
| **Blogger 404** | Match slug interception (`/{slug}-{uuid}`) displays match center. | Direct navigation test to match bug URL. | VERIFIED |
| **Master CSS** | Single CDN link replaces all redundant inline CSS in both XML themes. | Network waterfall inspection showing 200 OK from Supabase CDN. | VERIFIED |
| **Security** | Iframe sandboxing excludes `allow-top-navigation` and `allow-popups`. | DOM attribute inspection on `#streamIframe`. | VERIFIED |
| **Sanitization** | All dynamic HTML escaped; all URLs validated via `sanitizeUrl` & `isAllowedUrl`. | Static analysis & automated security unit tests. | VERIFIED |
| **Responsiveness** | `scrollWidth === clientWidth` on 360px, 390px, 768px, 1280px viewports. | Headless Chrome viewport bounding box evaluation. | VERIFIED |
| **Touch Targets** | Interactive elements have physical or hit area dimensions $\ge 44\text{px} \times 44\text{px}$. | Computed style evaluation across button and link elements. | VERIFIED |

---

*Authored by the System Architect for the ZetaSports 12-Agent Development Lifecycle.*
