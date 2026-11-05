import { createCanvas, loadImage, GlobalFonts } from './node_modules/@napi-rs/canvas/index.js';
import fs from 'fs';
import path from 'path';
import https from 'https';

// Register fonts
const fontDir = path.resolve('./fonts');
if (fs.existsSync(path.join(fontDir, 'BebasNeue-Regular.ttf'))) {
  GlobalFonts.registerFromPath(path.join(fontDir, 'BebasNeue-Regular.ttf'), 'Bebas Neue');
}
if (fs.existsSync('C:/Windows/Fonts/segoeuib.ttf')) {
  GlobalFonts.registerFromPath('C:/Windows/Fonts/segoeuib.ttf', 'Segoe UI Bold');
}
if (fs.existsSync('C:/Windows/Fonts/ARIALNB.TTF')) {
  GlobalFonts.registerFromPath('C:/Windows/Fonts/ARIALNB.TTF', 'Arial Narrow Bold');
}

function getZetaLogoPath() {
  const candidates = [
    path.resolve('./assets/zeta_logo.png'),
    path.join(process.cwd(), 'zetasports-v3', 'admin_v3', 'assets', 'zeta_logo.png'),
    path.join(process.cwd(), 'zetasports-v3', 'admin_frontend', 'assets', 'zeta_logo.png'),
    'C:/Users/Mubthaseem/.gemini/antigravity/scratch/zetasports-flutter/zetasports-v3/admin_v3/assets/zeta_logo.png'
  ];
  return candidates.find(p => fs.existsSync(p)) || null;
}

function fetchImageBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.fotmob.com/'
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchImageBuffer(res.headers.location).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// ==============================================================================
// 1. BEFORE MATCH CANVA ENGINE (match.pdf: Slanted Dual-Blue Split & Team Crests)
// ==============================================================================
export async function generateBeforeMatchCanvas(homeTeam, awayTeam, league, homeLogoUrl, awayLogoUrl, kickoff, venue) {
  const width = 1280;
  const height = 720;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Slanted Dual-Tone Division
  const topSplitX = width * 0.575;
  const bottomSplitX = width * 0.515;

  // 1. Right Side (Dark Midnight Navy: #0c1b33 -> #050c18)
  const rightBgGrad = ctx.createLinearGradient(bottomSplitX, 0, width, height);
  rightBgGrad.addColorStop(0, '#0c1b33');
  rightBgGrad.addColorStop(1, '#050c18');
  ctx.fillStyle = rightBgGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Left Side Polygon (Zeta Royal Blue: #2567df -> #184db4 -> #0f398e)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(topSplitX, 0);
  ctx.lineTo(bottomSplitX, height);
  ctx.lineTo(0, height);
  ctx.closePath();

  const leftBgGrad = ctx.createLinearGradient(0, 0, topSplitX, height);
  leftBgGrad.addColorStop(0, '#2567df');
  leftBgGrad.addColorStop(0.6, '#184db4');
  leftBgGrad.addColorStop(1, '#0f398e');
  ctx.fillStyle = leftBgGrad;
  ctx.fill();

  // Subtle Left Side Light Glow
  const leftAura = ctx.createRadialGradient(280, 260, 40, 280, 260, 450);
  leftAura.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
  leftAura.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = leftAura;
  ctx.fill();
  ctx.restore();

  // 3. Dividing Slant Shadow & Highlight
  ctx.save();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(topSplitX, 0);
  ctx.lineTo(bottomSplitX, height);
  ctx.stroke();

  // Crisp hairline highlight
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(topSplitX, 0);
  ctx.lineTo(bottomSplitX, height);
  ctx.stroke();
  ctx.restore();

  // --- TOP-LEFT BRAND TEXT: ZETASPORTS ---
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px "Bebas Neue", "Arial Narrow Bold", sans-serif';
  ctx.letterSpacing = '3px';
  ctx.textAlign = 'left';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 10;
  ctx.fillText('ZETASPORTS', 60, 68);
  ctx.restore();

  // --- TOP COMPETITION PILL (Top Right) ---
  ctx.save();
  const pillW = 420;
  const pillH = 38;
  const pillX = width - pillW - 60;
  const pillY = 38;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(pillX, pillY, pillW, pillH, 19);
  ctx.fill();
  ctx.stroke();

  // Red live indicator dot
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(pillX + 22, pillY + pillH / 2, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 14px "Segoe UI Bold", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '1px';
  ctx.fillText((league || 'MATCHDAY LIVE').toUpperCase() + (kickoff ? ` • ${kickoff}` : ''), pillX + (pillW / 2) + 10, pillY + pillH / 2);
  ctx.restore();

  // --- BOTTOM-RIGHT OFFICIAL 3D ZETA LOGO ---
  try {
    const logoPath = getZetaLogoPath();
    if (logoPath) {
      const zetaImg = await loadImage(logoPath);
      ctx.save();
      ctx.shadowColor = 'rgba(56, 189, 248, 0.6)';
      ctx.shadowBlur = 20;
      ctx.drawImage(zetaImg, width - 145, height - 135, 88, 88);
      ctx.restore();
    }
  } catch (err) {
    console.warn('Logo load warning:', err.message);
  }

  // --- TEAM CRESTS ---
  const homeCenterX = 280;
  const crestY = 190;
  const crestSize = 220;

  try {
    if (homeLogoUrl) {
      const hBuf = await fetchImageBuffer(homeLogoUrl);
      const hImg = await loadImage(hBuf);
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
      ctx.shadowBlur = 35;
      ctx.shadowOffsetY = 12;
      ctx.drawImage(hImg, homeCenterX - (crestSize / 2), crestY, crestSize, crestSize);
      ctx.restore();
    }
  } catch (e) {
    console.error('Home logo error:', e.message);
  }

  const awayCenterX = 960;
  try {
    if (awayLogoUrl) {
      const aBuf = await fetchImageBuffer(awayLogoUrl);
      const aImg = await loadImage(aBuf);
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowBlur = 35;
      ctx.shadowOffsetY = 12;
      ctx.drawImage(aImg, awayCenterX - (crestSize / 2), crestY, crestSize, crestSize);
      ctx.restore();
    }
  } catch (e) {
    console.error('Away logo error:', e.message);
  }

  // --- CENTER "VS" BADGE ---
  const vsCenterX = (topSplitX + bottomSplitX) / 2;
  const vsCenterY = 300;

  ctx.save();
  const vsAura = ctx.createRadialGradient(vsCenterX, vsCenterY, 30, vsCenterX, vsCenterY, 80);
  vsAura.addColorStop(0, 'rgba(56, 189, 248, 0.4)');
  vsAura.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = vsAura;
  ctx.beginPath();
  ctx.arc(vsCenterX, vsCenterY, 80, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.arc(vsCenterX, vsCenterY, 46, 0, Math.PI * 2);
  ctx.fill();

  const vsInnerGrad = ctx.createLinearGradient(vsCenterX - 40, vsCenterY - 40, vsCenterX + 40, vsCenterY + 40);
  vsInnerGrad.addColorStop(0, '#ffffff');
  vsInnerGrad.addColorStop(1, '#e2e8f0');
  ctx.fillStyle = vsInnerGrad;
  ctx.beginPath();
  ctx.arc(vsCenterX, vsCenterY, 42, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 36px "Bebas Neue", "Arial Narrow Bold", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('VS', vsCenterX, vsCenterY + 2);
  ctx.restore();

  // --- TEAM NAMES ---
  ctx.save();
  ctx.font = 'bold 54px "Bebas Neue", "Arial Narrow Bold", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;

  ctx.fillStyle = '#ffffff';
  ctx.fillText(homeTeam.toUpperCase(), homeCenterX, 440);
  ctx.fillText(awayTeam.toUpperCase(), awayCenterX, 440);
  ctx.restore();

  // --- BOTTOM VENUE BAR ---
  ctx.save();
  const venueText = venue ? `📍 ${venue}` : 'STARTING LINEUPS • TACTICAL PITCH • LIVE ARENA';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = 'bold 16px "Segoe UI Bold", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(venueText, 60, height - 60);
  ctx.restore();

  return canvas.toBuffer('image/jpeg', 92);
}

// ==============================================================================
// 2. LIVE MATCH CANVA ENGINE (Clean Arena: No Time Counter, No Bottom-Right Box)
// ==============================================================================
export async function generateLiveMatchCanvas(homeTeam, awayTeam, league, homeLogoUrl, awayLogoUrl, homeScore, awayScore) {
  const width = 1280;
  const height = 720;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 1. Seamless Dark Stadium Backdrop (Consistent deep navy across entire canvas)
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#040a17');
  bgGrad.addColorStop(0.5, '#07152d');
  bgGrad.addColorStop(1, '#020610');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Soft Volumetric arena floodlights on the right side
  ctx.save();
  // Cyan spotlight behind Home crest
  const homeBeam = ctx.createRadialGradient(730, 310, 20, 730, 310, 260);
  homeBeam.addColorStop(0, 'rgba(56, 189, 248, 0.28)');
  homeBeam.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = homeBeam;
  ctx.fillRect(0, 0, width, height);

  // Crimson spotlight behind Away crest
  const awayBeam = ctx.createRadialGradient(1070, 310, 20, 1070, 310, 260);
  awayBeam.addColorStop(0, 'rgba(239, 68, 68, 0.24)');
  awayBeam.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = awayBeam;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  // 2. Left Side Branding & Typography Panel
  ctx.save();
  const leftPanelGrad = ctx.createLinearGradient(0, 0, 560, 0);
  leftPanelGrad.addColorStop(0, 'rgba(5, 12, 26, 0.98)');
  leftPanelGrad.addColorStop(0.7, 'rgba(7, 18, 38, 0.90)');
  leftPanelGrad.addColorStop(1, 'rgba(7, 18, 38, 0)');
  ctx.fillStyle = leftPanelGrad;
  ctx.fillRect(0, 0, 580, height);
  ctx.restore();

  // Top Header: 🔴 LIVE IN-PLAY Pill (NO MATCH TIME DISPLAYED)
  ctx.save();
  ctx.fillStyle = '#dc2626';
  ctx.shadowColor = 'rgba(220, 38, 38, 0.65)';
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.roundRect(70, 65, 160, 38, 19);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px "Segoe UI Bold", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🔴 LIVE IN-PLAY', 150, 84);

  // Competition Sub-tag
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 18px "Segoe UI Bold", sans-serif';
  ctx.textAlign = 'left';
  ctx.letterSpacing = '1px';
  ctx.fillText((league || 'FOOTBALL LEAGUE').toUpperCase(), 70, 140);
  ctx.restore();

  // Massive Headline: LIVE MATCH (Stacked Bebas Neue)
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 150px "Bebas Neue", "Arial Narrow Bold", sans-serif';
  ctx.letterSpacing = '4px';
  ctx.textAlign = 'left';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetX = 6;
  ctx.shadowOffsetY = 8;
  ctx.fillText('LIVE', 65, 290);
  ctx.fillText('MATCH', 65, 435);
  ctx.restore();

  // Left Subtitle / Telemetry
  ctx.save();
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 15px "Segoe UI Bold", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('REAL-TIME FOTMOB TELEMETRY • LIVE STREAM', 70, 520);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 14px "Segoe UI Bold", sans-serif';
  ctx.fillText('HD BROADCAST FEED • INSTANT REPLAY', 70, 548);
  ctx.restore();

  // ============================================================================
  // 3. RIGHT SIDE: PROMINENT TEAM SCORE & LOGOS ARENA (Clean & Centered)
  // ============================================================================
  const homeX = 730;
  const awayX = 1070;
  const crestY = 310;
  const crestSize = 160;

  // Home Crest Backlight Aura
  ctx.save();
  ctx.shadowColor = 'rgba(56, 189, 248, 0.5)';
  ctx.shadowBlur = 28;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(homeX, crestY, 95, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Draw Home Crest
  try {
    if (homeLogoUrl) {
      const hBuf = await fetchImageBuffer(homeLogoUrl);
      const hImg = await loadImage(hBuf);
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowBlur = 25;
      ctx.shadowOffsetY = 8;
      ctx.drawImage(hImg, homeX - (crestSize / 2), crestY - (crestSize / 2), crestSize, crestSize);
      ctx.restore();
    }
  } catch (e) {
    console.error('Home logo error:', e.message);
  }

  // Home Team Name
  ctx.save();
  ctx.font = 'bold 36px "Bebas Neue", "Arial Narrow Bold", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
  ctx.shadowBlur = 12;
  ctx.fillText(homeTeam.toUpperCase(), homeX, crestY + 125);
  ctx.restore();

  // Away Crest Backlight Aura
  ctx.save();
  ctx.shadowColor = 'rgba(239, 68, 68, 0.5)';
  ctx.shadowBlur = 28;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(awayX, crestY, 95, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Draw Away Crest
  try {
    if (awayLogoUrl) {
      const aBuf = await fetchImageBuffer(awayLogoUrl);
      const aImg = await loadImage(aBuf);
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowBlur = 25;
      ctx.shadowOffsetY = 8;
      ctx.drawImage(aImg, awayX - (crestSize / 2), crestY - (crestSize / 2), crestSize, crestSize);
      ctx.restore();
    }
  } catch (e) {
    console.error('Away logo error:', e.message);
  }

  // Away Team Name
  ctx.save();
  ctx.font = 'bold 36px "Bebas Neue", "Arial Narrow Bold", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
  ctx.shadowBlur = 12;
  ctx.fillText(awayTeam.toUpperCase(), awayX, crestY + 125);
  ctx.restore();

  // Center Score Box (Between Home & Away)
  const scoreCenterX = (homeX + awayX) / 2; // 900
  const scoreBoxW = 165;
  const scoreBoxH = 92;
  const scoreBoxX = scoreCenterX - (scoreBoxW / 2);
  const scoreBoxY = crestY - (scoreBoxH / 2);

  ctx.save();
  const sGrad = ctx.createLinearGradient(scoreBoxX, scoreBoxY, scoreBoxX + scoreBoxW, scoreBoxY + scoreBoxH);
  sGrad.addColorStop(0, '#dc2626');
  sGrad.addColorStop(0.5, '#991b1b');
  sGrad.addColorStop(1, '#0062b2');
  ctx.fillStyle = sGrad;
  ctx.shadowColor = 'rgba(220, 38, 38, 0.65)';
  ctx.shadowBlur = 22;
  ctx.beginPath();
  ctx.roundRect(scoreBoxX, scoreBoxY, scoreBoxW, scoreBoxH, 16);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Score Text (e.g. "2 - 1")
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 66px "Bebas Neue", "Arial Narrow Bold", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 10;
  ctx.fillText(`${homeScore ?? 0} - ${awayScore ?? 0}`, scoreCenterX, scoreBoxY + (scoreBoxH / 2) + 3);
  ctx.restore();

  // Score Sub-label: "LIVE SCORE"
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.font = 'bold 13px "Segoe UI Bold", sans-serif';
  ctx.textAlign = 'center';
  ctx.letterSpacing = '2px';
  ctx.fillText('LIVE SCORE', scoreCenterX, scoreBoxY + scoreBoxH + 24);
  ctx.restore();

  // Bottom Arena Telemetry Badge (Spans under the matchup)
  ctx.save();
  const arenaPillW = 340;
  const arenaPillH = 32;
  const arenaPillX = scoreCenterX - (arenaPillW / 2);
  const arenaPillY = 530;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(arenaPillX, arenaPillY, arenaPillW, arenaPillH, 16);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 12px "Segoe UI Bold", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '1px';
  ctx.fillText('STARTING XI CONFIRMED • LIVE BROADCAST', scoreCenterX, arenaPillY + (arenaPillH / 2));
  ctx.restore();

  // Bottom-Right Zeta Logo Watermark
  try {
    const logoPath = getZetaLogoPath();
    if (logoPath) {
      const zetaImg = await loadImage(logoPath);
      ctx.save();
      ctx.shadowColor = 'rgba(56, 189, 248, 0.8)';
      ctx.shadowBlur = 20;
      ctx.drawImage(zetaImg, width - 125, height - 115, 75, 75);
      ctx.restore();
    }
  } catch (err) {
    console.warn('Zeta logo load warning:', err.message);
  }

  return canvas.toBuffer('image/jpeg', 92);
}

// ==============================================================================
// 3. AFTER MATCH CANVA ENGINE (matchAFTER.pdf: Action Photo & Full-Time Scoreline)
// ==============================================================================
export async function generateAfterMatchCanvas(homeTeam, awayTeam, league, homeLogoUrl, awayLogoUrl, homeScore, awayScore) {
  const width = 1280;
  const height = 720;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // --- RIGHT SIDE: REAL ACTION PHOTO (Field Turf with Soccer Ball) ---
  try {
    const actionPhotoUrl = 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1280&h=720&q=80';
    const aBuf = await fetchImageBuffer(actionPhotoUrl);
    const aImg = await loadImage(aBuf);
    ctx.drawImage(aImg, 0, 0, width, height);
  } catch (_) {
    ctx.fillStyle = '#15803d';
    ctx.fillRect(0, 0, width, height);
  }

  // --- LEFT SIDE: 48% ZETA BLUE GRADIENT PANEL WITH SMOOTH BLEND ---
  ctx.save();
  const panelWidth = width * 0.48;
  const fadeGrad = ctx.createLinearGradient(0, 0, panelWidth + 240, 0);
  fadeGrad.addColorStop(0, 'rgba(10, 45, 120, 0.98)');
  fadeGrad.addColorStop(0.35, 'rgba(12, 55, 145, 0.95)');
  fadeGrad.addColorStop(0.65, 'rgba(14, 60, 160, 0.82)');
  fadeGrad.addColorStop(0.85, 'rgba(14, 60, 160, 0.40)');
  fadeGrad.addColorStop(1, 'rgba(14, 60, 160, 0)');
  ctx.fillStyle = fadeGrad;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  // Subtle dark bottom vignette
  ctx.save();
  const botGrad = ctx.createLinearGradient(0, height - 180, 0, height);
  botGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
  botGrad.addColorStop(1, 'rgba(2, 6, 18, 0.65)');
  ctx.fillStyle = botGrad;
  ctx.fillRect(0, height - 180, width, 180);
  ctx.restore();

  // --- TOP HEADER: "MATCH HIGHLIGHT" ---
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px "Segoe UI Bold", sans-serif';
  ctx.letterSpacing = '1px';
  ctx.textAlign = 'left';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 10;
  ctx.fillText('MATCH HIGHLIGHT', 70, 85);

  // League Sub-tag
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 16px "Segoe UI Bold", sans-serif';
  ctx.fillText((league || 'FOOTBALL LEAGUE').toUpperCase(), 70, 115);
  ctx.restore();

  // --- MASSIVE HEADLINE: "FULL TIME" (Stacked Athletic Typography) ---
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 155px "Bebas Neue", "Arial Narrow Bold", sans-serif';
  ctx.letterSpacing = '4px';
  ctx.textAlign = 'left';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetX = 6;
  ctx.shadowOffsetY = 8;

  ctx.fillText('FULL', 65, 275);
  ctx.fillText('TIME', 65, 415);
  ctx.restore();

  // --- SCORELINE ROW (Bottom Left: Home Logo - Score - Away Logo) ---
  const scoreRowY = 540;
  const circleRadius = 42;

  // 1. Home Team Circular Crest
  const homeCircleX = 115;
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 16;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(homeCircleX, scoreRowY, circleRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
  ctx.lineWidth = 3.5;
  ctx.stroke();

  ctx.clip();
  try {
    if (homeLogoUrl) {
      const hBuf = await fetchImageBuffer(homeLogoUrl);
      const hImg = await loadImage(hBuf);
      ctx.drawImage(hImg, homeCircleX - 32, scoreRowY - 32, 64, 64);
    }
  } catch (_) {}
  ctx.restore();

  // 2. Bold White Scoreline (e.g. "3 - 2")
  const displayScore = `${homeScore !== null && homeScore !== undefined ? homeScore : 0} - ${awayScore !== null && awayScore !== undefined ? awayScore : 0}`;
  const scoreCenterX = 255;
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 78px "Bebas Neue", "Arial Narrow Bold", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
  ctx.shadowBlur = 18;
  ctx.fillText(displayScore, scoreCenterX, scoreRowY + 4);
  ctx.restore();

  // 3. Away Team Circular Crest
  const awayCircleX = 395;
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 16;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(awayCircleX, scoreRowY, circleRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
  ctx.lineWidth = 3.5;
  ctx.stroke();

  ctx.clip();
  try {
    if (awayLogoUrl) {
      const aBuf = await fetchImageBuffer(awayLogoUrl);
      const aImg = await loadImage(aBuf);
      ctx.drawImage(aImg, awayCircleX - 32, scoreRowY - 32, 64, 64);
    }
  } catch (_) {}
  ctx.restore();

  // --- TEAM NAMES UNDER SCORE ROW ---
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.font = 'bold 17px "Segoe UI Bold", sans-serif';
  ctx.textAlign = 'left';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 8;
  ctx.fillText(`${homeTeam} vs ${awayTeam}`, 70, 635);
  ctx.restore();

  // --- BOTTOM-RIGHT OFFICIAL ZETA LOGO ---
  try {
    const logoPath = getZetaLogoPath();
    if (logoPath) {
      const zetaImg = await loadImage(logoPath);
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 20;
      ctx.drawImage(zetaImg, width - 125, height - 115, 75, 75);
      ctx.restore();
    }
  } catch (err) {
    console.warn('Logo load warning:', err.message);
  }

  return canvas.toBuffer('image/jpeg', 92);
}

// Generate all 3 stages for the user!
async function run() {
  const artifactDir = 'C:/Users/Mubthaseem/.gemini/antigravity/brain/39a60873-c4c5-4e87-9c11-d368021db40b';

  console.log('Generating 1. STAGE 1: BEFORE MATCH (Preview)...');
  const stage1Buf = await generateBeforeMatchCanvas(
    'Arsenal',
    'Real Madrid',
    'UEFA Champions League',
    'https://images.fotmob.com/image_resources/logo/teamlogo/9825.png',
    'https://images.fotmob.com/image_resources/logo/teamlogo/8633.png',
    '08:00 PM GMT',
    'Emirates Stadium, London'
  );
  fs.writeFileSync(path.join(artifactDir, 'stage1_before_match.jpg'), stage1Buf);
  console.log('Saved stage1_before_match.jpg!');

  console.log('Generating 2. STAGE 2: IN-MATCH (No Time, No Box, Clean Arena)...');
  const stage2Buf = await generateLiveMatchCanvas(
    'Arsenal',
    'Real Madrid',
    'UEFA Champions League',
    'https://images.fotmob.com/image_resources/logo/teamlogo/9825.png',
    'https://images.fotmob.com/image_resources/logo/teamlogo/8633.png',
    2,
    1
  );
  fs.writeFileSync(path.join(artifactDir, 'stage2_in_match.jpg'), stage2Buf);
  console.log('Saved stage2_in_match.jpg!');

  console.log('Generating 3. STAGE 3: POST-MATCH (Full Time / Highlight)...');
  const stage3Buf = await generateAfterMatchCanvas(
    'Arsenal',
    'Real Madrid',
    'UEFA Champions League',
    'https://images.fotmob.com/image_resources/logo/teamlogo/9825.png',
    'https://images.fotmob.com/image_resources/logo/teamlogo/8633.png',
    3,
    2
  );
  fs.writeFileSync(path.join(artifactDir, 'stage3_post_match.jpg'), stage3Buf);
  console.log('Saved stage3_post_match.jpg!');

  console.log('ALL 3 STAGES GENERATED SUCCESSFULLY!');
}

run().catch(console.error);
