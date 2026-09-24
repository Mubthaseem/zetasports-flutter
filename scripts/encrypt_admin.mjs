import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rawHtmlPath = path.resolve(__dirname, '../admin_panel/admin_raw.html');
const outputHtmlPath = path.resolve(__dirname, '../admin_panel/index.html');

if (!fs.existsSync(rawHtmlPath)) {
  console.error('Error: admin_panel/admin_raw.html not found!');
  process.exit(1);
}

const rawUsername = (process.env.ADMIN_USERNAME || (process.platform === 'win32' && !process.env.ADMIN_USERNAME ? 'admin_user' : process.env.USERNAME) || 'admin_user').trim().toLowerCase();
const rawPassword = (process.env.ADMIN_PASSWORD || process.env.PASSWORD || '1234').trim();
const secretCombined = `${rawUsername}:${rawPassword}`;

console.log(`[Admin Encryptor] Encrypting admin panel with credentials for user: '${rawUsername}' (password len: ${rawPassword.length})...`);

const rawHtml = fs.readFileSync(rawHtmlPath, 'utf8');

const salt = crypto.randomBytes(16);
const iv = crypto.randomBytes(12);
const key = crypto.pbkdf2Sync(secretCombined, salt, 100000, 32, 'sha256');
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
const encrypted = Buffer.concat([cipher.update(rawHtml, 'utf8'), cipher.final()]);
const tag = cipher.getAuthTag();

const packedPayload = Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
console.log(`[Admin Encryptor] Packed ciphertext size: ${(packedPayload.length / 1024).toFixed(1)} KB`);

const gatekeeperHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>ZetaSports Admin</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Rajdhani:wght@600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet"/>
<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
body {
  font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
  background: radial-gradient(circle at 50% 20%, #1e293b 0%, #0f172a 60%, #020617 100%);
  color: #f8fafc;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.gatekeeper-card {
  background: rgba(30, 41, 59, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-radius: 18px;
  padding: 38px 32px 32px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.5);
  text-align: center;
}
.crest-badge-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 24px;
}
.crest-icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: linear-gradient(135deg, #2563eb, #3b82f6);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  margin-bottom: 12px;
  box-shadow: 0 8px 16px -4px rgba(37, 99, 235, 0.4);
}
h1 {
  font-family: 'Rajdhani', sans-serif;
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: #ffffff;
  margin-bottom: 4px;
}
h1 span {
  color: #38bdf8;
}
p.subtitle {
  font-size: 12px;
  font-weight: 600;
  color: #94a3b8;
}
.input-wrapper {
  margin-bottom: 16px;
  text-align: left;
}
.input-wrapper label {
  display: block;
  font-size: 12px;
  font-weight: 700;
  color: #cbd5e1;
  margin-bottom: 6px;
}
input {
  width: 100%;
  padding: 12px 14px;
  background: #0f172a;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  color: #ffffff;
  font-size: 15px;
  outline: none;
  font-family: inherit;
  transition: border-color 0.2s;
}
input:focus {
  border-color: #38bdf8;
  box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.2);
}
input::placeholder {
  color: #64748b;
  font-size: 13.5px;
}
button {
  width: 100%;
  padding: 13px;
  background: #2563eb;
  border: none;
  border-radius: 10px;
  color: #ffffff;
  font-family: 'Rajdhani', sans-serif;
  font-size: 17px;
  font-weight: 800;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 6px;
}
button:hover {
  background: #1d4ed8;
}
button:active {
  transform: scale(0.99);
}
#unlock-msg {
  min-height: 20px;
  font-size: 12px;
  font-weight: 600;
  margin-top: 12px;
  color: #f87171;
}
.security-note {
  font-size: 11px;
  color: #64748b;
  margin-top: 20px;
  padding-top: 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
</style>
</head>
<body>

<div class="gatekeeper-card">
  <div class="crest-badge-wrapper">
    <div class="crest-icon">⚡</div>
    <h1>Zeta<span>Sports</span> Admin</h1>
    <p class="subtitle">Enter your credentials to continue</p>
  </div>
  
  <div class="input-wrapper">
    <label>Username</label>
    <input id="master-user" type="text" placeholder="Enter username..." autocomplete="username" autofocus onkeydown="if(event.key==='Enter')document.getElementById('master-pwd').focus()"/>
  </div>

  <div class="input-wrapper">
    <label>Password / PIN</label>
    <input id="master-pwd" type="password" placeholder="Enter password or PIN..." autocomplete="current-password" onkeydown="if(event.key==='Enter')attemptUnlock()"/>
  </div>
  
  <button id="unlock-btn" onclick="attemptUnlock()">LOGIN →</button>
  <div id="unlock-msg"></div>

  <div class="security-note">
    🔒 Zero-knowledge AES-256 encrypted admin access
  </div>
</div>

<script>
const CIPHER_PAYLOAD = "${packedPayload}";

async function decryptAdminBundle(secret) {
  const binaryString = atob(CIPHER_PAYLOAD);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const salt = bytes.slice(0, 16);
  const iv = bytes.slice(16, 28);
  const tag = bytes.slice(28, 44);
  const ciphertext = bytes.slice(44);

  const combined = new Uint8Array(ciphertext.length + 16);
  combined.set(ciphertext);
  combined.set(tag, ciphertext.length);

  const enc = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const aesKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv, tagLength: 128 },
    aesKey,
    combined
  );

  return new TextDecoder().decode(decryptedBuffer);
}

async function attemptUnlock() {
  const userInput = document.getElementById('master-user');
  const pwdInput = document.getElementById('master-pwd');
  const msgEl = document.getElementById('unlock-msg');
  const btn = document.getElementById('unlock-btn');

  const u = userInput.value.trim().toLowerCase();
  const p = pwdInput.value.trim();

  if (!u || !p) {
    msgEl.textContent = 'Please enter both Username and Password.';
    return;
  }

  const secret = u + ':' + p;
  msgEl.style.color = '#38bdf8';
  msgEl.textContent = '⏳ Decrypting admin in memory...';
  btn.disabled = true;

  try {
    const decryptedHtml = await decryptAdminBundle(secret);
    sessionStorage.setItem('zeta_admin_secret', secret);
    sessionStorage.setItem('zeta_admin_username', u);

    document.open();
    document.write(decryptedHtml);
    document.close();
  } catch (err) {
    console.error('Decryption failed:', err);
    msgEl.style.color = '#f43f5e';
    msgEl.textContent = '❌ Invalid Username or Password. Access denied.';
    btn.disabled = false;
    pwdInput.select();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const cachedSecret = sessionStorage.getItem('zeta_admin_secret');
  if (cachedSecret) {
    decryptAdminBundle(cachedSecret).then(decryptedHtml => {
      document.open();
      document.write(decryptedHtml);
      document.close();
    }).catch(() => {
      sessionStorage.removeItem('zeta_admin_secret');
    });
  }
});
</script>
</body>
</html>`;

fs.writeFileSync(outputHtmlPath, gatekeeperHtml, 'utf8');
console.log(`[Admin Encryptor] Successfully generated zero-knowledge encrypted admin panel: ${outputHtmlPath}`);
