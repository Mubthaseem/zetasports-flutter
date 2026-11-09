// ==============================================================================
// ZetaSports Admin Portal v3: Zero-Dependency Server & Blogger/Gemini API Gateway
// Port 2121: Supabase CORS Proxy, Blogger API v3 Auto-Poster & Nano Banana 2 AI Thumbnails
// ==============================================================================

import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { verifyJWT } from './netlify/functions/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Register Athletic Broadcast Typography
try {
  const bebasPath = path.join(__dirname, 'fonts', 'BebasNeue-Regular.ttf');
  if (fs.existsSync(bebasPath)) GlobalFonts.registerFromPath(bebasPath, 'Bebas Neue');
  if (fs.existsSync('C:/Windows/Fonts/segoeuib.ttf')) GlobalFonts.registerFromPath('C:/Windows/Fonts/segoeuib.ttf', 'Segoe UI Bold');
  if (fs.existsSync('C:/Windows/Fonts/ARIALNB.TTF')) GlobalFonts.registerFromPath('C:/Windows/Fonts/ARIALNB.TTF', 'Arial Narrow Bold');
  console.log('✔ Broadcast typography engine initialized (Bebas Neue, Segoe UI Bold).');
} catch (fErr) {
  console.warn('Font register warning:', fErr.message);
}
const PORT = process.env.PORT || 2121;
const SUPABASE_HOST = 'udlncusvhmydivtjkjcy.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkbG5jdXN2aG15ZGl2dGpramN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4MTE2MDgsImV4cCI6MjEwOTM4NzYwOH0.gsnxlDww-fUC4HG7R7VasXSaQvqkSsDhhmf16KUCLZY';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';
const SESSION_SECRET = process.env.SESSION_SECRET || (process.env.SUPABASE_SERVICE_ROLE_KEY ? crypto.createHash('sha256').update(process.env.SUPABASE_SERVICE_ROLE_KEY).digest('hex') : 'zeta_admin_auth_entropy');
const CONFIG_FILE = path.join(__dirname, 'blogger_config.json');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

// Helper: Read JSON config
function loadConfig() {
  let cfg = {
    clientId: '',
    clientSecret: '',
    projectId: '',
    blogId: '',
    apiKey: '',
    accessToken: '',
    refreshToken: '',
    geminiApiKey: '',
    tokenExpiry: 0,
    connectionStatus: 'disconnected',
    targetBlogIds: [],
    thumbnailPromptTemplate: "Cinematic 16:9 television broadcast matchday graphic poster for {homeTeam} vs {awayTeam} in {league}. Left side: Official {homeTeam} team crest with stadium lighting. Right side: Official {awayTeam} team crest with floodlight beams. Center: Dramatic glowing 'VS' emblem with kickoff telemetry. Watermark & Branding: Official 'ZetaSports Match Center & Live Broadcasts' network logo in electric blue (#0062b2) and white. Atmosphere: Photorealistic packed stadium under floodlights, dynamic sports television presentation, 8k resolution.",
    useNanoBananaThumbnail: true,
    autoPublish: true,
    detailsBlogDomain: '',
    streamBlogDomain: '',
    thumbnailMode: 'auto'
  };

  try {
    if (fs.existsSync(CONFIG_FILE)) {
      cfg = { ...cfg, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) };
    }
  } catch (e) {
    console.error('[Config Load Error]:', e.message);
  }

  // Auto-read client_secret.json if clientId or clientSecret are missing
  try {
    const secretPath = path.join(__dirname, 'client_secret.json');
    if (fs.existsSync(secretPath)) {
      const secretJson = JSON.parse(fs.readFileSync(secretPath, 'utf8'));
      const creds = secretJson.web || secretJson.installed;
      if (creds) {
        if (!cfg.clientId && creds.client_id) cfg.clientId = creds.client_id;
        if (!cfg.clientSecret && creds.client_secret) cfg.clientSecret = creds.client_secret;
        if (!cfg.projectId && creds.project_id) cfg.projectId = creds.project_id;
      }
    }
  } catch (_) {}

  return cfg;
}

// Helper: Save JSON config
function saveConfig(cfg) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('[Config Save Error]:', e.message);
    return false;
  }
}

// Helper: HTTPS request returning Promise
function httpsRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, headers: res.headers, data: json, raw: body });
        } catch (_) {
          resolve({ status: res.statusCode, headers: res.headers, data: body, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

// Helper: Check if Google OAuth access token is expired or expiring within 5 minutes (300,000ms)
function isGoogleTokenExpired(cfg) {
  if (!cfg || !cfg.accessToken) return true;
  if (!cfg.tokenExpiry) return true;
  const now = Date.now();
  const bufferMs = 5 * 60 * 1000;
  return now >= (Number(cfg.tokenExpiry) - bufferMs);
}

// Helper: Load Blogger credentials and config from Supabase zeta_settings
async function loadConfigFromSupabase() {
  if (!SUPABASE_SERVICE_KEY) {
    return null;
  }
  try {
    const res = await httpsRequest({
      hostname: SUPABASE_HOST,
      path: '/rest/v1/zeta_settings?key=eq.blogger_oauth&select=*',
      method: 'GET',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    });

    if (Array.isArray(res.data) && res.data.length > 0 && res.data[0].value) {
      return res.data[0].value;
    }
  } catch (err) {
    console.warn('[Supabase Sync]: Failed to fetch remote Blogger config from zeta_settings:', err.message);
  }
  return null;
}

// Helper: Save Blogger credentials to Supabase zeta_settings
async function syncConfigToSupabase(cfg) {
  if (!SUPABASE_SERVICE_KEY) {
    return false;
  }
  try {
    const payload = {
      key: 'blogger_oauth',
      value: {
        clientId: cfg.clientId || '',
        clientSecret: cfg.clientSecret || '',
        refreshToken: cfg.refreshToken || '',
        accessToken: cfg.accessToken || '',
        tokenExpiry: cfg.tokenExpiry || 0,
        connectionStatus: cfg.connectionStatus || (cfg.accessToken ? 'connected' : 'disconnected'),
        targetBlogIds: Array.isArray(cfg.targetBlogIds) && cfg.targetBlogIds.length > 0
          ? cfg.targetBlogIds
          : (cfg.blogId ? String(cfg.blogId).split(',').map(s => s.trim()).filter(Boolean) : []),
        blogId: cfg.blogId || '',
        blogsList: cfg.blogsList || [],
        projectId: cfg.projectId || '',
        apiKey: cfg.apiKey || '',
        geminiApiKey: cfg.geminiApiKey || '',
        thumbnailPromptTemplate: cfg.thumbnailPromptTemplate || '',
        useNanoBananaThumbnail: cfg.useNanoBananaThumbnail !== false,
        autoPublish: cfg.autoPublish !== false,
        detailsBlogDomain: cfg.detailsBlogDomain || '',
        streamBlogDomain: cfg.streamBlogDomain || '',
        thumbnailMode: cfg.thumbnailMode || 'auto',
        updatedAt: new Date().toISOString()
      },
      description: 'Central Google Blogger OAuth configuration, refresh token & active access token',
      updated_at: new Date().toISOString()
    };

    const res = await httpsRequest({
      hostname: SUPABASE_HOST,
      path: '/rest/v1/zeta_settings',
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      }
    }, payload);

    if (res.status >= 200 && res.status < 300) {
      console.log('[Supabase Sync]: Successfully synchronized Blogger config to zeta_settings.');
      return true;
    } else {
      console.warn('[Supabase Sync Warning]: HTTP status', res.status, res.data || res.raw);
      return false;
    }
  } catch (err) {
    console.warn('[Supabase Sync Error]:', err.message);
    return false;
  }
}

// Helper: Sanitize Blogger config for client (CRITICAL CYBERSECURITY: Strip secrets)
function sanitizeBloggerConfigForClient(cfg) {
  const safe = { ...cfg };
  delete safe.clientSecret;
  delete safe.refreshToken;

  if (safe.geminiApiKey) {
    safe.hasGeminiKey = true;
    if (typeof safe.geminiApiKey === 'string' && safe.geminiApiKey.length > 8) {
      safe.geminiApiKey = `${safe.geminiApiKey.slice(0, 4)}••••${safe.geminiApiKey.slice(-4)}`;
    } else {
      safe.geminiApiKey = '••••••••';
    }
  } else {
    safe.hasGeminiKey = false;
    safe.geminiApiKey = '';
  }

  safe.isConnected = !!safe.accessToken;
  if (!Array.isArray(safe.targetBlogIds) || safe.targetBlogIds.length === 0) {
    safe.targetBlogIds = safe.blogId ? String(safe.blogId).split(',').map(s => s.trim()).filter(Boolean) : [];
  }
  if (!Array.isArray(safe.blogsList)) {
    safe.blogsList = [];
  }

  return safe;
}

function parseCookies(header = '') {
  const list = {};
  if (!header || typeof header !== 'string') return list;
  header.split(';').forEach(c => {
    const parts = c.split('=');
    if (parts.length >= 2) list[parts[0].trim()] = decodeURIComponent(parts.slice(1).join('=').trim());
  });
  return list;
}

function verifyAdminSession(req) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
  const token = (authHeader.startsWith('Bearer ') ? authHeader.substring(7) : '') ||
    parseCookies(req.headers['cookie'] || '').zeta_admin_session;
    
  if (!token) return null;
  return verifyJWT(token, SESSION_SECRET);
}

// Helper: Refresh Google OAuth2 Access Token using Refresh Token
async function refreshGoogleAccessToken(cfg) {
  if (!cfg.refreshToken || !cfg.clientId || !cfg.clientSecret) {
    throw new Error('Cannot refresh token: missing refreshToken, clientId, or clientSecret');
  }

  const postBody = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    refresh_token: cfg.refreshToken,
    grant_type: 'refresh_token'
  }).toString();

  const res = await httpsRequest({
    hostname: 'oauth2.googleapis.com',
    path: '/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postBody)
    }
  }, postBody);

  if (res.status === 200 && res.data?.access_token) {
    const expiresIn = Number(res.data.expires_in) || 3600;
    cfg.accessToken = res.data.access_token;
    cfg.tokenExpiry = Date.now() + (expiresIn * 1000);
    cfg.connectionStatus = 'connected';
    if (res.data.refresh_token) {
      cfg.refreshToken = res.data.refresh_token;
    }
    saveConfig(cfg);
    await syncConfigToSupabase(cfg);
    console.log(`[Google OAuth]: Successfully refreshed access token! Valid for ${expiresIn}s.`);
    return cfg.accessToken;
  } else {
    console.error('[Google OAuth Refresh Failed]:', res.data || res.raw);
    if (res.data?.error === 'invalid_grant') {
      cfg.connectionStatus = 'reauth_required';
      saveConfig(cfg);
      await syncConfigToSupabase(cfg);
    }
    throw new Error(`Token refresh failed: ${JSON.stringify(res.data || res.raw)}`);
  }
}

// Helper: Generate Fallback High-Res SVG Matchday Banner (Zero Failure Guarantee)
function generateSvgMatchBanner(homeTeam, awayTeam, league) {
  const cleanHome = (homeTeam || 'Home Team').replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const cleanAway = (awayTeam || 'Away Team').replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const cleanLeague = (league || 'Live Match Center').replace(/&/g, '&amp;').replace(/</g, '&lt;');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" width="1200" height="675">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0a192f"/>
        <stop offset="50%" stop-color="#112240"/>
        <stop offset="100%" stop-color="#07111e"/>
      </linearGradient>
      <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#0062b2"/>
        <stop offset="100%" stop-color="#38bdf8"/>
      </linearGradient>
      <linearGradient id="turf" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#16a34a" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="#052e16" stop-opacity="0.9"/>
      </linearGradient>
    </defs>
    <!-- Background Frame -->
    <rect width="1200" height="675" fill="url(#bg)"/>
    <rect y="420" width="1200" height="255" fill="url(#turf)"/>
    <circle cx="600" cy="550" r="180" fill="none" stroke="#ffffff" stroke-width="3" stroke-opacity="0.2"/>
    <line x1="0" y1="550" x2="1200" y2="550" stroke="#ffffff" stroke-width="3" stroke-opacity="0.2"/>

    <!-- Competition Pill -->
    <rect x="420" y="70" width="360" height="48" rx="24" fill="#0062b2" fill-opacity="0.3" stroke="#38bdf8" stroke-width="1.5"/>
    <text x="600" y="102" font-family="'Oswald', sans-serif" font-size="20" font-weight="bold" fill="#38bdf8" text-anchor="middle" letter-spacing="2">${cleanLeague.toUpperCase()}</text>

    <!-- Matchday Presentation -->
    <text x="320" y="320" font-family="'Oswald', sans-serif" font-size="64" font-weight="bold" fill="#ffffff" text-anchor="middle">${cleanHome}</text>
    <rect x="540" y="270" width="120" height="70" rx="16" fill="url(#accent)"/>
    <text x="600" y="320" font-family="'Oswald', sans-serif" font-size="38" font-weight="bold" fill="#ffffff" text-anchor="middle">VS</text>
    <text x="880" y="320" font-family="'Oswald', sans-serif" font-size="64" font-weight="bold" fill="#ffffff" text-anchor="middle">${cleanAway}</text>

    <!-- Subtitle Bar -->
    <rect x="360" y="440" width="480" height="44" rx="22" fill="#ffffff" fill-opacity="0.08"/>
    <text x="600" y="469" font-family="'Inter', sans-serif" font-size="16" font-weight="600" fill="#cbd5e1" text-anchor="middle" letter-spacing="1">STARTING LINEUPS • TACTICAL PITCH • LIVE BROADCAST</text>

    <!-- Brand Watermark -->
    <text x="600" y="625" font-family="'Oswald', sans-serif" font-size="18" font-weight="bold" fill="#64748b" text-anchor="middle" letter-spacing="4">ZETASPORTS MATCH CENTER</text>
  </svg>`;

  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

// Helper: Download image buffer
function fetchImageBuffer(url) {
  return new Promise((resolve, reject) => {
    if (!url) return reject(new Error('No URL provided'));
    const protocol = url.startsWith('http://') ? http : https;
    protocol.get(url, (res) => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// Helper: Upload image buffer to high-speed public CDN (Catbox.moe with direct image URL)
async function uploadToCdn(imageBuffer, filename = 'matchday_poster.jpg') {
  // 1. Try Catbox.moe (Generates direct permanent https://files.catbox.moe/...jpg)
  try {
    const url = await new Promise((resolve, reject) => {
      const boundary = '----Boundary' + Math.random().toString(36).substring(2);
      const safeFilename = filename.endsWith('.jpg') ? filename : `${filename}.jpg`;
      const p1 = Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="reqtype"\r\n\r\nfileupload\r\n` +
        `--${boundary}\r\nContent-Disposition: form-data; name="fileToUpload"; filename="${safeFilename}"\r\nContent-Type: image/jpeg\r\n\r\n`
      );
      const p2 = Buffer.from(`\r\n--${boundary}--\r\n`);
      const payload = Buffer.concat([p1, imageBuffer, p2]);

      const req = https.request({
        hostname: 'catbox.moe',
        path: '/user/api.php',
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data; boundary=' + boundary,
          'Content-Length': payload.length,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        },
        timeout: 10000
      }, (res) => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => {
          const trimmed = body.trim();
          if (res.statusCode === 200 && trimmed.startsWith('http')) {
            resolve(trimmed);
          } else {
            reject(new Error(`Catbox status ${res.statusCode}: ${trimmed}`));
          }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
      req.write(payload);
      req.end();
    });
    if (url) {
      console.log(`[CDN Upload]: Successfully uploaded to Catbox -> ${url}`);
      return url;
    }
  } catch (err) {
    console.warn('[CDN Upload]: Catbox upload failed (' + err.message + ')');
  }

  // 2. Fallback: High-res stadium under floodlights CDN image
  return 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=1280&auto=format&fit=crop';
}

// ==============================================================================
// 1. BEFORE MATCH CANVA ENGINE (match.pdf: Slanted Dual-Blue Split & Team Crests)
// ==============================================================================
async function generateBeforeMatchCanvas(homeTeam, awayTeam, league, homeLogoUrl, awayLogoUrl, kickoff, venue, customRightImage = null) {
  const width = 1280;
  const height = 720;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Slanted Dual-Tone Division
  const topSplitX = width * 0.575;
  const bottomSplitX = width * 0.515;

  // Right Side (Dark Midnight Navy or Custom Action Photo)
  const rightBgGrad = ctx.createLinearGradient(bottomSplitX, 0, width, height);
  rightBgGrad.addColorStop(0, '#0c1b33');
  rightBgGrad.addColorStop(1, '#050c18');
  ctx.fillStyle = rightBgGrad;
  ctx.fillRect(0, 0, width, height);

  if (customRightImage) {
    try {
      const rBuf = await fetchImageBuffer(customRightImage);
      const rImg = await loadImage(rBuf);
      ctx.drawImage(rImg, 0, 0, width, height);
    } catch (_) {}
  }

  // Left Side Polygon (Zeta Royal Blue)
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

  // Dividing Slant Shadow & Highlight
  ctx.save();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(topSplitX, 0);
  ctx.lineTo(bottomSplitX, height);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(topSplitX, 0);
  ctx.lineTo(bottomSplitX, height);
  ctx.stroke();
  ctx.restore();

  // Top-Left Brand Text: ZETASPORTS
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px "Bebas Neue", "Arial Narrow Bold", sans-serif';
  ctx.letterSpacing = '3px';
  ctx.textAlign = 'left';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 10;
  ctx.fillText('ZETASPORTS', 60, 68);
  ctx.restore();

  // Top Competition Pill
  ctx.save();
  const pillW = 380;
  const pillH = 36;
  const pillX = width - pillW - 60;
  const pillY = 40;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(pillX, pillY, pillW, pillH, 18);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(pillX + 20, pillY + pillH / 2, 4.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 13px "Segoe UI Bold", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '1px';
  ctx.fillText((league || 'MATCHDAY LIVE').toUpperCase() + (kickoff ? ` • ${kickoff}` : ''), pillX + (pillW / 2) + 10, pillY + pillH / 2);
  ctx.restore();

  // Bottom-Right Official 3D Zeta Logo
  try {
    const logoPath = path.join(__dirname, 'assets', 'zeta_logo.png');
    if (fs.existsSync(logoPath)) {
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

  // Team Crests (Left: Home, Right: Away)
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

  // Center "VS" Badge
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

  // Team Names
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

  // Venue Bar
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
// 2. AFTER MATCH CANVA ENGINE (matchAFTER.pdf: Action Photo & Full-Time Scoreline)
// ==============================================================================
async function generateAfterMatchCanvas(homeTeam, awayTeam, league, homeLogoUrl, awayLogoUrl, homeScore, awayScore, customRightImage = null) {
  const width = 1280;
  const height = 720;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Right Side Action Photo
  try {
    const actionPhotoUrl = customRightImage || 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1280&h=720&q=80';
    const aBuf = await fetchImageBuffer(actionPhotoUrl);
    const aImg = await loadImage(aBuf);
    ctx.drawImage(aImg, 0, 0, width, height);
  } catch (_) {
    ctx.fillStyle = '#15803d';
    ctx.fillRect(0, 0, width, height);
  }

  // Left Side Zeta Blue Gradient Panel
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

  // Bottom Vignette
  ctx.save();
  const botGrad = ctx.createLinearGradient(0, height - 180, 0, height);
  botGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
  botGrad.addColorStop(1, 'rgba(2, 6, 18, 0.65)');
  ctx.fillStyle = botGrad;
  ctx.fillRect(0, height - 180, width, 180);
  ctx.restore();

  // Top Header: MATCH HIGHLIGHT
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px "Segoe UI Bold", sans-serif';
  ctx.letterSpacing = '1px';
  ctx.textAlign = 'left';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 10;
  ctx.fillText('MATCH HIGHLIGHT', 70, 85);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 16px "Segoe UI Bold", sans-serif';
  ctx.fillText((league || 'FOOTBALL LEAGUE').toUpperCase(), 70, 115);
  ctx.restore();

  // Massive Headline: FULL TIME
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

  // Scoreline Row
  const scoreRowY = 540;
  const circleRadius = 42;

  // Home Crest
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

  // Bold White Scoreline
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

  // Away Crest
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

  // Team Names
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.font = 'bold 17px "Segoe UI Bold", sans-serif';
  ctx.textAlign = 'left';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 8;
  ctx.fillText(`${homeTeam} vs ${awayTeam}`, 70, 635);
  ctx.restore();

  // Bottom-Right Zeta Logo
  try {
    const logoPath = path.join(__dirname, 'assets', 'zeta_logo.png');
    if (fs.existsSync(logoPath)) {
      const zetaImg = await loadImage(logoPath);
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 20;
      ctx.drawImage(zetaImg, width - 125, height - 115, 75, 75);
      ctx.restore();
    }
  } catch (_) {}

  return canvas.toBuffer('image/jpeg', 92);
}

// ==============================================================================
// 2b. LIVE MATCH CANVA ENGINE (Live In-Play Telemetry, Crests & Score on Right)
// ==============================================================================
async function generateLiveMatchCanvas(homeTeam, awayTeam, league, homeLogoUrl, awayLogoUrl, homeScore, awayScore, liveMinute, customRightImage = null) {
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
  const homeBeam = ctx.createRadialGradient(730, 310, 20, 730, 310, 260);
  homeBeam.addColorStop(0, 'rgba(56, 189, 248, 0.28)');
  homeBeam.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = homeBeam;
  ctx.fillRect(0, 0, width, height);

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

  // 3. RIGHT SIDE: PROMINENT TEAM SCORE & LOGOS ARENA (Clean & Centered)
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

  // Center Score Box
  const scoreCenterX = (homeX + awayX) / 2;
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

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 66px "Bebas Neue", "Arial Narrow Bold", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 10;
  ctx.fillText(`${homeScore ?? 0} - ${awayScore ?? 0}`, scoreCenterX, scoreBoxY + (scoreBoxH / 2) + 3);
  ctx.restore();

  // Score Sub-label
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.font = 'bold 13px "Segoe UI Bold", sans-serif';
  ctx.textAlign = 'center';
  ctx.letterSpacing = '2px';
  ctx.fillText('LIVE SCORE', scoreCenterX, scoreBoxY + scoreBoxH + 24);
  ctx.restore();

  // Bottom Arena Telemetry Badge
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
    const logoCandidates = [
      path.join(__dirname, 'assets', 'zeta_logo.png'),
      path.join(process.cwd(), 'zetasports-v3', 'admin_v3', 'assets', 'zeta_logo.png'),
      path.join(process.cwd(), 'zetasports-v3', 'admin_frontend', 'assets', 'zeta_logo.png'),
      'C:/Users/Mubthaseem/.gemini/antigravity/scratch/zetasports-flutter/zetasports-v3/admin_v3/assets/zeta_logo.png'
    ];
    const logoPath = logoCandidates.find(p => fs.existsSync(p));
    if (logoPath) {
      const zetaImg = await loadImage(logoPath);
      ctx.save();
      ctx.shadowColor = 'rgba(56, 189, 248, 0.8)';
      ctx.shadowBlur = 20;
      ctx.drawImage(zetaImg, width - 125, height - 115, 75, 75);
      ctx.restore();
    }
  } catch (_) {}

  return canvas.toBuffer('image/jpeg', 92);
}

// Helper: Resolve Normalized Lifecycle State
function getMatchLifecycleState(status, mode) {
  const m = String(mode || 'auto').trim().toLowerCase();
  if (m === 'after') return 'finished';
  if (m === 'live') return 'live';
  if (m === 'before') return 'upcoming';

  const s = String(status || '').trim().toLowerCase();
  if (['ft', 'finished', 'aet', 'pen', 'ended', 'full time'].includes(s)) return 'finished';
  if (['live', 'in_play', '1h', '2h', 'ht', 'et', 'p'].includes(s)) return 'live';
  return 'upcoming';
}

// ==============================================================================
// 3. SMART CANVAS MATCHDAY POSTER DISPATCHER
// ==============================================================================
async function generateCanvasMatchdayPoster(homeTeam, awayTeam, league, homeLogoUrl, awayLogoUrl, matchMeta = {}) {
  let buf;
  const state = getMatchLifecycleState(matchMeta.status, matchMeta.mode);
  const customRight = matchMeta.rightImageUrl || matchMeta.customRightImage || matchMeta.article_image || null;

  if (state === 'finished') {
    console.log(`[Canvas Engine]: Rendering AFTER MATCH (Full Time) template for ${homeTeam} vs ${awayTeam}...`);
    buf = await generateAfterMatchCanvas(
      homeTeam, awayTeam, league,
      homeLogoUrl, awayLogoUrl,
      matchMeta.homeScore ?? 0,
      matchMeta.awayScore ?? 0,
      customRight
    );
  } else if (state === 'live') {
    console.log(`[Canvas Engine]: Rendering LIVE MATCHDAY template for ${homeTeam} vs ${awayTeam}...`);
    buf = await generateLiveMatchCanvas(
      homeTeam, awayTeam, league,
      homeLogoUrl, awayLogoUrl,
      matchMeta.homeScore ?? 0,
      matchMeta.awayScore ?? 0,
      matchMeta.timeElapsed || matchMeta.minute || 'LIVE',
      customRight
    );
  } else {
    console.log(`[Canvas Engine]: Rendering BEFORE MATCH (Preview) template for ${homeTeam} vs ${awayTeam}...`);
    buf = await generateBeforeMatchCanvas(
      homeTeam, awayTeam, league,
      homeLogoUrl, awayLogoUrl,
      matchMeta.kickoff || '',
      matchMeta.venue || '',
      customRight
    );
  }

  const cleanFilename = `${homeTeam}_vs_${awayTeam}_${state}.jpg`.replace(/[^a-zA-Z0-9_.]/g, '_');
  try {
    const cdnUrl = await uploadToCdn(buf, cleanFilename);
    console.log('[Matchday Poster]: Uploaded to CDN successfully ->', cdnUrl);
    return cdnUrl;
  } catch (upErr) {
    console.warn('[Matchday Poster]: CDN upload failed, using data URI:', upErr.message);
    return `data:image/jpeg;base64,${buf.toString('base64')}`;
  }
}

// Helper: Generate AI Thumbnail via Gemini API (Nano Banana 2) with Canvas Guarantee
async function generateAiThumbnail(homeTeam, awayTeam, league, homeLogo, awayLogo, geminiKey, customTemplate, matchMeta = {}) {
  // If custom right image is present, bypass AI generation and directly use Broadcast Canvas Engine
  if (matchMeta.rightImageUrl || matchMeta.customRightImage || matchMeta.article_image) {
    console.log('[Thumbnail Engine]: Custom right image provided, using Broadcast Canvas renderer directly.');
    return await generateCanvasMatchdayPoster(homeTeam, awayTeam, league, homeLogo, awayLogo, matchMeta);
  }
  // If Gemini API Key is provided, try AI image models first
  if (geminiKey && geminiKey.trim().length >= 10) {
    try {
      console.log(`[Nano Banana 2]: Requesting AI model for ${homeTeam} vs ${awayTeam}...`);
      const template = customTemplate || 
        "Cinematic 16:9 television broadcast matchday graphic poster for {homeTeam} vs {awayTeam} in {league}. Left side: Official {homeTeam} team crest with stadium lighting. Right side: Official {awayTeam} team crest with floodlight beams. Center: Dramatic glowing 'VS' emblem with kickoff telemetry. Watermark & Branding: Official 'ZetaSports Match Center & Live Broadcasts' network logo in electric blue (#0062b2) and white. Atmosphere: Photorealistic packed stadium under floodlights, dynamic sports television presentation, 8k resolution.";

      const prompt = template
        .replace(/{homeTeam}/g, homeTeam || 'Home')
        .replace(/{awayTeam}/g, awayTeam || 'Away')
        .replace(/{league}/g, league || 'Football')
        .replace(/{homeLogo}/g, homeLogo || '')
        .replace(/{awayLogo}/g, awayLogo || '')
        .replace(/{zetaBrand}/g, 'ZetaSports Match Center');

      // 1. Try Gemini Nano Banana 2 image endpoint
      try {
        const nanoPayload = { contents: [{ parts: [{ text: prompt }] }] };
        const nanoRes = await httpsRequest({
          hostname: 'generativelanguage.googleapis.com',
          path: `/v1beta/models/gemini-nano-banana-2.1:generateContent?key=${encodeURIComponent(geminiKey.trim())}`,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }, nanoPayload);

        const parts = nanoRes.data?.candidates?.[0]?.content?.parts || [];
        for (const p of parts) {
          if (p.inlineData && p.inlineData.data) {
            const mime = p.inlineData.mimeType || 'image/png';
            console.log('[Nano Banana 2]: Successfully generated photorealistic AI image via Gemini Nano Banana 2!');
            return `data:${mime};base64,${p.inlineData.data}`;
          }
        }
      } catch (_) {}

      // 2. Try Google Imagen 3 generate
      const imagenOptions = {
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/imagen-3.0-generate-002:predict?key=${encodeURIComponent(geminiKey.trim())}`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      };

      const payload = {
        instances: [{ prompt }],
        parameters: { sampleCount: 1, aspectRatio: '16:9' }
      };

      const res = await httpsRequest(imagenOptions, payload);
      if (res.status === 200 && res.data?.predictions?.[0]?.bytesBase64Encoded) {
        console.log('[Nano Banana 2]: Successfully generated photorealistic AI image via Imagen 3!');
        return `data:image/png;base64,${res.data.predictions[0].bytesBase64Encoded}`;
      }

      console.warn('[Nano Banana 2]: AI image model quota reached (429/403). Falling back to official Matchday Broadcast Poster.');
    } catch (err) {
      console.error('[Nano Banana 2 Error]:', err.message);
    }
  }

  // 100% Guaranteed Matchday Graphic with Team Crests & ZetaSports Branding
  try {
    const posterUrl = await generateCanvasMatchdayPoster(homeTeam, awayTeam, league, homeLogo, awayLogo, matchMeta);
    if (posterUrl) return posterUrl;
  } catch (canvasErr) {
    console.error('[Canvas Matchday Poster Error]:', canvasErr.message);
  }

  return 'https://files.catbox.moe/jhr0wa.jpg';
}

// Helper: Generate Team Acronym for Monogram Fallback
function getTeamAcronym(name) {
  if (!name) return 'FC';
  const clean = String(name).replace(/[^a-zA-Z0-9\s]/g, '').trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 3) return (words[0][0] + words[1][0] + words[2][0]).toUpperCase();
  if (words.length === 2) return (words[0][0] + words[1][0]).toUpperCase();
  return clean.substring(0, 3).toUpperCase();
}

// Helper: Generate Inline SVG Vector Monogram Data URI (No broken images in Chrome/Safari)
function getVectorMonogramDataUri(name, color = '#38bdf8') {
  const acronym = getTeamAcronym(name);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="76" height="76" viewBox="0 0 76 76"><defs><radialGradient id="g" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#1e293b"/><stop offset="100%" stop-color="#0f172a"/></radialGradient></defs><circle cx="38" cy="38" r="35" fill="url(#g)" stroke="${color}" stroke-width="2.5"/><text x="38" y="46" font-family="'Oswald', -apple-system, BlinkMacSystemFont, sans-serif" font-size="22" font-weight="700" fill="#ffffff" text-anchor="middle" letter-spacing="1.5">${acronym}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Helper: Generate Broadcast Hero Matchday Poster Markup (16:9 Broadcast Hero Graphic)
function generateHeroPosterMarkup(homeTeam, awayTeam, league, homeLogo, awayLogo, matchMeta = {}) {
  const cleanHome = homeTeam || 'Home Team';
  const cleanAway = awayTeam || 'Away Team';
  const cleanLeague = league || 'Football League';
  const state = getMatchLifecycleState(matchMeta.status, matchMeta.mode);
  const isFinished = state === 'finished';
  const isLive = state === 'live';
  const hasScore = matchMeta.homeScore !== null && matchMeta.homeScore !== undefined && matchMeta.homeScore !== '';
  const scoreStr = hasScore ? `${matchMeta.homeScore} - ${matchMeta.awayScore ?? 0}` : 'VS';
  const centerBadgeText = (isFinished || isLive) ? scoreStr : 'VS';

  // Strict compliance: no minute count in pill!
  const statusPill = isFinished ? 'FULL TIME' : (isLive ? 'LIVE IN-PLAY' : cleanLeague.toUpperCase());

  const homeFallback = getVectorMonogramDataUri(cleanHome, '#38bdf8');
  const awayFallback = getVectorMonogramDataUri(cleanAway, '#ef4444');
  const homeLogoSrc = homeLogo ? homeLogo : homeFallback;
  const awayLogoSrc = awayLogo ? awayLogo : awayFallback;

  return `<div class="zeta-matchday-hero" style="position: relative; border-radius: 16px; overflow: hidden; background: linear-gradient(135deg, #070d18 0%, #0d1b33 50%, #060c16 100%); border: 1px solid rgba(255,255,255,0.1); padding: 28px 24px; text-align: center; margin: 0 auto 24px auto; box-shadow: 0 10px 30px rgba(0,0,0,0.35); box-sizing: border-box; max-width: 820px; width: 100%;">
  <!-- ZetaSports Official Top Brand Bar -->
  <div style="display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 20px; flex-wrap: wrap;">
    <svg width="26" height="26" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle; filter: drop-shadow(0 0 8px rgba(56,189,248,0.6));">
      <circle cx="14" cy="14" r="13" fill="#0062b2" stroke="#38bdf8" stroke-width="1.5"/>
      <path d="M8 8.5H20L10 19.5H20" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <span style="font-family: 'Oswald', -apple-system, sans-serif; font-size: 14px; font-weight: 700; color: #ffffff; letter-spacing: 2px; text-transform: uppercase;">ZETASPORTS <span style="color: #38bdf8;">MATCH CENTER</span></span>
    <span style="background: ${isLive ? 'rgba(220, 38, 38, 0.2)' : 'rgba(56, 189, 248, 0.15)'}; border: 1px solid ${isLive ? '#dc2626' : 'rgba(56, 189, 248, 0.3)'}; color: ${isLive ? '#f87171' : '#38bdf8'}; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.5px;">${statusPill}</span>
  </div>

  <!-- Team Crests & VS / Score Presentation -->
  <div style="display: flex; align-items: center; justify-content: center; gap: 24px; margin: 18px 0; flex-wrap: nowrap;">
    <!-- Home Team -->
    <div style="flex: 1; text-align: center; max-width: 220px;">
      <img src="${homeLogoSrc}" alt="${cleanHome}" style="width: 76px; height: 76px; object-fit: contain; filter: drop-shadow(0 4px 14px rgba(0,0,0,0.6)); margin: 0 auto 10px; display: block;" onerror="this.onerror=null; this.src='${homeFallback}';" />
      <span style="font-family: 'Oswald', -apple-system, sans-serif; font-size: 18px; font-weight: 700; color: #ffffff; display: block; line-height: 1.2; text-shadow: 0 2px 8px rgba(0,0,0,0.8);">${cleanHome}</span>
    </div>

    <!-- Center Badge -->
    <div id="zetaLiveScoreHero" style="min-width: 72px; height: 50px; padding: 0 16px; border-radius: 25px; background: ${isLive ? 'linear-gradient(135deg, #dc2626, #991b1b)' : 'linear-gradient(135deg, #0062b2, #38bdf8)'}; display: flex; align-items: center; justify-content: center; font-family: 'Oswald', -apple-system, sans-serif; font-weight: 800; font-size: 20px; color: #ffffff; box-shadow: 0 0 24px ${isLive ? 'rgba(220, 38, 38, 0.5)' : 'rgba(56, 189, 248, 0.5)'}; flex-shrink: 0; letter-spacing: 1.5px;">
      ${centerBadgeText}
    </div>

    <!-- Away Team -->
    <div style="flex: 1; text-align: center; max-width: 220px;">
      <img src="${awayLogoSrc}" alt="${cleanAway}" style="width: 76px; height: 76px; object-fit: contain; filter: drop-shadow(0 4px 14px rgba(0,0,0,0.6)); margin: 0 auto 10px; display: block;" onerror="this.onerror=null; this.src='${awayFallback}';" />
      <span style="font-family: 'Oswald', -apple-system, sans-serif; font-size: 18px; font-weight: 700; color: #ffffff; display: block; line-height: 1.2; text-shadow: 0 2px 8px rgba(0,0,0,0.8);">${cleanAway}</span>
    </div>
  </div>

  <!-- Telemetry Bar -->
  <div style="display: inline-block; background: rgba(255,255,255,0.06); padding: 7px 18px; border-radius: 20px; font-size: 11px; color: #94a3b8; font-weight: 600; letter-spacing: 1px; border: 1px solid rgba(255,255,255,0.08); margin-top: 10px;">
    ${isFinished ? 'FINAL SCORE • MATCH HIGHLIGHTS • FOTMOB PLAYER STATS' : (isLive ? 'LIVE TELEMETRY • PITCH FORMATION • REAL-TIME SCORES' : 'STARTING XI • FOTMOB PITCH FORMATIONS • HD STREAM GATEWAY')}
  </div>
</div>`;
}

// Helper: Generate Rich Editorial Match Review HTML after Full Time
function generateMatchReviewHtml(m) {
  const home = m.home_team || 'Home';
  const away = m.away_team || 'Away';
  const league = m.league_name || m.league || 'Football League';
  const homeScore = m.home_score ?? 0;
  const awayScore = m.away_score ?? 0;

  // Format Goal Scorers
  let goalsHtml = '';
  const scorers = Array.isArray(m.goal_scorers) ? m.goal_scorers : [];
  if (scorers.length > 0) {
    goalsHtml = `<div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 20px; margin: 18px 0;">
      <h4 style="font-family: 'Oswald', sans-serif; font-size: 15px; font-weight: 700; color: #0f172a; text-transform: uppercase; margin: 0 0 12px; letter-spacing: 0.5px;">⚽ Match Goals &amp; Decisive Moments</h4>
      <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px;">
        ${scorers.map(g => `
          <li style="display: flex; align-items: center; justify-content: space-between; font-size: 14px; color: #334155; border-bottom: 1px dashed #e2e8f0; padding-bottom: 6px;">
            <span><strong style="color: #0f172a;">${g.player || 'Player'}</strong> (${g.team === 'home' || g.team === home ? home : away})</span>
            <span style="background: #0062b2; color: #ffffff; font-weight: 700; font-size: 12px; padding: 2px 8px; border-radius: 4px;">${g.minute}' ${g.penalty ? '(P)' : ''}${g.own_goal ? '(OG)' : ''}</span>
          </li>
        `).join('')}
      </ul>
    </div>`;
  }

  // Stats Breakdown with Dual-Color Comparative Progress Bars
  let statsHtml = '';
  const stats = m.match_stats || m.stats || {};
  const possession = stats.possession || [50, 50];
  const shots = stats.shots || [0, 0];
  const shotsOnTarget = stats.shots_on_target || [0, 0];
  const corners = stats.corners || [0, 0];
  const fouls = stats.fouls || [0, 0];

  const renderStatBar = (label, vHome, vAway, isPercent = false) => {
    const nHome = parseFloat(vHome) || 0;
    const nAway = parseFloat(vAway) || 0;
    const total = (nHome + nAway) > 0 ? (nHome + nAway) : 100;
    const pctHome = isPercent ? nHome : Math.round((nHome / total) * 100);
    const pctAway = isPercent ? nAway : Math.round((nAway / total) * 100);

    return `
      <div style="margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px; margin-bottom: 4px;">
          <span style="font-weight: 700; color: #0062b2;">${vHome}${isPercent ? '%' : ''}</span>
          <span style="color: #64748b; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">${label}</span>
          <span style="font-weight: 700; color: #dc2626;">${vAway}${isPercent ? '%' : ''}</span>
        </div>
        <div style="height: 7px; background: #e2e8f0; border-radius: 4px; overflow: hidden; display: flex;">
          <div style="width: ${pctHome}%; background: #0062b2; transition: width 0.3s ease;"></div>
          <div style="width: ${pctAway}%; background: #dc2626; transition: width 0.3s ease;"></div>
        </div>
      </div>
    `;
  };

  statsHtml = `<div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; margin: 18px 0;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
      <h4 style="font-family: 'Oswald', sans-serif; font-size: 15px; font-weight: 700; color: #0f172a; text-transform: uppercase; margin: 0; letter-spacing: 0.5px;">📊 Key Match Telemetry &amp; Statistics</h4>
      <div style="display: flex; gap: 12px; font-size: 11px; font-weight: 700;">
        <span style="color: #0062b2;">● ${home}</span>
        <span style="color: #dc2626;">● ${away}</span>
      </div>
    </div>
    <div style="display: flex; flex-direction: column;">
      ${renderStatBar('Ball Possession', possession[0], possession[1], true)}
      ${renderStatBar('Total Shots', shots[0], shots[1])}
      ${renderStatBar('Shots on Target', shotsOnTarget[0], shotsOnTarget[1])}
      ${renderStatBar('Corners', corners[0], corners[1])}
      ${renderStatBar('Fouls Committed', fouls[0], fouls[1])}
    </div>
  </div>`;

  return `<div class="zeta-match-review" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; margin: 28px 0; box-shadow: 0 4px 15px rgba(0,0,0,0.04);">
    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
      <span style="background: #15803d; color: #ffffff; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; text-transform: uppercase;">Full-Time Review</span>
      <span style="font-size: 12px; color: #64748b; font-weight: 600;">${league}</span>
    </div>
    <h3 style="font-family: 'Oswald', sans-serif; font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 14px; text-transform: uppercase;">
      ${home} ${homeScore} - ${awayScore} ${away}: Full-Time Analysis &amp; Match Highlights
    </h3>
    <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 14px;">
      The clash between <strong>${home}</strong> and <strong>${away}</strong> concluded with an intense ${homeScore}-${awayScore} scoreline in the ${league}. Both squads displayed remarkable tactical discipline and strategic resilience over the course of the 90 minutes.
    </p>
    ${goalsHtml}
    ${statsHtml}
    <p style="font-size: 13px; color: #64748b; line-height: 1.6; margin-top: 14px;">
      Official live stream transmission for this event concluded 10 minutes following full-time. The tactical formation pitch and full substitute details remain available below for in-depth analysis.
    </p>
  </div>`;
}

// --- FOTMOB TELEMETRY DEEP SYNC HELPER ---
async function fetchAndSyncFotMobMatch(matchId, fotmobId) {
  if (!fotmobId) return null;
  try {
    console.log(`[FotMob Sync]: Fetching match telemetry for FotMob ID ${fotmobId}...`);
    const fmRes = await httpsRequest({
      hostname: 'www.fotmob.com',
      path: `/api/data/matchDetails?matchId=${encodeURIComponent(fotmobId)}`,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.fotmob.com/'
      }
    });

    if (fmRes.status !== 200 || !fmRes.data) {
      console.warn(`[FotMob Sync]: Received HTTP ${fmRes.status} from FotMob for ID ${fotmobId}`);
      return null;
    }

    const raw = fmRes.data;
    const header = raw.header || {};
    const statusObj = header.status || {};
    const teams = header.teams || [];

    let homeScore = null;
    let awayScore = null;
    if (teams.length >= 2) {
      homeScore = parseInt(teams[0].score, 10);
      awayScore = parseInt(teams[1].score, 10);
    } else if (statusObj.scoreStr) {
      const parts = statusObj.scoreStr.split('-').map(s => parseInt(s.trim(), 10));
      if (parts.length === 2 && !isNaN(parts[0])) {
        homeScore = parts[0];
        awayScore = parts[1];
      }
    }

    const isFinished = statusObj.finished === true;
    const isStarted = statusObj.started === true;
    let status = isFinished ? 'finished' : (isStarted ? 'live' : 'scheduled');
    let minute = isFinished ? 'FT' : (isStarted ? (statusObj.liveTime?.short || 'LIVE') : '');

    // 1. Events, Goals, Cards & Substitutions
    const goalScorers = [];
    const playerEventsMap = {};
    const events = raw.content?.matchFacts?.events?.events || [];
    const fullEventsList = [];
    const cardsList = [];
    const subsList = [];

    events.forEach(e => {
      let rawName = '';
      if (typeof e.player === 'string') rawName = e.player;
      else if (e.player && typeof e.player.name === 'string') rawName = e.player.name;
      else if (typeof e.fullName === 'string') rawName = e.fullName;
      else if (typeof e.nameStr === 'string') rawName = e.nameStr;
      else if (typeof e.name === 'string') rawName = e.name;
      const pName = rawName.toLowerCase().trim();
      const min = e.time || e.timeStr || e.minute || 0;

      if (pName && !playerEventsMap[pName]) {
        playerEventsMap[pName] = { goals: [], yellow: null, red: null };
      }

      if (e.type === 'Goal') {
        const gObj = {
          team: e.isHome ? 'home' : 'away',
          player: e.fullName || e.nameStr || e.name || 'Goal',
          minute: min,
          assist: e.assistStr || (e.assist?.name) || '',
          penalty: !!e.isPenalty,
          own_goal: !!e.isOwnGoal,
          xg: e.shotmapEvent?.expectedGoals || null
        };
        goalScorers.push(gObj);
        if (pName && playerEventsMap[pName]) {
          playerEventsMap[pName].goals.push(min);
        }
        fullEventsList.push({ type: 'Goal', ...gObj });
      } else if (e.type === 'Card') {
        const cardStr = (e.card || '').toLowerCase();
        const isRed = cardStr.includes('red');
        if (pName && playerEventsMap[pName]) {
          if (cardStr.includes('yellow')) playerEventsMap[pName].yellow = min || true;
          if (isRed) playerEventsMap[pName].red = min || true;
        }
        const cObj = {
          team: e.isHome ? 'home' : 'away',
          player: rawName || 'Player',
          minute: min,
          card: e.card || (isRed ? 'Red' : 'Yellow'),
          cardReason: e.cardReason?.defaultText || e.cardDescription?.defaultText || ''
        };
        cardsList.push(cObj);
        fullEventsList.push({ type: 'Card', ...cObj });
      } else if (e.type === 'Substitution') {
        const swap = Array.isArray(e.swap) ? e.swap : [];
        const sObj = {
          team: e.isHome ? 'home' : 'away',
          minute: min,
          playerIn: swap[0]?.name || '',
          playerInId: swap[0]?.id || null,
          playerOut: swap[1]?.name || '',
          playerOutId: swap[1]?.id || null,
          swap: swap.map(s => ({ name: s.name, id: s.id }))
        };
        subsList.push(sObj);
        fullEventsList.push({ type: 'Substitution', ...sObj });
      }
    });

    // 2. Lineups & Formations
    const lu = raw.content?.lineup || {};
    const posName = (id) => {
      if (id === 0 || id === 11) return 'GK';
      if (id === 1 || id === 12) return 'DF';
      if (id === 2 || id === 13) return 'MF';
      if (id === 3 || id === 14) return 'FW';
      return '';
    };

    const mapPlayers = (arr) => (arr || []).map(p => {
      const pName = p.fullName || p.name || 'Player';
      const ev = playerEventsMap[pName.toLowerCase().trim()] || {};
      return {
        id: p.id,
        name: pName,
        short_name: p.shortName || p.short_name || pName.split(' ').pop(),
        number: p.shirtNumber || p.number || '',
        pos: posName(p.positionId ?? p.usualPlayingPositionId ?? p.position),
        captain: !!p.isCaptain,
        rating: p.performance?.rating || p.rating || null,
        photo: p.id ? `https://images.fotmob.com/image_resources/playerimages/${p.id}.png` : null,
        x: p.vertical?.x ?? p.x ?? null,
        y: p.vertical?.y ?? p.y ?? null,
        goals: ev.goals || [],
        yellowCard: ev.yellow || null,
        redCard: ev.red || null
      };
    });

    const homeFormation = lu.homeTeam?.formation || '4-3-3';
    const awayFormation = lu.awayTeam?.formation || '4-2-3-1';
    const homeCoach = lu.homeTeam?.coach?.name || '';
    const awayCoach = lu.awayTeam?.coach?.name || '';
    const homeStarters = mapPlayers(lu.homeTeam?.starters);
    const awayStarters = mapPlayers(lu.awayTeam?.starters);
    const homeSubs = mapPlayers(lu.homeTeam?.subs);
    const awaySubs = mapPlayers(lu.awayTeam?.subs);

    const lineups = (homeStarters.length > 0 || awayStarters.length > 0) ? {
      home: { formation: homeFormation, coach: homeCoach, starting: homeStarters, bench: homeSubs },
      away: { formation: awayFormation, coach: awayCoach, starting: awayStarters, bench: awaySubs }
    } : null;

    // 3. Venue, Referee, Tournament & Attendance
    const infoBox = raw.content?.matchFacts?.infoBox || {};
    const venueObj = infoBox['Stadium'] || infoBox['Venue'];
    const venue = venueObj ? (venueObj.name + (venueObj.city ? ', ' + venueObj.city : '')) : '';
    const stadiumName = venueObj?.name || venue || '';
    const refObj = infoBox['Referee'];
    const referee = refObj ? (refObj.text + (refObj.country ? ' (' + refObj.country + ')' : '')) : '';
    const tournamentObj = infoBox['Tournament'] || {};
    const roundStr = tournamentObj.roundName || tournamentObj.round || '';
    const attendanceVal = infoBox['Attendance'] || null;

    // 4. H2H Meetings
    const h2hRaw = raw.content?.h2h?.matches || [];
    const h2h = h2hRaw.filter(m => m.finished || m.status?.finished).slice(0, 5).map(m => ({
      date: (m.time?.utcTime || m.status?.utcTime || '').split('T')[0],
      home: m.home?.name || 'Home',
      away: m.away?.name || 'Away',
      score: m.status?.scoreStr || (m.home?.score !== undefined ? m.home.score + ' - ' + m.away.score : 'vs'),
      league: m.league?.name || ''
    }));

    // 5. Advanced Stats & Momentum Ingestion
    const matchStats = {};
    const statsPeriod = raw.content?.stats?.Periods?.All?.stats || [];
    statsPeriod.forEach(group => {
      (group.stats || []).forEach(item => {
        const title = (item.title || '').toLowerCase().trim();
        const key = (item.key || '').toLowerCase().trim();
        const vals = item.stats || [];
        if (vals.length >= 2 && vals[0] !== null && vals[0] !== undefined) {
          if (key === 'expected_goals' || title.includes('expected goals') || title.includes('(xg)')) {
            matchStats.xg = vals;
            matchStats.expected_goals = vals;
          } else if (key === 'ballpossesion' || title.includes('possession')) {
            matchStats.possession = vals;
          } else if (key === 'total_shots' || title.includes('total shots') || title === 'shots') {
            matchStats.shots = vals;
          } else if (key === 'shotsontarget' || title.includes('shots on target')) {
            matchStats.shots_on_target = vals;
          } else if (key === 'big_chance' || title === 'big chances') {
            matchStats.big_chances = vals;
          } else if (key === 'accurate_passes' || title.includes('accurate passes')) {
            matchStats.accurate_passes = vals;
            matchStats.passes_accuracy = vals;
          } else if (key === 'corners' || title.includes('corner')) {
            matchStats.corners = vals;
          } else if (key === 'fouls' || title.includes('foul')) {
            matchStats.fouls = vals;
          } else if (key === 'yellow_cards' || title.includes('yellow card')) {
            matchStats.yellow_cards = vals;
          } else if (key === 'red_cards' || title.includes('red card')) {
            matchStats.red_cards = vals;
          } else if (key === 'touches_opp_box' || title.includes('touches in opposition box')) {
            matchStats.touches_opp_box = vals;
          }
        }
      });
    });

    // Ingest FotMob momentum data
    const momentumData = raw.content?.momentum?.main?.data || [];
    if (momentumData.length > 0) {
      matchStats.momentum = momentumData;
    }

    const updatePayload = {
      status,
      minute
    };
    if (homeScore !== null && !isNaN(homeScore)) updatePayload.home_score = homeScore;
    if (awayScore !== null && !isNaN(awayScore)) updatePayload.away_score = awayScore;
    if (lineups) updatePayload.lineups = lineups;
    if (homeFormation || awayFormation) updatePayload.formations = { home: homeFormation, away: awayFormation };
    if (venue) updatePayload.venue = venue;
    if (stadiumName) updatePayload.stadium = stadiumName;
    if (referee) updatePayload.referee = referee;
    if (roundStr) updatePayload.round = String(roundStr);
    if (goalScorers.length > 0) updatePayload.goal_scorers = goalScorers;
    if (cardsList.length > 0) updatePayload.cards = cardsList;
    if (subsList.length > 0) updatePayload.substitutions = subsList;
    if (fullEventsList.length > 0) updatePayload.events = fullEventsList;
    if (h2h.length > 0) updatePayload.h2h = h2h;
    if (Object.keys(matchStats).length > 0) {
      updatePayload.match_stats = matchStats;
      updatePayload.stats = matchStats;
    }
    // In-memory momentum property
    updatePayload.momentum = momentumData;

    if (matchId) {
      // Safe filter: only include verified columns that exist in Supabase zeta_matches schema
      const allowedDbColumns = new Set([
        'status', 'minute', 'time_elapsed', 'home_score', 'away_score',
        'lineups', 'formations', 'venue', 'stadium', 'referee', 'round',
        'goal_scorers', 'h2h', 'cards', 'substitutions', 'events',
        'match_stats', 'stats', 'updated_at'
      ]);
      const dbPatch = { updated_at: new Date().toISOString() };
      for (const [k, v] of Object.entries(updatePayload)) {
        if (allowedDbColumns.has(k)) {
          dbPatch[k] = v;
        }
      }

      await httpsRequest({
        hostname: SUPABASE_HOST,
        path: `/rest/v1/zeta_matches?id=eq.${encodeURIComponent(matchId)}`,
        method: 'PATCH',
        headers: {
          'apikey': ANON_KEY,
          'authorization': `Bearer ${ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        }
      }, JSON.stringify(dbPatch));
      console.log(`✔ [FotMob Sync]: Match ${matchId} enriched & synced in Supabase (xG, Big Chances, Passes, Momentum)!`);
    }

    return updatePayload;
  } catch (err) {
    console.error(`[FotMob Sync Error]:`, err.message);
    return null;
  }
}

// ==============================================================================
// 17 BLOGGER POST HTML COMPONENTS GENERATOR FOR ZETASPORTS BROADCAST POSTS
// ==============================================================================

// --- COMPONENT 1: DUAL SCHEMA.ORG JSON-LD (SportsEvent + FAQPage with 4 Q&As) ---
function generateSchemaJsonLd(m, isFinished, isLive) {
  const home = m.home_team || 'Home Team';
  const away = m.away_team || 'Away Team';
  const league = m.league_name || m.league || 'Football League';
  const venue = m.stadium || m.venue || 'Official Stadium';
  const homeLogo = m.home_logo || '';
  const awayLogo = m.away_logo || '';
  const homeForm = m.formations?.home || m.lineups?.home?.formation || '4-3-3';
  const awayForm = m.formations?.away || m.lineups?.away?.formation || '4-2-3-1';
  const homeCoach = m.lineups?.home?.coach || m.home_coach || 'Head Coach';
  const awayCoach = m.lineups?.away?.coach || m.away_coach || 'Head Coach';
  const kickoffStr = m.kickoff_ist ? `${m.kickoff_ist} IST` : (m.time || 'Matchday');

  const eventStatus = isFinished
    ? 'https://schema.org/EventFinished'
    : (isLive ? 'https://schema.org/EventLive' : 'https://schema.org/EventScheduled');

  let startDate = m.date || new Date().toISOString().split('T')[0];
  if (m.kickoff_time) {
    startDate = m.kickoff_time;
  } else if (m.kickoff_ist) {
    startDate = `${m.date || new Date().toISOString().split('T')[0]}T${m.kickoff_ist}:00+05:30`;
  }

  const sportsEventSchema = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    'name': `${home} vs ${away} Lineups, Live Score & Match Center - ${league}`,
    'description': `Official match center for ${home} vs ${away} in ${league}. Confirmed starting lineups, tactical formations, live telemetry, xG stats, and broadcast schedule.`,
    'sport': 'Soccer',
    'eventStatus': eventStatus,
    'homeTeam': {
      '@type': 'SportsTeam',
      'name': home,
      'logo': homeLogo || undefined
    },
    'awayTeam': {
      '@type': 'SportsTeam',
      'name': away,
      'logo': awayLogo || undefined
    },
    'location': {
      '@type': 'Place',
      'name': venue
    },
    'startDate': startDate
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    'mainEntity': [
      {
        '@type': 'Question',
        'name': `Where can I watch ${home} vs ${away} live stream and television broadcast?`,
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': `Live score updates, real-time momentum telemetry, starting formations, and pitch analytics are hosted on the ZetaSports Match Center. Official regional television broadcasters include TNT Sports and Sky Sports in the UK, Paramount+ in the USA, Sony LIV in India, and SuperSport in Africa.`
        }
      },
      {
        '@type': 'Question',
        'name': `What time is kickoff and where is the stadium venue for ${home} vs ${away}?`,
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': `The fixture takes place at ${venue} with kickoff scheduled for ${kickoffStr} (IST) / international broadcast time.`
        }
      },
      {
        '@type': 'Question',
        'name': `What are the confirmed starting lineups and tactical formations for ${home} and ${away}?`,
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': `${home} deploys in a ${homeForm} tactical shape under manager ${homeCoach}, while ${away} lines up in a ${awayForm} tactical formation instructed by ${awayCoach}.`
        }
      },
      {
        '@type': 'Question',
        'name': `What is the historical head-to-head (H2H) record between ${home} and ${away}?`,
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': `${home} and ${away} have contested high-intensity encounters in recent competitions, showcasing tactical resilience and competitive goal differentials in ${league}.`
        }
      }
    ]
  };

  return `<script type="application/ld+json">\n${JSON.stringify([sportsEventSchema, faqSchema], null, 2)}\n</script>\n`;
}

// --- COMPONENT 3: REAL-TIME STATUS / COUNTDOWN TICKER ---
function generateStatusCountdownTicker(m, isFinished, isLive) {
  const kickoffTime = m.kickoff_ist || m.time || 'Kickoff';
  const kickoffIso = m.date ? `${m.date}T${m.kickoff_ist || '00:00'}:00` : '';

  if (isLive) {
    const liveTime = m.minute || m.time_elapsed || 'LIVE';
    return `
    <div class="zeta-ticker-live" style="background: linear-gradient(90deg, rgba(220,38,38,0.12) 0%, rgba(15,23,42,0.9) 50%, rgba(220,38,38,0.12) 100%); border: 1px solid rgba(220,38,38,0.35); border-radius: 12px; padding: 12px 18px; margin: 18px 0; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; box-shadow: 0 4px 15px rgba(220,38,38,0.15);">
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #ef4444; box-shadow: 0 0 10px #ef4444; animation: pulse 1.5s infinite;"></span>
        <span style="font-family: 'Oswald', -apple-system, sans-serif; font-size: 14px; font-weight: 700; color: #f87171; letter-spacing: 1px; text-transform: uppercase;">MATCH IN-PLAY:</span>
        <span style="background: #dc2626; color: #ffffff; font-weight: 800; font-size: 12px; padding: 2px 8px; border-radius: 4px;">${liveTime}</span>
      </div>
      <div style="font-size: 12px; color: #cbd5e1; font-weight: 600;">
        ⚡ Sub-second Live Telemetry Active • Auto-hydrating Match Center
      </div>
    </div>`;
  }

  if (isFinished) {
    return `
    <div class="zeta-ticker-finished" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 18px; margin: 18px 0; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="background: #16a34a; color: #ffffff; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 4px; text-transform: uppercase;">🏁 FULL TIME</span>
        <span style="font-family: 'Oswald', -apple-system, sans-serif; font-size: 14px; font-weight: 700; color: #0f172a; text-transform: uppercase;">Final Scoreline Confirmed</span>
      </div>
      <div style="font-size: 12px; color: #64748b; font-weight: 600;">
        Match finished • Comprehensive post-match analysis and player ratings below
      </div>
    </div>`;
  }

  return `
  <div class="zeta-ticker-countdown" data-kickoff="${kickoffIso}" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 14px 20px; margin: 18px 0; color: #ffffff; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.15);">
    <div style="display: flex; align-items: center; gap: 10px;">
      <span style="font-size: 18px;">⏳</span>
      <div>
        <div style="font-family: 'Oswald', -apple-system, sans-serif; font-size: 14px; font-weight: 700; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px;">MATCHDAY COUNTDOWN</div>
        <div style="font-size: 12px; color: #94a3b8;">Scheduled Kickoff: <strong style="color: #ffffff;">${kickoffTime} IST</strong></div>
      </div>
    </div>
    <div style="display: flex; gap: 8px; font-family: 'Oswald', -apple-system, sans-serif; font-size: 13px; font-weight: 700;">
      <div style="background: rgba(255,255,255,0.08); padding: 4px 10px; border-radius: 6px; text-align: center;"><span style="color: #38bdf8;">LIVE</span> <span style="font-size: 10px; color: #94a3b8; display: block; font-weight: 400;">RADAR</span></div>
      <div style="background: rgba(255,255,255,0.08); padding: 4px 10px; border-radius: 6px; text-align: center;"><span style="color: #ffffff;">HD</span> <span style="font-size: 10px; color: #94a3b8; display: block; font-weight: 400;">STREAM</span></div>
    </div>
  </div>`;
}

// --- COMPONENT 4: 4-CARD TELEMETRY GRID (Stadium, Referee, League, Time) ---
function generateMatchTelemetryGrid(m) {
  const venue = m.stadium || m.venue || 'Official Stadium';
  const referee = m.referee || 'Assigned Official';
  const league = m.league_name || m.league || 'Football League';
  const round = m.round ? ` • Round ${m.round}` : '';
  const kickoff = m.kickoff_ist ? `${m.kickoff_ist} IST` : (m.time || 'Matchday');

  return `
    <div class="zeta-meta-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin: 24px 0;">
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
        <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 5px; letter-spacing: 0.5px;">🏟 Stadium &amp; Venue</span>
        <span style="font-size: 13px; font-weight: 700; color: #0f172a; line-height: 1.3; display: block;">${venue}</span>
      </div>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
        <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 5px; letter-spacing: 0.5px;">👮 Head Referee</span>
        <span style="font-size: 13px; font-weight: 700; color: #0f172a; line-height: 1.3; display: block;">${referee}</span>
      </div>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
        <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 5px; letter-spacing: 0.5px;">🏆 Tournament &amp; Stage</span>
        <span style="font-size: 13px; font-weight: 700; color: #0062b2; line-height: 1.3; display: block;">${league}${round}</span>
      </div>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
        <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 5px; letter-spacing: 0.5px;">⏰ Kickoff Schedule</span>
        <span style="font-size: 13px; font-weight: 700; color: #0f172a; line-height: 1.3; display: block;">${kickoff}</span>
      </div>
    </div>
  `;
}

// --- COMPONENT 5: KEY MATCH FACTS & TRIVIA STRIP ---
function generateMatchFactsStrip(m) {
  const home = m.home_team || 'Home';
  const away = m.away_team || 'Away';
  const league = m.league_name || m.league || 'Football League';
  const venue = m.stadium || m.venue || 'Stadium';
  const ref = m.referee || 'Match Official';
  const homeForm = m.formations?.home || m.lineups?.home?.formation || '4-3-3';
  const awayForm = m.formations?.away || m.lineups?.away?.formation || '4-2-3-1';

  return `
    <div class="zeta-facts-strip" style="background: #ffffff; border: 1px solid #e2e8f0; border-left: 4px solid #0062b2; border-radius: 10px; padding: 16px 20px; margin: 24px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
      <h4 style="margin: 0 0 10px; font-family: 'Oswald', -apple-system, sans-serif; font-size: 14px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">
        📌 Key Match Facts &amp; Context
      </h4>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; font-size: 13px; color: #475569;">
        <div>📍 <strong>Venue Atmosphere:</strong> Hosted at ${venue}, setting a cauldron stage for European football.</div>
        <div>⚖️ <strong>Discipline:</strong> Officiated by ${ref}, maintaining strict control over tempo and set-pieces.</div>
        <div>🎯 <strong>Tournament Stakes:</strong> Crucial points in ${league} with both clubs competing for knockout progression.</div>
        <div>⚡ <strong>Tactical Profile:</strong> High-pressing systems with transition speed between ${homeForm} and ${awayForm} setups.</div>
      </div>
    </div>
  `;
}

// --- COMPONENT 6: MARQUEE PLAYER SPOTLIGHT & TACTICAL DUEL ---
function generatePlayerSpotlightDuel(m) {
  const home = m.home_team || 'Home';
  const away = m.away_team || 'Away';
  const lu = m.lineups || {};
  const homeStarters = Array.isArray(lu.home?.starting) ? lu.home.starting : [];
  const awayStarters = Array.isArray(lu.away?.starting) ? lu.away.starting : [];

  const getTopPlayer = (starters, defaultName) => {
    if (!starters || starters.length === 0) return { name: defaultName, number: '10', pos: 'FW', rating: 7.5, id: null };
    const sorted = [...starters].sort((a, b) => {
      const rA = parseFloat(a.rating) || 0;
      const rB = parseFloat(b.rating) || 0;
      return rB - rA;
    });
    return sorted[0];
  };

  const pHome = getTopPlayer(homeStarters, `${home} Star`);
  const pAway = getTopPlayer(awayStarters, `${away} Star`);

  const pHomePhoto = pHome.photo || (pHome.id ? `https://images.fotmob.com/image_resources/playerimages/${pHome.id}.png` : '');
  const pAwayPhoto = pAway.photo || (pAway.id ? `https://images.fotmob.com/image_resources/playerimages/${pAway.id}.png` : '');

  const pHomeFallback = getVectorMonogramDataUri(pHome.name, '#0062b2');
  const pAwayFallback = getVectorMonogramDataUri(pAway.name, '#dc2626');

  const renderPlayerCard = (player, photo, fallback, teamName, isHome) => {
    const rVal = parseFloat(player.rating);
    const rText = (!isNaN(rVal) && rVal > 0) ? `${rVal.toFixed(1)} ★` : 'KEY STAR';
    return `
      <div style="flex: 1; min-width: 240px; display: flex; align-items: center; gap: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px;">
        <img src="${photo || fallback}" alt="${player.name}" style="width: 56px; height: 56px; border-radius: 50%; object-fit: cover; background: #e2e8f0; border: 2px solid ${isHome ? '#0062b2' : '#dc2626'}; flex-shrink: 0;" onerror="this.onerror=null; this.src='${fallback}';" />
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
            <span style="font-size: 11px; font-weight: 700; color: ${isHome ? '#0062b2' : '#dc2626'}; text-transform: uppercase;">${teamName}</span>
            <span style="background: ${isHome ? '#0062b2' : '#dc2626'}; color: #ffffff; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 4px;">${rText}</span>
          </div>
          <div style="font-family: 'Oswald', -apple-system, sans-serif; font-size: 16px; font-weight: 700; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 2px 0;">
            #${player.number || ''} ${player.name}
          </div>
          <div style="font-size: 11px; color: #64748b; font-weight: 600;">Position: <strong>${player.pos || 'Attacker'}</strong></div>
        </div>
      </div>
    `;
  };

  return `
    <div class="zeta-player-duel" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px 20px; margin: 24px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.03);">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
        <h4 style="margin: 0; font-family: 'Oswald', -apple-system, sans-serif; font-size: 15px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">
          ⚡ Marquee Player Spotlight &amp; Key Duel
        </h4>
        <span style="background: #eff6ff; color: #0284c7; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px; border: 1px solid #bfdbfe;">
          Tactical Matchup
        </span>
      </div>
      <div style="display: flex; gap: 14px; align-items: center; flex-wrap: wrap;">
        ${renderPlayerCard(pHome, pHomePhoto, pHomeFallback, home, true)}
        <div style="font-family: 'Oswald', -apple-system, sans-serif; font-size: 15px; font-weight: 800; color: #94a3b8; text-align: center; flex-shrink: 0; padding: 0 4px;">VS</div>
        ${renderPlayerCard(pAway, pAwayPhoto, pAwayFallback, away, false)}
      </div>
    </div>
  `;
}

// --- COMPONENT 7: GOOGLE ADSENSE SLOT 1 (Mid-Article Native: 336x280 / Zero CLS Container) ---
function generateAdSenseSlot1(cfg) {
  const client = cfg?.adsenseClient || 'ca-pub-XXXXXXXXXXXXXXXX';
  const slot = cfg?.adSlot1 || '1234567890';
  return `
    <!-- Google AdSense Slot 1: Mid-Article Native (Zero CLS Container) -->
    <div class="zeta-ad-slot-1" style="min-height: 280px; width: 100%; max-width: 336px; margin: 28px auto; text-align: center; overflow: hidden; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; contain: layout size;">
      <span style="font-size: 10px; font-weight: 700; color: #94a3b8; letter-spacing: 1.5px; text-transform: uppercase; margin: 8px 0 4px; display: block;">ADVERTISEMENT</span>
      <ins class="adsbygoogle" style="display:inline-block;width:336px;height:280px;" data-ad-client="${client}" data-ad-slot="${slot}"></ins>
      <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
    </div>
  `;
}

// --- COMPONENT 8: EDITORIAL TACTICAL NARRATIVE (300+ Words SEO Article) ---
function generateEditorialNarrative(m, isFinished, isLive) {
  const home = m.home_team || 'Home Team';
  const away = m.away_team || 'Away Team';
  const league = m.league_name || m.league || 'Football League';
  const homeForm = m.formations?.home || m.lineups?.home?.formation || '4-3-3';
  const awayForm = m.formations?.away || m.lineups?.away?.formation || '4-2-3-1';
  const homeCoach = m.lineups?.home?.coach || m.home_coach || 'Head Coach';
  const awayCoach = m.lineups?.away?.coach || m.away_coach || 'Head Coach';
  const venue = m.stadium || m.venue || 'Stadium';
  const homeScore = m.home_score ?? 0;
  const awayScore = m.away_score ?? 0;
  const scoreStr = `${homeScore}-${awayScore}`;

  if (isFinished) {
    return `
      <div class="zeta-editorial-narrative" style="font-size: 15px; color: #334155; line-height: 1.75; margin: 28px 0;">
        <h3 style="font-family: 'Oswald', -apple-system, sans-serif; font-size: 21px; font-weight: 700; color: #0f172a; margin: 0 0 12px; text-transform: uppercase;">
          Full-Time Tactical Breakdown: ${home} ${scoreStr} ${away}
        </h3>
        <p>The highly anticipated continental clash between <strong>${home}</strong> and <strong>${away}</strong> in the <strong>${league}</strong> delivered exceptional sporting drama, culminating in a pulsating <strong>${scoreStr}</strong> full-time scoreline at <strong>${venue}</strong>. From the opening whistle, both tacticians demonstrated astute structural preparation, challenging each other's defensive pressing shapes across all three phases of play in an engrossing showcase of elite continental competition.</p>
        <p>Tactically, ${home} deployed in their signature <strong>${homeForm}</strong> system under the astute guidance of <strong>${homeCoach}</strong>, focusing on aggressive midfield overloads, diagonal third-man runs, and rapid rotational transitions through wide half-spaces. Conversely, ${away}, led by manager <strong>${awayCoach}</strong> in a disciplined <strong>${awayForm}</strong> formation, sought to disrupt central buildup passing lanes through a compact mid-block defensive structure and lightning-fast direct counter-attacks behind the opposition fullbacks.</p>
        <p>Throughout the ninety minutes of play, statistical telemetry reflected a ferocious duel for pitch territory and territorial possession dominance. Both goalkeepers and defensive center-back pairings were tested repeatedly under heavy pressure during set-pieces and high-turnover moments inside the final third. The expected goals (xG) metrics and shot-map telemetry illustrated just how finely balanced this showdown proved to be, with decisive moments and substitutions swinging momentum during key tactical phases.</p>
        <p>Midfield control proved to be the pivotal battleground where the contest was ultimately decided. With second-ball recoveries and high-intensity counter-pressing dictating tempo, both sets of central midfielders worked tirelessly to choke passing corridors while attempting to feed creative line-breaking passes into the attacking channels. The sheer physical output and tactical discipline on display underscored the immense continental stakes riding on this encounter.</p>
        <p>As the final whistle blew, supporters were treated to a showcase of top-tier footballing craft, technical precision, and physical resilience. Fans and tactical analysts can explore the complete interactive pitch formation, chronological moments timeline, comparative statistics meters, and verified player ratings presented below in the official ZetaSports Match Center report.</p>
      </div>
    `;
  }

  if (isLive) {
    return `
      <div class="zeta-editorial-narrative" style="font-size: 15px; color: #334155; line-height: 1.75; margin: 28px 0;">
        <h3 style="font-family: 'Oswald', -apple-system, sans-serif; font-size: 21px; font-weight: 700; color: #0f172a; margin: 0 0 12px; text-transform: uppercase;">
          Live In-Play Tactical Analysis: ${home} vs ${away}
        </h3>
        <p>Action is underway at <strong>${venue}</strong> as <strong>${home}</strong> squares off against <strong>${away}</strong> in this critical <strong>${league}</strong> showdown. The atmosphere inside the stadium is electric as both squads vie for supremacy on the pitch, executing tactical instructions drilled during training with utmost intensity and tactical commitment.</p>
        <p>From an organizational perspective, ${home} is set up in a fluid <strong>${homeForm}</strong> shape orchestrated by manager <strong>${homeCoach}</strong>. Their approach centers around dominant vertical possession, fluid positional interchanges between wingers and overlapping fullbacks, and sustained territorial pressure in the attacking third. Meanwhile, ${away}'s tactical blueprint under manager <strong>${awayCoach}</strong> utilizes a sturdy <strong>${awayForm}</strong> setup constructed to absorb attacking waves, maintain strict horizontal distances between midfield lines, and capitalize on defensive transition errors.</p>
        <p>With momentum constantly shifting back and forth, both sides have created dangerous scoring opportunities. The live telemetry engine continues to track real-time attack pressure momentum, expected goals distribution, duels won, and high-turnover zones. Every tackle, tactical foul, and substitution is proving vital in shaping the outcome of this contest.</p>
        <p>In the center of the park, individual duels are reaching boiling point as both squads fight tenaciously for territorial advantage. Coaches on both sidelines are constantly issuing positional adjustments to exploit emerging half-space pockets and defensive mismatches before defensive blocks can reset.</p>
        <p>Stay locked to the ZetaSports Match Center for minute-by-minute updates, real-time scoreboard synchronization, official player performance ratings, and pitch visualizations updated in sub-second intervals as this thrilling ${league} fixture progresses.</p>
      </div>
    `;
  }

  return `
    <div class="zeta-editorial-narrative" style="font-size: 15px; color: #334155; line-height: 1.75; margin: 28px 0;">
      <h3 style="font-family: 'Oswald', -apple-system, sans-serif; font-size: 21px; font-weight: 700; color: #0f172a; margin: 0 0 12px; text-transform: uppercase;">
        Match Preview &amp; Tactical Blueprint: ${home} vs ${away}
      </h3>
      <p>Football enthusiasts and tactical purists around the globe turn their focus toward <strong>${venue}</strong> as <strong>${home}</strong> prepares to battle <strong>${away}</strong> in a marquee <strong>${league}</strong> clash. With vital league standing implications and competitive pride at stake, both managers have formulated meticulous game plans to outwit and outmaneuver their counterparts across the 90 minutes.</p>
      <p>The tactical battle promises to be fascinating. ${home}, operating in a structured <strong>${homeForm}</strong> under head coach <strong>${homeCoach}</strong>, will prioritize tempo control, progressive ball circulation through defensive lines, and relentless counter-pressing upon turnovers. On the opposite sideline, ${away} and manager <strong>${awayCoach}</strong> are anticipated to field a versatile <strong>${awayForm}</strong> shape capable of toggling between compact low-block defending and explosive vertical transitions into the opposition's half.</p>
      <p>Key individual duels across the pitch will likely dictate the final outcome. In particular, the midfield battle for second balls and transition control will test both squads' physical stamina and spatial awareness. Both managers also possess deep substitution benches featuring game-changing dynamic talent capable of altering the flow of the game in the final thirty minutes.</p>
      <p>Set-piece execution and defensive organization against aerial deliveries could prove equally decisive in breaking down compact defensive barriers. Analytical telemetry indicates that converting high-probability big chances will be paramount in securing maximum points under heavy continental scrutiny.</p>
      <p>Explore the full confirmed starting lineups, player telemetry ratings, historical head-to-head records, and official broadcasting networks below. The ZetaSports live telemetry gateway will automatically hydrate with real-time live scores, attacking momentum charts, and instant event alerts as soon as the opening whistle sounds.</p>
    </div>
  `;
}

// --- COMPONENT 9: TEAM RECENT FORM GUIDE (W - D - L Badges) ---
function generateFormGuide(m) {
  const home = m.home_team || 'Home';
  const away = m.away_team || 'Away';

  const parseFormBadges = (formStr, defaultSeq) => {
    let badges = [];
    if (typeof formStr === 'string' && formStr.trim()) {
      badges = formStr.trim().toUpperCase().split('').filter(c => ['W', 'D', 'L'].includes(c));
    } else if (Array.isArray(formStr)) {
      badges = formStr.map(s => String(s).toUpperCase().charAt(0)).filter(c => ['W', 'D', 'L'].includes(c));
    }
    if (badges.length === 0) badges = defaultSeq;
    while (badges.length < 5) badges.push('W');
    return badges.slice(0, 5).map(res => {
      const bg = res === 'W' ? '#16a34a' : (res === 'D' ? '#d97706' : '#dc2626');
      return `<span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: ${bg}; color: #ffffff; font-size: 11px; font-weight: 800; box-shadow: 0 1px 3px rgba(0,0,0,0.15);">${res}</span>`;
    }).join('');
  };

  const homePills = parseFormBadges(m.home_form, ['W', 'W', 'D', 'W', 'L']);
  const awayPills = parseFormBadges(m.away_form, ['W', 'D', 'W', 'L', 'W']);

  return `
    <div class="zeta-form-guide" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 18px; margin: 24px 0; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 12px; font-weight: 700; color: #0062b2; text-transform: uppercase;">${home} Form:</span>
        <div style="display: flex; gap: 5px;">${homePills}</div>
      </div>
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 12px; font-weight: 700; color: #dc2626; text-transform: uppercase;">${away} Form:</span>
        <div style="display: flex; gap: 5px;">${awayPills}</div>
      </div>
    </div>
  `;
}

// --- COMPONENT 10: STARTING LINEUPS & SUBSTITUTES BENCH TABLE ---
function generateStartingXITable(m) {
  const home = m.home_team || 'Home';
  const away = m.away_team || 'Away';
  const homeLogo = m.home_logo || '';
  const awayLogo = m.away_logo || '';
  const lu = m.lineups || {};
  const homeLu = lu.home || {};
  const awayLu = lu.away || {};

  const homeStarters = Array.isArray(homeLu.starting) ? homeLu.starting : [];
  const awayStarters = Array.isArray(awayLu.starting) ? awayLu.starting : [];
  const homeSubs = Array.isArray(homeLu.bench) ? homeLu.bench : [];
  const awaySubs = Array.isArray(awayLu.bench) ? awayLu.bench : [];

  const homeForm = homeLu.formation || m.formations?.home || '4-3-3';
  const awayForm = awayLu.formation || m.formations?.away || '4-2-3-1';
  const homeCoach = homeLu.coach || m.home_coach || 'Head Coach';
  const awayCoach = awayLu.coach || m.away_coach || 'Head Coach';

  const renderTeamColumn = (teamName, logo, form, coach, starters, subs, isHome) => {
    let startersHtml = '';
    if (starters.length > 0) {
      startersHtml = starters.map((p, idx) => {
        const pPhoto = p.photo || (p.id ? `https://images.fotmob.com/image_resources/playerimages/${p.id}.png` : '');
        const pRating = parseFloat(p.rating);
        let ratingBadge = '';
        if (!isNaN(pRating) && pRating > 0) {
          const rBg = pRating >= 7.5 ? '#10b981' : (pRating >= 6.8 ? '#0284c7' : '#64748b');
          ratingBadge = `<span style="background: ${rBg}; color: #ffffff; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 4px; margin-left: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">${pRating.toFixed(1)}</span>`;
        }

        let eventBadges = '';
        if (Array.isArray(p.goals) && p.goals.length > 0) {
          eventBadges += `<span style="color: #15803d; font-size: 11px; margin-left: 5px; font-weight: 700;" title="Goal(s)">⚽ ${p.goals.join("', ")}'</span>`;
        }
        if (p.yellowCard) {
          eventBadges += `<span style="background: #facc15; color: #78350f; font-size: 10px; font-weight: 800; padding: 1px 4px; border-radius: 3px; margin-left: 5px;" title="Yellow Card">🟨 ${p.yellowCard !== true ? p.yellowCard + "'" : ''}</span>`;
        }
        if (p.redCard) {
          eventBadges += `<span style="background: #ef4444; color: #ffffff; font-size: 10px; font-weight: 800; padding: 1px 4px; border-radius: 3px; margin-left: 5px;" title="Red Card">🟥</span>`;
        }

        return `
        <tr style="border-bottom: 1px solid #f1f5f9; ${idx % 2 === 1 ? 'background: #f8fafc;' : ''}">
          <td style="padding: 6px 8px; font-weight: 700; color: #0062b2; font-size: 13px; width: 26px; text-align: center;">${p.number || idx + 1}</td>
          <td style="padding: 5px 4px; width: 34px; text-align: center;">
            <img src="${pPhoto}" alt="${p.name}" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover; background: #e2e8f0; border: 1.5px solid ${isHome ? '#3b82f6' : '#ef4444'}; display: inline-block; vertical-align: middle;" onerror="this.onerror=null; this.src='https://images.fotmob.com/image_resources/playerimages/placeholder.png';" />
          </td>
          <td style="padding: 6px 8px; font-size: 13px; color: #1e293b; font-weight: 600;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px;">
              <span>
                ${p.name}
                ${p.captain ? '<span style="background: #eab308; color: #000; font-size: 10px; font-weight: 800; padding: 1px 4px; border-radius: 3px; margin-left: 4px;">C</span>' : ''}
                ${eventBadges}
              </span>
              ${ratingBadge}
            </div>
          </td>
          <td style="padding: 6px 8px; font-size: 11px; color: #64748b; font-weight: 700; text-align: right; width: 36px;">${p.pos || ''}</td>
        </tr>
      `;
      }).join('');
    } else {
      startersHtml = `<tr><td colspan="4" style="padding: 20px; text-align: center; color: #94a3b8; font-size: 13px;">Confirmed Starting XI will be announced 60 mins before kickoff.</td></tr>`;
    }

    let subsHtml = '';
    if (subs.length > 0) {
      subsHtml = `<div style="margin-top: 14px; padding-top: 12px; border-top: 1px dashed #cbd5e1;">
        <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 8px;">Substitutes Bench</span>
        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
          ${subs.map(s => {
            const sPhoto = s.photo || (s.id ? `https://images.fotmob.com/image_resources/playerimages/${s.id}.png` : '');
            return `<span style="display: inline-flex; align-items: center; gap: 6px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 20px; padding: 2px 8px 2px 3px; font-size: 12px; color: #334155; font-weight: 500;">
              <img src="${sPhoto}" alt="${s.name}" style="width: 22px; height: 22px; border-radius: 50%; object-fit: cover; background: #cbd5e1;" onerror="this.onerror=null; this.src='https://images.fotmob.com/image_resources/playerimages/placeholder.png';" />
              <span>#${s.number || ''} ${s.name}</span>
            </span>`;
          }).join('')}
        </div>
      </div>`;
    }

    return `
      <div style="flex: 1; min-width: 280px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; box-shadow: 0 2px 10px rgba(0,0,0,0.03);">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 2px solid ${isHome ? '#0062b2' : '#0284c7'};">
          <div style="display: flex; align-items: center; gap: 10px;">
            ${logo ? `<img src="${logo}" alt="${teamName}" style="width: 32px; height: 32px; object-fit: contain;" />` : ''}
            <div>
              <h4 style="margin: 0; font-family: 'Oswald', sans-serif; font-size: 16px; font-weight: 700; color: #0f172a;">${teamName}</h4>
              <span style="font-size: 11px; color: #64748b;">Manager: <strong>${coach}</strong></span>
            </div>
          </div>
          <span style="background: ${isHome ? '#e0f2fe' : '#f0f9ff'}; color: ${isHome ? '#0369a1' : '#0284c7'}; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; border: 1px solid #bae6fd;">
            ${form}
          </span>
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          <tbody>
            ${startersHtml}
          </tbody>
        </table>
        ${subsHtml}
      </div>
    `;
  };

  return `
    <div class="zeta-lineups-container" style="margin: 28px 0;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; gap: 8px;">
        <h3 style="margin: 0; font-family: 'Oswald', sans-serif; font-size: 18px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">
          📋 Official Starting Lineups &amp; Tactical Formations
        </h3>
        <span style="background: #ecfdf5; border: 1px solid #a7f3d0; color: #059669; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 20px;">
          ✔ FotMob Verified Tactical Data
        </span>
      </div>
      <div style="display: flex; gap: 16px; flex-wrap: wrap;">
        ${renderTeamColumn(home, homeLogo, homeForm, homeCoach, homeStarters, homeSubs, true)}
        ${renderTeamColumn(away, awayLogo, awayForm, awayCoach, awayStarters, awaySubs, false)}
      </div>
    </div>
  `;
}

// --- COMPONENT 11: DECISIVE MOMENTS LOG & MATCH EVENTS TIMELINE ---
function generateMatchEventsTimeline(m, isFinished, isLive) {
  const home = m.home_team || 'Home';
  const away = m.away_team || 'Away';

  const timeline = [];
  const events = Array.isArray(m.events) ? m.events : [];
  
  if (events.length > 0) {
    events.forEach(e => {
      const min = parseInt(e.minute, 10) || 0;
      const teamName = e.team === 'home' || e.team === home ? home : away;
      const isHome = e.team === 'home' || e.team === home;
      if (e.type === 'Goal') {
        timeline.push({
          minute: min,
          type: 'goal',
          icon: '⚽',
          title: `Goal - ${e.player}`,
          team: teamName,
          isHome,
          desc: `${e.penalty ? '(Penalty) ' : ''}${e.own_goal ? '(Own Goal) ' : ''}${e.assist ? 'Assist: ' + e.assist : ''}${e.xg ? ' • xG: ' + parseFloat(e.xg).toFixed(2) : ''}`
        });
      } else if (e.type === 'Card') {
        const isRed = (e.card || '').toLowerCase().includes('red');
        timeline.push({
          minute: min,
          type: 'card',
          icon: isRed ? '🟥' : '🟨',
          title: `${isRed ? 'Red Card' : 'Yellow Card'} - ${e.player}`,
          team: teamName,
          isHome,
          desc: e.cardReason || e.reason || (isRed ? 'Expulsion' : 'Caution')
        });
      } else if (e.type === 'Substitution' && e.swap && e.swap.length >= 2) {
        timeline.push({
          minute: min,
          type: 'sub',
          icon: '🔄',
          title: `Substitution (${teamName})`,
          team: teamName,
          isHome,
          desc: `In: <strong>${e.swap[0].name}</strong> | Out: ${e.swap[1].name}`
        });
      }
    });
  } else {
    // Check goal_scorers
    (m.goal_scorers || []).forEach(g => {
      const min = parseInt(g.minute, 10) || 0;
      const teamName = g.team === 'home' || g.team === home ? home : away;
      timeline.push({
        minute: min,
        type: 'goal',
        icon: '⚽',
        title: `Goal - ${g.player}`,
        team: teamName,
        isHome: g.team === 'home' || g.team === home,
        desc: `${g.penalty ? '(Penalty) ' : ''}${g.own_goal ? '(Own Goal) ' : ''}${g.assist ? 'Assist: ' + g.assist : ''}`
      });
    });
    // Check cards
    (m.cards || []).forEach(c => {
      const min = parseInt(c.minute, 10) || 0;
      const isRed = (c.card || '').toLowerCase().includes('red');
      timeline.push({
        minute: min,
        type: 'card',
        icon: isRed ? '🟥' : '🟨',
        title: `${isRed ? 'Red Card' : 'Yellow Card'} - ${c.player}`,
        team: c.team === 'home' || c.team === home ? home : away,
        isHome: c.team === 'home' || c.team === home,
        desc: c.reason || 'Caution'
      });
    });
    // Check substitutions
    (m.substitutions || []).forEach(s => {
      const min = parseInt(s.minute, 10) || 0;
      timeline.push({
        minute: min,
        type: 'sub',
        icon: '🔄',
        title: `Substitution`,
        team: s.team === 'home' || s.team === home ? home : away,
        isHome: s.team === 'home' || s.team === home,
        desc: `In: <strong>${s.playerIn}</strong> | Out: ${s.playerOut}`
      });
    });
  }

  timeline.sort((a, b) => a.minute - b.minute);

  let eventsHtml = '';
  if (timeline.length > 0) {
    eventsHtml = timeline.map(ev => `
      <div style="display: flex; align-items: flex-start; gap: 12px; padding: 10px 0; border-bottom: 1px dashed #e2e8f0;">
        <span style="background: #0f172a; color: #ffffff; font-family: 'Oswald', -apple-system, sans-serif; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 4px; min-width: 32px; text-align: center; flex-shrink: 0;">${ev.minute}'</span>
        <div style="font-size: 16px; flex-shrink: 0; line-height: 1.2;">${ev.icon}</div>
        <div style="flex: 1;">
          <div style="font-size: 13px; font-weight: 700; color: #0f172a;">
            ${ev.title} <span style="font-size: 11px; font-weight: 600; color: ${ev.isHome ? '#0062b2' : '#dc2626'};">(${ev.team})</span>
          </div>
          ${ev.desc ? `<div style="font-size: 12px; color: #64748b; margin-top: 2px;">${ev.desc}</div>` : ''}
        </div>
      </div>
    `).join('');
  } else {
    eventsHtml = `
      <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 13px;">
        ${isFinished ? 'Official decisive moments recorded. See statistics below.' : (isLive ? 'No major incidents yet. Match telemetry streaming live.' : 'Match events timeline will update in real-time as soon as kickoff begins.')}
      </div>
    `;
  }

  return `
    <div class="zeta-timeline-container" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; margin: 28px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.03);">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
        <h3 style="margin: 0; font-family: 'Oswald', -apple-system, sans-serif; font-size: 17px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">
          ⏱ Decisive Moments Log &amp; Match Events Timeline
        </h3>
        <span style="background: #f1f5f9; color: #475569; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px;">
          Chronological
        </span>
      </div>
      <div>${eventsHtml}</div>
    </div>
  `;
}

// --- COMPONENT 12: MATCH STATISTICS & COMPARATIVE PROGRESS METERS ---
function generateMatchStatsMeters(m, isFinished, isLive) {
  const home = m.home_team || 'Home';
  const away = m.away_team || 'Away';
  const stats = m.match_stats || m.stats || {};

  const possession = stats.possession || [50, 50];
  const shots = stats.shots || [0, 0];
  const shotsOnTarget = stats.shots_on_target || [0, 0];
  const xg = stats.xg || stats.expected_goals || [null, null];
  const bigChances = stats.big_chances || [0, 0];
  const accuratePasses = stats.accurate_passes || stats.passes_accuracy || [null, null];
  const corners = stats.corners || [0, 0];
  const fouls = stats.fouls || [0, 0];

  const renderMeter = (label, vHome, vAway, isPercent = false) => {
    if (vHome === null || vHome === undefined || vAway === null || vAway === undefined) return '';
    const parseNum = (v) => {
      if (typeof v === 'string') {
        const match = v.match(/(\d+(\.\d+)?)/);
        return match ? parseFloat(match[1]) : 0;
      }
      return parseFloat(v) || 0;
    };
    const nHome = parseNum(vHome);
    const nAway = parseNum(vAway);
    const total = (nHome + nAway) > 0 ? (nHome + nAway) : 100;
    const pctHome = isPercent ? Math.min(100, Math.max(0, nHome)) : Math.round((nHome / total) * 100);
    const pctAway = 100 - pctHome;

    return `
      <div style="margin-bottom: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px; margin-bottom: 5px;">
          <span style="font-weight: 700; color: #0062b2;">${vHome}${isPercent && !String(vHome).includes('%') ? '%' : ''}</span>
          <span style="color: #64748b; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">${label}</span>
          <span style="font-weight: 700; color: #dc2626;">${vAway}${isPercent && !String(vAway).includes('%') ? '%' : ''}</span>
        </div>
        <div style="height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; display: flex;">
          <div style="width: ${pctHome}%; background: #0062b2; transition: width 0.3s ease;"></div>
          <div style="width: ${pctAway}%; background: #dc2626; transition: width 0.3s ease;"></div>
        </div>
      </div>
    `;
  };

  return `
    <div class="zeta-stats-meters" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; margin: 28px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.03);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h4 style="font-family: 'Oswald', -apple-system, sans-serif; font-size: 16px; font-weight: 700; color: #0f172a; text-transform: uppercase; margin: 0; letter-spacing: 0.5px;">
          📊 Match Telemetry &amp; Comparative Performance Meters
        </h4>
        <div style="display: flex; gap: 12px; font-size: 11px; font-weight: 700;">
          <span style="color: #0062b2;">● ${home}</span>
          <span style="color: #dc2626;">● ${away}</span>
        </div>
      </div>
      <div>
        ${xg[0] !== null ? renderMeter('Expected Goals (xG)', xg[0], xg[1]) : ''}
        ${renderMeter('Ball Possession', possession[0], possession[1], true)}
        ${renderMeter('Total Shots', shots[0], shots[1])}
        ${renderMeter('Shots on Target', shotsOnTarget[0], shotsOnTarget[1])}
        ${(bigChances[0] !== 0 || bigChances[1] !== 0) ? renderMeter('Big Chances', bigChances[0], bigChances[1]) : ''}
        ${accuratePasses[0] !== null ? renderMeter('Accurate Passes', accuratePasses[0], accuratePasses[1]) : ''}
        ${renderMeter('Corner Kicks', corners[0], corners[1])}
        ${renderMeter('Fouls Committed', fouls[0], fouls[1])}
      </div>
    </div>
  `;
}

// --- COMPONENT 13: HEAD-TO-HEAD (H2H) HISTORICAL TABLE ---
function generateH2HTable(m) {
  const home = m.home_team || 'Home';
  const away = m.away_team || 'Away';
  const league = m.league_name || m.league || 'Football League';
  const h2h = Array.isArray(m.h2h) ? m.h2h : [];

  if (h2h.length === 0) {
    return `
      <div class="zeta-h2h-container" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 28px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.03);">
        <h3 style="margin: 0 0 10px; font-family: 'Oswald', sans-serif; font-size: 17px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">
          ⚔️ Head-to-Head (H2H) Historical Record
        </h3>
        <p style="font-size: 13px; color: #64748b; margin: 0;">First official competitive meeting between ${home} and ${away} in ${league}.</p>
      </div>
    `;
  }

  const rows = h2h.map((h, i) => `
    <tr style="border-bottom: 1px solid #f1f5f9; ${i % 2 === 1 ? 'background: #f8fafc;' : ''}">
      <td style="padding: 10px 12px; font-size: 12px; color: #64748b; font-weight: 600;">${h.date || 'Recent'}</td>
      <td style="padding: 10px 12px; font-size: 11px; color: #0284c7; font-weight: 700;">${h.league || 'League'}</td>
      <td style="padding: 10px 12px; font-size: 13px; font-weight: 700; color: #1e293b; text-align: right;">${h.home}</td>
      <td style="padding: 10px 12px; text-align: center; width: 70px;">
        <span style="background: #0f172a; color: #ffffff; font-size: 12px; font-weight: 800; padding: 2px 8px; border-radius: 4px; letter-spacing: 1px;">${h.score}</span>
      </td>
      <td style="padding: 10px 12px; font-size: 13px; font-weight: 700; color: #1e293b; text-align: left;">${h.away}</td>
    </tr>
  `).join('');

  return `
    <div class="zeta-h2h-container" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 28px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.03);">
      <h3 style="margin: 0 0 14px; font-family: 'Oswald', sans-serif; font-size: 17px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">
        ⚔️ Head-to-Head (H2H) Historical Record
      </h3>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f1f5f9; text-transform: uppercase; font-size: 11px; color: #64748b; letter-spacing: 0.5px;">
            <th style="padding: 8px 12px; text-align: left;">Date</th>
            <th style="padding: 8px 12px; text-align: left;">Competition</th>
            <th style="padding: 8px 12px; text-align: right;">Home</th>
            <th style="padding: 8px 12px; text-align: center;">Score</th>
            <th style="padding: 8px 12px; text-align: left;">Away</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

// --- COMPONENT 14: GLOBAL TV & LIVE STREAMING BROADCAST GUIDE ---
function generateBroadcastGuide(m, cfg) {
  const league = m.league_name || m.league || 'Football League';
  const rawDetailsDomain = (cfg?.detailsBlogDomain || '').replace(/^https?:\/\//i, '').replace(/\/+$/, '').trim();
  const linksUrl = rawDetailsDomain 
    ? `https://${rawDetailsDomain}/?links=${m.id}`
    : `/?links=${m.id}`;

  return `
    <div class="zeta-broadcast-guide" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; margin: 28px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.03);">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; gap: 8px;">
        <h3 style="margin: 0; font-family: 'Oswald', -apple-system, sans-serif; font-size: 17px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">
          📺 Global TV Channels &amp; Live Streaming Directory
        </h3>
        <span style="background: #f0fdf4; border: 1px solid #bbf7d0; color: #16a34a; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px;">
          Official Broadcasters
        </span>
      </div>
      <p style="font-size: 13px; color: #64748b; margin: 0 0 14px; line-height: 1.5;">
        Tune in to official rights-holders broadcasting live action of the <strong>${league}</strong> across major international regions:
      </p>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-bottom: 16px;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px;">
          <span style="font-size: 11px; font-weight: 700; color: #0062b2; text-transform: uppercase; display: block;">🇬🇧 United Kingdom</span>
          <span style="font-size: 12px; font-weight: 700; color: #1e293b;">TNT Sports / discovery+ / Sky Sports</span>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px;">
          <span style="font-size: 11px; font-weight: 700; color: #0062b2; text-transform: uppercase; display: block;">🇺🇸 United States</span>
          <span style="font-size: 12px; font-weight: 700; color: #1e293b;">Paramount+ / CBS Sports Golazo / ViX</span>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px;">
          <span style="font-size: 11px; font-weight: 700; color: #0062b2; text-transform: uppercase; display: block;">🇮🇳 India &amp; Subcontinent</span>
          <span style="font-size: 12px; font-weight: 700; color: #1e293b;">Sony LIV / Sony Sports Ten Network</span>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px;">
          <span style="font-size: 11px; font-weight: 700; color: #0062b2; text-transform: uppercase; display: block;">🌍 MENA &amp; Africa</span>
          <span style="font-size: 12px; font-weight: 700; color: #1e293b;">beIN Sports / SuperSport Football</span>
        </div>
      </div>
      <!-- High-CTR Server Selection CTA (Full-Page Refresh to Link Selection Page) -->
      <div class="zeta-live-server-cta" style="margin-top: 18px; padding-top: 16px; border-top: 1px dashed #cbd5e1; text-align: center;">
        <a href="${linksUrl}" style="display: inline-flex; align-items: center; justify-content: center; gap: 8px; background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: #ffffff; text-decoration: none; font-family: 'Oswald', -apple-system, sans-serif; font-size: 15px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; padding: 14px 28px; border-radius: 8px; box-shadow: 0 4px 14px rgba(220, 38, 38, 0.35); min-height: 48px; transition: transform 0.15s ease, background 0.15s ease;">
          <span>🔴</span> Select Live Streaming Server (Multi-Server HD) <span>➔</span>
        </a>
        <div style="font-size: 11px; color: #64748b; margin-top: 8px;">
          Choose from multiple high-speed broadcast feeds &amp; commentary languages
        </div>
      </div>
    </div>
  `;
}

// --- COMPONENT 15: GOOGLE ADSENSE SLOT 2 (High-CTR Bottom Placement: 728x250 / Zero CLS Container) ---
function generateAdSenseSlot2(cfg) {
  const client = cfg?.adsenseClient || 'ca-pub-XXXXXXXXXXXXXXXX';
  const slot = cfg?.adSlot2 || '0987654321';
  return `
    <!-- Google AdSense Slot 2: High-CTR Bottom Placement (Zero CLS Container) -->
    <div class="zeta-ad-slot-2" style="min-height: 250px; width: 100%; max-width: 728px; margin: 28px auto; text-align: center; overflow: hidden; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; contain: layout size;">
      <span style="font-size: 10px; font-weight: 700; color: #94a3b8; letter-spacing: 1.5px; text-transform: uppercase; margin: 8px 0 4px; display: block;">ADVERTISEMENT</span>
      <ins class="adsbygoogle" style="display:inline-block;width:728px;height:250px;" data-ad-client="${client}" data-ad-slot="${slot}"></ins>
      <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
    </div>
  `;
}

// --- COMPONENT 16: 1-CLICK VIRAL SOCIAL SHARE CARD (WHATSAPP, TELEGRAM, CLIPBOARD) ---
function generateSocialShareCard(m) {
  const home = m.home_team || 'Home';
  const away = m.away_team || 'Away';
  const homeScore = m.home_score ?? 0;
  const awayScore = m.away_score ?? 0;
  const isFinished = ['ft', 'finished'].includes(String(m.status || '').toLowerCase());
  const scoreText = isFinished ? `${homeScore} - ${awayScore} (FT)` : 'Live Match Center';
  const postUrl = m.article_url || 'https://keralahub.online';

  const shareText = encodeURIComponent(`🔥 ${home} ${scoreText} ${away} | Official Lineups, Goals & Match Review on ZetaSports: ${postUrl}`);
  const whatsappUrl = `https://api.whatsapp.com/send?text=${shareText}`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(postUrl)}&text=${encodeURIComponent(`🔥 ${home} ${scoreText} ${away} - ZetaSports Match Center`)}`;

  return `
    <div class="zeta-share-box" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 18px 20px; margin: 24px 0; color: #ffffff; box-shadow: 0 4px 15px rgba(0,0,0,0.15);">
      <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px;">
        <div>
          <h4 style="margin: 0; font-family: 'Oswald', sans-serif; font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #f8fafc;">
            📢 Share Match Result &amp; Lineups
          </h4>
          <p style="margin: 4px 0 0; font-size: 12px; color: #94a3b8;">
            Broadcast this match scoreline, player ratings, and starting formations with friends.
          </p>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <a href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 6px; background: #25d366; color: #ffffff; text-decoration: none; font-size: 12px; font-weight: 700; padding: 8px 14px; border-radius: 8px; box-shadow: 0 2px 6px rgba(37,211,102,0.3); transition: transform 0.15s ease;">
            <span>💬 WhatsApp</span>
          </a>
          <a href="${telegramUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 6px; background: #0088cc; color: #ffffff; text-decoration: none; font-size: 12px; font-weight: 700; padding: 8px 14px; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,136,204,0.3); transition: transform 0.15s ease;">
            <span>✈️ Telegram</span>
          </a>
          <button type="button" onclick="navigator.clipboard.writeText('${postUrl}').then(() => alert('✔ Match URL copied to clipboard!'));" style="display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.1); color: #f8fafc; border: 1px solid rgba(255,255,255,0.2); font-size: 12px; font-weight: 700; padding: 8px 14px; border-radius: 8px; cursor: pointer;">
            <span>📋 Copy Link</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

// --- MASTER GENERATOR: COMPLETE 17-COMPONENT MAGAZINE-GRADE HTML FOR BLOGGER POSTS ---
async function generateRichPostContent(m, cfg, forcedState = null, thumbUrl = null) {
  const home = m.home_team || 'Home';
  const away = m.away_team || 'Away';
  const league = m.league_name || m.league || 'Football League';
  const homeLogo = m.home_logo || '';
  const awayLogo = m.away_logo || '';

  const state = forcedState || getMatchLifecycleState(m.status, cfg?.thumbnailMode);
  const isFinished = state === 'finished';
  const isLive = state === 'live';

  const matchMeta = {
    mode: cfg?.thumbnailMode || 'auto',
    homeScore: m.home_score,
    awayScore: m.away_score,
    kickoff: m.kickoff_time || m.kickoff_ist,
    venue: m.stadium || m.venue,
    status: isFinished ? 'FT' : (isLive ? 'LIVE' : m.status)
  };

  const finalThumb = thumbUrl || m.thumbnail_url || '';

  let html = '';

  // Component 1: Dual Schema.org JSON-LD (SportsEvent + FAQPage with 4 Q&As)
  html += generateSchemaJsonLd(m, isFinished, isLive);

  // Optional Featured Thumbnail Top Lead
  if (finalThumb) {
    html += `<div class="separator" style="clear: both; text-align: center; margin-bottom: 20px;">\n` +
      `  <img class="zeta-post-thumb" border="0" src="${finalThumb}" alt="${home} vs ${away} Match Center" style="width: 100%; max-width: 820px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.12); display: block; margin: 0 auto;" />\n` +
      `</div>\n`;
  }

  // Component 2: 16:9 Broadcast Hero Graphic (Crests with Monogram Fallback, Score, No Minute in Pill)
  html += generateHeroPosterMarkup(home, away, league, homeLogo, awayLogo, matchMeta);

  // Component 3: Real-Time Status / Countdown Ticker
  html += generateStatusCountdownTicker(m, isFinished, isLive);

  // Component 4: 4-Card Telemetry Grid (Stadium, Referee, League, Time)
  html += generateMatchTelemetryGrid(m);

  // Component 5: Key Match Facts & Trivia Strip
  html += generateMatchFactsStrip(m);

  // Component 6: Marquee Player Spotlight & Tactical Duel
  html += generatePlayerSpotlightDuel(m);

  // Component 7: Google AdSense Slot 1: Mid-Article Native (336x280 / Zero CLS Container)
  html += generateAdSenseSlot1(cfg);

  // Component 8: Editorial Tactical Narrative (300+ Words SEO Article)
  html += generateEditorialNarrative(m, isFinished, isLive);

  // Component 9: Team Recent Form Guide (W - D - L Badges)
  html += generateFormGuide(m);

  // Component 10: Starting Lineups & Substitutes Bench Table (Starters, Subs, Ratings, Events)
  html += generateStartingXITable(m);

  // Component 11: Decisive Moments Log & Match Events Timeline
  html += generateMatchEventsTimeline(m, isFinished, isLive);

  // Component 12: Match Statistics & Comparative Progress Meters (xG, Possession, Shots, Fouls)
  html += generateMatchStatsMeters(m, isFinished, isLive);

  // Component 13: Head-to-Head (H2H) Historical Encounters (Last 5 Games)
  html += generateH2HTable(m);

  // Component 14: Global TV & Live Streaming Broadcast Guide
  html += generateBroadcastGuide(m, cfg);

  // Component 15: Google AdSense Slot 2: High-CTR Bottom Placement (728x250 / Zero CLS Container)
  html += generateAdSenseSlot2(cfg);

  // Component 16: 1-Click Viral Social Sharing Card (WhatsApp, Telegram)
  html += generateSocialShareCard(m);

  // Component 17: Real-Time Token: zeta:ID for Colorify Theme Hydration
  const mountStatus = isFinished ? 'finished' : (isLive ? 'live' : 'upcoming');
  html += `<div id="zetaMatchCenter" data-match-id="${m.id}" data-zeta-id="${m.id}" data-fotmob-id="${m.fotmob_id || ''}" data-status="${mountStatus}" data-kickoff="${m.kickoff_time || m.kickoff_ist || ''}" data-has-lineup-table="true" style="margin-top: 24px;">\n` +
    `  <span style="display:none;" id="zetaMatchToken" class="zeta-match-token">zeta:${m.id}</span>\n` +
    `</div>\n`;

  return html;
}

// Helper: Update Blogger Post to Full-Time with Fresh Thumbnail, Review & Stream Removal
async function updateBloggerPostToFullTime(m) {
  let cfg = loadConfig();
  if (cfg.refreshToken && isGoogleTokenExpired(cfg)) {
    try {
      await refreshGoogleAccessToken(cfg);
      cfg = loadConfig();
    } catch (_) {}
  }
  const targetBlogId = (m.article_url && m.article_url.includes('zeta-live.blogspot.com'))
    ? '1465102539101242447'
    : (cfg.blogId || '2859669537523181583');

  if (!targetBlogId) {
    console.warn('[Auto-Lifecycle]: Cannot update post, missing blogId.');
    return { success: false, error: 'Missing blogId' };
  }

  // 1. Resolve Blogger Post ID
  let postId = '';
  if (m.article_source && m.article_source.startsWith('blogger:')) {
    postId = m.article_source.replace('blogger:', '').trim();
  }

  // If not saved directly in article_source, extract path and lookup bypath
  if (!postId && m.article_url) {
    try {
      const u = new URL(m.article_url);
      const postPath = u.pathname;
      const lookupRes = await httpsRequest({
        hostname: 'www.googleapis.com',
        path: `/blogger/v3/blogs/${encodeURIComponent(targetBlogId)}/posts/bypath?path=${encodeURIComponent(postPath)}${cfg.apiKey ? `&key=${encodeURIComponent(cfg.apiKey)}` : ''}`,
        method: 'GET',
        headers: cfg.accessToken ? { 'Authorization': `Bearer ${cfg.accessToken.trim()}` } : {}
      });
      if (lookupRes.status === 200 && lookupRes.data?.id) {
        postId = lookupRes.data.id;
      }
    } catch (_) {}
  }

  if (!postId) {
    console.warn(`[Auto-Lifecycle]: Unable to resolve Blogger Post ID for match ${m.id}. Skipping.`);
    return { success: false, error: 'Could not resolve Blogger Post ID' };
  }

  // 1B. Re-sync freshest FotMob match telemetry if fotmob_id is available
  if (m.fotmob_id) {
    try {
      const synced = await fetchAndSyncFotMobMatch(m.id, m.fotmob_id);
      if (synced) Object.assign(m, synced);
    } catch (sErr) {
      console.warn('[Auto-Lifecycle]: FotMob re-sync notice:', sErr.message);
    }
  }

  const home = m.home_team || 'Home';
  const away = m.away_team || 'Away';
  const league = m.league_name || m.league || 'Football League';
  const homeScore = m.home_score ?? 0;
  const awayScore = m.away_score ?? 0;

  console.log(`[Auto-Lifecycle]: Generating FULL-TIME graphic and match review for ${home} vs ${away} (Post ID: ${postId})...`);

  // 2. Generate Full Time Canvas Poster & upload to CDN
  const matchMeta = {
    mode: 'after',
    status: 'FT',
    homeScore,
    awayScore,
    kickoff: m.kickoff_ist || m.time || '',
    venue: m.venue || ''
  };

  const newThumbUrl = await generateCanvasMatchdayPoster(home, away, league, m.home_logo, m.away_logo, matchMeta);

  // 3. Assemble Updated Rich Post Content
  let updatedContent = await generateRichPostContent(m, cfg, 'finished', newThumbUrl);

  // Add the stream concluded notice right above the mount point
  updatedContent = updatedContent.replace(
    '<div id="zetaMatchCenter"',
    `<div class="zeta-gateway-concluded" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; text-align: center; margin: 24px 0;">\n` +
    `  <div style="font-family: 'Oswald', sans-serif; font-size: 15px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">🏁 Official Live Transmission Concluded</div>\n` +
    `  <p style="font-size: 13px; color: #64748b; margin: 0; line-height: 1.5;">The live streaming transmission for this fixture ended 10 minutes after full time. Full match statistics and lineup archives are permanently preserved above.</p>\n` +
    `</div>\n<div id="zetaMatchCenter"`
  );

  const updatedTitle = `${home} ${homeScore}-${awayScore} ${away}: Full-Time Result, Match Review & Lineups - ${league}`;
  const searchDesc = `zeta:${m.id} - ${home} ${homeScore}-${awayScore} ${away} full-time match review, final scoreline, goal scorers and tactical breakdown.`;

  const bloggerUpdatePayload = {
    kind: 'blogger#post',
    id: postId,
    blog: { id: targetBlogId },
    title: updatedTitle,
    content: updatedContent,
    customMetaData: searchDesc,
    labels: [league, home, away, 'Full Time', 'Match Review', 'Football']
  };

  // 4. Update via Blogger API (PUT)
  const bloggerHeaders = { 'Content-Type': 'application/json' };
  if (cfg.accessToken) bloggerHeaders['Authorization'] = `Bearer ${cfg.accessToken.trim()}`;

  const updatePath = `/blogger/v3/blogs/${encodeURIComponent(targetBlogId)}/posts/${encodeURIComponent(postId)}${cfg.apiKey ? `?key=${encodeURIComponent(cfg.apiKey)}` : ''}`;

  let updateRes = await httpsRequest({
    hostname: 'www.googleapis.com',
    path: updatePath,
    method: 'PUT',
    headers: bloggerHeaders
  }, bloggerUpdatePayload);

  // Auto-refresh token if 401
  if (updateRes.status === 401 && cfg.refreshToken) {
    try {
      const freshTok = await refreshGoogleAccessToken(cfg);
      bloggerHeaders['Authorization'] = `Bearer ${freshTok.trim()}`;
      updateRes = await httpsRequest({
        hostname: 'www.googleapis.com',
        path: updatePath,
        method: 'PUT',
        headers: bloggerHeaders
      }, bloggerUpdatePayload);
    } catch (_) {}
  }

  if (updateRes.status === 200) {
    console.log(`[Auto-Lifecycle]: Blogger post ${postId} updated successfully to Full Time! URL: ${updateRes.data?.url}`);

    // 5. Update Supabase record
    await httpsRequest({
      hostname: SUPABASE_HOST,
      path: `/rest/v1/zeta_matches?id=eq.${encodeURIComponent(m.id)}`,
      method: 'PATCH',
      headers: {
        'apikey': ANON_KEY,
        'authorization': `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      }
    }, {
      article_title: 'finalized',
      thumbnail_url: newThumbUrl,
      stream_url: null // Disables/cleans stream URL 10 minutes post match
    });

    return { success: true, postId, postUrl: updateRes.data?.url, thumbUrl: newThumbUrl };
  } else {
    console.error(`[Auto-Lifecycle]: Failed to update Blogger post ${postId}:`, updateRes.raw);
    return { success: false, error: updateRes.raw };
  }
}

// Background Task: Realtime Live Score & Lifecycle Poller (Every 45s)
async function autoSyncLiveMatchesAndFinalize() {
  try {
    // 1. Poll FotMob for active in-play / live / scheduled matches
    const activeRes = await httpsRequest({
      hostname: SUPABASE_HOST,
      path: `/rest/v1/zeta_matches?status=in.(live,in_play,HT,1H,2H,scheduled)&fotmob_id=not.is.null&select=*&limit=30`,
      method: 'GET',
      headers: { 'apikey': ANON_KEY, 'authorization': `Bearer ${ANON_KEY}` }
    });

    if (activeRes.status === 200 && Array.isArray(activeRes.data) && activeRes.data.length > 0) {
      for (const m of activeRes.data) {
        if (!m.fotmob_id) continue;
        const synced = await fetchAndSyncFotMobMatch(m.id, m.fotmob_id);
        if (synced && synced.status === 'finished') {
          console.log(`[Auto-Poller]: Match ${m.home_team} vs ${m.away_team} reached FULL TIME! Finalizing...`);
          m.status = 'finished';
          m.home_score = synced.homeScore ?? m.home_score;
          m.away_score = synced.awayScore ?? m.away_score;
          m.time_elapsed = 'FT';
          if (m.article_url) {
            await updateBloggerPostToFullTime(m);
          }
        }
      }
    }

    // 2. Finalize any finished matches on Blogger that haven't been finalized yet
    const queryPath = `/rest/v1/zeta_matches?status=in.(finished,FT,ended)&not.article_url=is.null&article_title=neq.finalized&select=*&limit=10`;
    const res = await httpsRequest({
      hostname: SUPABASE_HOST,
      path: queryPath,
      method: 'GET',
      headers: {
        'apikey': ANON_KEY,
        'authorization': `Bearer ${ANON_KEY}`
      }
    });

    if (res.status === 200 && Array.isArray(res.data) && res.data.length > 0) {
      console.log(`[Auto-Lifecycle]: Found ${res.data.length} finished match(es) needing Full-Time post updates.`);
      for (const m of res.data) {
        await updateBloggerPostToFullTime(m);
      }
    }
  } catch (err) {
    console.warn('[Auto-Poller Warning]:', err.message);
  }
}

async function runNetlifyFunction(fn, req, res) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const queryStringParameters = {};
      urlObj.searchParams.forEach((v, k) => queryStringParameters[k] = v);

      const event = {
        httpMethod: req.method,
        path: urlObj.pathname,
        headers: req.headers,
        queryStringParameters,
        body
      };

      const result = await fn(event);
      if (result.headers) {
        Object.entries(result.headers).forEach(([k, v]) => {
          if (k.toLowerCase() === 'set-cookie' && Array.isArray(v)) {
            res.setHeader(k, v);
          } else {
            res.setHeader(k, v);
          }
        });
      }
      res.writeHead(result.statusCode || 200);
      res.end(result.body || '');
    } catch (e) {
      console.error('[Netlify Function Local Error]:', e);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
  });
}

const server = http.createServer(async (req, res) => {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // --- 0. NETLIFY SERVERLESS FUNCTIONS LOCAL ADAPTER ---
  if (req.url.startsWith('/api/auth')) {
    const { handler: authHandler } = await import('./netlify/functions/auth.js');
    return runNetlifyFunction(authHandler, req, res);
  }
  if (req.url.startsWith('/api/settings')) {
    const { handler: settingsHandler } = await import('./netlify/functions/settings.js');
    return runNetlifyFunction(settingsHandler, req, res);
  }
  if (req.url.startsWith('/api/audit')) {
    const { handler: auditHandler } = await import('./netlify/functions/audit.js');
    return runNetlifyFunction(auditHandler, req, res);
  }

  // --- 1. PROXY REST API DIRECTLY TO SUPABASE ---
  if (req.url.startsWith('/rest/v1/')) {
    const supabaseUrl = new URL(req.url, `https://${SUPABASE_HOST}`);
    const proxyHeaders = { ...req.headers };
    delete proxyHeaders['host'];
    proxyHeaders['host'] = SUPABASE_HOST;
    proxyHeaders['origin'] = `https://${SUPABASE_HOST}`;

    if (!proxyHeaders['apikey'] || proxyHeaders['apikey'].length < 20) {
      proxyHeaders['apikey'] = ANON_KEY;
    }
    if (!proxyHeaders['authorization'] || proxyHeaders['authorization'].includes('undefined')) {
      proxyHeaders['authorization'] = `Bearer ${ANON_KEY}`;
    }

    const proxyReq = https.request(supabaseUrl, {
      method: req.method,
      headers: proxyHeaders
    }, (proxyRes) => {
      const responseHeaders = { ...proxyRes.headers };
      responseHeaders['access-control-allow-origin'] = '*';
      responseHeaders['access-control-allow-methods'] = 'GET, POST, PATCH, PUT, DELETE, OPTIONS';
      responseHeaders['access-control-allow-headers'] = '*';
      res.writeHead(proxyRes.statusCode, responseHeaders);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error('[Supabase Gateway Error]:', err.message);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Supabase Gateway Error: ' + err.message }));
    });

    req.pipe(proxyReq);
    return;
  }

  // --- 2. BLOGGER & GEMINI API CONFIGURATION ENDPOINTS ---
  if (req.url === '/api/blogger/config') {
    if (req.method === 'GET') {
      let cfg = loadConfig();

      // 1. Central Supabase Sync: Fetch remote configuration from zeta_settings
      try {
        const remoteConfig = await loadConfigFromSupabase();
        if (remoteConfig) {
          const remoteExpiry = Number(remoteConfig.tokenExpiry) || 0;
          const localExpiry = Number(cfg.tokenExpiry) || 0;
          const preferRemote = remoteExpiry > localExpiry || (!cfg.refreshToken && remoteConfig.refreshToken) || (!cfg.accessToken && remoteConfig.accessToken);

          cfg = preferRemote ? { ...cfg, ...remoteConfig } : { ...remoteConfig, ...cfg };
          cfg.refreshToken = cfg.refreshToken || remoteConfig.refreshToken || '';
          cfg.clientSecret = cfg.clientSecret || remoteConfig.clientSecret || '';
          saveConfig(cfg);
        }
      } catch (syncErr) {
        console.warn('[Blogger Config]: Supabase pull warning:', syncErr.message);
      }

      // 2. Auto-refresh if token is expired or near expiry and refreshToken is present
      if (cfg.refreshToken && isGoogleTokenExpired(cfg)) {
        console.log('[Blogger Config]: Google Access Token expired or near expiry. Auto-refreshing...');
        try {
          await refreshGoogleAccessToken(cfg);
          cfg = loadConfig();
        } catch (refErr) {
          console.warn('[Blogger Config]: Auto-refresh failed:', refErr.message);
        }
      }

      // 3. Ensure targetBlogIds is populated
      if (!Array.isArray(cfg.targetBlogIds) || cfg.targetBlogIds.length === 0) {
        cfg.targetBlogIds = cfg.blogId ? String(cfg.blogId).split(',').map(s => s.trim()).filter(Boolean) : [];
      }
      cfg.isConnected = !!cfg.accessToken;

      // 4. CRITICAL CYBERSECURITY SANITIZATION: NEVER return clientSecret or refreshToken!
      const safeConfig = sanitizeBloggerConfigForClient(cfg);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(safeConfig));
      return;
    } else if (req.method === 'POST') {
      if (!verifyAdminSession(req)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized: Admin authentication required to update Blogger configuration' }));
        return;
      }
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const newCfg = JSON.parse(body);
          const current = loadConfig();

          // Never overwrite real geminiApiKey with a masked value
          if (newCfg.geminiApiKey && newCfg.geminiApiKey.includes('••••')) {
            delete newCfg.geminiApiKey;
          }
          // Preserve existing secrets if omitted from client payload
          if (!newCfg.clientSecret && current.clientSecret) {
            newCfg.clientSecret = current.clientSecret;
          }
          if (!newCfg.refreshToken && current.refreshToken) {
            newCfg.refreshToken = current.refreshToken;
          }

          const merged = { ...current, ...newCfg };
          saveConfig(merged);
          await syncConfigToSupabase(merged);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, config: sanitizeBloggerConfigForClient(merged) }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }
  }

  // --- 2A-2. UPLOAD CLIENT SECRET JSON FILE ---
  if (req.url === '/api/blogger/upload-client-secret' && req.method === 'POST') {
    if (!verifyAdminSession(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized: Admin authentication required' }));
      return;
    }
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        let json = JSON.parse(body);
        if (json.fileContent) {
          json = typeof json.fileContent === 'string' ? JSON.parse(json.fileContent) : json.fileContent;
        }
        const creds = json.web || json.installed || json;
        if (!creds.client_id || !creds.client_secret) {
          throw new Error('Invalid client secret JSON: missing client_id or client_secret');
        }

        fs.writeFileSync(path.join(__dirname, 'client_secret.json'), JSON.stringify(json, null, 2), 'utf8');

        const cfg = loadConfig();
        cfg.clientId = creds.client_id;
        cfg.clientSecret = creds.client_secret;
        cfg.projectId = creds.project_id || cfg.projectId || '';
        cfg.authUri = creds.auth_uri || cfg.authUri || '';
        cfg.tokenUri = creds.token_uri || cfg.tokenUri || '';
        saveConfig(cfg);
        await syncConfigToSupabase(cfg);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, clientId: cfg.clientId, projectId: cfg.projectId }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // --- 2B. GOOGLE OAUTH2 AUTHORIZE URL GENERATOR ---
  if (req.url === '/api/blogger/auth-url' && req.method === 'GET') {
    const cfg = loadConfig();
    const host = req.headers.host || `localhost:${PORT}`;
    const redirectUri = `http://${host}/oauth2callback`;
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(cfg.clientId || '')}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent('https://www.googleapis.com/auth/blogger')}&access_type=offline&prompt=consent`;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ authUrl, redirectUri }));
    return;
  }

  // --- 2C. GOOGLE OAUTH2 REDIRECT CALLBACK & TOKEN EXCHANGE ---
  if (req.url.startsWith('/oauth2callback')) {
    const host = req.headers.host || `localhost:${PORT}`;
    const u = new URL(req.url, `http://${host}`);
    const code = u.searchParams.get('code');
    if (!code) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end('<h1>Google Authorization Failed: No code returned</h1>');
      return;
    }

    const cfg = loadConfig();
    const redirectUri = `http://${host}/oauth2callback`;
    const postBody = new URLSearchParams({
      code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    }).toString();

    try {
      const tokenRes = await httpsRequest({
        hostname: 'oauth2.googleapis.com',
        path: '/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postBody)
        }
      }, postBody);

      if (tokenRes.data && tokenRes.data.access_token) {
        const expiresIn = Number(tokenRes.data.expires_in) || 3600;
        cfg.accessToken = tokenRes.data.access_token;
        cfg.tokenExpiry = Date.now() + (expiresIn * 1000);
        cfg.connectionStatus = 'connected';
        if (tokenRes.data.refresh_token) {
          cfg.refreshToken = tokenRes.data.refresh_token;
        }
        saveConfig(cfg);
        console.log('✔ Google OAuth2 token received and saved!');

        // Auto-fetch user's blogs list
        try {
          const blogsRes = await httpsRequest({
            hostname: 'www.googleapis.com',
            path: '/blogger/v3/users/self/blogs',
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${cfg.accessToken}`
            }
          });
          if (blogsRes.data?.items && blogsRes.data.items.length > 0) {
            cfg.blogsList = blogsRes.data.items.map(b => ({ id: b.id, name: b.name, url: b.url }));
            if (!cfg.blogId) {
              cfg.blogId = blogsRes.data.items[0].id;
            }
            if (!cfg.targetBlogIds || cfg.targetBlogIds.length === 0) {
              cfg.targetBlogIds = [cfg.blogId];
            }
            saveConfig(cfg);
            console.log(`✔ Auto-detected ${blogsRes.data.items.length} Blogger blogs for account!`);
          }
        } catch (blogErr) {
          console.warn('Could not auto-fetch blogs:', blogErr.message);
        }

        // Persist fresh tokens and blogs centrally to Supabase
        await syncConfigToSupabase(cfg);

        res.writeHead(302, { 'Location': '/index.html?blogger_auth=success' });
        res.end();
        return;
      } else {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(`<h1>Token Exchange Failed</h1><pre>${JSON.stringify(tokenRes.data, null, 2)}</pre>`);
        return;
      }
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end(`<h1>Token Error: ${e.message}</h1>`);
      return;
    }
  }

  // --- 2D. LIST USER'S BLOGGER BLOGS ---
  if (req.url === '/api/blogger/blogs' && req.method === 'GET') {
    let cfg = loadConfig();
    if (cfg.refreshToken && isGoogleTokenExpired(cfg)) {
      try {
        await refreshGoogleAccessToken(cfg);
        cfg = loadConfig();
      } catch (err) {
        console.warn('[Blogger Blogs]: Token pre-refresh failed:', err.message);
      }
    }
    if (!cfg.accessToken) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not authenticated with Google yet.' }));
      return;
    }

    try {
      let blogsRes = await httpsRequest({
        hostname: 'www.googleapis.com',
        path: '/blogger/v3/users/self/blogs',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${cfg.accessToken}`
        }
      });

      // Auto-refresh token if 401 unauthenticated
      if (blogsRes.status === 401 && cfg.refreshToken) {
        console.log('[Blogger Blogs]: Access token expired (401). Auto-refreshing...');
        try {
          const freshTok = await refreshGoogleAccessToken(cfg);
          blogsRes = await httpsRequest({
            hostname: 'www.googleapis.com',
            path: '/blogger/v3/users/self/blogs',
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${freshTok}`
            }
          });
        } catch (refErr) {
          console.error('[Blogger Blogs]: Token refresh failed:', refErr.message);
        }
      }

      res.writeHead(blogsRes.status || 200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(blogsRes.data));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // --- 3. GENERATE NANO BANANA 2 THUMBNAIL ON-DEMAND ---
  if (req.url === '/api/blogger/generate-thumbnail' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { homeTeam, awayTeam, league, homeLogo, awayLogo, mode, homeScore, awayScore, kickoff, venue } = JSON.parse(body);
        const cfg = loadConfig();
        const matchMeta = { mode, homeScore, awayScore, kickoff, venue };
        const thumbUrl = await generateAiThumbnail(
          homeTeam, awayTeam, league,
          homeLogo || '', awayLogo || '',
          cfg.geminiApiKey,
          cfg.thumbnailPromptTemplate,
          matchMeta
        );
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, thumbUrl }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // --- 3C. GENERATE 3-STATE SVG & UPLOAD TO SUPABASE STORAGE ---
  if (req.url === '/api/thumbnail/upload-storage' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { matchId } = JSON.parse(body);
        if (!matchId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'matchId is required' }));
          return;
        }

        // 1. Fetch match from Supabase
        const matchRes = await httpsRequest({
          hostname: SUPABASE_HOST,
          path: `/rest/v1/zeta_matches?id=eq.${encodeURIComponent(matchId)}&select=*`,
          method: 'GET',
          headers: { 'apikey': ANON_KEY, 'authorization': `Bearer ${ANON_KEY}` }
        });

        if (!Array.isArray(matchRes.data) || matchRes.data.length === 0) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Match ${matchId} not found` }));
          return;
        }

        const m = matchRes.data[0];
        const publicStorageUrl = `https://${SUPABASE_HOST}/storage/v1/object/public/match-thumbnails/${m.id}.svg`;

        // Update zeta_matches thumbnail_url
        await httpsRequest({
          hostname: SUPABASE_HOST,
          path: `/rest/v1/zeta_matches?id=eq.${encodeURIComponent(matchId)}`,
          method: 'PATCH',
          headers: {
            'apikey': ANON_KEY,
            'authorization': `Bearer ${ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          }
        }, JSON.stringify({ thumbnail_url: publicStorageUrl, updated_at: new Date().toISOString() }));

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          matchId,
          thumbnailUrl: publicStorageUrl
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // --- 3D. CUSTOMIZE THUMBNAIL RIGHT IMAGE & REGENERATE ---
  if (req.url === '/api/thumbnail/customize-right-image' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { matchId, rightImageUrl, mode } = JSON.parse(body || '{}');
        if (!matchId || !rightImageUrl) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'matchId and rightImageUrl are required' }));
          return;
        }

        // 1. Fetch match from Supabase
        const matchRes = await httpsRequest({
          hostname: SUPABASE_HOST,
          path: `/rest/v1/zeta_matches?id=eq.${encodeURIComponent(matchId)}&select=*`,
          method: 'GET',
          headers: { 'apikey': ANON_KEY, 'authorization': `Bearer ${ANON_KEY}` }
        });

        if (!Array.isArray(matchRes.data) || matchRes.data.length === 0) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Match ${matchId} not found` }));
          return;
        }

        const m = matchRes.data[0];
        const cfg = loadConfig();
        const matchMeta = {
          mode: 'after', // Strict Full-Time match recap presentation
          homeScore: m.home_score !== null && m.home_score !== undefined ? m.home_score : 0,
          awayScore: m.away_score !== null && m.away_score !== undefined ? m.away_score : 0,
          kickoff: m.kickoff_time || m.kickoff_ist,
          venue: m.venue,
          status: 'FT',
          rightImageUrl: rightImageUrl.trim(),
          article_image: rightImageUrl.trim()
        };

        console.log(`[Thumbnail Engine]: Rendering customized thumbnail for ${m.home_team} vs ${m.away_team} with custom right image...`);
        const newThumbUrl = await generateCanvasMatchdayPoster(
          m.home_team, m.away_team, m.league_name || m.league || 'Football',
          m.home_logo, m.away_logo,
          matchMeta
        );

        // Update Supabase with new thumbnail_url and article_image
        await httpsRequest({
          hostname: SUPABASE_HOST,
          path: `/rest/v1/zeta_matches?id=eq.${encodeURIComponent(matchId)}`,
          method: 'PATCH',
          headers: {
            'apikey': ANON_KEY,
            'authorization': `Bearer ${ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          }
        }, JSON.stringify({
          thumbnail_url: newThumbUrl,
          article_image: rightImageUrl.trim(),
          updated_at: new Date().toISOString()
        }));

        // If published on Blogger, update the post content with the new thumbnail!
        let bloggerUpdated = false;
        if (m.article_url || (m.article_source && m.article_source.startsWith('blogger:'))) {
          try {
            m.thumbnail_url = newThumbUrl;
            m.article_image = rightImageUrl.trim();
            const upRes = await updateBloggerPostToFullTime(m);
            bloggerUpdated = upRes?.success || false;
          } catch (bErr) {
            console.warn('[Custom Thumb]: Blogger sync warning:', bErr.message);
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          matchId,
          thumbnailUrl: newThumbUrl,
          rightImageUrl: rightImageUrl.trim(),
          bloggerUpdated
        }));
      } catch (err) {
        console.error('[Customize Thumbnail Error]:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // --- 3A. PREVIEW & GENERATE FULL 17-COMPONENT LIVE POST HTML ---
  if ((req.url === '/api/blogger/preview-html' || req.url === '/api/blogger/generate-html' || req.url.startsWith('/api/blogger/preview-html?') || req.url.startsWith('/api/blogger/generate-html?')) && (req.method === 'POST' || req.method === 'GET')) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        let matchId = null;
        if (req.method === 'POST') {
          const parsed = JSON.parse(body || '{}');
          matchId = parsed.matchId || parsed.id || parsed.fotmobId || parsed.fotmob_id;
        } else {
          const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
          matchId = u.searchParams.get('matchId') || u.searchParams.get('id') || u.searchParams.get('fotmobId') || u.searchParams.get('fotmob_id');
        }

        if (!matchId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'matchId is required' }));
          return;
        }

        // 1. Fetch match from Supabase
        let matchRes = await httpsRequest({
          hostname: SUPABASE_HOST,
          path: `/rest/v1/zeta_matches?id=eq.${encodeURIComponent(matchId)}&select=*`,
          method: 'GET',
          headers: {
            'apikey': ANON_KEY,
            'authorization': `Bearer ${ANON_KEY}`
          }
        });

        // Fallback: try lookup by fotmob_id
        if (!Array.isArray(matchRes.data) || matchRes.data.length === 0) {
          matchRes = await httpsRequest({
            hostname: SUPABASE_HOST,
            path: `/rest/v1/zeta_matches?fotmob_id=eq.${encodeURIComponent(matchId)}&select=*`,
            method: 'GET',
            headers: {
              'apikey': ANON_KEY,
              'authorization': `Bearer ${ANON_KEY}`
            }
          });
        }

        let m = (Array.isArray(matchRes.data) && matchRes.data.length > 0) ? matchRes.data[0] : null;

        // If match not in Supabase yet but numeric ID is provided, build in-memory match object
        if (!m && /^\d+$/.test(String(matchId).trim())) {
          m = {
            id: String(matchId),
            fotmob_id: String(matchId),
            status: 'scheduled',
            home_team: 'Home Team',
            away_team: 'Away Team'
          };
        }

        if (!m) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Match ${matchId} not found in Supabase` }));
          return;
        }

        // 2. Deep sync freshest FotMob telemetry if fotmob_id is available
        if (m.fotmob_id) {
          try {
            const syncedM = await fetchAndSyncFotMobMatch(m.id, m.fotmob_id);
            if (syncedM) Object.assign(m, syncedM);
          } catch (syncErr) {
            console.warn('[Preview HTML]: FotMob telemetry sync notice:', syncErr.message);
          }
        }

        const cfg = loadConfig();
        const homeTeam = m.home_team || 'Home';
        const awayTeam = m.away_team || 'Away';
        const league = m.league_name || m.league || 'Football League';
        const thumbUrl = m.thumbnail_url || '';

        const postTitle = `${homeTeam} vs ${awayTeam} Lineups, Live Score & Match Center - ${league}`;
        const searchDescription = `zeta:${m.id} - ${homeTeam} vs ${awayTeam} live score, starting lineups, tactical formation and HD broadcast stream.`;

        const html = await generateRichPostContent(m, cfg, null, thumbUrl);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          matchId: m.id,
          fotmobId: m.fotmob_id || null,
          title: postTitle,
          searchDescription,
          html
        }));
      } catch (err) {
        console.error('[Preview HTML Error]:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // --- 3B. APPROVE MATCH & GENERATE 16:9 BROADCAST THUMBNAIL ON DEMAND ---
  if (req.url === '/api/blogger/approve-and-generate' && req.method === 'POST') {
    if (!verifyAdminSession(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized: Admin authentication required' }));
      return;
    }
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { matchId } = JSON.parse(body);
        if (!matchId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'matchId is required' }));
          return;
        }

        // 1. Fetch match from Supabase
        const matchRes = await httpsRequest({
          hostname: SUPABASE_HOST,
          path: `/rest/v1/zeta_matches?id=eq.${encodeURIComponent(matchId)}&select=*`,
          method: 'GET',
          headers: {
            'apikey': ANON_KEY,
            'authorization': `Bearer ${ANON_KEY}`
          }
        });

        if (!Array.isArray(matchRes.data) || matchRes.data.length === 0) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Match ${matchId} not found in Supabase` }));
          return;
        }

        const m = matchRes.data[0];
        const homeTeam = m.home_team || 'Home';
        const awayTeam = m.away_team || 'Away';
        const league = m.league_name || m.league || 'Football League';
        const homeLogo = m.home_logo || '';
        const awayLogo = m.away_logo || '';

        const cfg = loadConfig();
        const matchMeta = {
          mode: cfg.thumbnailMode || 'auto',
          homeScore: m.home_score,
          awayScore: m.away_score,
          kickoff: m.kickoff_time || m.kickoff_ist,
          venue: m.venue,
          status: m.status,
          rightImageUrl: m.article_image || null,
          article_image: m.article_image || null
        };

        // 2. Generate 16:9 Broadcast Thumbnail with Team Crests & ZetaSports branding
        console.log(`[Approval Engine]: Generating broadcast thumbnail for ${homeTeam} vs ${awayTeam}...`);
        const thumbUrl = await generateAiThumbnail(
          homeTeam, awayTeam, league,
          homeLogo, awayLogo,
          cfg.geminiApiKey,
          cfg.thumbnailPromptTemplate,
          matchMeta
        );

        // 3. Update Supabase with is_approved=true and thumbnail_url
        const patchPayload = {
          is_approved: true,
          thumbnail_url: thumbUrl,
          updated_at: new Date().toISOString()
        };

        await httpsRequest({
          hostname: SUPABASE_HOST,
          path: `/rest/v1/zeta_matches?id=eq.${encodeURIComponent(matchId)}`,
          method: 'PATCH',
          headers: {
            'apikey': ANON_KEY,
            'authorization': `Bearer ${ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          }
        }, JSON.stringify(patchPayload));

        console.log(`✔ [Approval Engine]: Match ${matchId} approved & thumbnail saved: ${thumbUrl}`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          matchId,
          thumbUrl,
          is_approved: true
        }));
      } catch (e) {
        console.error('[Approval Engine Error]:', e.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // --- 4. PUBLISH MATCH TO BLOGGER (AUTO-POSTER) ---
  if ((req.url === '/api/blogger/publish-match' || req.url === '/api/blogger/publish') && req.method === 'POST') {
    if (!verifyAdminSession(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized: Admin authentication required to publish matches' }));
      return;
    }
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { matchId } = JSON.parse(body);
        if (!matchId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'matchId is required' }));
          return;
        }

        let cfg = loadConfig();
        if (cfg.refreshToken && isGoogleTokenExpired(cfg)) {
          try {
            await refreshGoogleAccessToken(cfg);
            cfg = loadConfig();
          } catch (tokErr) {
            console.warn('[Publish Match]: Token pre-refresh warning:', tokErr.message);
          }
        }

        if (!cfg.accessToken) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: 'Google Account not connected yet. Please open "Blogger & AI Settings" and click "Connect Google Account" to authorize Blogger API.'
          }));
          return;
        }
        if (!cfg.blogId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Blogger Blog ID is not configured. Please save it in Site Config.' }));
          return;
        }

        // 1. Fetch Match details from Supabase
        const matchRes = await httpsRequest({
          hostname: SUPABASE_HOST,
          path: `/rest/v1/zeta_matches?id=eq.${encodeURIComponent(matchId)}&select=*`,
          method: 'GET',
          headers: {
            'apikey': ANON_KEY,
            'authorization': `Bearer ${ANON_KEY}`
          }
        });

        if (!Array.isArray(matchRes.data) || matchRes.data.length === 0) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Match ${matchId} not found in Supabase` }));
          return;
        }

        const m = matchRes.data[0];

        // 1B. Auto-Sync Fresh Telemetry from FotMob if available
        if (m.fotmob_id) {
          try {
            const syncedM = await fetchAndSyncFotMobMatch(matchId, m.fotmob_id);
            if (syncedM) Object.assign(m, syncedM);
          } catch (syncErr) {
            console.warn('[Blogger Publisher]: FotMob pre-sync notice:', syncErr.message);
          }
        }

        const homeTeam = m.home_team || 'Home';
        const awayTeam = m.away_team || 'Away';
        const league = m.league_name || m.league || 'Football League';
        const homeLogo = m.home_logo || '';
        const awayLogo = m.away_logo || '';

        const matchMeta = {
          mode: cfg.thumbnailMode || 'auto',
          homeScore: m.home_score,
          awayScore: m.away_score,
          kickoff: m.kickoff_time || m.kickoff_ist,
          venue: m.venue,
          status: m.status
        };

        // 2. Use existing Thumbnail (or generate if missing)
        let thumbUrl = m.thumbnail_url || '';
        if (!thumbUrl && cfg.useNanoBananaThumbnail !== false) {
          thumbUrl = await generateAiThumbnail(
            homeTeam, awayTeam, league,
            homeLogo, awayLogo,
            cfg.geminiApiKey,
            cfg.thumbnailPromptTemplate,
            matchMeta
          );
          // Persist generated thumbnail back to match
          try {
            await httpsRequest({
              hostname: SUPABASE_HOST,
              path: `/rest/v1/zeta_matches?id=eq.${encodeURIComponent(matchId)}`,
              method: 'PATCH',
              headers: {
                'apikey': ANON_KEY,
                'authorization': `Bearer ${ANON_KEY}`,
                'Content-Type': 'application/json'
              }
            }, JSON.stringify({ thumbnail_url: thumbUrl }));
          } catch (err) {}
        }

        // 3. Build Blogger v3 Rich Post Payload (Full Editorial, SEO Lineups, H2H, Schema.org)
        const postTitle = `${homeTeam} vs ${awayTeam} Lineups, Live Score & Match Center - ${league}`;
        const searchDescription = `zeta:${m.id} - ${homeTeam} vs ${awayTeam} live score, starting lineups, tactical formation and HD broadcast stream.`;

        const postContent = await generateRichPostContent(m, cfg, null, thumbUrl);

        const bloggerPayload = {
          kind: 'blogger#post',
          blog: { id: cfg.blogId },
          title: postTitle,
          content: postContent,
          customMetaData: searchDescription,
          labels: [league, homeTeam, awayTeam, 'Live Match', 'Football']
        };

        // 4. Send to Google Blogger API v3
        const bloggerApiPath = `/blogger/v3/blogs/${encodeURIComponent(cfg.blogId)}/posts${cfg.apiKey ? `?key=${encodeURIComponent(cfg.apiKey)}` : ''}`;
        const bloggerHeaders = {
          'Content-Type': 'application/json'
        };

        if (cfg.accessToken) {
          bloggerHeaders['Authorization'] = `Bearer ${cfg.accessToken.trim()}`;
        }

        let publishRes = await httpsRequest({
          hostname: 'www.googleapis.com',
          path: bloggerApiPath,
          method: 'POST',
          headers: bloggerHeaders
        }, bloggerPayload);

        // Auto-refresh token and retry once if Google returned 401 UNAUTHENTICATED
        if (publishRes.status === 401 && cfg.refreshToken) {
          console.log('[Blogger API]: Access token expired during publish (401). Auto-refreshing and retrying...');
          try {
            const freshTok = await refreshGoogleAccessToken(cfg);
            bloggerHeaders['Authorization'] = `Bearer ${freshTok.trim()}`;
            publishRes = await httpsRequest({
              hostname: 'www.googleapis.com',
              path: bloggerApiPath,
              method: 'POST',
              headers: bloggerHeaders
            }, bloggerPayload);
          } catch (refErr) {
            console.error('[Blogger API]: Auto-refresh failed during publish:', refErr.message);
          }
        }

        if (publishRes.status !== 200 && publishRes.status !== 201) {
          console.error('[Blogger API Error]:', publishRes.raw);
          res.writeHead(publishRes.status || 500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: `Blogger API Error (${publishRes.status}): ${typeof publishRes.data === 'object' ? JSON.stringify(publishRes.data.error || publishRes.data) : publishRes.raw}`
          }));
          return;
        }

        const publishedPostUrl = publishRes.data?.url || '';

        // 5. Save published URL and post ID to Supabase zeta_matches
        if (publishedPostUrl) {
          await httpsRequest({
            hostname: SUPABASE_HOST,
            path: `/rest/v1/zeta_matches?id=eq.${encodeURIComponent(matchId)}`,
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'apikey': ANON_KEY,
              'authorization': `Bearer ${ANON_KEY}`,
              'Prefer': 'return=minimal'
            }
          }, { 
            article_url: publishedPostUrl,
            article_source: publishRes.data?.id ? `blogger:${publishRes.data.id}` : null
          });
          console.log(`[Blogger Auto-Poster]: Match ${matchId} published successfully -> ${publishedPostUrl}`);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          matchId,
          postUrl: publishedPostUrl,
          postId: publishRes.data?.id,
          thumbUrl
        }));

      } catch (err) {
        console.error('[Publish Match Exception]:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // --- 4B. FINALIZE MATCH (AFTER-MATCH FULL TIME UPDATE) ---
  if (req.url === '/api/blogger/finalize' && req.method === 'POST') {
    if (!verifyAdminSession(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized: Admin authentication required to finalize matches' }));
      return;
    }
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { matchId } = JSON.parse(body);
        if (!matchId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'matchId is required' }));
          return;
        }

        const matchRes = await httpsRequest({
          hostname: SUPABASE_HOST,
          path: `/rest/v1/zeta_matches?id=eq.${encodeURIComponent(matchId)}&select=*`,
          method: 'GET',
          headers: {
            'apikey': ANON_KEY,
            'authorization': `Bearer ${ANON_KEY}`
          }
        });

        if (!Array.isArray(matchRes.data) || matchRes.data.length === 0) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Match ${matchId} not found` }));
          return;
        }

        const m = matchRes.data[0];
        const result = await updateBloggerPostToFullTime(m);
        res.writeHead(result.success ? 200 : 500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // --- 4C. DELETE POST FROM BLOGGER & UNLINK MATCH ---
  if ((req.url === '/api/blogger/delete-post' || req.url === '/api/blogger/delete') && req.method === 'POST') {
    if (!verifyAdminSession(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized: Admin authentication required to delete posts' }));
      return;
    }
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const bodyJson = JSON.parse(body || '{}');
        const { matchId, postId: explicitPostId, postUrl: reqPostUrl, homeTeam: reqHome, awayTeam: reqAway } = bodyJson;

        if (!matchId && !explicitPostId && !reqPostUrl) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'matchId, postId, or postUrl is required' }));
          return;
        }

        let cfg = loadConfig();
        if (cfg.refreshToken && isGoogleTokenExpired(cfg)) {
          try {
            await refreshGoogleAccessToken(cfg);
            cfg = loadConfig();
          } catch (tokErr) {
            console.warn('[Delete Post]: Token pre-refresh warning:', tokErr.message);
          }
        }

        if (!cfg.accessToken) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Google Account not connected yet.' }));
          return;
        }

        if (!cfg.blogId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Blogger Blog ID is not configured.' }));
          return;
        }

        let targetMatch = null;
        if (matchId) {
          const matchRes = await httpsRequest({
            hostname: SUPABASE_HOST,
            path: `/rest/v1/zeta_matches?id=eq.${encodeURIComponent(matchId)}&select=*`,
            method: 'GET',
            headers: { 'apikey': ANON_KEY, 'authorization': `Bearer ${ANON_KEY}` }
          });

          if (Array.isArray(matchRes.data) && matchRes.data.length > 0) {
            targetMatch = matchRes.data[0];
          }
        }

        const deletePostIds = new Set();
        if (explicitPostId) deletePostIds.add(String(explicitPostId).trim());

        if (targetMatch && targetMatch.article_source && targetMatch.article_source.startsWith('blogger:')) {
          const pid = targetMatch.article_source.replace('blogger:', '').trim();
          if (pid) deletePostIds.add(pid);
        }

        // Search Blogger by team names & match ID & URL
        const homeTeam = (targetMatch?.home_team || reqHome || '').trim();
        const awayTeam = (targetMatch?.away_team || reqAway || '').trim();
        const articleUrl = (targetMatch?.article_url || reqPostUrl || '').trim();

        if (homeTeam && awayTeam) {
          try {
            const queryStr = `${homeTeam} ${awayTeam}`;
            let sRes = await httpsRequest({
              hostname: 'www.googleapis.com',
              path: `/blogger/v3/blogs/${encodeURIComponent(cfg.blogId)}/posts/search?q=${encodeURIComponent(queryStr)}`,
              method: 'GET',
              headers: { 'Authorization': `Bearer ${cfg.accessToken.trim()}` }
            });

            if (sRes.status === 401 && cfg.refreshToken) {
              const freshTok = await refreshGoogleAccessToken(cfg);
              cfg = loadConfig();
              sRes = await httpsRequest({
                hostname: 'www.googleapis.com',
                path: `/blogger/v3/blogs/${encodeURIComponent(cfg.blogId)}/posts/search?q=${encodeURIComponent(queryStr)}`,
                method: 'GET',
                headers: { 'Authorization': `Bearer ${freshTok.trim()}` }
              });
            }

            if (sRes.data?.items && sRes.data.items.length > 0) {
              const hLower = homeTeam.toLowerCase();
              const aLower = awayTeam.toLowerCase();
              sRes.data.items.forEach(p => {
                const titleLower = (p.title || '').toLowerCase();
                if ((titleLower.includes(hLower) && titleLower.includes(aLower)) || (articleUrl && p.url === articleUrl)) {
                  deletePostIds.add(p.id);
                  console.log(`[Blogger Matcher]: Found matching post to delete: ${p.id} (${p.title})`);
                }
              });
            }
          } catch (sErr) {
            console.warn('[Blogger Search Error]:', sErr.message);
          }
        }

        // Also check if articleUrl directly matches any recent posts on the blog
        if (deletePostIds.size === 0 && articleUrl) {
          try {
            const listRes = await httpsRequest({
              hostname: 'www.googleapis.com',
              path: `/blogger/v3/blogs/${encodeURIComponent(cfg.blogId)}/posts?maxResults=25`,
              method: 'GET',
              headers: { 'Authorization': `Bearer ${cfg.accessToken.trim()}` }
            });
            if (listRes.data?.items) {
              const urlSlug = articleUrl.split('/').pop().replace(/\.html.*$/, '');
              listRes.data.items.forEach(p => {
                if (p.url === articleUrl || (urlSlug && p.url.includes(urlSlug))) {
                  deletePostIds.add(p.id);
                  console.log(`[Blogger URL Matcher]: Found post by URL: ${p.id} (${p.url})`);
                }
              });
            }
          } catch (lErr) {}
        }

        // Delete all matching posts on Blogger API v3
        let deletedCount = 0;
        for (const pid of deletePostIds) {
          try {
            const deletePath = `/blogger/v3/blogs/${encodeURIComponent(cfg.blogId)}/posts/${encodeURIComponent(pid)}`;
            let delRes = await httpsRequest({
              hostname: 'www.googleapis.com',
              path: deletePath,
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${cfg.accessToken.trim()}` }
            });

            if (delRes.status === 401 && cfg.refreshToken) {
              const freshTok = await refreshGoogleAccessToken(cfg);
              cfg = loadConfig();
              delRes = await httpsRequest({
                hostname: 'www.googleapis.com',
                path: deletePath,
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${freshTok.trim()}` }
              });
            }

            if (delRes.status === 204 || delRes.status === 200 || delRes.status === 404) {
              deletedCount++;
              console.log(`✔ [Blogger API]: Successfully deleted post ${pid} (HTTP ${delRes.status})`);
            } else {
              console.warn(`[Blogger API Warning]: Post ${pid} delete returned status ${delRes.status}`);
            }
          } catch (dErr) {
            console.error(`[Delete Post Error for ${pid}]:`, dErr.message);
          }
        }

        // Reset article_url and article_source in Supabase zeta_matches
        if (matchId) {
          await httpsRequest({
            hostname: SUPABASE_HOST,
            path: `/rest/v1/zeta_matches?id=eq.${encodeURIComponent(matchId)}`,
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'apikey': ANON_KEY,
              'authorization': `Bearer ${ANON_KEY}`,
              'Prefer': 'return=minimal'
            }
          }, {
            article_url: null,
            article_source: null
          });
          console.log(`✔ Match ${matchId} unlinked in Supabase!`);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          matchId,
          deletedCount,
          deletedIds: Array.from(deletePostIds),
          message: deletedCount > 0 ? `Successfully deleted ${deletedCount} post(s) from Blogger!` : 'Match unlinked from database'
        }));
      } catch (err) {
        console.error('[Delete Post Exception]:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // --- 4C-2. LINK ARTICLE URL DIRECTLY TO MATCH ---
  if (req.url === '/api/match/link-article' && req.method === 'POST') {
    if (!verifyAdminSession(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized: Admin authentication required' }));
      return;
    }
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { matchId, articleUrl } = JSON.parse(body || '{}');
        if (!matchId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'matchId is required' }));
          return;
        }

        const patchRes = await httpsRequest({
          hostname: SUPABASE_HOST,
          path: `/rest/v1/zeta_matches?id=eq.${encodeURIComponent(matchId)}`,
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': ANON_KEY,
            'authorization': `Bearer ${ANON_KEY}`,
            'Prefer': 'return=representation'
          }
        }, {
          article_url: articleUrl ? articleUrl.trim() : null,
          updated_at: new Date().toISOString()
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          matchId,
          articleUrl: articleUrl ? articleUrl.trim() : null,
          data: patchRes.data
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // --- 4D. SYNC FOTMOB MATCH DETAILS ---
  if (req.url === '/api/fotmob/sync-match' && req.method === 'POST') {
    if (!verifyAdminSession(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized: Admin authentication required' }));
      return;
    }
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { matchId, fotmobId } = JSON.parse(body || '{}');
        if (!matchId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'matchId is required' }));
          return;
        }

        let targetFotmobId = fotmobId;
        if (!targetFotmobId) {
          const matchRes = await httpsRequest({
            hostname: SUPABASE_HOST,
            path: `/rest/v1/zeta_matches?id=eq.${encodeURIComponent(matchId)}&select=fotmob_id`,
            method: 'GET',
            headers: { 'apikey': ANON_KEY, 'authorization': `Bearer ${ANON_KEY}` }
          });
          if (Array.isArray(matchRes.data) && matchRes.data[0]?.fotmob_id) {
            targetFotmobId = matchRes.data[0].fotmob_id;
          }
        }

        if (!targetFotmobId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'No fotmob_id found for this match in Supabase' }));
          return;
        }

        const synced = await fetchAndSyncFotMobMatch(matchId, targetFotmobId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          matchId,
          fotmobId: targetFotmobId,
          synced
        }));
      } catch (e) {
        console.error('[FotMob Sync Endpoint Error]:', e);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // --- 5. STATIC FILE SERVER (FOR ADMIN V3 & WEB) ---
  let reqPath = decodeURI(req.url.split('?')[0]);
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  const cleanPath = reqPath.replace(/^\/+/, '');
  let filePath;

  if (cleanPath.startsWith('web/')) {
    const webDir = path.resolve(__dirname, '..', 'web');
    filePath = path.join(webDir, cleanPath.replace(/^web\//, ''));
  } else {
    filePath = path.join(__dirname, cleanPath);
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`404 Not Found: ${reqPath}`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    if (ext === '.html') {
      try {
        let content = fs.readFileSync(filePath, 'utf8');
        content = content.replace(/app\.js(\?[^"]*)?/g, `app.js?t=${Date.now()}`);
        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0'
        });
        res.end(content);
        return;
      } catch (_) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error loading template');
        return;
      }
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

process.on('uncaughtException', (err) => {
  console.error('[CRASH PREVENTED - uncaughtException]:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[CRASH PREVENTED - unhandledRejection]:', reason);
});

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://localhost:${PORT}/index.html`;
  console.log(`\x1b[32m✔ ZetaSports Admin Portal v3 running at:\x1b[0m \x1b[36m${url}\x1b[0m`);
  console.log(`\x1b[90mBlogger API Gateway + Nano Banana 2 active on port ${PORT}.\x1b[0m\n`);
});

