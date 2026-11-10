# ZetaSports Master Project Guide: Full-Stack Visual & Responsive Remediation

## 1. Executive Summary & Project Goals

**ZetaSports** is an enterprise-grade live sports portal, fixtures aggregation engine, and low-latency streaming hub designed to deliver football/soccer scores, detailed match lineups, statistical timelines, and multi-server video streams to global users. 

This project encompasses the full-stack visual, responsive, and architectural remediation of the platform across its **2-Blogger dual-domain architecture**. The primary objective is to eliminate all visual defects, CSS collisions, overlapping UI components, and viewport clipping across all device form factors (from 360px/390px mobile up to 1440px desktop), while enforcing strict cybersecurity hygiene, maintaining zero horizontal overflow, and guaranteeing WCAG AAA-compliant 44px touch targets.

### Core Objectives:
1. **Flawless Multi-Device Responsiveness**: Achieve 100% visual harmony with zero horizontal overflow (`overflow-x: hidden`), dynamic flex containment, and seamless reflow on **390px mobile viewports** (iPhone 14/15, Android standard) and **1280px+ desktop viewports**.
2. **2-Blogger Architectural Decoupling**: Maintain clear domain separation between **KeralaHub** (Content, Fixtures & Match Details) and **ZetaSports** (Streaming Gateway, Player & Server Switcher) via secure cross-domain parameter passing.
3. **Single Source of Truth (SOT) Master CSS**: Centralize over 6,500 lines of previously duplicated theme styles into `web/css/zetasports-core.css`, hosted globally on Supabase Storage CDN and jsDelivr with instant client-side cache updates.
4. **Defect Elimination**: Resolve all known layout collisions, including the 104% match card width collision, header button overlaps on tablet, sub-44px touch targets on date filters, unstyled scoreboard containers on match detail bug URLs, and tactical pitch dot collisions.
5. **Strict Cybersecurity**: Enforce zero-trust client protections, including robust HTML escaping (`escapeHtml`), strict URL scheme validation (`sanitizeUrl`), open-redirect defense (`isAllowedUrl`), and restrictive iframe sandboxing (`allow-scripts allow-same-origin allow-forms allow-presentation`).

---

## 2. High-Level System Architecture

ZetaSports leverages a decoupled **2-Blogger dual-domain topology** combined with a cloud-native backend powered by **Supabase PostgreSQL** and modern CDN distribution.

```
+---------------------------------------------------------------------------------------------------+
|                                      ZETASPORTS SYSTEM TOPOLOGY                                   |
+---------------------------------------------------------------------------------------------------+
                                                  |
           +--------------------------------------+--------------------------------------+
           |                                                                             |
           v                                                                             v
+------------------------------------+                         +------------------------------------+
|       PRIMARY CONTENT DOMAIN       |                         |       STREAMING PLAYER DOMAIN      |
|    https://www.keralahub.online/   |                         |     http://www.zetasports.site/    |
|   (Colorify Blogger Theme XML)     |                         |     (Korra Blogger Theme XML)      |
+------------------------------------+                         +------------------------------------+
| - Homepage & Fixtures Center       |                         | - Links Gateway (#linksView)       |
| - Date Switcher (Yest/Today/Tmrw)  |                         | - Sandboxed Player (#streamView)   |
| - League Filter Carousel           |   Cross-Domain Query    | - Multi-Server Switcher            |
| - Search & Filter Modals           | ======================> | - Quality / Bitrate Selector       |
| - Match Details (#matchView)       |   ?matchId={id}&view=   | - Fallback Direct Stream Gateway   |
| - Scoreboards, Timelines, Lineups  | <====================== | - Safe Return-to-Match Navigation  |
| - Byte-Mirror with zetasports-v3   |    isAllowedUrl() Safe  | - AdSense Zero-CLS Containment     |
+------------------------------------+                         +------------------------------------+
           |                                                                             |
           +--------------------------------------+--------------------------------------+
                                                  |
                                                  v
                   +--------------------------------------------------------------+
                   |               MASTER STYLING LAYER (CENTRAL SOT)             |
                   |                  web/css/zetasports-core.css                 |
                   +--------------------------------------------------------------+
                   | - CDN 1: Supabase Storage Object Cache                       |
                   |   (https://udlncusvhmydivtjkjcy.supabase.co/storage/v1/...)  |
                   | - CDN 2: jsDelivr GitHub Fallback                            |
                   |   (https://cdn.jsdelivr.net/gh/Mubthaseem/zetasports-...)    |
                   +--------------------------------------------------------------+
                                                  |
                                                  v
                   +--------------------------------------------------------------+
                   |                 DATA LAYER: SUPABASE POSTGRESQL              |
                   +--------------------------------------------------------------+
                   | - Tables: matches, leagues, teams, stream_sources, crawlers  |
                   | - Authentication: Public Anon Key + Row Level Security (RLS) |
                   | - Ingestion: Real-time crawler pipeline & FotMob sync        |
                   +--------------------------------------------------------------+
```

### Domain Separation & Responsibilities:

#### 1. Primary / Match Details Domain (`https://www.keralahub.online/`)
- **Theme**: Colorify Blogger Theme (`zetasports-colorify-blogger-theme.xml`).
- **Mirror**: Fully synchronized with `zetasports-v3/web/colorify_zetasports_theme.xml` (SHA-256 byte parity).
- **Functionality**:
  - Hosts the main portal view (`#homeView`), featuring chronological match groupings.
  - Interactive Date Switcher bar (Yesterday, Today, Tomorrow) with live count indicators.
  - League selection pills with SVG crests (Premier League, La Liga, Serie A, Champions League, etc.).
  - Match Details Page (`#matchView`) rendering rich live scoreboards, match clocks, goal scorers, head-to-head statistics, and 2.5D tactical pitch formations.
  - Dynamic routing to the streaming domain upon clicking "Watch Live" or "Stream Links".

#### 2. Streaming & Player Domain (`http://www.zetasports.site/`)
- **Theme**: Korra Blogger Theme (`zetasports-korra-blogger-theme.xml`).
- **Functionality**:
  - Link Selection Gateway (`#linksView`): Displays all verified live servers with health statuses, bitrates, audio languages, and latency ratings.
  - Stream Player View (`#streamView`): High-definition embedded video player encapsulated in a sandboxed iframe.
  - Multi-Server Switcher: Seamless switching between Server 1 (HD), Server 2 (Fast CDN), Server 3 (Mobile Low-Latency), and Server 4 (Web Player).
  - Cross-Domain Navigation: Safe "Return to Match Post" link returning users back to `keralahub.online` with match parameters intact.

#### 3. Master CSS Core (`web/css/zetasports-core.css`)
- Serves as the single stylesheet referenced by both Blogger themes in their `<head>`:
  ```html
  <link rel="stylesheet" href="https://udlncusvhmydivtjkjcy.supabase.co/storage/v1/object/public/scripts/zetasports-core.css" id="zetasports-core-css"/>
  ```
- Eliminates inline CSS divergence, ensuring brand, typography, color tokens, and layout changes propagate instantaneously to both domains without editing Blogger XML files.

---

## 3. Responsive Layout Goals & Anti-Collision System

The platform has been audited and engineered against extreme viewport variations to guarantee visual elegance and structural stability:

| Viewport Category | Screen Width | Key Design Guarantees |
| :--- | :--- | :--- |
| **Mobile Compact** | `360px - 380px` | Single-column cards, tactical pitch scaled down to 420px height, logo truncated to 130px, player tags constrained to 48px width with ellipsis, zero horizontal scroll. |
| **Mobile Standard** | `380px - 480px` | Canonical mobile baseline (**390px iPhone 14/15**). Minimum 44px touch targets on all buttons, 8px grid gaps, flex-wrap on header bars and gateway pills, card widths auto-calculated (`flex: 1 1 0%`). |
| **Tablet Portrait** | `768px - 1024px` | Adjusted navbar spacing (`gap: 10px; font-size: 13px; padding: 6px 8px;`), dual-column link grid (`grid-template-columns: repeat(2, 1fr)`), clean ad container isolation. |
| **Desktop HD** | `1280px - 1440px`| Full 3-column layout (Left: Leagues sidebar, Center: Fixtures/Player, Right: Trending/Standings), 1280px max-width container, 16px grid gutters, zero layout shifts. |

### Technical Anti-Collision Guardrails:
1. **Dynamic Flexbox Team Containers**:
   ```css
   .STING-web-Right-Team, .STING-web-Left-Team {
     flex: 1 1 0%;
     min-width: 0;
     width: auto !important;
     max-width: 35%;
     gap: 6px;
   }
   .STING-web-Team-NAME {
     overflow: hidden;
     text-overflow: ellipsis;
     white-space: nowrap;
   }
   ```
2. **WCAG AAA Touch Sizing Enforcement**:
   ```css
   .btn, .tab-btn, .server-btn, .nav-icon-btn, .date-pill {
     min-height: 44px;
     min-width: 44px;
     display: inline-flex;
     align-items: center;
     justify-content: center;
     touch-action: manipulation;
   }
   ```
3. **Zero-CLS AdSense Layout Isolation**:
   ```css
   .ads-banner, .google-ad-slot, .sponsored-wrapper {
     contain: layout;
     min-height: 90px;
     overflow: hidden;
   }
   ```

---

## 4. Directory Structure

The project workspace adheres strictly to the standardized 12-agent delivery structure:

```
c:\Users\Mubthaseem\.gemini\antigravity\scratch\zetasports-flutter\
├── project/                                     # Master Deliverables Root
│   ├── README.md                                # Master Project Guide & Architecture (this document)
│   ├── AGENTS.md                                # 12-Agent Hierarchy, Workflow Lifecycle & Roles
│   ├── docs/                                    # Technical Specifications
│   │   ├── PRD.md                               # Product Requirements Document
│   │   ├── ARCHITECTURE.md                      # System Architecture & Topology
│   │   ├── DESIGN_SYSTEM.md                     # UI/UX Tokens, Typography & Breakpoints
│   │   ├── DATABASE_SCHEMA.md                   # Supabase Tables, RLS & Migration DDL
│   │   ├── API_DOCUMENTATION.md                 # REST API, Crawler & FotMob Contracts
│   │   └── SECURITY_REQUIREMENTS.md             # OWASP Top 10, Sandboxing & Sanitization
│   ├── agent-reports/                           # Independent 12-Agent Technical Reports
│   │   ├── product-manager.md                   # PM Requirements, Stories & Gating
│   │   ├── architect.md                         # Architectural Decisions & Verification
│   │   ├── designer.md                          # Design Defect Audit & System Tokens
│   │   ├── frontend.md                          # Theme Patching & DOM Analysis
│   │   ├── backend.md                           # Edge Functions & Integration Services
│   │   ├── database.md                          # Schema Optimization & Indexing
│   │   ├── qa.md                                # QA Functional & Integration Suite Report
│   │   ├── logic-tester.md                      # Edge Cases, Timezones & Null Scenarios
│   │   ├── security.md                          # Cybersecurity & Vulnerability Audit
│   │   ├── code-review.md                       # Peer Review & Quality Assurance Audit
│   │   └── deployment.md                        # DevOps, CDN Sync & Release Report
│   ├── tests/                                   # Automated Test Harness
│   │   ├── functional/                          # Fixtures, navigation & DOM node tests
│   │   ├── integration/                         # Cross-domain routing & Supabase REST tests
│   │   ├── logic/                               # Date boundaries, timezone shifts & empty states
│   │   ├── responsive/                          # 390px & 1280px DOM layout & overflow verification
│   │   └── security/                            # XSS escaping, open redirect & sandbox tests
│   └── src/                                     # Patched Source & Deployment Assets
│       ├── zetasports-core.css                  # Patched Master Stylesheet (CDN SOT)
│       ├── zetasports-colorify-blogger-theme.xml# Patched Colorify Theme for KeralaHub
│       ├── zetasports-korra-blogger-theme.xml   # Patched Korra Theme for ZetaSports
│       └── deployment-manifest.json             # Release artifact metadata & hashes
├── web/                                         # Web Source
│   └── css/
│       └── zetasports-core.css                  # Active Master Stylesheet
├── zetasports-colorify-blogger-theme.xml        # Root Colorify Theme Source
├── zetasports-korra-blogger-theme.xml           # Root Korra Theme Source
└── .agents/                                     # Teamwork Multi-Agent State Directory
```

---

## 5. Local Setup, Verification & Deployment Instructions

### 5.1 Environment Prerequisites
- **Node.js**: v18.0.0 or higher
- **PowerShell**: v5.1 or PowerShell Core 7+
- **Git**: v2.30+
- **Python**: v3.10+ (optional, for crawler validation scripts)

### 5.2 Verification Test Execution
To run the automated visual collision and responsive audit suite:
```powershell
# Execute design collision audit across all themes
node scratch/audit_design_collisions.mjs

# Execute multi-viewport DOM and overflow verification
node scratch/verify_responsive_layout.mjs
```

### 5.3 Theme Deployment to Blogger (KeralaHub & ZetaSports)

#### Updating KeralaHub (`https://www.keralahub.online/`):
1. Sign in to the [Blogger Admin Console](https://www.blogger.com).
2. Select the **KeralaHub** blog from the drop-down selector.
3. In the left navigation sidebar, navigate to **Theme**.
4. Click the down arrow (**▾**) adjacent to the orange **Customize** button and choose **Edit HTML**.
5. Select all existing XML code (`Ctrl+A`) and paste the complete content of:
   `c:\Users\Mubthaseem\.gemini\antigravity\scratch\zetasports-flutter\zetasports-colorify-blogger-theme.xml`
6. Click the **Save** (💾 icon) in the upper-right corner.

#### Updating ZetaSports (`http://www.zetasports.site/`):
1. In the Blogger Admin Console, switch to the **ZetaSports** blog.
2. Navigate to **Theme** $\to$ **Edit HTML**.
3. Replace the entire code with the contents of:
   `c:\Users\Mubthaseem\.gemini\antigravity\scratch\zetasports-flutter\zetasports-korra-blogger-theme.xml`
4. Click **Save**.

### 5.4 Master CSS Deployment to Supabase Storage CDN

Whenever changes are made to `web/css/zetasports-core.css`, deploy the updated file to Supabase Storage:
```powershell
# Automated upload via Supabase REST API (or execute PowerShell deployment script)
$cssPath = "web/css/zetasports-core.css"
$supabaseUrl = "https://udlncusvhmydivtjkjcy.supabase.co"
$anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkbG5jdXN2aG15ZGl2dGpramN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4MTE2MDgsImV4cCI6MjEwOTM4NzYwOH0.gsnxlDww-fUC4HG7R7VasXSaQvqkSsDhhmf16KUCLZY"

# Verify HTTP 200 availability
Invoke-WebRequest -Uri "$supabaseUrl/storage/v1/object/public/scripts/zetasports-core.css" -Method Head
```

*Note: Once uploaded to Supabase Storage, both Blogger themes instantly consume the updated styles on the next client request without requiring template re-uploads.*

---

## 6. Cybersecurity & Compliance Summary

In strict compliance with project cybersecurity mandates:
- **Iframe Sandboxing**: All embedded stream iframes are locked down with `sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"`. Disallowed flags include `allow-top-navigation-by-user-activation`, `allow-modals`, and `allow-downloads`.
- **Referrer Privacy**: Enforced `referrerpolicy="no-referrer"` to prevent leaking stream authentication tokens and originating URLs.
- **XSS Mitigation**: All dynamic user inputs, URL query parameters, and match payload fields are sanitized through `escapeHtml()` and `sanitizeUrl()`.
- **Anti-Open Redirect**: Cross-domain navigation executes through `isAllowedUrl()`, rejecting unapproved domains and protocol-relative prefixes (`//` and `/\\`).
