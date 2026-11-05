// ==============================================================================
// Netlify Serverless Function: 100 Enterprise Settings Manager (OWASP A01 & A02)
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
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
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
  const origin = event.headers.origin || '*';
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (method === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  // Validate Admin Session (Bearer Token or Cookie)
  const cookies = parseCookies(event.headers.cookie || '');
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const token = (authHeader.startsWith('Bearer ') ? authHeader.substring(7) : '') || cookies.zeta_admin_session;
  const user = verifyJWT(token, SESSION_SECRET);

  if (!user) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Unauthorized: Valid admin session token required' })
    };
  }

  // GET: Fetch all 100 enterprise settings
  if (method === 'GET') {
    try {
      const res = await httpsRequest({
        hostname: SUPABASE_HOST,
        path: '/rest/v1/admin_settings?select=*&order=category.asc,key.asc',
        method: 'GET',
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
      });

      const settingsMap = {};
      const categorized = {};

      if (Array.isArray(res.data)) {
        res.data.forEach(item => {
          // Mask secrets if not superadmin
          const val = item.is_secret && user.role !== 'superadmin' ? '••••••••' : item.value;
          settingsMap[item.key] = val;
          if (!categorized[item.category]) categorized[item.category] = {};
          categorized[item.category][item.key] = val;
        });
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          count: Object.keys(settingsMap).length,
          settings: settingsMap,
          categories: categorized
        })
      };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  // POST: Batch update settings
  if (method === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');
      const updates = body.settings || body;

      const keys = Object.keys(updates);
      if (!keys.length) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'No settings provided' }) };
      }

      for (const key of keys) {
        let value = updates[key];
        await httpsRequest({
          hostname: SUPABASE_HOST,
          path: `/rest/v1/admin_settings?key=eq.${encodeURIComponent(key)}`,
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Prefer': 'return=minimal'
          }
        }, {
          value: typeof value === 'string' && (value.startsWith('{') || value.startsWith('[')) ? JSON.parse(value) : value,
          updated_by: user.email,
          updated_at: new Date().toISOString()
        });
      }

      // Record Audit Log in Supabase (OWASP A09)
      await httpsRequest({
        hostname: SUPABASE_HOST,
        path: '/rest/v1/admin_audit_logs',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
      }, {
        admin_email: user.email,
        action: 'UPDATE_SETTINGS',
        resource_type: 'admin_settings',
        resource_id: keys.join(','),
        ip_address: event.headers['x-forwarded-for'] || 'unknown',
        user_agent: event.headers['user-agent'] || '',
        payload: { updated_keys: keys }
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, updatedCount: keys.length })
      };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
};
