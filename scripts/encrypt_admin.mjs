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

const rawUsername = (process.env.USERNAME || 'admin_user').trim().toLowerCase();
const rawPassword = (process.env.PASSWORD || '1234').trim();
const secretCombined = `${rawUsername}:${rawPassword}`;

console.log(`[Admin Encryptor] Encrypting admin panel with credentials for user: '${rawUsername}' (password len: ${rawPassword.length})...`);

const rawHtml = fs.readFileSync(rawHtmlPath, 'utf8');

// 1. Generate cryptographic salt and IV
const salt = crypto.randomBytes(16);
const iv = crypto.randomBytes(12);

// 2. Derive 256-bit key using PBKDF2 (100,000 iterations, SHA-256)
const key = crypto.pbkdf2Sync(secretCombined, salt, 100000, 32, 'sha256');

// 3. Encrypt raw HTML with AES-256-GCM
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
const encrypted = Buffer.concat([cipher.update(rawHtml, 'utf8'), cipher.final()]);
const tag = cipher.getAuthTag();

// 4. Pack: salt (16) + iv (12) + tag (16) + ciphertext
const packedPayload = Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
console.log(`[Admin Encryptor] Packed ciphertext size: ${(packedPayload.length / 1024).toFixed(1)} KB`);

// 5. Generate secure gatekeeper index.html
const gatekeeperHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>ZetaSports • Admin Gatekeeper</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Rajdhani:wght@600;700;800&display=swap" rel="stylesheet"/>
<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
body {
  font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
  background: radial-gradient(circle at 50% 0%, #1e293b 0%, #0f172a 60%, #020617 100%);
  color: #f8fafc;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.gatekeeper-card {
  background: rgba(30, 41, 59, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-radius: 24px;
  padding: 42px 34px;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05);
  text-align: center;
  position: relative;
  overflow: hidden;
}
.gatekeeper-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 4px;
  background: linear-gradient(90deg, #2563eb, #38bdf8, #10b981);
}
.lock-icon {
  width: 58px;
  height: 58px;
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.2), rgba(56, 189, 248, 0.2));
  border: 1px solid rgba(56, 189, 248, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  margin: 0 auto 16px;
  box-shadow: 0 8px 16px -4px rgba(37, 99, 235, 0.3);
}
h1 {
  font-family: 'Rajdhani', sans-serif;
  font-size: 32px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #ffffff;
  margin-bottom: 2px;
}
h1 span {
  background: linear-gradient(135deg, #38bdf8, #2563eb);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
p.subtitle {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: #94a3b8;
  text-transform: uppercase;
  margin-bottom: 24px;
}
.input-wrapper {
  position: relative;
  margin-bottom: 14px;
  text-align: left;
}
.input-wrapper label {
  display: block;
  font-size: 11px;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 6px;
}
input {
  width: 100%;
  padding: 13px 16px;
  background: rgba(15, 23, 42, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  color: #ffffff;
  font-size: 16px;
  outline: none;
  font-family: inherit;
  transition: all 0.2s ease;
}
input:focus {
  border-color: #38bdf8;
  background: rgba(15, 23, 42, 1);
  box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.2);
}
button {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  border: none;
  border-radius: 12px;
  color: #ffffff;
  font-family: 'Rajdhani', sans-serif;
  font-size: 17px;
  font-weight: 800;
  letter-spacing: 0.08em;
  cursor: pointer;
  box-shadow: 0 10px 20px -5px rgba(37, 99, 235, 0.4);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  margin-top: 6px;
}
button:hover {
  transform: translateY(-1px);
  box-shadow: 0 14px 24px -5px rgba(37, 99, 235, 0.5);
}
button:active {
  transform: translateY(0);
}
#unlock-msg {
  min-height: 20px;
  font-size: 12px;
  font-weight: 600;
  margin-top: 14px;
  color: #f43f5e;
}
.security-note {
  font-size: 11px;
  color: #64748b;
  margin-top: 22px;
  line-height: 1.5;
}
</style>
</head>
<body>

<div class="gatekeeper-card">
  <div class="lock-icon">🔒</div>
  <h1>ZETA<span>SPORTS</span></h1>
  <p class="subtitle">Zero-Knowledge Encrypted Admin</p>
  
  <div class="input-wrapper">
    <label>Admin Username</label>
    <input id="master-user" type="text" placeholder="Enter username..." autocomplete="username" autofocus onkeydown="if(event.key==='Enter')document.getElementById('master-pwd').focus()"/>
  </div>

  <div class="input-wrapper">
    <label>Admin Password / PIN</label>
    <input id="master-pwd" type="password" placeholder="Enter password..." autocomplete="current-password" onkeydown="if(event.key==='Enter')attemptUnlock()"/>
  </div>
  
  <button id="unlock-btn" onclick="attemptUnlock()">UNLOCK PANEL →</button>
  <div id="unlock-msg"></div>

  <div class="security-note">
    🛡️ Military-grade AES-256-GCM zero-knowledge encryption.<br>
    The page source is 100% encrypted and impossible to bypass.
  </div>
</div>

<script>
// Zero-Knowledge Encrypted Admin App Bundle
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

  // In Web Crypto AES-GCM, the auth tag must be appended to the ciphertext
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

    // Launch decrypted admin panel cleanly in memory
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

// Auto-unlock if active browser session exists
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
