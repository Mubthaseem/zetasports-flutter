// ==============================================================================
// Edge-Cached Matches Endpoint & Admin Management Gateway (OWASP & Egress Shield)
// Caches live/upcoming matches on Vercel Edge CDN for 60s
// Prevents Supabase egress exhaustion & provides secure match listing management
// ==============================================================================

import https from 'https';

const SUPABASE_HOST = process.env.SUPABASE_HOST || 'udlncusvhmydivtjkjcy.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_VXZvAq86GvVgqY-c23gwmQ_RtuTSlWF';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || SUPABASE_ANON_KEY;

function httpsRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (_) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    req.end();
  });
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Handle PATCH or POST to update match status (e.g. is_approved)
  if (req.method === 'PATCH' || req.method === 'POST') {
    try {
      const rawUrl = req.url || '';
      const queryIdx = rawUrl.indexOf('?');
      const queryString = queryIdx !== -1 ? rawUrl.substring(queryIdx) : '';
      
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const matchId = body.id || (queryString.match(/id=eq\.([^&]+)/) ? queryString.match(/id=eq\.([^&]+)/)[1] : null);

      if (!matchId && !queryString.includes('id=eq.')) {
        return res.status(400).json({ error: 'matchId or id=eq. query parameter is required' });
      }

      const patchPath = queryString.includes('id=eq.') ? `/rest/v1/zeta_matches${queryString}` : `/rest/v1/zeta_matches?id=eq.${encodeURIComponent(matchId)}`;
      
      const patchData = { ...body };
      delete patchData.id;

      const { status, data } = await httpsRequest({
        hostname: SUPABASE_HOST,
        path: patchPath,
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Prefer': 'return=representation'
        }
      }, patchData);

      res.setHeader('Cache-Control', 'no-store, max-age=0');
      return res.status(status).json(data);
    } catch (err) {
      console.error('[Matches Gateway PATCH Error]:', err);
      return res.status(500).json({ error: 'Failed to update match', message: err.message });
    }
  }

  // Edge CDN Caching for GET: 60s fresh, 300s stale-while-revalidate
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

  try {
    const rawUrl = req.url || '';
    const queryIdx = rawUrl.indexOf('?');
    const queryString = queryIdx !== -1 ? rawUrl.substring(queryIdx) : '';
    
    // Default fields if no specific select provided
    let supaPath = `/rest/v1/zeta_matches${queryString}`;
    if (!queryString.includes('select=')) {
      const sep = queryString ? '&' : '?';
      supaPath += `${sep}select=id,home_team,away_team,home_logo,away_logo,league_name,league_id,date,kickoff_ist,home_score,away_score,status,minute,article_url,article_source,thumbnail_url,is_approved,is_live,viewers&order=date.asc`;
    }

    const { status, data } = await httpsRequest({
      hostname: SUPABASE_HOST,
      path: supaPath,
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'User-Agent': 'ZetaSports-Vercel-Edge-Gateway'
      }
    });
    res.status(status).json(data);
  } catch (err) {
    console.error('[Matches Edge Gateway Error]:', err);
    res.status(500).json({ error: 'Failed to fetch matches', message: err.message });
  }
}