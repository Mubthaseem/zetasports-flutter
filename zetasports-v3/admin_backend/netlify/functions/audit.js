// ==============================================================================
// Netlify Serverless Function: Immutable Security & Audit Trail (OWASP A09)
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
    if (postData) req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
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

  const cookies = parseCookies(event.headers.cookie || '');
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const token = (authHeader.startsWith('Bearer ') ? authHeader.substring(7) : '') || cookies.zeta_admin_session;
  const user = verifyJWT(token, SESSION_SECRET);

  if (!user) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized admin session' }) };
  }

  // GET: Fetch audit logs
  if (method === 'GET') {
    try {
      const limit = event.queryStringParameters?.limit || 50;
      const offset = event.queryStringParameters?.offset || 0;

      const res = await httpsRequest({
        hostname: SUPABASE_HOST,
        path: `/rest/v1/admin_audit_logs?select=*&order=created_at.desc&limit=${limit}&offset=${offset}`,
        method: 'GET',
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          logs: Array.isArray(res.data) ? res.data : []
        })
      };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  // POST: Record an audit event
  if (method === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');
      const logEntry = {
        admin_email: user.email,
        action: body.action || 'CUSTOM_ACTION',
        resource_type: body.resource_type || 'system',
        resource_id: body.resource_id || '',
        ip_address: event.headers['x-forwarded-for'] || 'unknown',
        user_agent: event.headers['user-agent'] || '',
        payload: body.payload || {}
      };

      await httpsRequest({
        hostname: SUPABASE_HOST,
        path: '/rest/v1/admin_audit_logs',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
      }, logEntry);

      return { statusCode: 201, headers, body: JSON.stringify({ success: true }) };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
};
