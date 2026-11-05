// ==============================================================================
// Netlify Serverless Function: Google OAuth2 SSO & Direct DB Governance (OWASP A01 & A07)
// ==============================================================================

import crypto from 'crypto';
import https from 'https';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const SESSION_SECRET = process.env.SESSION_SECRET || (process.env.SUPABASE_SERVICE_ROLE_KEY ? crypto.createHash('sha256').update(process.env.SUPABASE_SERVICE_ROLE_KEY).digest('hex') : 'zeta_admin_auth_entropy');
const SUPABASE_HOST = process.env.SUPABASE_HOST || 'udlncusvhmydivtjkjcy.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

// Fallback allowlist if DB is initializing
const FALLBACK_EMAILS = (process.env.ADMIN_ALLOWED_EMAILS || '')
  .toLowerCase()
  .split(',')
  .map(e => e.trim())
  .filter(Boolean);

// Helper: HTTPS GET JSON
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    }).on('error', reject);
  });
}

// Helper: HTTPS Request with JSON payload
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

// Helper: Sign JWT
function signJWT(payload, secret, expiresInSec = 28800) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + expiresInSec;
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

// Helper: Verify JWT
export function verifyJWT(token, secret) {
  try {
    if (!token) return null;
    const [header, body, signature] = token.split('.');
    if (!header || !body || !signature) return null;
    const expected = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
    if (expected !== signature) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

// Helper: Parse Cookies
function parseCookies(header = '') {
  const list = {};
  header.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    if (parts.length >= 2) {
      list[parts[0].trim()] = decodeURIComponent(parts.slice(1).join('=').trim());
    }
  });
  return list;
}

export const handler = async (event) => {
  const method = event.httpMethod;
  const rawPath = event.path || '';
  const path = rawPath.replace(/\/\.netlify\/functions\/auth/, '').replace(/\/api\/auth/, '').replace(/\/$/, '') || '/';

  // CORS headers for decoupled frontend support
  const origin = event.headers.origin || '*';
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (method === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  // Route 0: Public Runtime Configuration (Serves public client ID to frontend dynamically from env vars)
  if (path === '/config' && method === 'GET') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        clientId: GOOGLE_CLIENT_ID,
        supabaseHost: SUPABASE_HOST,
        supabaseAnonKey: SUPABASE_ANON_KEY
      })
    };
  }

  // Route 1: Verify Current Session (Bearer Token or Cookie)
  if ((path === '/me' || path === '') && method === 'GET') {
    const cookies = parseCookies(event.headers.cookie || '');
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    const token = (authHeader.startsWith('Bearer ') ? authHeader.substring(7) : '') || cookies.zeta_admin_session;
    const user = verifyJWT(token, SESSION_SECRET);

    if (!user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ authenticated: false, error: 'Session invalid or expired' })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ authenticated: true, user })
    };
  }

  // Route 2: Google ID Token Sign-In (OpenID Connect + Direct DB Governance)
  if ((path === '/google' || path === '/login') && method === 'POST') {
    try {
      const payload = JSON.parse(event.body || '{}');
      const idToken = payload.credential || payload.id_token;

      if (!idToken) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Missing Google credential or ID token' })
        };
      }

      // 1. Cryptographic Google Token Verification
      const googleRes = await httpsGet(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
      if (googleRes.status !== 200 || !googleRes.body || !googleRes.body.email) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Google cryptographic token verification failed' })
        };
      }

      const gUser = googleRes.body;
      const userEmail = (gUser.email || '').toLowerCase().trim();

      // 2. Direct Database Check (Zero-Trust in public.admin_users)
      let dbUser = null;
      try {
        const dbRes = await httpsRequest({
          hostname: SUPABASE_HOST,
          path: `/rest/v1/admin_users?email=eq.${encodeURIComponent(userEmail)}&select=*`,
          method: 'GET',
          headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
          }
        });
        if (Array.isArray(dbRes.data) && dbRes.data.length > 0) {
          dbUser = dbRes.data[0];
        }
      } catch (err) {
        console.error('Supabase admin_users check error:', err);
      }

      // Check authorization in DB (or fallback)
      const isAuthorized = (dbUser && dbUser.is_active) || FALLBACK_EMAILS.includes(userEmail);

      if (!isAuthorized) {
        console.warn(`[UNAUTHORIZED ACCESS ATTEMPT]: ${userEmail} from IP ${event.headers['x-forwarded-for'] || 'unknown'}`);
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({
            error: `Access Denied: Account (${userEmail}) is not registered or active in the database admin_users table.`,
            email: userEmail
          })
        };
      }

      // Update last_login_at in database
      if (dbUser) {
        try {
          await httpsRequest({
            hostname: SUPABASE_HOST,
            path: `/rest/v1/admin_users?id=eq.${dbUser.id}`,
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'apikey': SUPABASE_SERVICE_ROLE_KEY,
              'authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              'Prefer': 'return=minimal'
            }
          }, {
            last_login_at: new Date().toISOString(),
            picture: gUser.picture || dbUser.picture
          });
        } catch (_) {}
      }

      // 3. Mint 8-Hour Session JWT
      const sessionUser = {
        id: dbUser ? dbUser.id : 'owner',
        email: userEmail,
        name: dbUser?.name || gUser.name || userEmail.split('@')[0],
        picture: gUser.picture || '',
        role: dbUser?.role || 'superadmin',
        googleSub: gUser.sub,
        loginAt: new Date().toISOString()
      };

      const sessionToken = signJWT(sessionUser, SESSION_SECRET, 28800);

      // Return both cookie (for edge) and bearer token (for cross-origin frontend)
      const cookieHeader = `zeta_admin_session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=28800; Partitioned`;

      return {
        statusCode: 200,
        headers: {
          ...headers,
          'Set-Cookie': cookieHeader
        },
        body: JSON.stringify({
          success: true,
          authenticated: true,
          token: sessionToken,
          user: sessionUser
        })
      };
    } catch (err) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Authentication internal exception: ' + err.message })
      };
    }
  }

  // Route 3: Sign Out
  if ((path === '/logout' || path === '/signout') && method === 'POST') {
    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Set-Cookie': 'zeta_admin_session=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0; Partitioned'
      },
      body: JSON.stringify({ success: true, message: 'Signed out successfully' })
    };
  }

  return {
    statusCode: 404,
    headers,
    body: JSON.stringify({ error: `Auth route not found: ${method} ${path}` })
  };
};
