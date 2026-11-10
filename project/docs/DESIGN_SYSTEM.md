# ZetaSports Unified Design System & Collision Guard Standards

**Author:** UI/UX Designer  
**Scope:** Cross-Device Consistency (360px Mobile to 1440px Ultra-Wide)  
**Version:** 3.6.0  

---

## 1. Typography & Hierarchy

The design system standardizes on Google Fonts:

- **Primary UI & Data Body:** `Inter`, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
- **Scoreboard Big Numbers & Hero Teams:** `Oswald`, sans-serif (Weights: 500, 600, 700)
- **Monospace Codes & Stream Badges:** `ui-monospace`, SFMono-Regular, "Roboto Mono", Menlo, monospace

```css
:root {
  --zeta-font-main: 'Inter', system-ui, -apple-system, sans-serif;
  --zeta-font-heading: 'Oswald', sans-serif;
  
  --zeta-primary: #0062b2;
  --zeta-primary-hover: #004f93;
  --zeta-accent-blue: #2563eb;
  --zeta-live-green: #16a34a;
  --zeta-live-bg: #dcfce7;
  
  --zeta-card-bg: #ffffff;
  --zeta-border: #e2e8f0;
  --zeta-text-main: #0f172a;
  --zeta-text-muted: #64748b;
  
  --zeta-dark-bg: #0b0f19;
  --zeta-dark-card: #131b2e;
  --zeta-dark-border: #1e293b;
  --zeta-dark-text: #f1f5f9;
}
```

---

## 2. Component Specifications

### 1. Hero Scoreboard Grid
- **Desktop (1280px)**: 3-column grid (`team-unit`, `score-unit`, `team-unit`) with 64px team logos and 38px scores.
- **Mobile (<600px)**: Proportional scaling:
  - Team logos: 48px $\times$ 48px
  - Team names: max-width 35%, word-break enabled, 13px bold
  - Score counter: 30px with 2px letter spacing

### 2. Interactive Navigation Tabs (7 Tabs)
- Horizontally scrollable tab bar with hidden scrollbar (`scrollbar-width: none`).
- Touch target height: minimum $44\text{px}$.
- Active tab indicator: 2px solid `#3b82f6` with smooth fade-in.

### 3. Stream Action CTA
- Prominent blue accent (`#2563eb`) with bold text and play symbol (`▶`).
- Full width on mobile; max-width 480px centered on desktop.
- Minimum touch target: $48\text{px}$ height.

---

## 3. Responsive Collision Guards & Zero-Overflow Rules

```css
/* Universal safe layout protections */
#matchView, #linksView, #streamView, #homeView {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

/* Touch Target Compliance (WCAG 2.2 AA) */
.STING-web-Menu > li > a,
.STING-web-Matches-Toggle > li > a,
.match-chip-btn,
.badge-chip,
.btn-watch-stream,
.mtab-btn {
  min-height: 44px !important;
  box-sizing: border-box !important;
  touch-action: manipulation;
}

/* Zero CLS AdSense Reserve */
.STING-web-Ads, .links-ad-container {
  contain: layout;
  min-height: 90px;
  overflow: hidden;
}
```
