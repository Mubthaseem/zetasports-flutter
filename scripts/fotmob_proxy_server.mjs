import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 7676;

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://voocdrpetiyspuhyeapi.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_luDUt769BBrrApn8z-Cgvw_W9VE0rIV';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const FOTMOB_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Referer': 'https://www.fotmob.com/',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-GB,en;q=0.9',
};

async function fetchFotmob(url) {
  const startTime = Date.now();
  try {
    const res = await fetch(url, { headers: FOTMOB_HEADERS });
    const latency = Date.now() - startTime;
    if (!res.ok) {
      return {
        status: res.status,
        error: `HTTP ${res.status}: ${res.statusText}`,
        latency,
        url,
      };
    }
    const data = await res.json();
    const size = Buffer.byteLength(JSON.stringify(data));
    return {
      status: 200,
      data,
      latency,
      sizeKb: (size / 1024).toFixed(1),
      url,
    };
  } catch (e) {
    return {
      status: 500,
      error: e.message,
      latency: Date.now() - startTime,
      url,
    };
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. Serve UI
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

  // 2. GET /api/match?id=<matchId>
  if (url.pathname === '/api/match') {
    const matchId = url.searchParams.get('id');
    if (!matchId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing match id parameter' }));
      return;
    }
    const apiUrl = `https://www.fotmob.com/api/data/matchDetails?matchId=${matchId}`;
    const result = await fetchFotmob(apiUrl);
    res.writeHead(result.status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  // 3. GET /api/tv?id=<matchId>
  if (url.pathname === '/api/tv') {
    const matchId = url.searchParams.get('id');
    const apiUrl = `https://www.fotmob.com/api/data/tvlistings?matchId=${matchId}`;
    const result = await fetchFotmob(apiUrl);
    res.writeHead(result.status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  // 4. GET /api/matches?date=<YYYYMMDD>
  if (url.pathname === '/api/matches') {
    const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const apiUrl = `https://www.fotmob.com/api/data/matches?date=${date}`;
    const result = await fetchFotmob(apiUrl);
    res.writeHead(result.status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  // 5. GET /api/allLeagues
  if (url.pathname === '/api/allLeagues') {
    const apiUrl = `https://www.fotmob.com/api/data/allLeagues`;
    const result = await fetchFotmob(apiUrl);
    res.writeHead(result.status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  // 6. POST /api/supabase/push
  if (url.pathname === '/api/supabase/push' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { matchId, dataKey, rawJson, phase = 'live' } = JSON.parse(body);
        if (!matchId || !dataKey || !rawJson) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing required fields: matchId, dataKey, rawJson' }));
          return;
        }

        const { data, error } = await sb.from('fotmob_raw').upsert(
          {
            match_id: String(matchId),
            data_key: dataKey,
            raw_json: rawJson,
            fetched_at: new Date().toISOString(),
            phase
          },
          { onConflict: 'match_id,data_key' }
        ).select();

        if (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, saved: data }));
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 7. GET /proxy?url=<encodedUrl>
  if (url.pathname === '/proxy') {
    const targetUrl = url.searchParams.get('url');
    if (!targetUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing url parameter' }));
      return;
    }
    const result = await fetchFotmob(decodeURIComponent(targetUrl));
    res.writeHead(result.status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`🚀 ZetaSports Advanced FotMob Telemetry & API Hub`);
  console.log(`   Local URL:    http://localhost:${PORT}`);
  console.log(`   Network URL:  http://127.0.0.1:${PORT}`);
  console.log(`   Direct API:   http://localhost:${PORT}/api/match?id=5181862`);
  console.log(`======================================================\n`);
});
