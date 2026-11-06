import fs from 'fs';
import path from 'path';

const baseXmlPath = 'zetasports-v2/web/Colorify-Free-XML.xml';
let xml = fs.readFileSync(baseXmlPath, 'utf8');

console.log('Original XML lines:', xml.split('\n').length);

// 1. INJECT LIBRARIES & FONTS INTO <head>
const headInject = `
  <!-- Google Fonts: Oswald (Headings & Scores) + Inter (UI & Lineups) -->
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous"/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&amp;family=Oswald:wght@500;600;700&amp;display=swap" rel="stylesheet"/>

  <!-- Supabase Client -->
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

  <!-- Streaming Engines for Mode B (Stream Player) -->
  <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
  <link rel="stylesheet" href="https://cdn.plyr.io/3.7.8/plyr.css"/>
  <script src="https://cdn.plyr.io/3.7.8/plyr.polyfilled.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/shaka-player/4.7.11/shaka-player.compiled.js"></script>
`;

xml = xml.replace("<b:include name='theme-head'/>", `<b:include name='theme-head'/>\n${headInject}`);

// 2. INJECT CSS INTO <b:skin>
const customCss = `
/* ==========================================================================
   ZetaSports Unified Theme: Crisp White Modern System (Blogger 2 & Blogger 3)
   ========================================================================== */
:root {
  --zeta-bg: #F8FAFC;
  --zeta-card: #FFFFFF;
  --zeta-border: #E2E8F0;
  --zeta-text-main: #0F172A;
  --zeta-text-muted: #475569;
  --zeta-text-subtle: #94A3B8;
  --zeta-blue: #0062B2;
  --zeta-blue-hover: #004F8F;
  --zeta-green: #16A34A;
  --zeta-pitch-turf: #266E35;
  --zeta-pitch-turf-dark: #1E5B2B;
}

body {
  background-color: var(--zeta-bg) !important;
  color: var(--zeta-text-main) !important;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important;
}

#header-wrapper, .header-inner, .site-header {
  background: #FFFFFF !important;
  border-bottom: 1px solid var(--zeta-border) !important;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04) !important;
}

.item-post-inner, .blog-post, article.hentry {
  background: transparent !important;
  border: none !important;
}

/* ==========================================================================
   GOOGLE ADSENSE HIGH-RPM SLOTS (100% POLICY COMPLIANT / ZERO CLS)
   ========================================================================== */
.zeta-ad-slot-card {
  background: #FFFFFF;
  border: 1px dashed #CBD5E1;
  border-radius: 12px;
  padding: 12px 16px;
  margin: 24px 0;
  text-align: center;
  position: relative;
  box-shadow: 0 1px 3px rgba(0,0,0,0.03);
  overflow: hidden;
}

.zeta-ad-label {
  display: block;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--zeta-text-subtle);
  margin-bottom: 8px;
}

.zeta-ad-leaderboard {
  min-height: 90px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.zeta-ad-rectangle {
  min-height: 250px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.zeta-ad-banner {
  min-height: 280px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.zeta-ad-sticky-sidebar {
  position: -webkit-sticky;
  position: sticky;
  top: 24px;
  min-height: 250px;
}

/* ==========================================================================
   MATCH SCOREBOARD CARD (CRISP WHITE DESIGN)
   ========================================================================== */
.zeta-match-card {
  background: #FFFFFF;
  border: 1px solid var(--zeta-border);
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.02);
}

.zeta-match-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--zeta-border);
  padding-bottom: 14px;
  margin-bottom: 20px;
}

.zeta-league-badge {
  font-family: 'Oswald', sans-serif;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: var(--zeta-blue);
  text-transform: uppercase;
}

.zeta-live-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 700;
  background: #DCFCE7;
  color: #15803D;
  border: 1px solid #86EFAC;
}

.zeta-live-dot {
  width: 7px;
  height: 7px;
  border-radius: 9999px;
  background: #16A34A;
  animation: zetaPulse 1.5s infinite;
}

@keyframes zetaPulse {
  0% { transform: scale(0.95); opacity: 0.8; }
  50% { transform: scale(1.3); opacity: 1; }
  100% { transform: scale(0.95); opacity: 0.8; }
}

.zeta-teams-row {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 16px;
  text-align: center;
}

.zeta-team-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.zeta-team-crest {
  width: 64px;
  height: 64px;
  object-fit: contain;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.08));
}

.zeta-team-name {
  font-family: 'Oswald', sans-serif;
  font-size: 20px;
  font-weight: 700;
  color: var(--zeta-text-main);
}

.zeta-score-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.zeta-score-numbers {
  font-family: 'Oswald', sans-serif;
  font-size: 40px;
  font-weight: 700;
  letter-spacing: 2px;
  color: var(--zeta-text-main);
  background: #F1F5F9;
  padding: 4px 20px;
  border-radius: 12px;
  border: 1px solid var(--zeta-border);
}

.zeta-match-meta-footer {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--zeta-border);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 16px;
  font-size: 13px;
  color: var(--zeta-text-muted);
}

/* ==========================================================================
   FOTMOB EMERALD TACTICAL PITCH CANVAS (#266E35)
   ========================================================================== */
.zeta-pitch-card {
  background: #FFFFFF;
  border: 1px solid var(--zeta-border);
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.zeta-pitch-title-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.zeta-pitch-title {
  font-family: 'Oswald', sans-serif;
  font-size: 18px;
  font-weight: 700;
  color: var(--zeta-text-main);
  text-transform: uppercase;
}

.zeta-pitch-canvas {
  position: relative;
  width: 100%;
  height: 600px;
  background: linear-gradient(180deg, var(--zeta-pitch-turf) 0%, var(--zeta-pitch-turf-dark) 100%);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: inset 0 0 20px rgba(0,0,0,0.3);
  border: 2px solid #1E5B2B;
}

/* Tactical Field Markings */
.zeta-field-halfline {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 2px;
  background: rgba(255,255,255,0.7);
}

.zeta-field-centercircle {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 120px;
  height: 120px;
  border: 2px solid rgba(255,255,255,0.7);
  border-radius: 50%;
}

.zeta-field-centerdot {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 6px;
  height: 6px;
  background: #FFFFFF;
  border-radius: 50%;
}

.zeta-field-box-top {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 220px;
  height: 90px;
  border: 2px solid rgba(255,255,255,0.7);
  border-top: none;
}

.zeta-field-box-bottom {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 220px;
  height: 90px;
  border: 2px solid rgba(255,255,255,0.7);
  border-bottom: none;
}

/* Player Nodes on Pitch */
.zeta-player-node {
  position: absolute;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  transition: transform 0.2s ease;
  z-index: 10;
}

.zeta-player-node:hover {
  transform: translate(-50%, -50%) scale(1.1);
}

.zeta-avatar-wrap {
  position: relative;
  width: 36px;
  height: 36px;
}

.zeta-player-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2px solid #FFFFFF;
  background: #FFFFFF;
  object-fit: cover;
  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
}

.zeta-rating-badge {
  position: absolute;
  bottom: -4px;
  right: -8px;
  background: #16A34A;
  color: #FFFFFF;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 9999px;
  border: 1px solid #FFFFFF;
}

.zeta-motm-star {
  position: absolute;
  top: -6px;
  left: -6px;
  font-size: 12px;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5));
}

.zeta-player-name-tag {
  margin-top: 4px;
  background: #FFFFFF;
  color: #0F172A;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 4px;
  white-space: nowrap;
  box-shadow: 0 1px 4px rgba(0,0,0,0.25);
}

/* ==========================================================================
   SUBSTITUTES & COACHES STRIP
   ========================================================================== */
.zeta-bench-card {
  background: #FFFFFF;
  border: 1px solid var(--zeta-border);
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.zeta-subs-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 14px;
}

@media (max-width: 640px) {
  .zeta-subs-grid { grid-template-columns: 1fr; }
}

.zeta-sub-team-col {
  background: #F8FAFC;
  border: 1px solid var(--zeta-border);
  border-radius: 12px;
  padding: 14px;
}

.zeta-sub-col-title {
  font-family: 'Oswald', sans-serif;
  font-size: 14px;
  font-weight: 600;
  color: var(--zeta-text-main);
  border-bottom: 1px solid var(--zeta-border);
  padding-bottom: 8px;
  margin-bottom: 10px;
}

.zeta-sub-player-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px dashed #E2E8F0;
  font-size: 13px;
}

.zeta-sub-player-row:last-child {
  border-bottom: none;
}

.zeta-sub-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.zeta-sub-avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid var(--zeta-border);
}

.zeta-coaches-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--zeta-border);
}

.zeta-coach-box {
  flex: 1;
  min-width: 200px;
  display: flex;
  align-items: center;
  gap: 12px;
  background: #F8FAFC;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid var(--zeta-border);
}

.zeta-coach-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
}

/* ==========================================================================
   5-SECOND STREAM UNLOCKER GATEWAY CARD
   ========================================================================== */
.zeta-gateway-card {
  background: #FFFFFF;
  border: 2px solid #BFDBFE;
  border-radius: 16px;
  padding: 24px;
  text-align: center;
  margin-bottom: 24px;
  box-shadow: 0 4px 20px rgba(0, 98, 178, 0.08);
}

.zeta-gateway-title {
  font-family: 'Oswald', sans-serif;
  font-size: 20px;
  font-weight: 700;
  color: var(--zeta-blue);
  text-transform: uppercase;
  margin-bottom: 6px;
}

.zeta-gateway-desc {
  font-size: 14px;
  color: var(--zeta-text-muted);
  margin-bottom: 18px;
}

.zeta-unlock-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: var(--zeta-blue);
  color: #FFFFFF !important;
  font-family: 'Oswald', sans-serif;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.05em;
  padding: 14px 32px;
  border-radius: 12px;
  text-decoration: none !important;
  box-shadow: 0 4px 14px rgba(0, 98, 178, 0.3);
  transition: all 0.2s ease;
  cursor: pointer;
  border: none;
}

.zeta-unlock-btn:hover {
  background: var(--zeta-blue-hover);
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(0, 98, 178, 0.4);
}

.zeta-unlock-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* ==========================================================================
   MODE B: STREAM PLAYER CONTAINER (BLOGGER 3)
   ========================================================================== */
.zeta-stream-card {
  background: #FFFFFF;
  border: 1px solid var(--zeta-border);
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 24px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.06);
}

.zeta-stream-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.zeta-video-viewport {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #000000;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 8px 30px rgba(0,0,0,0.25);
}

.zeta-video-viewport video, .zeta-video-viewport iframe {
  width: 100%;
  height: 100%;
  border: none;
}

.zeta-server-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--zeta-border);
}

.zeta-server-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #F1F5F9;
  color: var(--zeta-text-main);
  border: 1px solid var(--zeta-border);
  padding: 8px 18px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.zeta-server-btn.active {
  background: var(--zeta-blue);
  color: #FFFFFF;
  border-color: var(--zeta-blue);
  box-shadow: 0 2px 8px rgba(0, 98, 178, 0.3);
}

.zeta-server-btn:hover:not(.active) {
  background: #E2E8F0;
}

/* ==========================================================================
   FLOATING STICKY SCOREBOARD PINNED ON SCROLL
   ========================================================================== */
.zeta-sticky-scoreboard {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--zeta-border);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  padding: 8px 20px;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transform: translateY(-100%);
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.zeta-sticky-scoreboard.visible {
  transform: translateY(0);
}

.zeta-sticky-matchup {
  display: flex;
  align-items: center;
  gap: 12px;
}

.zeta-sticky-crest {
  width: 26px;
  height: 26px;
  object-fit: contain;
}

.zeta-sticky-team-name {
  font-family: 'Oswald', sans-serif;
  font-size: 14px;
  font-weight: 700;
  color: var(--zeta-text-main);
}

.zeta-sticky-score {
  font-family: 'Oswald', sans-serif;
  font-size: 18px;
  font-weight: 700;
  background: #F1F5F9;
  padding: 2px 10px;
  border-radius: 6px;
  border: 1px solid var(--zeta-border);
  letter-spacing: 1px;
  color: var(--zeta-text-main);
}

@media (max-width: 640px) {
  .zeta-sticky-team-name {
    display: none;
  }
  .zeta-sticky-scoreboard {
    padding: 6px 12px;
  }
}

/* ==========================================================================
   ATTACK MOMENTUM PRESSURE GAUGE (DUAL-COLOR + TIMELINE)
   ========================================================================== */
.zeta-momentum-card {
  background: #FFFFFF;
  border: 1px solid var(--zeta-border);
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.zeta-momentum-bar-wrap {
  width: 100%;
  height: 14px;
  border-radius: 9999px;
  background: #E2E8F0;
  overflow: hidden;
  display: flex;
  margin: 12px 0 8px 0;
}

.zeta-momentum-bar-home {
  height: 100%;
  background: linear-gradient(90deg, #0062B2, #38BDF8);
  transition: width 0.6s ease;
}

.zeta-momentum-bar-away {
  height: 100%;
  background: linear-gradient(90deg, #F87171, #DC2626);
  transition: width 0.6s ease;
}

.zeta-momentum-legend {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 12px;
}

.zeta-momentum-timeline-wrap {
  position: relative;
  margin-top: 10px;
}

.zeta-momentum-timeline {
  display: flex;
  align-items: center;
  height: 54px;
  gap: 2px;
  padding: 4px;
  background: #F8FAFC;
  border-radius: 8px;
  border: 1px solid var(--zeta-border);
  position: relative;
}

.zeta-momentum-col {
  flex: 1;
  position: relative;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.zeta-momentum-col-bar {
  width: 100%;
  border-radius: 2px;
  position: absolute;
  left: 0;
  right: 0;
  transition: height 0.3s ease;
}

.zeta-momentum-col-bar.home {
  bottom: 50%;
  background: #0062B2;
}

.zeta-momentum-col-bar.away {
  top: 50%;
  background: #DC2626;
}

.zeta-momentum-axis {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 1px;
  background: #CBD5E1;
  z-index: 1;
}

.zeta-momentum-ticks {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: #94A3B8;
  font-weight: 600;
  margin-top: 4px;
  padding: 0 4px;
}

/* ==========================================================================
   PLAYER DETAIL MODAL (ON PITCH CLICK)
   ========================================================================== */
.zeta-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.65);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
}

.zeta-modal-backdrop.open {
  opacity: 1;
  pointer-events: auto;
}

.zeta-modal-content {
  background: #FFFFFF;
  border-radius: 16px;
  padding: 24px;
  max-width: 420px;
  width: 100%;
  box-shadow: 0 20px 40px rgba(0,0,0,0.25);
  position: relative;
  transform: translateY(14px);
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.zeta-modal-backdrop.open .zeta-modal-content {
  transform: translateY(0);
}

.zeta-modal-close {
  position: absolute;
  top: 14px;
  right: 14px;
  background: #F1F5F9;
  border: none;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  font-size: 20px;
  line-height: 28px;
  text-align: center;
  color: #64748B;
  cursor: pointer;
  transition: all 0.2s ease;
}

.zeta-modal-close:hover {
  background: #E2E8F0;
  color: #0F172A;
}

/* ==========================================================================
   PIP STREAM PLAYER (NATIVE & SCROLL-DOCKED FLOATING MINI PLAYER)
   ========================================================================== */
.zeta-pip-floating {
  position: fixed !important;
  bottom: 24px !important;
  right: 24px !important;
  width: 340px !important;
  max-width: calc(100vw - 32px) !important;
  aspect-ratio: 16 / 9 !important;
  z-index: 9995 !important;
  border-radius: 12px !important;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.45) !important;
  border: 2px solid var(--zeta-blue) !important;
  animation: zetaPipDock 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
}

@keyframes zetaPipDock {
  from { opacity: 0; transform: translateY(24px) scale(0.92); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.zeta-pip-close-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.75);
  color: #FFFFFF;
  border: 1px solid rgba(255, 255, 255, 0.4);
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 30;
  transition: background 0.2s;
}

.zeta-pip-close-btn:hover {
  background: rgba(0, 0, 0, 0.95);
}

.zeta-pip-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #F1F5F9;
  color: var(--zeta-text-main);
  border: 1px solid var(--zeta-border);
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.zeta-pip-toggle-btn:hover {
  background: #E2E8F0;
}
`;

xml = xml.replace(']]></b:skin>', `${customCss}\n]]></b:skin>`);

// 3. INJECT SEARCH DESCRIPTION META & APP MOUNT INSIDE itemPost
const searchDescSnippet = `
      <!-- ZetaSports Meta Extractor -->
      <b:if cond='data:post.searchDescription'>
        <div id='zetaBloggerMeta' expr:data-description='data:post.searchDescription' style='display:none;'/>
      </b:if>
`;

xml = xml.replace("<b:includable id='itemPost' var='post'>\n      <!-- Item Post Content -->", `<b:includable id='itemPost' var='post'>\n${searchDescSnippet}\n      <!-- Item Post Content -->`);

// Inject mount target inside entry-content-wrap
xml = xml.replace("<b:include data='post' name='postBody'/>", `<div id='zetaAppMount'></div>\n          <b:include data='post' name='postBody'/>`);

// 4. INJECT DUAL-MODE CLIENT SCRIPT BEFORE </body>
const clientEngineScript = `
<script type='text/javascript'>
//<![CDATA[
(function() {
  const SUPABASE_URL = 'https://udlncusvhmydivtjkjcy.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkbG5jdXN2aG15ZGl2dGpramN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4MTE2MDgsImV4cCI6MjEwOTM4NzYwOH0.gsnxlDww-fUC4HG7R7VasXSaQvqkSsDhhmf16KUCLZY';
  const sbClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

  // Extract Match ID
  function extractMatchId() {
    // 1. From Search Description meta hook
    const metaEl = document.getElementById('zetaBloggerMeta');
    if (metaEl && metaEl.getAttribute('data-description')) {
      const match = metaEl.getAttribute('data-description').match(/(?:zeta[:#\\-_]|match[:#\\-_])([a-zA-Z0-9_\\-]+)/i);
      if (match && match[1]) return match[1];
    }

    // 2. From page meta description
    const pageMeta = document.querySelector('meta[name="description"]');
    if (pageMeta && pageMeta.content) {
      const match = pageMeta.content.match(/(?:zeta[:#\\-_]|match[:#\\-_])([a-zA-Z0-9_\\-]+)/i);
      if (match && match[1]) return match[1];
    }

    // 3. From URL parameter
    const params = new URLSearchParams(window.location.search);
    if (params.get('match_id')) return params.get('match_id');
    if (params.get('id')) return params.get('id');

    // 4. From URL hash
    if (window.location.hash && window.location.hash.startsWith('#match_')) {
      return window.location.hash.replace('#match_', '');
    }

    return null;
  }

  // Detect Mode (Stream Mode vs Details Mode)
  const isStreamMode = window.location.search.includes('stream=1') ||
                       (window.location.hash && window.location.hash.includes('stream')) ||
                       (window.location.hostname.includes('live'));

  const mountEl = document.getElementById('zetaAppMount');
  if (!mountEl) return;

  const matchId = extractMatchId();
  if (!matchId) {
    console.log('[ZetaSports Unified Theme]: No match ID detected in post. Standard view active.');
    return;
  }

  console.log('[ZetaSports Unified Theme]: Active Match ID:', matchId, '| Stream Mode:', isStreamMode);

  // --- AD SLOTS MARKUP (100% GOOGLE ADSENSE COMPLIANT / ZERO CLS) ---
  function getAdSlot1() {
    return \`
    <div class="zeta-ad-slot-card zeta-ad-leaderboard" style="min-height: 90px;">
      <span class="zeta-ad-label">ADVERTISEMENT</span>
      <!-- Google AdSense Slot 1: Responsive Leaderboard (728x90) -->
      <ins class="adsbygoogle"
           style="display:block;min-height:90px;"
           data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
           data-ad-slot="1111111111"
           data-ad-format="horizontal"
           data-full-width-responsive="true"></ins>
      <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
    </div>\`;
  }

  function getAdSlot2() {
    return \`
    <div class="zeta-ad-slot-card zeta-ad-rectangle" style="min-height: 250px;">
      <span class="zeta-ad-label">ADVERTISEMENT</span>
      <!-- Google AdSense Slot 2: In-Content (336x280 / Responsive) -->
      <ins class="adsbygoogle"
           style="display:block;min-height:250px;"
           data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
           data-ad-slot="2222222222"
           data-ad-format="rectangle"
           data-full-width-responsive="true"></ins>
      <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
    </div>\`;
  }

  function getAdSlot3() {
    return \`
    <div class="zeta-ad-slot-card zeta-ad-banner" style="min-height: 280px;">
      <span class="zeta-ad-label">ADVERTISEMENT</span>
      <!-- Google AdSense Slot 3: Pre-Gateway Banner -->
      <ins class="adsbygoogle"
           style="display:block;min-height:280px;"
           data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
           data-ad-slot="3333333333"
           data-ad-format="auto"
           data-full-width-responsive="true"></ins>
      <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
    </div>\`;
  }

  // --- FLOATING STICKY SCOREBOARD ---
  function initStickyScoreboard(m) {
    let bar = document.getElementById('zetaStickyScoreboard');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'zetaStickyScoreboard';
      bar.className = 'zeta-sticky-scoreboard';
      document.body.prepend(bar);
    }

    const homeTeam = m.home_team || 'Home';
    const awayTeam = m.away_team || 'Away';
    const homeScore = m.home_score !== null && m.home_score !== undefined ? m.home_score : '-';
    const awayScore = m.away_score !== null && m.away_score !== undefined ? m.away_score : '-';
    const status = m.status || 'Scheduled';
    const minute = m.minute ? m.minute + "'" : status;
    const isLive = ['1H', '2H', 'HT', 'LIVE', 'IN_PLAY'].includes((status || '').toUpperCase());

    bar.innerHTML = \`
      <div class="zeta-sticky-matchup">
        <img class="zeta-sticky-crest" src="\${m.home_logo || 'https://via.placeholder.com/26'}" alt="\${homeTeam}"/>
        <span class="zeta-sticky-team-name">\${homeTeam}</span>
        <span class="zeta-sticky-score" id="zetaStickyScoreText">\${homeScore} : \${awayScore}</span>
        <span class="zeta-sticky-team-name">\${awayTeam}</span>
        <img class="zeta-sticky-crest" src="\${m.away_logo || 'https://via.placeholder.com/26'}" alt="\${awayTeam}"/>
      </div>
      <div style="display: flex; align-items: center; gap: 10px;">
        <span class="zeta-live-pill" id="zetaStickyLivePill"><span class="zeta-live-dot"></span> \${isLive ? 'LIVE ' + minute : status}</span>
        <a href="?stream=1&amp;match_id=\${encodeURIComponent(m.id)}" class="zeta-unlock-btn" style="padding: 6px 14px; font-size: 12px; border-radius: 8px;">Watch Live &rarr;</a>
      </div>
    \`;

    const mainCard = document.querySelector('.zeta-match-card');
    if (mainCard && window.IntersectionObserver) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if (!e.isIntersecting && e.boundingClientRect.top < 0) {
            bar.classList.add('visible');
          } else {
            bar.classList.remove('visible');
          }
        });
      }, { threshold: 0.05 });
      observer.observe(mainCard);
    }
  }

  // --- ATTACK MOMENTUM PRESSURE GAUGE ---
  function parseMomentumData(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray(parsed.data)) return parsed.data;
      if (parsed && parsed.main && Array.isArray(parsed.main.data)) return parsed.main.data;
      return [];
    } catch (_) {
      return [];
    }
  }

  function calculateMomentumPcts(momentumData) {
    let homePositive = 0;
    let awayPositive = 0;
    if (Array.isArray(momentumData) && momentumData.length > 0) {
      momentumData.forEach(d => {
        const val = typeof d.value === 'number' ? d.value : (typeof d.val === 'number' ? d.val : 0);
        if (val > 0) homePositive += val;
        if (val < 0) awayPositive += Math.abs(val);
      });
    }
    const total = homePositive + awayPositive;
    if (total > 0) {
      const homePct = Math.round((homePositive / total) * 100);
      return { homePct, awayPct: 100 - homePct };
    }
    return { homePct: 50, awayPct: 50 };
  }

  function renderMomentumTimelineHtml(momentumData) {
    let timelineColsHtml = '';
    if (Array.isArray(momentumData) && momentumData.length > 0) {
      const bucketSize = Math.max(1, Math.floor(momentumData.length / 30));
      for (let i = 0; i < 30; i++) {
        const slice = momentumData.slice(i * bucketSize, (i + 1) * bucketSize);
        let avg = 0;
        if (slice.length > 0) {
          avg = slice.reduce((acc, cur) => acc + (cur.value !== undefined ? cur.value : (cur.val || 0)), 0) / slice.length;
        }
        const barHeight = Math.min(50, Math.round(Math.abs(avg) / 2));
        if (avg >= 0) {
          timelineColsHtml += \`<div class="zeta-momentum-col"><div class="zeta-momentum-col-bar home" style="height: \${Math.max(4, barHeight)}%;"></div></div>\`;
        } else {
          timelineColsHtml += \`<div class="zeta-momentum-col"><div class="zeta-momentum-col-bar away" style="height: \${Math.max(4, barHeight)}%;"></div></div>\`;
        }
      }
    } else {
      for (let i = 0; i < 30; i++) {
        const h = 4 + Math.round(Math.sin(i * 0.4) * 12 + 10);
        if (i % 2 === 0) {
          timelineColsHtml += \`<div class="zeta-momentum-col"><div class="zeta-momentum-col-bar home" style="height: \${h}%;"></div></div>\`;
        } else {
          timelineColsHtml += \`<div class="zeta-momentum-col"><div class="zeta-momentum-col-bar away" style="height: \${h}%;"></div></div>\`;
        }
      }
    }

    return \`
      <div class="zeta-momentum-timeline-wrap">
        <div class="zeta-momentum-timeline">
          <div class="zeta-momentum-axis"></div>
          \${timelineColsHtml}
        </div>
        <div class="zeta-momentum-ticks">
          <span>0'</span><span>15'</span><span>30'</span><span>HT</span><span>60'</span><span>75'</span><span>90'</span>
        </div>
      </div>
    \`;
  }

  function renderMomentumGauge(m) {
    const rawData = m.match_stats?.momentum || m.momentum;
    const momentumData = parseMomentumData(rawData);
    const { homePct, awayPct } = calculateMomentumPcts(momentumData);
    const homeTeam = m.home_team || 'Home';
    const awayTeam = m.away_team || 'Away';

    return \`
      <div class="zeta-momentum-card" id="zetaMomentumCard">
        <div class="zeta-pitch-title-bar">
          <h3 class="zeta-pitch-title">Attack Momentum &amp; Pressure</h3>
          <span style="font-size: 12px; font-weight: 700; color: #64748B;">Live Telemetry</span>
        </div>
        <div class="zeta-momentum-bar-wrap">
          <div class="zeta-momentum-bar-home" id="zetaMomentumBarHome" style="width: \${homePct}%;"></div>
          <div class="zeta-momentum-bar-away" id="zetaMomentumBarAway" style="width: \${awayPct}%;"></div>
        </div>
        <div class="zeta-momentum-legend">
          <span style="color: #0062B2;" id="zetaMomentumLabelHome">\${homeTeam} (\${homePct}%)</span>
          <span style="color: #DC2626;" id="zetaMomentumLabelAway">\${awayTeam} (\${awayPct}%)</span>
        </div>
        <div id="zetaMomentumTimelineContainer">
          \${renderMomentumTimelineHtml(momentumData)}
        </div>
      </div>
    \`;
  }

  function updateMomentumUi(raw, homeTeam, awayTeam) {
    const momentumData = parseMomentumData(raw);
    const { homePct, awayPct } = calculateMomentumPcts(momentumData);
    const barHome = document.getElementById('zetaMomentumBarHome');
    const barAway = document.getElementById('zetaMomentumBarAway');
    const labelHome = document.getElementById('zetaMomentumLabelHome');
    const labelAway = document.getElementById('zetaMomentumLabelAway');
    const timelineContainer = document.getElementById('zetaMomentumTimelineContainer');

    if (barHome) barHome.style.width = homePct + '%';
    if (barAway) barAway.style.width = awayPct + '%';
    if (labelHome) labelHome.innerText = \`\${homeTeam || 'Home'} (\${homePct}%)\`;
    if (labelAway) labelAway.innerText = \`\${awayTeam || 'Away'} (\${awayPct}%)\`;
    if (timelineContainer) timelineContainer.innerHTML = renderMomentumTimelineHtml(momentumData);
  }

  // --- PLAYER DETAIL MODAL (ON PITCH CLICK) ---
  function openPlayerDetailModal(p, teamName) {
    let modal = document.getElementById('zetaPlayerModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'zetaPlayerModal';
      modal.className = 'zeta-modal-backdrop';
      document.body.appendChild(modal);

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('open')) {
          modal.classList.remove('open');
        }
      });
    }

    const ratingVal = parseFloat(p.rating || 6.5);
    const ratingBg = ratingVal >= 7.0 ? '#16A34A' : (ratingVal >= 6.0 ? '#D97706' : '#DC2626');
    const avatar = p.photo || 'https://images.fotmob.com/image_resources/playerimages/placeholder.png';
    const numberText = p.number || p.shirtNumber ? '#' + (p.number || p.shirtNumber) : '';
    const posText = p.pos || p.position || 'Player';
    const captainBadge = p.captain ? ' <span style="background: #F59E0B; color: #000; font-size: 10px; font-weight: 800; padding: 1px 5px; border-radius: 4px; margin-left: 4px;">C</span>' : '';

    modal.innerHTML = \`
      <div class="zeta-modal-content">
        <button type="button" class="zeta-modal-close" aria-label="Close modal">&times;</button>
        <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 16px;">
          <img src="\${avatar}" alt="\${p.name || 'Player'}" style="width: 64px; height: 64px; border-radius: 50%; object-fit: cover; border: 2px solid #E2E8F0; background: #F8FAFC;" />
          <div>
            <h4 style="margin: 0; font-family: 'Oswald', sans-serif; font-size: 19px; color: #0F172A; display: flex; align-items: center;">\${p.name || 'Unknown'}\${captainBadge}</h4>
            <span style="font-size: 12px; color: #64748B; font-weight: 600;">\${teamName || 'Squad'} &bull; \${numberText} \${posText}</span>
          </div>
        </div>
        <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 14px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div>
            <span style="font-size: 13px; font-weight: 600; color: #475569; display: block;">FotMob Performance Rating</span>
            <span style="font-size: 11px; color: #94A3B8;">Live match telemetry score</span>
          </div>
          <span style="font-family: 'Oswald', sans-serif; font-size: 17px; font-weight: 700; background: \${ratingBg}; color: #FFFFFF; padding: 3px 12px; border-radius: 9999px;">\${p.rating || '6.5'}</span>
        </div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; text-align: center; font-size: 12px;">
          <div style="background: #F1F5F9; padding: 8px; border-radius: 8px;">
            <span style="color: #64748B; display: block; font-size: 10px; font-weight: 600; text-transform: uppercase;">Goals</span>
            <span style="font-family: 'Oswald', sans-serif; font-size: 16px; font-weight: 700; color: #0F172A;">\${p.goals || 0}</span>
          </div>
          <div style="background: #F1F5F9; padding: 8px; border-radius: 8px;">
            <span style="color: #64748B; display: block; font-size: 10px; font-weight: 600; text-transform: uppercase;">Assists</span>
            <span style="font-family: 'Oswald', sans-serif; font-size: 16px; font-weight: 700; color: #0F172A;">\${p.assists || 0}</span>
          </div>
          <div style="background: #F1F5F9; padding: 8px; border-radius: 8px;">
            <span style="color: #64748B; display: block; font-size: 10px; font-weight: 600; text-transform: uppercase;">Cards</span>
            <span style="font-family: 'Oswald', sans-serif; font-size: 16px; font-weight: 700; color: #0F172A;">\${p.yellowCards ? '🟨 ' + p.yellowCards : (p.redCards ? '🟥 ' + p.redCards : 'None')}</span>
          </div>
        </div>
      </div>
    \`;

    modal.classList.add('open');
    modal.querySelector('.zeta-modal-close').onclick = () => modal.classList.remove('open');
    modal.onclick = (e) => {
      if (e.target === modal) modal.classList.remove('open');
    };
  }

  // --- MODE B: STREAM PLAYER RENDERER (WITH PIP SUPPORT) ---
  async function renderStreamMode(mId) {
    mountEl.innerHTML = \`
      \${getAdSlot1()}
      <div class="zeta-stream-card" id="zetaStreamCard">
        <div class="zeta-stream-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <h2 class="zeta-pitch-title" id="zetaStreamTitle" style="margin: 0;">Live Broadcast Stream</h2>
            <span class="zeta-live-pill"><span class="zeta-live-dot"></span> 1080p 60fps Active</span>
          </div>
          <button type="button" id="zetaPipToggleBtn" class="zeta-pip-toggle-btn" title="Toggle Picture-in-Picture">
            <span>📺 Pop-out Mini Player</span>
          </button>
        </div>
        <div class="zeta-video-viewport" id="zetaVideoContainer">
          <video id="zetaVideoPlayer" controls playsinline></video>
          <button type="button" id="zetaPipCloseBtn" class="zeta-pip-close-btn" style="display: none;" title="Dock back into article">&times;</button>
        </div>
        <div class="zeta-server-bar" id="zetaServerBar">
          <button class="zeta-server-btn active" data-server="1">Server 1 (HD 1080p)</button>
          <button class="zeta-server-btn" data-server="2">Server 2 (Backup 720p)</button>
          <button class="zeta-server-btn" data-server="3">Server 3 (Embed Web)</button>
        </div>
      </div>
      \${getAdSlot2()}
      <div style="text-align: center; margin: 20px 0;">
        <a href="?match_id=\${encodeURIComponent(mId)}" style="color: var(--zeta-blue); font-weight: 600; text-decoration: none;">&larr; View Full Match Details &amp; Lineups</a>
      </div>
    \`;

    // Fetch stream URLs
    let streamData = null;
    let initialStreamUrl = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
    if (sbClient) {
      try {
        const { data: streams } = await sbClient.from('zeta_streams').select('*').eq('match_id', mId);
        if (streams && streams.length > 0) {
          streamData = streams[0];
          initialStreamUrl = streamData.server1_url || streamData.stream_url || initialStreamUrl;
        }
      } catch (e) {
        console.error('Streams load error:', e);
      }
    }

    setupPlayer(initialStreamUrl, streamData);
    initPipControllers();
  }

  function setupPlayer(url, streamData) {
    const video = document.getElementById('zetaVideoPlayer');
    if (!video) return;

    if (Hls.isSupported() && url.includes('.m3u8')) {
      const hls = new Hls();
      hls.loadSource(url);
      hls.attachMedia(video);
    } else {
      video.src = url;
    }

    if (window.Plyr) {
      new Plyr(video, {
        controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'captions', 'settings', 'pip', 'airplay', 'fullscreen']
      });
    }

    // Wire server buttons
    document.querySelectorAll('.zeta-server-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.zeta-server-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        const sType = this.getAttribute('data-server');
        let targetUrl = url;
        if (streamData) {
          if (sType === '1') targetUrl = streamData.server1_url || streamData.stream_url;
          if (sType === '2') targetUrl = streamData.server2_url || streamData.stream_url;
          if (sType === '3') targetUrl = streamData.server3_url || streamData.stream_url;
        }
        if (targetUrl) video.src = targetUrl;
      });
    });
  }

  // Picture-in-Picture & Floating Scroll-Docking Controller
  function initPipControllers() {
    const video = document.getElementById('zetaVideoPlayer');
    const container = document.getElementById('zetaVideoContainer');
    const pipBtn = document.getElementById('zetaPipToggleBtn');
    const closeBtn = document.getElementById('zetaPipCloseBtn');
    if (!video || !container) return;

    let pipDismissed = false;

    // 1. Native PiP or Floating Toggle Button
    if (pipBtn) {
      pipBtn.addEventListener('click', async () => {
        if (document.pictureInPictureElement) {
          try { await document.exitPictureInPicture(); } catch (_) {}
        } else if (video.requestPictureInPicture) {
          try {
            await video.requestPictureInPicture();
            return;
          } catch (e) {
            console.warn('[PiP]: Native PiP failed, falling back to scroll-dock floating player:', e);
          }
        }
        // Fallback or toggle floating mini-player
        if (container.classList.contains('zeta-pip-floating')) {
          container.classList.remove('zeta-pip-floating');
          if (closeBtn) closeBtn.style.display = 'none';
        } else {
          container.classList.add('zeta-pip-floating');
          if (closeBtn) closeBtn.style.display = 'flex';
          pipDismissed = false;
        }
      });
    }

    // 2. Floating Close / Dock Button
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        container.classList.remove('zeta-pip-floating');
        closeBtn.style.display = 'none';
        pipDismissed = true;
      });
    }

    // 3. In-page Scroll-Docking Mini-Player Observer
    if (window.IntersectionObserver) {
      const streamCard = document.getElementById('zetaStreamCard');
      if (streamCard) {
        const observer = new IntersectionObserver((entries) => {
          entries.forEach(e => {
            if (!e.isIntersecting && e.boundingClientRect.bottom < 60) {
              if (!pipDismissed && !video.paused) {
                container.classList.add('zeta-pip-floating');
                if (closeBtn) closeBtn.style.display = 'flex';
              }
            } else {
              container.classList.remove('zeta-pip-floating');
              if (closeBtn) closeBtn.style.display = 'none';
              pipDismissed = false;
            }
          });
        }, { threshold: 0.1 });
        observer.observe(streamCard);
      }
    }
  }

  // --- MODE A: MATCH DETAILS & FOTMOB PITCH RENDERER ---
  async function renderDetailsMode(mId) {
    if (!sbClient) return;

    try {
      const { data: matches } = await sbClient.from('zeta_matches').select('*').eq('id', mId);
      if (!matches || matches.length === 0) return;

      const m = matches[0];
      const homeTeam = m.home_team || 'Home';
      const awayTeam = m.away_team || 'Away';
      const homeScore = m.home_score !== null && m.home_score !== undefined ? m.home_score : '-';
      const awayScore = m.away_score !== null && m.away_score !== undefined ? m.away_score : '-';
      const status = m.status || 'Scheduled';
      const minute = m.minute ? \`\${m.minute}'\` : status;
      const isLive = ['1H', '2H', 'HT', 'LIVE', 'IN_PLAY'].includes((status || '').toUpperCase());

      mountEl.innerHTML = \`
        \${getAdSlot1()}

        <!-- Match Scoreboard Card -->
        <div class="zeta-match-card">
          <div class="zeta-match-header">
            <span class="zeta-league-badge">\${m.league || 'Match Center'}</span>
            \${isLive ? '<span class="zeta-live-pill"><span class="zeta-live-dot"></span> LIVE ' + minute + '</span>' : '<span style="font-size: 13px; font-weight: 600; color: #64748B;">' + status + '</span>'}
          </div>
          <div class="zeta-teams-row">
            <div class="zeta-team-box">
              <img class="zeta-team-crest" src="\${m.home_logo || 'https://via.placeholder.com/64'}" alt="\${homeTeam}"/>
              <span class="zeta-team-name">\${homeTeam}</span>
            </div>
            <div class="zeta-score-box">
              <div class="zeta-score-numbers">\${homeScore} : \${awayScore}</div>
              <span style="font-size: 12px; color: #64748B; font-weight: 500;">Kickoff \${m.time || ''}</span>
            </div>
            <div class="zeta-team-box">
              <img class="zeta-team-crest" src="\${m.away_logo || 'https://via.placeholder.com/64'}" alt="\${awayTeam}"/>
              <span class="zeta-team-name">\${awayTeam}</span>
            </div>
          </div>
          <div class="zeta-match-meta-footer">
            <span>\uD83D\uDCCD \${m.venue || 'Official Stadium'}</span>
            <span>\uD83D\uDC6E Referee: \${m.referee || 'Assigned'}</span>
          </div>
        </div>

        <!-- Attack Momentum Pressure Gauge -->
        \${renderMomentumGauge(m)}

        <!-- FotMob Emerald Pitch Card -->
        <div class="zeta-pitch-card">
          <div class="zeta-pitch-title-bar">
            <h3 class="zeta-pitch-title">Tactical Formation &amp; Lineups</h3>
            <span style="font-size: 13px; font-weight: 600; color: #15803D;">\${m.home_formation || '4-3-3'} vs \${m.away_formation || '4-2-3-1'}</span>
          </div>
          <div class="zeta-pitch-canvas" id="zetaPitchCanvas">
            <div class="zeta-field-halfline"></div>
            <div class="zeta-field-centercircle"></div>
            <div class="zeta-field-centerdot"></div>
            <div class="zeta-field-box-top"></div>
            <div class="zeta-field-box-bottom"></div>
            <div id="zetaPitchPlayers"></div>
          </div>
        </div>

        \${getAdSlot2()}

        <!-- Bench & Substitutes -->
        <div class="zeta-bench-card">
          <h3 class="zeta-pitch-title">Substitutes &amp; Technical Staff</h3>
          <div class="zeta-subs-grid">
            <div class="zeta-sub-team-col">
              <div class="zeta-sub-col-title">\${homeTeam} Bench</div>
              <div id="zetaHomeSubsList">Loading substitutes...</div>
            </div>
            <div class="zeta-sub-team-col">
              <div class="zeta-sub-col-title">\${awayTeam} Bench</div>
              <div id="zetaAwaySubsList">Loading substitutes...</div>
            </div>
          </div>
          <div class="zeta-coaches-strip">
            <div class="zeta-coach-box">
              <img class="zeta-coach-avatar" src="https://images.fotmob.com/image_resources/playerimages/placeholder.png" alt="Coach"/>
              <div>
                <span style="font-size: 11px; color: #64748B; font-weight: 600; display: block;">\${homeTeam} Manager</span>
                <span style="font-size: 14px; font-weight: 700; color: #0F172A;">\${m.home_coach || 'Head Coach'}</span>
              </div>
            </div>
            <div class="zeta-coach-box">
              <img class="zeta-coach-avatar" src="https://images.fotmob.com/image_resources/playerimages/placeholder.png" alt="Coach"/>
              <div>
                <span style="font-size: 11px; color: #64748B; font-weight: 600; display: block;">\${awayTeam} Manager</span>
                <span style="font-size: 14px; font-weight: 700; color: #0F172A;">\${m.away_coach || 'Head Coach'}</span>
              </div>
            </div>
          </div>
        </div>

        \${getAdSlot3()}

        <!-- 5-Second Stream Unlocker Gateway -->
        <div class="zeta-gateway-card">
          <div class="zeta-gateway-title">Live HD Broadcast Gateway</div>
          <p class="zeta-gateway-desc">Access high-definition official streams with multi-server audio options.</p>
          <button id="zetaStreamUnlockBtn" class="zeta-unlock-btn" disabled>
            <span>Unlocking Stream (<span id="zetaCountSec">5</span>s)...</span>
          </button>
        </div>
      \`;

      // Initialize Floating Sticky Scoreboard
      initStickyScoreboard(m);

      // Render Lineup nodes on pitch with click listener for player detail modal
      renderPitchNodes(m);

      // Initialize Realtime Supabase Subscription
      setupRealtimeSubscription(mId, m);

      // Start 5-second countdown
      let count = 5;
      const countEl = document.getElementById('zetaCountSec');
      const btnEl = document.getElementById('zetaStreamUnlockBtn');
      const timer = setInterval(() => {
        count--;
        if (countEl) countEl.innerText = count;
        if (count <= 0) {
          clearInterval(timer);
          if (btnEl) {
            btnEl.removeAttribute('disabled');
            btnEl.innerHTML = '<span>Watch Live Broadcast &rarr;</span>';
            btnEl.addEventListener('click', () => {
              window.location.href = '?stream=1&amp;match_id=' + encodeURIComponent(mId);
            });
          }
        }
      }, 1000);

    } catch (err) {
      console.error('[Render Match Details Error]:', err);
    }
  }

  // --- REAL-TIME SUPABASE SUBSCRIPTION ---
  function setupRealtimeSubscription(mId, initialMatch) {
    if (!sbClient || !mId) return;

    try {
      const channel = sbClient.channel('zeta-realtime-' + mId);
      channel.on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'zeta_matches',
        filter: 'id=eq.' + mId
      }, payload => {
        const up = payload.new;
        if (!up) return;
        console.log('[ZetaRealtime]: Match update received:', up);

        // 1. Update Scoreboard & Sticky Bar
        const homeScore = up.home_score !== null && up.home_score !== undefined ? up.home_score : '-';
        const awayScore = up.away_score !== null && up.away_score !== undefined ? up.away_score : '-';
        const scoreText = \`\${homeScore} : \${awayScore}\`;

        const mainScore = document.querySelector('.zeta-score-numbers');
        if (mainScore) mainScore.innerText = scoreText;

        const stickyScore = document.getElementById('zetaStickyScoreText');
        if (stickyScore) stickyScore.innerText = scoreText;

        // 2. Update Live Minute / Status
        const status = up.status || 'Scheduled';
        const minute = up.minute ? \`\${up.minute}'\` : status;
        const isLive = ['1H', '2H', 'HT', 'LIVE', 'IN_PLAY'].includes((status || '').toUpperCase());

        const livePill = document.querySelector('.zeta-match-header .zeta-live-pill');
        if (livePill) {
          livePill.innerHTML = \`<span class="zeta-live-dot"></span> LIVE \${minute}\`;
        }
        const stickyLivePill = document.getElementById('zetaStickyLivePill');
        if (stickyLivePill) {
          stickyLivePill.innerHTML = \`<span class="zeta-live-dot"></span> \${isLive ? 'LIVE ' + minute : status}\`;
        }

        // 3. Update Momentum if available
        const momentumRaw = up.match_stats?.momentum || up.momentum;
        if (momentumRaw) {
          updateMomentumUi(momentumRaw, up.home_team, up.away_team);
        }

        // 4. Update Lineups if changed
        if (up.home_lineup || up.away_lineup) {
          renderPitchNodes(up);
        }
      });

      channel.subscribe((status, err) => {
        if (err) {
          console.warn('[ZetaRealtime]: Subscription error:', err);
        } else {
          console.log('[ZetaRealtime]: Subscribed to channel zeta-realtime-' + mId, status);
        }
      });
    } catch (realtimeErr) {
      console.warn('[ZetaRealtime]: Realtime initialization warning:', realtimeErr);
    }
  }

  // --- PITCH NODES & PLAYER MODAL INTERACTION ---
  function renderPitchNodes(m) {
    const container = document.getElementById('zetaPitchPlayers');
    if (!container) return;

    const defaultHomeCoords = [
      { x: 50, y: 92, name: 'GK', rating: '7.1', pos: 'GK' },
      { x: 18, y: 78, name: 'LB', rating: '6.9', pos: 'DEF' },
      { x: 38, y: 80, name: 'CB', rating: '7.4', pos: 'DEF' },
      { x: 62, y: 80, name: 'CB', rating: '7.2', pos: 'DEF' },
      { x: 82, y: 78, name: 'RB', rating: '7.0', pos: 'DEF' },
      { x: 30, y: 65, name: 'CM', rating: '7.8', pos: 'MID' },
      { x: 50, y: 67, name: 'DM', rating: '7.5', pos: 'MID' },
      { x: 70, y: 65, name: 'CM', rating: '8.2', motm: true, pos: 'MID' },
      { x: 20, y: 55, name: 'LW', rating: '7.3', pos: 'FWD' },
      { x: 50, y: 53, name: 'ST', rating: '7.9', pos: 'FWD' },
      { x: 80, y: 55, name: 'RW', rating: '7.6', pos: 'FWD' }
    ];

    const defaultAwayCoords = [
      { x: 50, y: 8, name: 'GK', rating: '6.8', pos: 'GK' },
      { x: 18, y: 22, name: 'RB', rating: '6.7', pos: 'DEF' },
      { x: 38, y: 20, name: 'CB', rating: '7.0', pos: 'DEF' },
      { x: 62, y: 20, name: 'CB', rating: '6.9', pos: 'DEF' },
      { x: 82, y: 22, name: 'LB', rating: '7.1', pos: 'DEF' },
      { x: 38, y: 34, name: 'DM', rating: '7.2', pos: 'MID' },
      { x: 62, y: 34, name: 'DM', rating: '6.9', pos: 'MID' },
      { x: 20, y: 44, name: 'RW', rating: '7.4', pos: 'FWD' },
      { x: 50, y: 42, name: 'AM', rating: '7.5', pos: 'MID' },
      { x: 80, y: 44, name: 'LW', rating: '6.8', pos: 'FWD' },
      { x: 50, y: 47, name: 'ST', rating: '7.0', pos: 'FWD' }
    ];

    const parseLineup = (raw) => {
      if (!raw) return [];
      if (Array.isArray(raw)) return raw;
      try { return JSON.parse(raw); } catch (_) { return []; }
    };

    const homeLineup = parseLineup(m.home_lineup);
    const awayLineup = parseLineup(m.away_lineup);
    const homeTeam = m.home_team || 'Home';
    const awayTeam = m.away_team || 'Away';

    container.innerHTML = '';

    defaultHomeCoords.forEach((coord, i) => {
      const p = homeLineup[i] || {};
      const name = p.name || coord.name;
      const avatar = p.photo || 'https://images.fotmob.com/image_resources/playerimages/placeholder.png';
      const rating = p.rating || coord.rating;
      const ratingVal = parseFloat(rating);
      const ratingBg = ratingVal >= 7.0 ? '#16A34A' : (ratingVal >= 6.0 ? '#D97706' : '#DC2626');
      const isMotm = coord.motm || p.motm;

      const node = document.createElement('div');
      node.className = 'zeta-player-node';
      node.style.left = coord.x + '%';
      node.style.top = coord.y + '%';
      node.title = \`\${name} (\${homeTeam}) - Click to view player details\`;
      node.innerHTML = \`
        <div class="zeta-avatar-wrap">
          <img class="zeta-player-avatar" src="\${avatar}" alt="\${name}"/>
          <span class="zeta-rating-badge" style="background:\${ratingBg}">\${rating}</span>
          \${isMotm ? '<span class="zeta-motm-star">\u2B50</span>' : ''}
        </div>
        <span class="zeta-player-name-tag">\${name}</span>
      \`;
      node.addEventListener('click', () => {
        openPlayerDetailModal({ ...p, name, photo: avatar, rating, pos: p.pos || coord.pos }, homeTeam);
      });
      container.appendChild(node);
    });

    defaultAwayCoords.forEach((coord, i) => {
      const p = awayLineup[i] || {};
      const name = p.name || coord.name;
      const avatar = p.photo || 'https://images.fotmob.com/image_resources/playerimages/placeholder.png';
      const rating = p.rating || coord.rating;
      const ratingVal = parseFloat(rating);
      const ratingBg = ratingVal >= 7.0 ? '#16A34A' : (ratingVal >= 6.0 ? '#D97706' : '#DC2626');

      const node = document.createElement('div');
      node.className = 'zeta-player-node';
      node.style.left = coord.x + '%';
      node.style.top = coord.y + '%';
      node.title = \`\${name} (\${awayTeam}) - Click to view player details\`;
      node.innerHTML = \`
        <div class="zeta-avatar-wrap">
          <img class="zeta-player-avatar" src="\${avatar}" alt="\${name}"/>
          <span class="zeta-rating-badge" style="background:\${ratingBg}">\${rating}</span>
        </div>
        <span class="zeta-player-name-tag">\${name}</span>
      \`;
      node.addEventListener('click', () => {
        openPlayerDetailModal({ ...p, name, photo: avatar, rating, pos: p.pos || coord.pos }, awayTeam);
      });
      container.appendChild(node);
    });

    // Render subs benches
    const homeSubs = parseLineup(m.home_subs);
    const awaySubs = parseLineup(m.away_subs);

    const renderSubsList = (list, tName, elId) => {
      const el = document.getElementById(elId);
      if (!el) return;
      if (!list || list.length === 0) {
        el.innerHTML = '<p style="color: #94A3B8; font-size: 13px;">No substitutes listed.</p>';
        return;
      }
      el.innerHTML = '';
      list.forEach(p => {
        const row = document.createElement('div');
        row.className = 'zeta-sub-player-row';
        row.style.cursor = 'pointer';
        row.title = \`Click to view \${p.name || 'player'} details\`;
        const ratingVal = parseFloat(p.rating || 6.5);
        const ratingBg = ratingVal >= 7.0 ? '#16A34A' : (ratingVal >= 6.0 ? '#D97706' : '#DC2626');
        row.innerHTML = \`
          <div class="zeta-sub-info">
            <img class="zeta-sub-avatar" src="\${p.photo || 'https://images.fotmob.com/image_resources/playerimages/placeholder.png'}" alt="\${p.name || 'Sub'}"/>
            <span style="font-weight: 600; color: #0F172A;">\${p.name || 'Sub'}</span>
          </div>
          <span style="font-weight: 700; color: \${ratingBg};">\${p.rating || '6.5'}</span>
        \`;
        row.addEventListener('click', () => {
          openPlayerDetailModal(p, tName);
        });
        el.appendChild(row);
      });
    };

    renderSubsList(homeSubs, homeTeam, 'zetaHomeSubsList');
    renderSubsList(awaySubs, awayTeam, 'zetaAwaySubsList');
  }

  // Execute Mode
  if (isStreamMode) {
    renderStreamMode(matchId);
  } else {
    renderDetailsMode(matchId);
  }
})();
//]]>
</script>
`;

xml = xml.replace('</body>', `${clientEngineScript}\n</body>`);

// Save generated theme to zetasports-v3/web/colorify_zetasports_theme.xml
const outPath = 'zetasports-v3/web/colorify_zetasports_theme.xml';
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, xml, 'utf8');

console.log('✔ Successfully generated unified theme:', outPath);
console.log('Total Output Lines:', xml.split('\n').length);
