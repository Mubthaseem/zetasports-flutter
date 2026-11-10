# Product Requirements Document (PRD)

**Project:** ZetaSports Enterprise Live Sports Network  
**Target Domains:** `keralahub.online` & `zetasports.site`  
**Author:** Technical Product Manager  
**Version:** 3.6.0  

---

## 1. Executive Summary & Purpose

The ZetaSports network delivers real-time football scores, high-fidelity match centers, live tactical lineups, FotMob-synchronized game statistics, and HD streaming gateways across two optimized Google Blogger web surfaces:
1. **KeralaHub (`keralahub.online`)**: Match Post Center & Deep Editorial Experience.
2. **ZetaSports (`zetasports.site`)**: Live Score Fixtures Board & Multi-Server Video Streaming Player.

---

## 2. Target Users & Problems Solved

| User Persona | Problem Faced | ZetaSports Solution |
| :--- | :--- | :--- |
| **Live Sports Fan** | Annoying popups, dead stream links, delayed scores. | Instant verified scores, clean link selection gateway, 1080p fallback streams, zero intrusive popups. |
| **Mobile Match Follower** | Cluttered desktop interfaces, broken layouts on phones. | Responsive single-column layouts, touch targets $\ge 44\text{px}$, zero horizontal overflow on 360px & 390px. |
| **Site Administrator** | Need to manually edit HTML for every theme update or keyword change. | Centralized CDN stylesheet (`zetasports-core.css`), automated real-time SEO keywords, and 1-click theme publisher. |

---

## 3. Feature Prioritization (MoSCoW)

### Must Have (P0)
- Real-time fixture list with live score indicators (`LIVE`, `FT`, Kickoff time).
- Dedicated Match Post Page (`/{slug}-{id}`) with scoreboard, crests, and venue meta.
- 8 Interactive Match Center Tabs: Overview, Timeline, Statistics, Lineups, H2H, Commentary, Articles.
- Multi-server Link Selection Gateway with server health tags (`1080p`, `Multi-Language`, `Fast`).
- Full Responsive Layout without horizontal scrollbars on mobile ($360\text{px} - 430\text{px}$).
- Strict XSS protection via `escapeHtml()` and URL sanitization via `sanitizeUrl()`.

### Should Have (P1)
- Dynamic Google `SportsEvent` JSON-LD schema injection for search engine rich results.
- Automated meta keywords generation per match.
- Real-time global announcement banner and Telegram popup alerts via Supabase `zeta_config`.
- 1-Click Blogger automated publisher script (`automate_blogger.bat`).

### Could Have (P2)
- Fan Prediction Poll with real-time percentage bars.
- Goal whistle audio alerts upon live score increment.
- Multi-language UI localization.

### Won't Have (P3)
- Intrusive interstitial pop-under ad scripts that degrade user experience.
- Heavy front-end JavaScript frameworks that exceed Blogger bundle budgets.

---

## 4. Acceptance Criteria

1. **Visual Parity**: Match details page on `keralahub.online` must display the full hero scoreboard, tabs, and action buttons identically to `zetasports.site`.
2. **Performance**: First Contentful Paint (FCP) $\le 1.8\text{s}$ on 4G mobile connections.
3. **Responsive Stability**: Zero horizontal overflow (`scrollWidth === clientWidth`) across 360px, 390px, 768px, 1280px, and 1440px viewports.
4. **Parity Check**: `zetasports-colorify-blogger-theme.xml` must remain 100% byte-identical to `colorify_zetasports_theme.xml`.
