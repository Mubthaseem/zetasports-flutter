# Product Requirements Document (PRD)

## Project: ZetaSports Full-Stack Visual & Responsive Remediation
**Document Version**: 2.0.0  
**Status**: APPROVED / ACTIVE  
**Product Manager**: ZetaSports Multi-Agent Engineering Core (`pm_m1`)  
**Target Environments**:
- **Primary / Details Portal**: `https://www.keralahub.online/` (Colorify Theme)
- **Streaming & Player Portal**: `http://www.zetasports.site/` (Korra Theme)
- **Central Styling Core**: `web/css/zetasports-core.css` (Supabase Storage CDN & jsDelivr)

---

## 1. Product Overview & Strategic Vision

**ZetaSports** is a comprehensive live sports intelligence, fixtures scheduling, and video streaming web portal. The platform provides global football/soccer fans with real-time match fixtures, instant scoreboards, deep statistical breakdowns, tactical pitch formations, and seamless access to high-definition live video feeds.

### 1.1 Problem Statement
The platform historically operated with fragmented styling duplicated across multiple Blogger XML templates (over 6,500 lines of redundant CSS). This caused severe layout bugs, including:
1. **Mobile Card Collision (104% Width Bug)**: On mobile viewports ($\le 768\text{px}$), left and right team columns (34% each) and the center score box (36%) totaled 104% width, causing long club names ("Manchester United", "Wolverhampton Wanderers") to overlap the score container.
2. **Sub-44px Touch Targets**: Mobile date filter pills, header toggle icons, and server selector buttons measured between 26px and 38px, violating WCAG AAA accessibility standards and causing frequent mis-taps.
3. **Match Details Visual Collapse**: When accessing specific match URLs (such as `https://www.keralahub.online/al-mokawloon-al-arab-vs-we-sc-15366038-b321-4e06-a42c-90712b422692`), the scoreboard rendered transparently without team crest containers, tabs collapsed, and tactical lineups overlapped.
4. **Header Element Overlap on Tablet**: Tablet screens (769px–1024px) caused navigation menus and search buttons to collide due to unyielding flex gaps.
5. **Cybersecurity Risks**: Potential exposure to Cross-Site Scripting (XSS) via unescaped match metadata, unvalidated URL query parameters, open redirect vulnerabilities, and un-sandboxed stream iframes.

### 1.2 Strategic Goals
- Unify styling under a single, globally cached Master CSS file (`zetasports-core.css`).
- Guarantee 100% visual harmony with zero horizontal overflow across **390px mobile** (iPhone 14/15) and **1280px+ desktop** viewports.
- Deliver an intuitive, zero-latency streaming gateway with multi-server redundancy.
- Enforce uncompromising cybersecurity safeguards (HTML escaping, URL sanitization, open-redirect defenses, and sandboxed iframes).

---

## 2. User Personas & Journey Maps

### 2.1 Persona Definitions

```
+---------------------------------------------------------------------------------------------------------+
|                                           USER PERSONA MATRIX                                           |
+---------------------------------------------------------------------------------------------------------+
| Persona 1: "Matchday Mark" (Mobile Live Follower)                                                       |
| - Demographics: Age 24, mobile-first user accessing on iPhone 14 (390x844px).                           |
| - Goal: Checks live scores during his commute; needs instant fixture times, live clocks, and 1-tap      |
|   access to video streams without horizontal scrolling or broken elements.                              |
| - Frustrations: Overlapping team names, tiny buttons that are hard to tap, intrusive popups.           |
+---------------------------------------------------------------------------------------------------------+
| Persona 2: "Tactical Tim" (Desktop Football Enthusiast)                                                 |
| - Demographics: Age 32, accessing on 1440x900px laptop or 1280x800px desktop.                          |
| - Goal: Deep-dives into match details, head-to-head records, starting XI pitch formations, and real-time|
|   match commentary while watching the game.                                                             |
| - Frustrations: Unstyled scoreboard headers, broken pitch dot alignments, slow-loading skeletons.      |
+---------------------------------------------------------------------------------------------------------+
| Persona 3: "Streamer Sam" (Live Match Viewer)                                                          |
| - Demographics: Age 28, accessing on tablet (iPad) or Android mobile.                                   |
| - Goal: Wants uninterrupted live video feeds with reliable server fallbacks if Server 1 buffers.        |
| - Frustrations: Dead stream links, intrusive ads causing layout shifts (CLS), un-sandboxed malware.    |
+---------------------------------------------------------------------------------------------------------+
| Persona 4: "Sports Admin Alex" (Site Operations & Curator)                                             |
| - Demographics: Platform administrator managing Supabase data pipelines and Blogger publishing.         |
| - Goal: Publishes matches and updates CSS centrally without having to manually edit XML themes daily.  |
| - Frustrations: Theme drift, broken byte-mirror parity between theme branches, schema mismatches.       |
+---------------------------------------------------------------------------------------------------------+
```

### 2.2 Core User Journeys

#### Journey A: Discovering and Watching a Live Match (Mobile 390px)
1. Mark opens `https://www.keralahub.online/` on his smartphone (390px viewport).
2. The page loads within 1.2s; the date bar defaults to "Today's Fixtures".
3. Mark sees live scores update in real time with distinct live status indicators ("74' LIVE").
4. Mark taps the "Stream Live" button (touch target: 48px height).
5. The system safely navigates to `http://www.zetasports.site/?matchId=15366038&view=links`.
6. The Link Selection Gateway (`#linksView`) displays 4 server cards with latency and bitrate badges.
7. Mark selects "Server 1 (HD CDN)"; the stream player initializes cleanly inside a sandboxed iframe.
8. If Mark wishes to check lineups, he taps "← Back to Match Post", which safely routes back to `keralahub.online`.

#### Journey B: Exploring Lineups and Tactics (Desktop 1280px)
1. Tim navigates to `https://www.keralahub.online/al-mokawloon-al-arab-vs-we-sc-15366038-b321-4e06-a42c-90712b422692`.
2. The Scoreboard loads with dark gradient styling, crisp team crests, and current score (2 - 1).
3. Tim clicks the "Lineups & Pitch" tab; the tactical 2.5D pitch renders both starting XIs with formation lines (4-3-3 vs 4-2-3-1).
4. Tim clicks on player dots to view squad numbers and player statistics with zero overlap.

---

## 3. Functional Requirements

### FR-1: Home View & Fixtures Center (`#homeView`)
- **FR-1.1**: The system shall render all matches chronologically grouped by league or start time.
- **FR-1.2**: Each match card must display:
  - Home team crest, home team name, away team crest, away team name.
  - Match status indicator: Scheduled time (e.g., "19:45"), Live match clock (e.g., "62' LIVE"), or "FT" (Full Time).
  - Current score for live and completed matches; "VS" for upcoming matches.
  - Interactive "Watch" or "Details" action button.
- **FR-1.3**: Team name containers must be responsive flex items (`flex: 1 1 0%`) with automatic truncation (`text-overflow: ellipsis`) so names up to 30 characters never collide with the center score badge.
- **FR-1.4**: Hover effects on desktop must not trigger sticky hover overlays on touch screens (`@media (hover: none)` guard).

### FR-2: Interactive Date Switcher Bar
- **FR-2.1**: The switcher bar must provide three primary filter tabs: "Yesterday", "Today", and "Tomorrow".
- **FR-2.2**: Each tab must display the fixture count badge (e.g., "Today (18)").
- **FR-2.3**: Tapping a tab must immediately filter the fixtures DOM without full page reload.
- **FR-2.4**: All date pills must have a minimum physical height of 44px with a 4px separation margin on mobile viewports.
- **FR-2.5**: The active date tab must have clear high-contrast visual focus styling (blue gradient border/background).

### FR-3: League Filter & Navigation Carousel
- **FR-3.1**: The system must provide horizontal scrollable or wrapped filter pills for major competitions: Premier League, UEFA Champions League, La Liga, Serie A, Bundesliga, Ligue 1, and Domestic Cups.
- **FR-3.2**: Selecting a league must instantly isolate matches belonging to that competition ID.
- **FR-3.3**: League crest icons must render crisply at $24 \times 24\text{px}$ with fallback generic football SVG icons if the remote crest fails to load.

### FR-4: Real-time Search & Filter Modal
- **FR-4.1**: Users must be able to search matches by club name, league name, or stadium.
- **FR-4.2**: The search input must debounce queries at 250ms to prevent UI thrashing.
- **FR-4.3**: Search results must update dynamically, highlighting matching team names.
- **FR-4.4**: If zero matches match the query, a friendly empty-state illustration with a "Reset Filters" action button must render.

### FR-5: Link Selection Gateway (`#linksView`)
- **FR-5.1**: When routed to `zetasports.site` with a valid `matchId`, the `#linksView` container must activate.
- **FR-5.2**: The gateway must render an array of available stream servers retrieved from the Supabase `stream_sources` table.
- **FR-5.3**: Each server card must present:
  - Server label (e.g., "Server 1 - Ultra HD", "Server 2 - Fast CDN").
  - Quality badge ("1080p 60fps", "720p Mobile").
  - Audio commentary language ("English", "Arabic", "Spanish").
  - Health/Latency status indicator ("🟢 99.9% Online", "🟡 Medium Buffer").
  - Prominent "Play Stream" button ($\ge 44\text{px}$ height).
- **FR-5.4**: The top bar must include a safe "← Back to Match Post" return link targeting `https://www.keralahub.online/`.

### FR-6: Embedded Stream Player (`#streamView`)
- **FR-6.1**: Upon selecting a stream server, the player view (`#streamView`) must become visible.
- **FR-6.2**: The video player must be embedded inside a strictly sandboxed `<iframe>`:
  ```html
  <iframe id="zeta-player-frame" 
          src="[sanitized_stream_url]" 
          sandbox="allow-scripts allow-same-origin allow-forms allow-presentation" 
          referrerpolicy="no-referrer" 
          allowfullscreen="true" 
          loading="lazy"></iframe>
  ```
- **FR-6.3**: Multi-Server Selector: The player view must render sticky or top-level server buttons allowing users to switch feeds in 1 tap without reloading the entire page.
- **FR-6.4**: Player Utilities: Must provide a "🔄 Reload Player" button and a "⛶ Native Fullscreen" toggle.
- **FR-6.5**: Disallowed iframe permissions: `allow-top-navigation-by-user-activation`, `allow-modals`, `allow-popups` (unless explicitly gated).

### FR-7: Match Details View (`#matchView`)
- **FR-7.1**: The Match Details container must render upon loading a match post URL or when `#matchView` is targeted.
- **FR-7.2**: Header Scoreboard: Must feature a dark modern gradient background (`linear-gradient(135deg, #0f172a, #1e293b)`), prominent score numbers, match minute badge, and high-resolution team badges.
- **FR-7.3**: Interactive Content Tabs: The view must feature responsive tabs:
  1. **Overview / Info**: Venue, referee, kick-off time, attendance.
  2. **Lineups & Formation**: 2.5D visual tactical pitch + bench roster list.
  3. **Live Stats**: Possession bars, shots on target, corners, fouls, cards.
  4. **Head-to-Head (H2H)**: Past 5 encounters between the two clubs.
  5. **League Standings**: Current table positions of both teams.
  6. **Timeline / Events**: Chronological goals, substitutions, and VAR alerts.
  7. **Watch Live Button**: Primary CTA redirecting to the stream gateway.
- **FR-7.4**: Tactical Pitch Scaling: The pitch canvas must scale adaptively:
  - Desktop: 600px height.
  - Tablet: 520px height.
  - Mobile standard ($\le 640\text{px}$): 460px height.
  - Mobile compact ($\le 380\text{px}$): 420px height; player labels truncated to 48px max-width with ellipsis.

### FR-8: Cross-Domain Routing & Parameter Synchronization
- **FR-8.1**: Cross-domain state passing must adhere to `window.ZETA_CONFIG`:
  ```javascript
  window.ZETA_CONFIG = {
    detailsOrigin: 'https://www.keralahub.online',
    streamOrigin: 'http://www.zetasports.site',
    supabaseUrl: 'https://udlncusvhmydivtjkjcy.supabase.co',
    supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  };
  ```
- **FR-8.2**: Navigating to streaming: `http://www.zetasports.site/?matchId={id}&view=links&returnUrl={safeEncodedUrl}`.
- **FR-8.3**: All URL parameters must be verified against `isAllowedUrl()` and stripped of unauthorized protocols before rendering or redirecting.

---

## 4. Responsive UI & Visual Harmony Requirements

### 4.1 Viewport Breakpoints & Layout Matrix
| Breakpoint Name | Viewport Range | Grid Structure | Key Responsive Rules |
| :--- | :--- | :--- | :--- |
| **Mobile Compact** | $320\text{px} - 380\text{px}$ | 1 Column | Zero horizontal scroll; pitch height 420px; team names max-width 32%; header logo max 130px. |
| **Mobile Standard** | $381\text{px} - 480\text{px}$ | 1 Column | Canonical mobile (**390px**); $\ge 44\text{px}$ touch targets; flex-wrap on toolbars; cards 100% width. |
| **Tablet Portrait** | $768\text{px} - 1024\text{px}$| 2 Columns | Nav gap 10px; font-size 13px; link grid 2-col; ad slots contained. |
| **Desktop HD** | $1280\text{px} - 1440\text{px}$| 3 Columns | Max-width 1280px; 16px grid gutters; sticky sidebar; multi-column stats. |

### 4.2 Accessibility & Touch Target Minimums
- **Criterion**: In compliance with WCAG 2.5.5 (Target Size) Level AAA, all interactive controls (date tabs, server buttons, navigation icons, close buttons, accordion headers) must possess an interactive bounding box of at least **$44\text{px} \times 44\text{px}$**.
- **Implementation**:
  ```css
  .touch-target-compliant {
    min-height: 44px;
    min-width: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    touch-action: manipulation;
  }
  ```

### 4.3 Overflow & Collision Elimination
- **Criterion**: The page body and all view wrappers must enforce `overflow-x: hidden`. 
- **Dynamic Flex Allocation**:
  - Left Team: `flex: 1 1 0%; max-width: 35%;`
  - Score / Time Center: `flex: 0 0 auto; min-width: 80px; text-align: center;`
  - Right Team: `flex: 1 1 0%; max-width: 35%;`
  - Total width cannot exceed 100% under any circumstance.
- **Zero-CLS Ad Layout Containment**:
  ```css
  .ad-slot-container {
    contain: layout;
    min-height: 90px;
    overflow: hidden;
  }
  ```

---

## 5. Cybersecurity & Quality Requirements

Under the mandatory cybersecurity directive:

### 5.1 Input & Data Sanitization
- Every string originating from API responses, database queries, URL query parameters, or user search inputs must be passed through `escapeHtml()` prior to DOM insertion.
- No direct `element.innerHTML` assignment with unescaped variables.
- Direct DOM construction (`createElement`, `textContent`) must be preferred over string concatenation wherever possible.

### 5.2 URL Sanitization & Scheme Whitelisting
- All hyperlinks (`<a href="...">`) and resource references (`<img src="...">`, `<iframe src="...">`) must be sanitized using `sanitizeUrl()`.
- Explicitly rejected schemes: `javascript:`, `data:text/html`, `vbscript:`, `file:`.
- Accepted schemes: `https:`, `http:` (for approved stream origins), and absolute path `/`.

### 5.3 Open-Redirect Defense
- Cross-domain redirects and "Return" navigation must be validated with `isAllowedUrl()`.
- Protocol-relative URLs (starting with `//` or `/\\`) are strictly rejected.
- Only hostnames belonging to `keralahub.online` and `zetasports.site` are permitted as redirect destinations.

### 5.4 Iframe Sandboxing & Clickjacking Mitigation
- Third-party stream iframes must be sandboxed:
  `sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"`.
- `referrerpolicy="no-referrer"` must be applied to prevent streaming token leakage to upstream referrers.
- Top-level windows must implement frame-busting defenses to prevent clickjacking in third-party iframes.

### 5.5 Token & Secret Isolation
- Client-side code must only utilize the public Supabase `anon` key.
- Supabase Service Role keys, database master passwords, and administrative tokens must never be present in theme XML files, JavaScript bundles, or public CSS.
- Row Level Security (RLS) policies in Supabase must restrict `anon` access to `SELECT` on public tables (`matches`, `leagues`, `stream_sources` where `is_active = true`).

---

## 6. Technical & Non-Functional Requirements

### 6.1 Master CSS Single Source of Truth (SOT)
- All custom component styles must reside in `web/css/zetasports-core.css`.
- The stylesheet is hosted on Supabase Storage CDN:
  `https://udlncusvhmydivtjkjcy.supabase.co/storage/v1/object/public/scripts/zetasports-core.css`
  with secondary fallback to jsDelivr:
  `https://cdn.jsdelivr.net/gh/Mubthaseem/zetasports-flutter@main/web/css/zetasports-core.css`.
- Both theme templates (`zetasports-colorify-blogger-theme.xml` and `zetasports-korra-blogger-theme.xml`) must load this stylesheet in their `<head>` and maintain zero inline duplicate rules.

### 6.2 Byte-for-Byte Theme Parity
- `zetasports-colorify-blogger-theme.xml` and `zetasports-v3/web/colorify_zetasports_theme.xml` must remain 100% byte-identical, verified via SHA-256 hash checks on every build.

### 6.3 Performance SLAs
- **First Contentful Paint (FCP)**: $\le 1.2\text{ seconds}$ on 4G mobile connections.
- **Largest Contentful Paint (LCP)**: $\le 2.2\text{ seconds}$ on 4G mobile connections.
- **Cumulative Layout Shift (CLS)**: $\le 0.05$ across all pages.
- **Time to Interactive (TTI)**: $\le 2.5\text{ seconds}$.

---

## 7. Acceptance Criteria & Release Checklist

### 7.1 Visual & Responsive Layout
- [ ] **AC-1.1**: Zero horizontal scrollbar/overflow on mobile (390px) across homepage, match details, and stream gateway.
- [ ] **AC-1.2**: Zero horizontal scrollbar/overflow on desktop (1280px) across all views.
- [ ] **AC-1.3**: Team names up to 30 characters truncate cleanly without colliding with the match score box.
- [ ] **AC-1.4**: All interactive touch targets (buttons, pills, icons) meet or exceed $44\text{px} \times 44\text{px}$.
- [ ] **AC-1.5**: Match details bug page (`/al-mokawloon-al-arab-vs-we-sc-...`) renders a fully styled gradient scoreboard header, visible team crests, and functional navigation tabs.
- [ ] **AC-1.6**: Tactical 2.5D pitch scales cleanly down to 420px height on mobile screens with no overlapping player tags.

### 7.2 Functional Integrity
- [ ] **AC-2.1**: Date switcher tabs ("Yesterday", "Today", "Tomorrow") accurately filter fixtures with real-time counts.
- [ ] **AC-2.2**: League filter pills correctly filter fixtures by competition.
- [ ] **AC-2.3**: Stream gateway displays active servers with bitrate and latency badges.
- [ ] **AC-2.4**: Multi-server switcher changes stream player source without full-page reloads.
- [ ] **AC-2.5**: Safe cross-domain navigation successfully passes `matchId` from KeralaHub to ZetaSports and back.

### 7.3 Cybersecurity & Quality
- [ ] **AC-3.1**: Automated collision audit suite passes with 42/42 checks (0 design bugs, 0 overlaps).
- [ ] **AC-3.2**: All stream iframes contain strict sandbox and `no-referrer` attributes.
- [ ] **AC-3.3**: All user-controlled text and API fields pass `escapeHtml()`.
- [ ] **AC-3.4**: Open redirect validation rejects protocol-relative URLs (`//`, `/\\`) and external untrusted domains.
- [ ] **AC-3.5**: Zero secret keys exposed in client themes; Supabase RLS policies active and verified.

---

## 8. Key Performance Indicators (KPIs) & Success Metrics

| Metric | Baseline (Pre-Remediation) | Target (Post-Remediation) | Measurement Tool |
| :--- | :--- | :--- | :--- |
| **Design Collisions / Bugs** | 38 detected bugs | **0 bugs** | `scratch/audit_design_collisions.mjs` |
| **Horizontal Overflow** | Present on 360px & 390px | **0 overflow (hasOverflow: false)** | Multi-viewport DOM runner |
| **Touch Target Compliance** | 62% compliant (< 44px) | **100% compliant ($\ge 44\text{px}$)** | Automated CSS bounding box audit |
| **Duplicate Theme CSS** | > 6,500 lines inline | **0 duplicate lines (Central SOT)** | Static theme code analyzer |
| **Cumulative Layout Shift** | 0.38 (High shift from ads) | **< 0.05 (Negligible shift)** | Google Lighthouse / Chrome UX |
| **Cross-Domain Handshake** | Unsanitized query params | **100% sanitized & validated** | Security test suite |
| **Cybersecurity Vulnerabilities** | Multiple XSS / iframe risks | **0 High/Critical findings** | OWASP Top 10 Security Audit |
