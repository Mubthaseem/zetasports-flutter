import http from 'http';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const gunzip = promisify(zlib.gunzip);
const PORT = 7676;

const FOTMOB_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Referer': 'https://www.fotmob.com/',
  'Accept': '*/*',
  'Accept-Language': 'en-GB,en;q=0.9',
};

let cachedBuildId = null;

async function getBuildId() {
  if (cachedBuildId) return cachedBuildId;
  try {
    const res = await fetch('https://www.fotmob.com/', { headers: FOTMOB_HEADERS });
    const html = await res.text();
    const tag = '__NEXT_DATA__" type="application/json">';
    const start = html.indexOf(tag) + tag.length;
    const end = html.indexOf('</script>', start);
    const data = JSON.parse(html.slice(start, end));
    cachedBuildId = data.buildId;
    return cachedBuildId;
  } catch (e) {
    console.warn('Fallback buildId due to:', e.message);
    return 'quX4vmazDEcAFzWw1ZjDZ';
  }
}

async function proxyFetch(targetUrl, isGzip = false) {
  try {
    const res = await fetch(targetUrl, { headers: FOTMOB_HEADERS });
    if (!res.ok) {
      return { status: res.status, error: `HTTP ${res.status}` };
    }
    if (isGzip) {
      const buf = await res.arrayBuffer();
      const decompressed = await gunzip(Buffer.from(buf));
      return { status: 200, data: JSON.parse(decompressed.toString('utf8')) };
    }
    const data = await res.json();
    return { status: 200, data };
  } catch (e) {
    return { status: 500, error: e.message };
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // Serve HTML UI
  if (url.pathname === '/' || url.pathname === '/index.html') {
    const htmlPath = path.join(__dirname, 'fotmob_api_tester.html');
    if (fs.existsSync(htmlPath)) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.writeHead(200);
      res.end(fs.readFileSync(htmlPath));
    } else {
      res.writeHead(404);
      res.end('fotmob_api_tester.html not found');
    }
    return;
  }

  // GET /buildid
  if (url.pathname === '/buildid') {
    const buildId = await getBuildId();
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({ buildId }));
    return;
  }

  // GET /proxy?url=<encoded_url>&gzip=1
  if (url.pathname === '/proxy') {
    const targetUrl = url.searchParams.get('url');
    const isGzip = url.searchParams.get('gzip') === '1';
    if (!targetUrl) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Missing url param' }));
      return;
    }
    try {
      const result = await proxyFetch(decodeURIComponent(targetUrl), isGzip);
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(result.status || 200);
      res.end(JSON.stringify(result));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`\n✅ ZetaSports FotMob API Tester`);
  console.log(`   Open: http://localhost:${PORT}`);
  console.log(`   Press Ctrl+C to stop\n`);
});
