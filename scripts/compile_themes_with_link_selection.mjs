import fs from 'fs';
import vm from 'vm';

console.log('=== Compiling Blogger Themes with Link Selection Gateway & Cross-Domain 2-Blogger Routing ===');

// 1. Read blogger_script_part.js
let js = fs.readFileSync('scripts/blogger_script_part.js', 'utf8');

// Ensure match card link uses getMatchPostUrl
const oldMatchClick = `onclick="event.preventDefault(); openMatchPage(' + m.id + ', true);"`;
if (js.indexOf(oldMatchClick) !== -1) {
  js = js.replace(
    `<a href="/' + matchSlug + '" ` + oldMatchClick + `>`,
    `<a href="' + getMatchPostUrl(m) + '">`
  );
  console.log('✔ Updated match cards in Home list to link directly to post URL');
}

// Ensure syntax is 100% valid
new vm.Script(js);
console.log('✔ scripts/blogger_script_part.js verified with 0 syntax errors');
fs.writeFileSync('scripts/blogger_script_part.js', js, 'utf8');

const linkSelectionCss = `
  /* ── LINK SELECTION GATEWAY CSS ── */
  .links-page-box {
    background: #fff;
    border-radius: 14px;
    border: 1px solid #e2e8f0;
    padding: 20px;
    margin-bottom: 18px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.03);
  }
  body.Night .links-page-box {
    background: #0e1424;
    border-color: #1e293b;
    color: #f1f5f9;
  }
  .links-servers-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 16px;
    margin: 16px 0;
  }
  .link-server-card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 12px;
    text-decoration: none;
    transition: all 0.2s ease-in-out;
  }
  body.Night .link-server-card {
    background: #131b2e;
    border-color: #1e293b;
  }
  .link-server-card:hover {
    transform: translateY(-2px);
    border-color: #2563eb;
    box-shadow: 0 8px 20px rgba(37,99,235,0.12);
  }
  .link-server-card-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
  }
  .link-server-title {
    font-size: 15px;
    font-weight: 800;
    color: #0f172a;
  }
  body.Night .link-server-title {
    color: #f8fafc;
  }
  .server-num-badge {
    background: #2563eb;
    color: #fff;
    font-size: 11px;
    font-weight: 800;
    padding: 2px 6px;
    border-radius: 4px;
    margin-right: 4px;
  }
  .link-server-status {
    font-size: 11px;
    font-weight: 700;
    color: #16a34a;
    background: #dcfce7;
    padding: 2px 8px;
    border-radius: 999px;
    white-space: nowrap;
  }
  body.Night .link-server-status {
    background: rgba(34,197,94,0.15);
    color: #4ade80;
  }
  .link-server-meta-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .badge-chip {
    font-size: 11px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 6px;
    background: #e2e8f0;
    color: #334155;
  }
  body.Night .badge-chip {
    background: #1e293b;
    color: #94a3b8;
  }
  .badge-chip.badge-quality {
    background: #dbeafe;
    color: #1e40af;
  }
  body.Night .badge-chip.badge-quality {
    background: rgba(37,99,235,0.2);
    color: #60a5fa;
  }
  .badge-chip.badge-lang {
    background: #fef3c7;
    color: #92400e;
  }
  body.Night .badge-chip.badge-lang {
    background: rgba(245,158,11,0.2);
    color: #fbbf24;
  }
  .badge-chip.badge-type {
    background: #f1f5f9;
    color: #475569;
  }
  body.Night .badge-chip.badge-type {
    background: #1e293b;
    color: #cbd5e1;
  }
  .btn-launch-stream {
    min-height: 44px;
    background: #2563eb;
    color: #ffffff !important;
    text-decoration: none;
    font-size: 13px;
    font-weight: 800;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    box-shadow: 0 2px 6px rgba(37,99,235,0.25);
    transition: background 0.15s ease;
  }
  .btn-launch-stream:hover {
    background: #1d4ed8;
  }
`;

const linksViewHtml = `
  <!-- VIEW 2.5: DEDICATED LINK SELECTION GATEWAY (Blogger Blog 1) -->
  <div id="linksView" class="STING-web-Max-Size" style="display:none;">
    <div style="margin-bottom: 14px; display:flex; justify-content:space-between; align-items:center;">
      <button onclick="returnToMatch()" class="match-chip-btn" id="btnLinksBackToMatch" style="cursor:pointer;">
        ← Back to Match Post
      </button>
      <span style="font-size:12px;font-weight:700;color:#2563eb;display:flex;align-items:center;gap:6px;">
        <span style="width:8px;height:8px;background:#2563eb;border-radius:50%;display:inline-block;"></span>
        STREAM SELECTION GATEWAY
      </span>
    </div>

    <!-- Dynamic Link Selection Box Injected by JS -->
    <div class="links-page-box" id="linksBox"></div>

    <div class="STING-web-Ads">
      <span>Advertisement • High-CTR Link Gateway</span>
    </div>
  </div>
`;

function upgradeTheme(file) {
  console.log('Processing theme file: ' + file);
  let xml = fs.readFileSync(file, 'utf8');

  // 1. Inject CSS if not present
  if (xml.indexOf('.link-server-card') === -1) {
    const cssMarker = '.countdown-box {';
    if (xml.indexOf(cssMarker) !== -1) {
      xml = xml.replace(cssMarker, linkSelectionCss + '\n  ' + cssMarker);
      console.log('  ✔ Injected Link Selection CSS');
    }
  }

  // 2. Inject #linksView container if not present
  if (xml.indexOf('id="linksView"') === -1) {
    const matchViewEnd = '</div>\n  </div>\n\n  <!-- VIEW 3: DEDICATED STREAMING PAGE';
    const matchViewEndAlt = '</div>\r\n  </div>\r\n\r\n  <!-- VIEW 3: DEDICATED STREAMING PAGE';
    if (xml.indexOf(matchViewEnd) !== -1) {
      xml = xml.replace(matchViewEnd, '</div>\n  </div>\n' + linksViewHtml + '\n  <!-- VIEW 3: DEDICATED STREAMING PAGE');
      console.log('  ✔ Injected #linksView markup container');
    } else if (xml.indexOf(matchViewEndAlt) !== -1) {
      xml = xml.replace(matchViewEndAlt, '</div>\r\n  </div>\r\n' + linksViewHtml + '\r\n  <!-- VIEW 3: DEDICATED STREAMING PAGE');
      console.log('  ✔ Injected #linksView markup container (CRLF)');
    } else {
      // Fallback search
      const streamViewMarker = '<!-- VIEW 3: DEDICATED STREAMING PAGE';
      const sIdx = xml.indexOf(streamViewMarker);
      if (sIdx !== -1) {
        xml = xml.substring(0, sIdx) + linksViewHtml + '\n  ' + xml.substring(sIdx);
        console.log('  ✔ Injected #linksView markup container (fallback)');
      }
    }
  }

  // 3. Update Stream View top nav bar if needed
  const oldStreamNav = `<button onclick="returnToMatch()" style="background:#fff;border:1px solid #cbd5e1;padding:8px 16px;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer;">
        ← Back to Match Details
      </button>`;
  const newStreamNav = `<div style="display:flex;gap:8px;flex-wrap:wrap;">
        <a id="btnBackToLinks" href="#" class="match-chip-btn" style="background:#2563eb;color:#fff;border-color:#2563eb;text-decoration:none;">
          🔀 Change Server / Links
        </a>
        <a id="btnBackToPost" href="#" class="match-chip-btn" style="text-decoration:none;">
          ← Match Post
        </a>
        <a id="btnBackToHome" href="#" class="match-chip-btn" style="text-decoration:none;">
          🏠 Home
        </a>
      </div>`;

  if (xml.indexOf('btnBackToLinks') === -1) {
    if (xml.indexOf(oldStreamNav) !== -1) {
      xml = xml.replace(oldStreamNav, newStreamNav);
      console.log('  ✔ Upgraded Stream View navigation bar with cross-domain back buttons');
    } else {
      // Handle CRLF
      const oldStreamNavCRLF = oldStreamNav.replace(/\n/g, '\r\n');
      if (xml.indexOf(oldStreamNavCRLF) !== -1) {
        xml = xml.replace(oldStreamNavCRLF, newStreamNav.replace(/\n/g, '\r\n'));
        console.log('  ✔ Upgraded Stream View navigation bar with cross-domain back buttons (CRLF)');
      }
    }
  }

  // 4. Inject updated scripts/blogger_script_part.js
  const jsStartMarker = '// ── VIEW SWITCHERS & ROUTING';
  const jsEndMarker = '// ── FotMob Live Scores API Sync ──';

  const sIdx = xml.indexOf(jsStartMarker);
  const eIdx = xml.indexOf(jsEndMarker);

  if (sIdx === -1 || eIdx === -1) {
    throw new Error('Could not find JS markers in ' + file);
  }

  xml = xml.substring(0, sIdx) + js + '\n\n    ' + xml.substring(eIdx);

  fs.writeFileSync(file, xml, 'utf8');
  console.log('  ✔ Successfully saved and upgraded ' + file);
}

upgradeTheme('zetasports-korra-blogger-theme.xml');
upgradeTheme('zetasports-react-blogger-theme.xml');

console.log('=== Theme Compilation Completed Successfully ===');
