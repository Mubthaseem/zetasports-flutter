# ZetaSports Design System Specification (v3.6.0)

**Document Version:** 3.6.0  
**Status:** APPROVED & RELEASED FOR FRONTEND INTEGRATION  
**Lead Designer:** Senior UI/UX Designer (`designer_m2`)  
**Scope:** Universal Cross-Platform Consistency across `https://www.keralahub.online/` (Colorify Theme) and `http://www.zetasports.site/` (Korra Theme), mobile (360px, 390px), tablet (768px), and desktop (1280px, 1440px+).

---

## 1. Executive Summary & Design Vision

The **ZetaSports Design System** establishes a definitive, mathematically verified visual design standard for the ZetaSports sports streaming and live scores network. 

Prior iterations suffered from fragmented styling distributed across multiple Blogger XML templates (over 6,500 lines of redundant CSS). This fragmentation introduced critical defects:
1. **The 104% Mobile Card Width Collision**: In which left team (34%), score box (36%), and right team (34%) exceeded viewport constraints, crushing long team names into the score box.
2. **Transparent Match Details Scoreboard**: Unstyled scoreboard containers (`scoreboardBg: rgba(0, 0, 0, 0)`) when loading match detail permalinks like `/al-mokawloon-al-arab-vs-we-sc-15366038-b321-4e06-a42c-90712b422692`.
3. **Sub-44px Touch Target Violations**: Date switcher pills (28px height), menu toggles (38px), and server switcher buttons that failed WCAG AAA accessibility standards.
4. **Tablet Header Collisions**: Fixed flex gaps in the 769px–1024px range causing navigation buttons and logos to overlap.

This specification provides the single source of truth (SOT) for design tokens, responsive typography clamp equations, layout grids, collision prevention mathematics, touch target enforcement, and detailed UI component specifications for the Frontend Developer.

---

## 2. Design Tokens & CSS Custom Properties

All design tokens are formalized as CSS custom properties on `:root` within the centralized stylesheet `web/css/zetasports-core.css`.

### 2.1 Dark Theme Color Palette (Primary System)

ZetaSports utilizes an immersive, high-contrast dark theme engineered for prolonged matchday viewing and video playback clarity:

```css
:root {
  /* ==========================================================================
     CORE DARK THEME PALETTE
     ========================================================================== */
  /* Primary Canvas Background: Deep Space Navy/Black */
  --zeta-dark-bg: #0a0e17;
  --zeta-dark-bg-rgb: 10, 14, 23;

  /* Card Surface: Rich Dark Slate */
  --zeta-dark-card: #111827;
  --zeta-dark-card-rgb: 17, 24, 39;

  /* Elevated Surface: Raised Badges, Toolbars, Menus */
  --zeta-dark-surface-raised: #1e293b;
  --zeta-dark-surface-raised-rgb: 30, 41, 59;

  /* Borders & Dividers: Subtle Slate Boundaries */
  --zeta-dark-border: #1f2937;
  --zeta-dark-border-subtle: #374151;

  /* Primary Accent: Pitch Emerald Green (Live Status, Highlights) */
  --zeta-accent: #10b981;
  --zeta-accent-rgb: 16, 185, 129;
  --zeta-accent-hover: #059669;
  --zeta-accent-glow: rgba(16, 185, 129, 0.35);

  /* Action / CTA Blue: Primary Interactive Controls & Stream Triggers */
  --zeta-action-blue: #2563eb;
  --zeta-action-blue-hover: #1d4ed8;
  --zeta-action-blue-glow: rgba(37, 99, 235, 0.40);

  /* High-Contrast Typography */
  --zeta-dark-text: #f9fafb;        /* Crisp White: Headings, Scores, Team Names */
  --zeta-dark-muted: #9ca3af;       /* Medium Gray: Kickoff Times, Subtitles, League Names */
  --zeta-dark-subtle: #6b7280;      /* Dim Gray: Meta tags, disabled states, timestamps */

  /* In-Play & Match Status Colors */
  --zeta-live-green: #10b981;
  --zeta-live-green-bg: rgba(16, 185, 129, 0.12);
  --zeta-live-green-pulse: #34d399;

  --zeta-danger: #ef4444;           /* Red Cards, Live alerts, Errors */
  --zeta-danger-bg: rgba(239, 68, 68, 0.12);

  --zeta-warning: #f59e0b;          /* Yellow Cards, Half-Time, Pending */
  --zeta-warning-bg: rgba(245, 158, 11, 0.12);

  /* Tactical Pitch Turf Gradients */
  --zeta-pitch-turf-1: #15803d;
  --zeta-pitch-turf-2: #166534;
  --zeta-pitch-line: rgba(255, 255, 255, 0.45);
}
```

### 2.2 Complementary Light Theme Tokens (Colorify Compatibility)

To maintain support for the Colorify crisp-white editorial layout where enabled on Domain 1 (`keralahub.online`):

```css
:root {
  /* ==========================================================================
     LIGHT THEME COMPLEMENTARY TOKENS
     ========================================================================== */
  --zeta-light-bg: #f8fafc;
  --zeta-light-card: #ffffff;
  --zeta-light-border: #e2e8f0;
  --zeta-light-border-subtle: #f1f5f9;
  --zeta-light-text: #0f172a;
  --zeta-light-muted: #475569;
  --zeta-light-subtle: #94a3b8;
  --zeta-light-primary: #0062b2;
  --zeta-light-primary-hover: #004f93;
}
```

### 2.3 Typography Scale & Fluid Clamp Formulations

ZetaSports combines **Inter** for data readability with **Oswald** for scoreboard numbers and team names:

```css
:root {
  /* Font Family Definitions */
  --zeta-font-main: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --zeta-font-display: 'Oswald', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --zeta-font-mono: 'JetBrains Mono', 'Roboto Mono', SFMono-Regular, Menlo, Monaco, Consolas, monospace;

  /* Font Weights */
  --zeta-weight-regular: 400;
  --zeta-weight-medium: 500;
  --zeta-weight-semibold: 600;
  --zeta-weight-bold: 700;
  --zeta-weight-extrabold: 800;

  /* Fluid Clamp Typography Equations */
  /* Display XL: Big Scoreboard Counter (30px on 360px mobile -> 52px on 1440px desktop) */
  --zeta-text-display-xl: clamp(1.875rem, 1.25rem + 2.5vw, 3.25rem);
  --zeta-leading-display-xl: 1.1;

  /* Heading 1: Match Post Title & Section Heroes (22px -> 36px) */
  --zeta-text-h1: clamp(1.375rem, 1.05rem + 1.35vw, 2.25rem);
  --zeta-leading-h1: 1.2;

  /* Heading 2: Tab Titles, League Group Titles (18px -> 24px) */
  --zeta-text-h2: clamp(1.125rem, 0.95rem + 0.75vw, 1.5rem);
  --zeta-leading-h2: 1.3;

  /* Heading 3: Team Names in Fixture Cards, Server Titles (14px -> 17px) */
  --zeta-text-h3: clamp(0.875rem, 0.8rem + 0.35vw, 1.0625rem);
  --zeta-leading-h3: 1.35;

  /* Body Large: Action CTA Buttons, Tab Labels (15px -> 16px) */
  --zeta-text-body-lg: clamp(0.9375rem, 0.9rem + 0.15vw, 1rem);
  --zeta-leading-body-lg: 1.5;

  /* Body Base: General Content, Descriptions (14px) */
  --zeta-text-body: 0.875rem;
  --zeta-leading-body: 1.5;

  /* Body Small: Metadata, Kickoff Timestamps, Lineup Positions (12px) */
  --zeta-text-body-sm: 0.75rem;
  --zeta-leading-body-sm: 1.4;

  /* Micro: Badges, Status Dots, Subscripts, Footnotes (11px) */
  --zeta-text-micro: 0.6875rem;
  --zeta-leading-micro: 1.25;
}
```

### 2.4 Spatial System (4px Geometric Scale)

All margins, paddings, and layout gaps adhere strictly to the 4px baseline rhythm:

| Token | Pixel Value | Typical Application |
| :--- | :--- | :--- |
| `--zeta-space-1` | `4px` | Pill gap, badge internal padding, micro-spacing |
| `--zeta-space-2` | `8px` | Icon-to-text gap, compact button padding, team crest margin |
| `--zeta-space-3` | `12px` | Card internal padding (mobile), date tab margin |
| `--zeta-space-4` | `16px` | Standard card padding (desktop), grid gutter (mobile) |
| `--zeta-space-6` | `24px` | Section margins, grid gutter (desktop), hero padding |
| `--zeta-space-8` | `32px` | Major section separator, scoreboard container padding |
| `--zeta-space-12` | `48px` | Hero container vertical padding |
| `--zeta-space-16` | `64px` | Desktop viewport outer vertical separation |

### 2.5 Corner Radii Scale

```css
:root {
  --zeta-radius-xs: 4px;      /* Status chips, tiny tags */
  --zeta-radius-sm: 6px;      /* Server badges, event icons */
  --zeta-radius-md: 10px;     /* Match cards, input fields, tab items */
  --zeta-radius-lg: 14px;     /* Hero scoreboard, stream player container */
  --zeta-radius-xl: 20px;     /* Modal dialogs, floating action sheets */
  --zeta-radius-full: 9999px; /* Date pills, circular badges, avatar crests */
}
```

### 2.6 Elevation & Shadow Depth Scale

```css
:root {
  /* Depth 1: Static Cards & Inactive Containers */
  --zeta-shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.40);

  /* Depth 2: Hovered Cards & Dropdowns */
  --zeta-shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.50), 0 2px 4px -2px rgba(0, 0, 0, 0.35);

  /* Depth 3: Scoreboard Hero & Sticky Headers */
  --zeta-shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.60), 0 4px 6px -4px rgba(0, 0, 0, 0.40);

  /* Depth 4: Floating Modals & Stream Server Drawer */
  --zeta-shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.70), 0 8px 10px -6px rgba(0, 0, 0, 0.50);

  /* Atmospheric Glows */
  --zeta-glow-live: 0 0 16px rgba(16, 185, 129, 0.35);
  --zeta-glow-action: 0 0 16px rgba(37, 99, 235, 0.40);
  --zeta-glow-danger: 0 0 16px rgba(239, 68, 68, 0.35);
}
```

---

## 3. Responsive Layout Grid & Breakpoints

ZetaSports guarantees zero horizontal overflow (`scrollWidth === clientWidth`) across the full spectrum of mobile, tablet, and desktop display hardware.

### 3.1 Breakpoint Matrix

```
┌─────────────────┬──────────────────┬─────────────────┬─────────────────┬──────────────────┐
│ Mobile Compact  │ Mobile Standard  │ Tablet Portrait │ Desktop HD      │ Wide Desktop     │
│  320px - 380px  │  381px - 480px   │  768px - 1024px │ 1280px - 1439px │ 1440px+          │
├─────────────────┼──────────────────┼─────────────────┼─────────────────┼──────────────────┤
│ • 1 Column      │ • 1 Column       │ • 2 Columns     │ • 3 Columns     │ • Max 1200px     │
│ • 420px Pitch   │ • 460px Pitch    │ • 520px Pitch   │ • 600px Pitch   │ • Side Gutters   │
│ • 44px targets  │ • 44px targets   │ • Flex wrap nav │ • Full stats    │ • Ad Skyscraper  │
└─────────────────┴──────────────────┴─────────────────┴─────────────────┴──────────────────┘
```

| Breakpoint Name | Viewport Target | Grid Layout | Key Responsive Characteristics |
| :--- | :--- | :--- | :--- |
| **Mobile Compact** | $320\text{px} - 380\text{px}$ | 1 Column Stack | Lateral padding 10px; pitch height 420px; team crests 28px; player name truncate at 48px; logo max-width 130px. |
| **Mobile Standard** | $381\text{px} - 480\text{px}$ (Baseline: **390px**) | 1 Column Stack | Canonical mobile baseline; lateral padding 12px; pitch height 460px; cards 100% width; all controls $\ge 44\text{px}$. |
| **Tablet Portrait** | $768\text{px} - 1024\text{px}$ | 2 Columns | Lateral padding 16px; nav gap 10px; font size 13px; auto-wrapping header flex containers; ad slots contained. |
| **Desktop HD** | $1025\text{px} - 1439\text{px}$ (Baseline: **1280px**) | 2 to 3 Columns | Max-width 1200px; 24px gutters; scoreboard hero 64px crests; horizontal 7-tab bar; side-by-side pitch & roster. |
| **Wide Desktop** | $1440\text{px}+$ | 3 Columns + Gutters | Centered 1200px container; outer background `--zeta-dark-bg`; dual zero-CLS ad banners in left/right gutters. |

### 3.2 Fluid Container Architecture

To enforce responsive containment without horizontal page scrolling:

```css
/* Universal Box-Sizing & Viewport Containment */
html, body {
  overflow-x: hidden !important;
  max-width: 100vw !important;
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  background-color: var(--zeta-dark-bg);
  color: var(--zeta-dark-text);
  font-family: var(--zeta-font-main);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

*, *::before, *::after {
  box-sizing: inherit;
}

/* Fluid Global Centering Container */
.zeta-container,
.STING-web-Container-Matches,
.STING-web-Max-Size,
.zeta-match-details-container {
  width: 100% !important;
  max-width: 1200px !important;
  margin-left: auto !important;
  margin-right: auto !important;
  padding-left: clamp(12px, 3vw, 24px) !important;
  padding-right: clamp(12px, 3vw, 24px) !important;
  overflow-x: hidden;
}
```

---

## 4. Collision & Overflow Prevention Mathematics

### 4.1 Proof & Resolution of the 104% Mobile Card Defect

#### The Legacy Defect:
In legacy theme stylesheets (`zetasports-korra-blogger-theme.xml`), mobile match card layout was governed by rigid percentage declarations:

$$\text{Width}_{\text{Total}} = \text{Width}_{\text{Left Team}} + \text{Width}_{\text{Score Box}} + \text{Width}_{\text{Right Team}}$$

$$\text{Width}_{\text{Total}} = 34\% + 36\% + 34\% = 104\%$$

On a canonical 390px mobile device with 12px outer padding, the available card width $W_{\text{avail}}$ is:

$$W_{\text{avail}} = 390\text{px} - 2(12\text{px}) = 366\text{px}$$

$$\text{Required Layout Space} = 366\text{px} \times 1.04 = 380.64\text{px}$$

This created a **14.64px immediate boundary violation** prior to evaluating internal margins, flex gaps, or borders. When clubs with long names competed (e.g., "Manchester United", "Wolverhampton Wanderers"), the unyielding intrinsic width of text strings forced the left and right containers into physical collision with the score box, blowing out the horizontal card frame and introducing horizontal page scroll wobble (`hasOverflow: true`).

#### The Mathematical Remediation:
The layout is transitioned to an anti-collision fluid flex allocation model that guarantees total width $\le 100\%$:

$$\text{Width}_{\text{Left Team}}^{\max} (35\%) + \text{Width}_{\text{Score Box}}^{\min} (30\%) + \text{Width}_{\text{Right Team}}^{\max} (35\%) = 100.0\%$$

```css
/* Container: Explicit Flex Row with Strict Containment */
.STING-web-Match-Content,
.zeta-match-card-row {
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  justify-content: space-between !important;
  width: 100% !important;
  max-width: 100% !important;
  gap: var(--zeta-space-2) !important;
  box-sizing: border-box !important;
}

/* Left & Right Team Units: Fluid Flex Shrink with 35% Ceiling */
.STING-web-Left-Team,
.STING-web-Right-Team,
.zeta-card-team {
  flex: 1 1 0% !important;
  min-width: 0 !important;      /* CRITICAL: Overrides flexbox intrinsic text width */
  max-width: 35% !important;
  width: auto !important;
  display: flex !important;
  align-items: center !important;
  box-sizing: border-box !important;
}

.STING-web-Left-Team,
.zeta-card-team-home {
  justify-content: flex-end !important;
  text-align: right !important;
  gap: var(--zeta-space-2) !important;
}

.STING-web-Right-Team,
.zeta-card-team-away {
  justify-content: flex-start !important;
  text-align: left !important;
  gap: var(--zeta-space-2) !important;
}

/* Center Score & Time Unit: Fixed Intrinsic Anchor */
.STING-web-Score-Box,
.zeta-card-center {
  flex: 0 0 auto !important;
  min-width: 76px !important;
  max-width: 30% !important;
  text-align: center !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  box-sizing: border-box !important;
}

/* Strict Text Truncation Guards */
.STING-web-Team-NAME,
.zeta-team-name {
  flex: 1 1 auto !important;
  min-width: 0 !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
  font-family: var(--zeta-font-display) !important;
  font-weight: var(--zeta-weight-bold) !important;
  font-size: var(--zeta-text-h3) !important;
  color: var(--zeta-dark-text) !important;
}
```

### 4.2 Tablet Header Collision & Flex Gap Containment

#### The Defect:
In the tablet range (769px to 1024px), the top navigation bar featured 5 text links, brand logo, search trigger, and theme toggle in a rigid `gap: 20px` flex container:

$$W_{\text{needed}} = \text{Logo}(180\text{px}) + \text{Links}(5 \times 90\text{px}) + \text{Gaps}(6 \times 20\text{px}) + \text{Actions}(110\text{px}) = 860\text{px}$$

On a standard 768px iPad in portrait orientation, $860\text{px} > 768\text{px}$, causing action buttons to wrap haphazardly over logo borders or push the dark mode toggle off-screen.

#### The Remediation:
1. Scale gaps from 20px to 10px.
2. Reduce navigation link padding to `6px 8px` and font size to `13px`.
3. Enable controlled flex wrapping with `flex-wrap: wrap`.
4. Enforce `max-width: 140px` with ellipsis on the logo element.

```css
@media screen and (min-width: 769px) and (max-width: 1024px) {
  .STING-web-Header,
  .zeta-site-header {
    flex-wrap: wrap !important;
    gap: 10px !important;
    padding: 8px 16px !important;
  }

  .STING-web-Menu,
  .zeta-header-nav {
    gap: 10px !important;
  }

  .STING-web-Menu > li > a,
  .zeta-header-nav-link {
    font-size: 13px !important;
    padding: 6px 8px !important;
  }

  .STING-web-Logo,
  .zeta-header-logo {
    max-width: 140px !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
  }
}
```

### 4.3 Zero-CLS Layout Reservation for External Embeds & Ads

To satisfy the Cumulative Layout Shift (CLS) threshold ($\le 0.05$), all dynamically injected containers (Google AdSense units and third-party stream players) enforce strict layout reservation:

```css
/* Zero-CLS Container Isolation */
.zeta-ad-slot-container,
.STING-web-Ads,
.links-ad-container {
  contain: layout !important;
  min-height: 90px !important;
  max-width: 100% !important;
  overflow: hidden !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}

/* 16:9 Video Player Aspect Ratio Reservation */
.zeta-player-aspect-wrapper {
  position: relative !important;
  width: 100% !important;
  aspect-ratio: 16 / 9 !important;
  background-color: #000000 !important;
  border-radius: var(--zeta-radius-lg) !important;
  overflow: hidden !important;
  contain: layout paint !important;
}
```

---

## 5. Touch Targets Accessibility Standards (WCAG 2.1 AAA)

Per WCAG 2.1 Success Criterion 2.5.5 (Target Size Level AAA) and Apple/Android Ergonomic Guidelines, every interactive control must possess an active bounding box of at least **$44\text{px} \times 44\text{px}$**.

### 5.1 Interactive Elements Inventory

| Element Class / ID | Target Type | Visual Size | Interactive Sizing Rule |
| :--- | :--- | :--- | :--- |
| `.STING-web-Matches-Toggle > li > a` | Date Filter Pill | 44px min-height | Physical height $\ge 44\text{px}$, padding `10px 16px` |
| `.zeta-league-pill` | League Carousel Filter | 44px min-height | Physical height $\ge 44\text{px}$, padding `8px 14px` |
| `.STING-web-Open-Dark`, `.STING-web-Open-Menu` | Header Icon Buttons | 44px $\times$ 44px | Direct box `min-width: 44px; min-height: 44px;` |
| `.btn-watch-stream`, `#watchBtn` | Watch Live CTA | 48px height | Physical height $\ge 48\text{px}$, full width on mobile |
| `.zeta-server-btn` | Server Switcher Buttons | 44px min-height | Physical height $\ge 44\text{px}$, min-width 100px |
| `.mtab-btn` | Match Center Tab Buttons | 44px min-height | Physical height $\ge 44\text{px}$, padding `10px 18px` |
| `.search-clear-btn`, `.search-trigger` | Search Icon Actions | 44px $\times$ 44px | Direct box `min-width: 44px; min-height: 44px;` |
| `#btnLinksBackToMatch` | Cross-Domain Return Link | 44px min-height | Physical height $\ge 44\text{px}$, padding `10px 16px` |

### 5.2 Implementation Standards

#### A. Direct Physical Bounding Box Sizing:
```css
.zeta-touch-target,
.match-chip-btn,
.btn-watch-stream,
.mtab-btn,
.zeta-server-btn,
.STING-web-Matches-Toggle > li > a {
  min-height: var(--zeta-touch-min, 44px) !important;
  min-width: var(--zeta-touch-min, 44px) !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  touch-action: manipulation !important;
  box-sizing: border-box !important;
}
```

#### B. Hit-Area Expansion via Pseudo-Elements (for compact visual badges):
Where design density requires a visually compact component (e.g., 28px height badge):
```css
.zeta-touch-expand {
  position: relative !important;
  touch-action: manipulation !important;
}

.zeta-touch-expand::after {
  content: '' !important;
  position: absolute !important;
  top: 50% !important;
  left: 50% !important;
  transform: translate(-50%, -50%) !important;
  min-width: 44px !important;
  min-height: 44px !important;
  width: 100% !important;
  height: 100% !important;
}
```

---

## 6. UI Component Specifications

### 6.1 Match Fixture Card (`.STING-web-Match` / `.zeta-match-card`)

```
┌────────────────────────────────────────────────────────────────────────┐
│  Premier League • Matchday 24 • Live 74' 🟢                           │
├────────────────────────────────────────────────────────────────────────┤
│   [ Crest ] Manchester City     2  -  1     Liverpool [ Crest ]       │
├────────────────────────────────────────────────────────────────────────┤
│                    [ ▶ Watch Live Broadcast ]                          │
└────────────────────────────────────────────────────────────────────────┘
```

- **Visual Architecture**:
  - Background: `--zeta-dark-card` (`#111827`)
  - Border: `1px solid var(--zeta-dark-border)` (`#1f2937`)
  - Border Radius: `--zeta-radius-md` (`10px`)
  - Padding: Desktop `14px 18px`, Mobile `10px 12px`
  - Margin: `0 0 12px 0`
  - Shadow: `--zeta-shadow-sm`
- **Interactive States**:
  - **Hover (Desktop only)**: `@media (hover: hover)`: Border color shifts to `--zeta-dark-border-subtle` (`#374151`), transform `translateY(-2px)`, shadow `--zeta-shadow-md`.
  - **Live In-Play State**: Left card accent line `3px solid var(--zeta-accent)` (`#10b981`), live pulse dot animation.
  - **Touch Guard**: Sticky hover disabled on touch screens via `@media (hover: none) { .STING-web-Overlay { display: none !important; } }`.
- **Sub-Elements**:
  - **Team Crest**: $36\text{px} \times 36\text{px}$ (Desktop), $28\text{px} \times 28\text{px}$ (Mobile $\le 390\text{px}$), `object-fit: contain`.
  - **Scoreboard Center**: Monospace Oswald counter, font size `20px` bold.
  - **Kickoff Pill**: Monospace `12px` text, background `--zeta-dark-surface-raised`, padding `4px 8px`, border radius `4px`.
  - **Watch CTA Button**: Background `--zeta-action-blue` (`#2563eb`), color `#ffffff`, height `44px`, font size `14px` bold, border radius `6px`.

### 6.2 Date Switcher Tabs (`.STING-web-Matches-Toggle` / `.zeta-date-switcher`)

- **Structure**: Horizontal 3-pill toggle bar (Yesterday, Today, Tomorrow) + Date Picker trigger.
- **Visual Styling**:
  - Background: `--zeta-dark-card` (`#111827`) with `1px solid var(--zeta-dark-border)`.
  - Border Radius: `--zeta-radius-full` (`9999px`).
  - Container Padding: `4px`.
  - Tab Pill Sizing: `min-height: 44px; padding: 8px 16px; border-radius: 9999px;`
- **States**:
  - **Inactive Tab**: Background `transparent`, color `--zeta-dark-muted` (`#9ca3af`), font-size `14px`, font-weight `500`.
  - **Active Tab**: Background `linear-gradient(135deg, #10b981, #059669)`, color `#ffffff`, font-weight `700`, box-shadow `--zeta-glow-live`.
  - **Fixture Counter Badge**: Background `rgba(255, 255, 255, 0.20)`, color `#ffffff`, padding `2px 6px`, border radius `9999px`, font-size `11px`, margin-left `6px`.

### 6.3 League Filter Pills (`.zeta-league-pills`)

- **Structure**: Horizontal scrolling carousel with momentum scrolling (`-webkit-overflow-scrolling: touch`).
- **Styling**:
  - Pill Height: `min-height: 44px`.
  - Padding: `8px 14px`.
  - Border: `1px solid var(--zeta-dark-border)`.
  - Border Radius: `--zeta-radius-full`.
  - Background: `--zeta-dark-card`.
  - Gap: `8px`.
  - Scrollbar: Suppressed (`scrollbar-width: none; &::-webkit-scrollbar { display: none; }`).
- **Sub-Elements**:
  - League Crest: $20\text{px} \times 20\text{px}$ circular icon.
  - League Name: `13px` medium text, color `--zeta-dark-text`.
  - Match Count Pill: `11px` monospace count.

### 6.4 Search Bar (`.zeta-search-bar`)

- **Structure**: Full-width input with icon prefix and clear button suffix.
- **Sizing**:
  - Container Height: `min-height: 44px`.
  - Font Size: `16px` on mobile (prevents iOS auto-zoom behavior), `14px` on desktop.
  - Border: `1px solid var(--zeta-dark-border)`.
  - Background: `--zeta-dark-card`.
  - Border Radius: `--zeta-radius-md` (`10px`).
- **Interactions**:
  - Focus state: Border color `--zeta-action-blue` (`#2563eb`), box shadow `--zeta-glow-action`.
  - Clear Action Button: `min-width: 44px; min-height: 44px; display: flex; align-items: center; justify-content: center;`.
  - Debounce: 250ms query debounce.

### 6.5 Scoreboard Hero Header (`#matchView .zeta-scoreboard-hero`)
*Directly Resolves Match Detail Permalink Bug (`scoreboardBg: rgba(0, 0, 0, 0)`)*

```
┌────────────────────────────────────────────────────────────────────────┐
│  EGYPTIAN PREMIER LEAGUE • MATCHDAY 18 • LIVE 82' 🟢                   │
│                                                                        │
│       [ CREST ]                                    [ CREST ]          │
│   Al Mokawloon Al Arab       2   -   1               WE SC            │
│         (Home)                                      (Away)            │
│                                                                        │
│   🏟 Arab Contractors Stadium   •   👤 Mahmoud El Banna               │
│                                                                        │
│   [ ▶ WATCH LIVE BROADCAST ]                                           │
└────────────────────────────────────────────────────────────────────────┘
```

- **Universal Styling Guarantee**:
  Because this component previously rendered transparent when accessed via Blogger post permalinks, its styles are bound directly in `zetasports-core.css` with explicit solid fallback and high-specificity selectors:

```css
/* Universal Scoreboard Hero (Immune to Template Permalinks) */
#matchView .zeta-scoreboard-hero,
.zeta-match-hero-wrapper {
  background: #111827 !important; /* Solid fallback */
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%) !important;
  border: 1px solid var(--zeta-dark-border) !important;
  border-radius: var(--zeta-radius-lg) !important;
  padding: clamp(16px, 4vw, 32px) !important;
  margin-bottom: var(--zeta-space-6) !important;
  box-shadow: var(--zeta-shadow-lg) !important;
  width: 100% !important;
  max-width: 100% !important;
  box-sizing: border-box !important;
  position: relative !important;
  overflow: hidden !important;
}

/* Scoreboard Grid: 3-Unit Layout */
.zeta-scoreboard-grid {
  display: grid !important;
  grid-template-columns: 1fr auto 1fr !important;
  align-items: center !important;
  gap: var(--zeta-space-4) !important;
}

@media (max-width: 480px) {
  .zeta-scoreboard-grid {
    gap: var(--zeta-space-2) !important;
  }
}

/* Team Crest Container */
.zeta-hero-crest-wrap {
  width: clamp(48px, 8vw, 64px) !important;
  height: clamp(48px, 8vw, 64px) !important;
  background: rgba(30, 41, 59, 0.70) !important;
  border: 1px solid var(--zeta-dark-border-subtle) !important;
  border-radius: var(--zeta-radius-full) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 6px !important;
  box-shadow: var(--zeta-shadow-sm) !important;
}

.zeta-hero-crest-img {
  max-width: 100% !important;
  max-height: 100% !important;
  object-fit: contain !important;
}

/* Score Display Typography */
.zeta-hero-score-counter {
  font-family: var(--zeta-font-display) !important;
  font-size: var(--zeta-text-display-xl) !important;
  font-weight: var(--zeta-weight-bold) !important;
  color: var(--zeta-dark-text) !important;
  letter-spacing: 2px !important;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.50) !important;
  display: flex !important;
  align-items: center !important;
  gap: 12px !important;
}

/* Live Minute Pulser Badge */
.zeta-hero-minute-badge {
  display: inline-flex !important;
  align-items: center !important;
  gap: 6px !important;
  background: var(--zeta-live-green-bg) !important;
  border: 1px solid rgba(16, 185, 129, 0.30) !important;
  color: var(--zeta-live-green) !important;
  font-family: var(--zeta-font-mono) !important;
  font-size: var(--zeta-text-body-sm) !important;
  font-weight: var(--zeta-weight-bold) !important;
  padding: 4px 10px !important;
  border-radius: var(--zeta-radius-full) !important;
}
```

### 6.6 Tactical Pitch Formation with Player Dots (`.zeta-tactical-pitch`)

```
┌────────────────────────────────────────────────────────────────────────┐
│                          TACTICAL FORMATION (4-3-3)                    │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │                                GK                                  │ │
│ │                               (1)                                  │ │
│ │                     [ Alisson ]                                    │ │
│ │                                                                    │ │
│ │       RB              CB                CB              LB         │ │
│ │      (66)             (5)               (4)            (26)        │ │
│ │  [ Alexander-A ]  [ Konate ]       [ Van Dijk ]   [ Robertson ]    │ │
│ │                                                                    │ │
│ │              RCM               DM               LCM                │ │
│ │             (10)               (3)              (8)                │ │
│ │        [ Mac Allister ]    [ Endo ]        [ Szoboszlai ]          │ │
│ │                                                                    │ │
│ │       RW                                                LW         │ │
│ │      (11)                      CF                      (7)         │ │
│ │    [ Salah ]                  (9)                    [ Diaz ]      │ │
│ │                             [ Nunez ]                              │ │
│ └────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

- **Canvas Dimensions**:
  - Desktop (1280px+): `height: 600px`
  - Tablet (768px): `height: 520px`
  - Mobile Standard ($\le 640\text{px}$): `height: 460px`
  - Mobile Compact ($\le 380\text{px}$): `height: 420px`
- **Pitch Turf Visuals**:
  - Alternating emerald lawn stripes: `repeating-linear-gradient(0deg, #15803d 0px, #15803d 40px, #166534 40px, #166534 80px)`
  - Markings: Pitch outline, center circle, penalty boxes rendered in `2px solid rgba(255, 255, 255, 0.40)`.
- **Player Dots & Labels (Anti-Overlap Specs)**:
  - Avatar Circle: Desktop `32px`, Tablet `28px`, Mobile `24px`, Compact Mobile `22px`.
  - Avatar Border: `2px solid #ffffff`, Background `#0f172a`.
  - Squad Number: Centered in circle, monospace bold, `11px`.
  - Player Name Tag:
    - Background: `rgba(15, 23, 42, 0.85)` with `backdrop-filter: blur(4px)`.
    - Border: `1px solid rgba(255, 255, 255, 0.15)`.
    - Border Radius: `4px`.
    - Padding: `2px 6px`.
    - Font Size: `10px` bold, color `#ffffff`.
    - **Max-Width & Truncation (Critical Defense)**:
      - Desktop: `max-width: 80px; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;`
      - Mobile Standard: `max-width: 58px; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;`
      - Mobile Compact ($\le 380\text{px}$): `max-width: 48px; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;`

### 6.7 Match Events Timeline (`.zeta-timeline-container`)

- **Structure**: Vertical chronological timeline dividing home incidents (left) and away incidents (right) on desktop; single-column unified list on mobile.
- **Divider Spine**: Centered vertical line `2px solid var(--zeta-dark-border)`.
- **Event Item Sizing**:
  - Incident Badge: `32px x 32px` circular icon with event indicator:
    - ⚽ Goal: Emerald background `#10b98120`, border `#10b981`.
    - 🟨 Yellow Card: Warning background `#f59e0b20`, border `#f59e0b`.
    - 🟥 Red Card: Danger background `#ef444420`, border `#ef4444`.
    - 🔄 Substitution: Action blue background `#2563eb20`, border `#2563eb`.
    - 📺 VAR Review: Purple background `#8b5cf620`, border `#8b5cf6`.
  - Minute Marker: Monospace `12px` bold badge.
  - Player Name: `14px` bold, white `#f9fafb`.

### 6.8 Stream Player with Multi-Server Switcher (`#streamView`)

```
┌────────────────────────────────────────────────────────────────────────┐
│  ← Back to Match Post           ZETASPORTS LIVE          🏠 Home       │
├────────────────────────────────────────────────────────────────────────┤
│  [ Server 1 (1080p HD) ]   [ Server 2 (720p) ]   [ Server 3 (Audio) ]  │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│                        SANDBOXED VIDEO IFRAME                          │
│                          (16:9 Aspect Ratio)                           │
│                                                                        │
├────────────────────────────────────────────────────────────────────────┤
│  [ 🔄 Reload Stream ]                            [ ⛶ Native Fullscreen ]│
└────────────────────────────────────────────────────────────────────────┘
```

- **Aspect Ratio Containment**: `aspect-ratio: 16 / 9; width: 100%; max-height: 720px; background: #000000;`.
- **Server Switcher Toolbar**:
  - Container: Horizontal flex row with `gap: 8px; flex-wrap: wrap; margin-bottom: 12px;`.
  - Server Buttons:
    - Height: `min-height: 44px`.
    - Padding: `8px 16px`.
    - Border Radius: `8px`.
    - Active Server: Background `--zeta-action-blue` (`#2563eb`), color `#ffffff`, shadow `--zeta-glow-action`.
    - Inactive Server: Background `--zeta-dark-card` (`#111827`), border `1px solid var(--zeta-dark-border)`, color `--zeta-dark-muted`.
    - Quality Badge: Nested `span` with `font-size: 10px; background: rgba(255,255,255,0.15); padding: 2px 6px; border-radius: 4px; margin-left: 6px;`.
- **Utility Action Bar**:
  - Full-width flex container with `justify-content: space-between`.
  - Reload & Fullscreen Buttons: `min-height: 44px; min-width: 44px; display: inline-flex; align-items: center; justify-content: center; gap: 6px;`.
- **Iframe Sandboxing Integrity**:
  The embedded iframe (`#streamIframe`) strictly applies:
  `sandbox="allow-scripts allow-same-origin allow-presentation"`
  `referrerpolicy="no-referrer"`
  `allowfullscreen="true"`

---

## 7. Implementation Contracts for Frontend Developer

Downstream implementation by the Frontend Developer (`frontend_m3`) must adhere to the following contractual guidelines:

1. **Stylesheet Single Source of Truth**:
   All CSS rules must be committed to `web/css/zetasports-core.css`. Zero custom inline CSS or `<style>` blocks may be added to `zetasports-colorify-blogger-theme.xml` or `zetasports-korra-blogger-theme.xml`.

2. **Namespace Discipline**:
   - New components must utilize the `.zeta-*` class naming prefix (e.g., `.zeta-match-card`, `.zeta-scoreboard-hero`, `.zeta-server-btn`).
   - Legacy template hooks (`.STING-web-Match`, `.STING-web-Score-Box`, `.STING-web-Left-Team`, `.STING-web-Right-Team`) must be styled concurrently via multi-selector rules to preserve backward compatibility.

3. **Mandatory Overflow Rule**:
   Before submitting changes, test with Chrome DevTools or Puppeteer runner to verify that:
   ```javascript
   document.documentElement.scrollWidth === document.documentElement.clientWidth
   ```
   at **360px**, **390px**, **768px**, and **1280px** viewports.

4. **Touch Target Verification**:
   Every clickable element (`<a>`, `<button>`, `input[type="button"]`, `.match-chip-btn`, `.badge-chip`, `.mtab-btn`) must evaluate to:
   ```javascript
   const rect = el.getBoundingClientRect();
   rect.width >= 44 && rect.height >= 44;
   ```
   or possess a pseudo-element `.zeta-touch-expand` with `44px x 44px` hit area.

---

*Authored by Senior UI/UX Designer for the ZetaSports 12-Agent Development Lifecycle.*
