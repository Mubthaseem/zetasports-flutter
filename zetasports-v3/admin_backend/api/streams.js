// ==============================================================================
// Edge-Cached Streams Endpoint (OWASP & Egress Shield)
// Caches live streams on Vercel Edge CDN for 60s
// Prevents Supabase egress exhaustion
// ==============================================================================

import https from 'https';

const SUPABASE_HOST = process.env.SUPABASE_HOST || 'udlncusvhmydivtjkjcy.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_VXZvAq86GvVgqY-c23gwmQ_RtuTSlWF';

function fetchSupabase(path) {
  return new Promise((resolve, reject) => {
    https.get({
      hostname: SUPABASE_HOST,
      path: path,
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'User-Agent': 'ZetaSports-Vercel-Edge-Gateway'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (_) {
          resolve({ status: res.statusCode, data });
        }
      });
    }).on('error', reject);
  });
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Edge CDN Caching: 60s fresh, 300s stale-while-revalidate
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

  try {
    const rawUrl = req.url || '';
    const queryIdx = rawUrl.indexOf('?');
    const queryString = queryIdx !== -1 ? rawUrl.substring(queryIdx) : '';
    
    let supaPath = `/rest/v1/zeta_streams${queryString}`;
    if (!queryString.includes('select=')) {
      const sep = queryString ? '&' : '?';
      supaPath += `${sep}select=*&is_active=eq.true&deleted=eq.false`;
    }

    const { status, data } = await fetchSupabase(supaPath);
    res.status(status).json(data);
  } catch (err) {
    console.error('[Streams Edge Gateway Error]:', err);
    res.status(500).json({ error: 'Failed to fetch streams', message: err.message });
  }
}
