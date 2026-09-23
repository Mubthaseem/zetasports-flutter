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
<title>ZetaSports Federation • Official Extranet Gatekeeper</title>
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
  background: radial-gradient(circle at 50% 10%, #0c2b66 0%, #051838 50%, #020c1d 100%);
  color: #f8fafc;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
}
.gatekeeper-card {
  background: rgba(8, 29, 69, 0.88);
  border: 1px solid rgba(212, 175, 55, 0.4);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border-radius: 20px;
  padding: 44px 34px 36px;
  width: 100%;
  max-width: 440px;
  box-shadow: 0 30px 60px -12px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(212, 175, 55, 0.2);
  text-align: center;
  position: relative;
  overflow: hidden;
}
.gatekeeper-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 4px;
  background: linear-gradient(90deg, #996515, #d4af37, #fef08a, #d4af37, #996515);
}
.crest-badge-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 22px;
}
.crest-icon {
  width: 62px;
  height: 62px;
  border-radius: 16px;
  background: linear-gradient(135deg, #d4af37 0%, #996515 100%);
  border: 2px solid rgba(254, 243, 199, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  margin-bottom: 14px;
  box-shadow: 0 8px 24px -4px rgba(212, 175, 55, 0.45);
}
.confed-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  background: rgba(212, 175, 55, 0.15);
  border: 1px solid rgba(212, 175, 55, 0.45);
  border-radius: 4px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
  color: #fde047;
  text-transform: uppercase;
  margin-bottom: 10px;
}
h1 {
  font-family: 'Rajdhani', sans-serif;
  font-size: 27px;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: #ffffff;
  margin-bottom: 3px;
  line-height: 1.15;
}
h1 span {
  color: #d4af37;
  background: linear-gradient(135deg, #fef08a, #d4af37);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
p.subtitle {
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: #94a3b8;
  text-transform: uppercase;
  margin-bottom: 26px;
}
.input-wrapper {
  position: relative;
  margin-bottom: 16px;
  text-align: left;
}
.input-wrapper label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 10.5px;
  font-weight: 800;
  color: #cbd5e1;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 7px;
}
.input-wrapper label span.req {
  color: #d4af37;
  font-size: 10px;
}
input {
  width: 100%;
  padding: 13px 16px;
  background: rgba(3, 16, 39, 0.85);
  border: 1px solid rgba(212, 175, 55, 0.3);
  border-radius: 10px;
  color: #ffffff;
  font-size: 15px;
  outline: none;
  font-family: inherit;
  transition: all 0.2s ease;
}
input:focus {
  border-color: #d4af37;
  background: rgba(3, 16, 39, 1);
  box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.25);
}
input::placeholder {
  color: #64748b;
  font-size: 13.5px;
}
button {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #d4af37 0%, #b8860b 100%);
  border: 1px solid rgba(254, 240, 138, 0.4);
  border-radius: 10px;
  color: #051838;
  font-family: 'Rajdhani', sans-serif;
  font-size: 17px;
  font-weight: 800;
  letter-spacing: 0.08em;
  cursor: pointer;
  box-shadow: 0 10px 24px -5px rgba(212, 175, 55, 0.4);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  margin-top: 8px;
}
button:hover {
  background: linear-gradient(135deg, #fef08a 0%, #d4af37 100%);
  transform: translateY(-1px);
  box-shadow: 0 14px 28px -5px rgba(212, 175, 55, 0.55);
}
button:active {
  transform: translateY(0);
}
#unlock-msg {
  min-height: 22px;
  font-size: 12px;
  font-weight: 700;
  margin-top: 14px;
  color: #f87171;
}
.security-note {
  font-size: 10.5px;
  color: #94a3b8;
  margin-top: 24px;
  padding-top: 18px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  line-height: 1.55;
  text-align: center;
}
.security-note strong {
  color: #fde047;
  font-weight: 700;
}
</style>
</head>
<body>

<div class="gatekeeper-card">
  <div class="crest-badge-wrapper">
    <div class="crest-icon">🏛️</div>
    <div class="confed-badge">★ CONFEDERATION CERTIFIED</div>
    <h1>ZETA SPORTS <span>FEDERATION</span></h1>
    <p class="subtitle">Official Central Governance Extranet</p>
  </div>
  
  <div class="input-wrapper">
    <label>Official Delegate Identifier <span class="req">REQUIRED</span></label>
    <input id="master-user" type="text" placeholder="Enter delegate username..." autocomplete="username" autofocus onkeydown="if(event.key==='Enter')document.getElementById('master-pwd').focus()"/>
  </div>

  <div class="input-wrapper">
    <label>Security Clearance Key / PIN <span class="req">REQUIRED</span></label>
    <input id="master-pwd" type="password" placeholder="Enter security clearance key..." autocomplete="current-password" onkeydown="if(event.key==='Enter')attemptUnlock()"/>
  </div>
  
  <button id="unlock-btn" onclick="attemptUnlock()">AUTHENTICATE CREDENTIALS →</button>
  <div id="unlock-msg"></div>

  <div class="security-note">
    <strong>🛡️ ZERO-KNOWLEDGE AES-256-GCM SECURED</strong><br>
    Restricted to accredited federation delegates & commissioners. Access is cryptographically verified and audited under statutory protocols.
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
