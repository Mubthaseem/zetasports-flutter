// ==============================================================================
// ZetaSports Admin Portal v2: Zero-Dependency Local Static Server & API Gateway
// Solves browser CORS limitations, proxies Supabase REST calls, and ensures zero cache
// ==============================================================================

import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;
const SUPABASE_HOST = 'voocdrpetiyspuhyeapi.supabase.co';
const ANON_KEY = 'sb_publishable_luDUt769BBrrApn8z-Cgvw_W9VE0rIV';

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

const server = http.createServer((req, res) => {
  // Enable full CORS for local development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // --- 1. PROXY REST API DIRECTLY TO SUPABASE (ZERO CORS, ZERO NETWORK BLOCKS) ---
  if (req.url.startsWith('/rest/v1/')) {
    const supabaseUrl = new URL(req.url, `https://${SUPABASE_HOST}`);
    const proxyHeaders = { ...req.headers };
    delete proxyHeaders['host'];
    proxyHeaders['host'] = SUPABASE_HOST;
    proxyHeaders['origin'] = `https://${SUPABASE_HOST}`;

    // Ensure verified credentials are always attached
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

  // --- 2. STATIC FILE SERVER (WITH CACHE-BUSTING) ---
  let reqPath = decodeURI(req.url.split('?')[0]);
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  let filePath = path.join(__dirname, reqPath);

  // Security check: ensure path is within directory or standalone web directory
  if (!filePath.startsWith(__dirname)) {
    const webDir = path.resolve(__dirname, '..', 'web');
    filePath = path.join(webDir, reqPath.replace(/^\/web\//, ''));
    if (!filePath.startsWith(webDir)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`404 Not Found: ${reqPath}`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // For HTML, dynamically inject timestamp cache buster for script tags
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
      } catch (readErr) {
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

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://localhost:${PORT}/index.html`;
  console.log(`\x1b[32m✔ ZetaSports Admin Portal v2 running at:\x1b[0m \x1b[36m${url}\x1b[0m`);
  console.log(`\x1b[90mAPI Gateway active: /rest/v1/* proxied to Supabase with zero CORS.\x1b[0m\n`);

  if (process.platform === 'win32') {
    exec(`start ${url}`);
  }
});
