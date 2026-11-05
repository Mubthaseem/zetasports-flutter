// ==============================================================================
// Netlify Serverless Function: Thumbnail & Broadcast Media Pipeline (OWASP A10)
// ==============================================================================

import https from 'https';
import crypto from 'crypto';
import { verifyJWT } from './auth.js';

const SUPABASE_HOST = process.env.SUPABASE_HOST || 'udlncusvhmydivtjkjcy.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';
const SESSION_SECRET = process.env.SESSION_SECRET || (process.env.SUPABASE_SERVICE_ROLE_KEY ? crypto.createHash('sha256').update(process.env.SUPABASE_SERVICE_ROLE_KEY).digest('hex') : 'zeta_admin_auth_entropy');

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
    if (postData) req.write(postData);
    req.end();
  });
}

function parseCookies(header = '') {
  const list = {};
  header.split(';').forEach(c => {
    const parts = c.split('=');
    if (parts.length >= 2) list[parts[0].trim()] = decodeURIComponent(parts.slice(1).join('=').trim());
  });
  return list;
}

export const handler = async (event) => {
  const method = event.httpMethod;
  const path = event.path.replace(/\/\.netlify\/functions\/thumbnail/, '').replace(/\/api\/thumbnail/, '');

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': event.headers.origin || '*',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (method === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  const cookies = parseCookies(event.headers.cookie || '');
  const token = cookies.zeta_admin_session || (event.headers.authorization || '').replace('Bearer ', '');
  const user = verifyJWT(token, SESSION_SECRET);

  if (!user) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized: Admin session required' }) };
  }

  // Route 1: Upload Image to Supabase S3 Storage Bucket
  if (path === '/upload-storage' && method === 'POST') {
    try {
      const { filename, base64Data, contentType, matchId, isFullTime } = JSON.parse(event.body || '{}');
      if (!filename || !base64Data) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'filename and base64Data required' }) };
      }

      // Convert base64 to buffer
      const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(cleanBase64, 'base64');
      const mime = contentType || 'image/jpeg';

      const uploadPath = `/storage/v1/object/scripts/${encodeURIComponent(filename)}`;
      const uploadRes = await httpsRequest({
        hostname: SUPABASE_HOST,
        path: uploadPath,
        method: 'POST',
        headers: {
          'Content-Type': mime,
          'Content-Length': buffer.length,
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'x-upsert': 'true'
        }
      }, buffer);

      const publicUrl = `https://${SUPABASE_HOST}/storage/v1/object/public/scripts/${encodeURIComponent(filename)}?t=${Date.now()}`;

      // If matchId provided, attach thumbnail_url directly to Supabase record
      if (matchId) {
        const patchCol = isFullTime ? 'fulltime_thumbnail_url' : 'thumbnail_url';
        await httpsRequest({
          hostname: SUPABASE_HOST,
          path: `/rest/v1/zeta_matches?id=eq.${encodeURIComponent(matchId)}`,
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
          }
        }, JSON.stringify({
          [patchCol]: publicUrl,
          thumbnail_url: publicUrl,
          updated_at: new Date().toISOString()
        }));
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          publicUrl,
          filename
        })
      };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  // Route 2: Customize Right Hero Photo for Full-Time Graphic
  if (path === '/customize-right-image' && method === 'POST') {
    try {
      const { matchId, heroPhotoUrl, heroPhotoBase64 } = JSON.parse(event.body || '{}');
      if (!matchId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'matchId is required' }) };
      }

      // Verify match is in Full-Time status (Strict business rule)
      const matchRes = await httpsRequest({
        hostname: SUPABASE_HOST,
        path: `/rest/v1/zeta_matches?id=eq.${encodeURIComponent(matchId)}&select=status,home_team,away_team,home_score,away_score`,
        method: 'GET',
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
      });

      const match = Array.isArray(matchRes.data) ? matchRes.data[0] : null;
      if (!match) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Match record not found' }) };
      }

      if (match.status !== 'finished' && match.status !== 'ft' && match.status !== 'FT') {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({
            error: 'Custom photo editing is strictly restricted to Full-Time / Finished matches only.'
          })
        };
      }

      let finalHeroUrl = heroPhotoUrl;

      // If base64 uploaded, save to storage first
      if (heroPhotoBase64) {
        const cleanBase64 = heroPhotoBase64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(cleanBase64, 'base64');
        const heroFilename = `hero_${matchId}_${Date.now()}.jpg`;

        await httpsRequest({
          hostname: SUPABASE_HOST,
          path: `/storage/v1/object/scripts/${encodeURIComponent(heroFilename)}`,
          method: 'POST',
          headers: {
            'Content-Type': 'image/jpeg',
            'Content-Length': buffer.length,
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'x-upsert': 'true'
          }
        }, buffer);

        finalHeroUrl = `https://${SUPABASE_HOST}/storage/v1/object/public/scripts/${encodeURIComponent(heroFilename)}`;
      }

      // Save custom hero URL to match record
      await httpsRequest({
        hostname: SUPABASE_HOST,
        path: `/rest/v1/zeta_matches?id=eq.${encodeURIComponent(matchId)}`,
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
      }, JSON.stringify({
        custom_hero_image_url: finalHeroUrl,
        updated_at: new Date().toISOString()
      }));

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          matchId,
          heroPhotoUrl: finalHeroUrl,
          message: 'Full-time hero photo updated successfully.'
        })
      };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  return { statusCode: 404, headers, body: JSON.stringify({ error: 'Endpoint not found' }) };
};
