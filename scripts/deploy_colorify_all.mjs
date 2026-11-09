import fs from 'fs';
import vm from 'vm';
import { execSync } from 'child_process';

console.log('=== DEPLOYING ALL ZETASPORTS COLORIFY THEME ENHANCEMENTS ===');

// 1. Read scripts/blogger_script_part.js and verify syntax
let jsPart = fs.readFileSync('scripts/blogger_script_part.js', 'utf8');
new vm.Script(jsPart);
console.log('✔ scripts/blogger_script_part.js syntax is 100% valid (' + jsPart.split('\n').length + ' lines)');

// 2. Read base Colorify theme
let xml = fs.readFileSync('zetasports-v3/web/colorify_zetasports_theme.xml', 'utf8');

// Normalize CRLF to LF for consistent processing
const hadCRLF = xml.includes('\r\n');
xml = xml.replace(/\r\n/g, '\n');

// A. Revamp Header1: Replace Header1 widget contents with ZetaSports Brand & Pulsing LIVE badge
console.log('Step A: Revamping Header Logo & Navigation...');

const headerWidgetRegex = /<b:widget id='Header1'[\s\S]*?<\/b:widget>/;
const newHeaderWidget = `<b:widget id='Header1' locked='true' title='ZetaSports' type='Header' visible='true'>
                    <b:widget-settings>
                      <b:widget-setting name='useImage'>false</b:widget-setting>
                      <b:widget-setting name='imagePlacement'>REPLACE</b:widget-setting>
                    </b:widget-settings>
                    <b:includable id='main' var='this'>
                      <b:tag class='mobile-menu-toggle' href='javascript:;' name='a' role='button' title='Menu'/>
                      <b:include name='image'/>
                    </b:includable>
                    <b:includable id='behindImageStyle'><b:comment>Replaced</b:comment></b:includable>
                    <b:includable id='description'><b:comment>Replaced</b:comment></b:includable>
                    <b:includable id='image'>
                      <a class='logo-img' expr:href='data:blog.homepageUrl.canonical' style='display:inline-flex; align-items:center; gap:8px; text-decoration:none;'>
                        <span style='background:#0062b2; color:#ffffff; font-family:"Oswald", sans-serif; font-size:22px; font-weight:700; padding:4px 12px; border-radius:8px; letter-spacing:0.5px;'>ZETASPORTS</span>
                        <span id='zetaHeaderLiveCounter' style='display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:700; background:#dcfce7; color:#15803d; border:1px solid #86efac; border-radius:999px; padding:2px 8px; font-family:"Inter", sans-serif;'>
                          <span style='width:6px; height:6px; border-radius:50%; background:#16a34a; display:inline-block; animation:zetaPulse 1.5s infinite;'></span>
                          LIVE
                        </span>
                      </a>
                    </b:includable>
                    <b:includable id='title'>
                      <a class='logo-img' expr:href='data:blog.homepageUrl.canonical' style='display:inline-flex; align-items:center; gap:8px; text-decoration:none;'>
                        <span style='background:#0062b2; color:#ffffff; font-family:"Oswald", sans-serif; font-size:22px; font-weight:700; padding:4px 12px; border-radius:8px; letter-spacing:0.5px;'>ZETASPORTS</span>
                      </a>
                    </b:includable>
                  </b:widget>`;

if (headerWidgetRegex.test(xml)) {
  xml = xml.replace(headerWidgetRegex, newHeaderWidget);
  console.log('  ✔ Replaced Header1 widget with ZetaSports branding & #zetaHeaderLiveCounter');
} else {
  console.warn('  ⚠ Header1 widget regex did not match');
}

// B. Revamp Navigation Menu in linklist-content includable
console.log('Step B: Injecting Sports Navigation Menu into linklist-content includable...');

const linkListIncludableRegex = /<b:includable id='linklist-content'>[\s\S]*?<b:elseif cond='data:widget\.sectionId in \[&quot;sidebar&quot;/;
const newLinkListIncludable = `<b:includable id='linklist-content'>
      <b:if cond='data:widget.sectionId == &quot;colorify-free-main-nav&quot;'>
        <ul id='colorify-free-main-nav-menu' role='menubar' style='display:flex; align-items:center; gap:16px; list-style:none; margin:0; padding:0;'>
          <li><a href='/?filter=live' role='menuitem' style='font-family:"Oswald",sans-serif; font-weight:600; text-transform:uppercase;'>⚡ Live Scores</a></li>
          <li><a href='/search/label/Football' role='menuitem' style='font-family:"Oswald",sans-serif; font-weight:600; text-transform:uppercase;'>⚽ Football</a></li>
          <li><a href='/search/label/Cricket' role='menuitem' style='font-family:"Oswald",sans-serif; font-weight:600; text-transform:uppercase;'>🏏 Cricket</a></li>
          <li><a href='#' role='menuitem' style='font-family:"Oswald",sans-serif; font-weight:600; text-transform:uppercase;'>🏆 Competitions</a></li>
          <li><a href='/?filter=live' role='menuitem' style='font-family:"Oswald",sans-serif; font-weight:600; text-transform:uppercase;'>📺 Live Streams</a></li>
          <li><a href='/search/label/Highlights' role='menuitem' style='font-family:"Oswald",sans-serif; font-weight:600; text-transform:uppercase;'>⭐ Highlights</a></li>
        </ul>
      <b:elseif cond='data:widget.sectionId in [&quot;sidebar&quot;`;

if (linkListIncludableRegex.test(xml)) {
  xml = xml.replace(linkListIncludableRegex, newLinkListIncludable);
  console.log('  ✔ Injected ZetaSports sports navigation into linklist-content includable');
} else {
  console.warn('  ⚠ linklist-content includable regex did not match');
}

// C. Inject Brand CSS Overrides into <b:skin>
console.log('Step C: Injecting Brand CSS Overrides into <b:skin>...');
const brandCss = `
/* ZetaSports Brand & Header Overrides */
.main-logo .logo-img img, #Header1 img, #Header1_headerimg { display: none !important; }
#featured, .featured-post-wrap, .hero-post { display: none !important; }
@keyframes zetaPulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.3; transform: scale(1.15); } }
`;

if (!xml.includes('/* ZetaSports Brand & Header Overrides */')) {
  xml = xml.replace(']]></b:skin>', brandCss + '\n]]></b:skin>');
  console.log('  ✔ Injected ZetaSports Brand & Header Overrides CSS into <b:skin>');
}

// D. Inject 4 Views into <main id='main-wrapper'> if not already present
console.log("Step D: Checking 4 Core Views into <main id='main-wrapper'>...");

const viewsMarkup = `
      <!-- Top AdSense Leaderboard (728x90) Zero-CLS -->
      <div class="STING-web-Ads adsense-leaderboard zeta-ad-slot-card" style="min-height:90px; contain:layout size; margin:16px 0; text-align:center; background:#ffffff; border:1px dashed #cbd5e1; border-radius:12px; padding:12px;">
        <span class="zeta-ad-label" style="display:block; font-size:10px; font-weight:700; text-transform:uppercase; color:#94a3b8; margin-bottom:4px;">Advertisement • Top Leaderboard (728x90)</span>
      </div>

      <!-- VIEW 1: HOME DASHBOARD WITH MATCH CARDS SORTED BY TIME -->
      <div id="homeView">
        <div class="STING-web-Container-Matches">
          <div class="STING-web-Container-Matches-Top" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:16px;">
            <h2 class="STING-web-Title-Box" style="font-family:'Oswald',sans-serif; font-size:18px; font-weight:700; color:#0f172a; margin:0; display:flex; align-items:center; gap:6px;">
              <span style="color:#0062b2;">⚡</span>
              <strong>Today's Fixtures (Chronological Time Order)</strong>
            </h2>
            <ul class="STING-web-Matches-Toggle" style="display:flex; gap:6px; list-style:none; padding:0; margin:0;">
              <li class="Yesterday-Matches" id="tab-yesterday" onclick="filterDate('yesterday')">
                <a href="javascript:void(0)" class="match-chip-btn">Yesterday</a>
              </li>
              <li class="Today-Matches active" id="tab-today" onclick="filterDate('today')">
                <a href="javascript:void(0)" class="match-chip-btn active" style="background:#0062b2; color:#fff;">Today</a>
              </li>
              <li class="Tomorrow-Matches" id="tab-tomorrow" onclick="filterDate('tomorrow')">
                <a href="javascript:void(0)" class="match-chip-btn">Tomorrow</a>
              </li>
            </ul>
          </div>

          <!-- League Filter Pills -->
          <div id="leagueFilterPills" style="display:flex; gap:6px; overflow-x:auto; padding-bottom:8px; margin-bottom:14px;">
            <button onclick="filterLeague('all')" class="badge-chip active" style="cursor:pointer; background:#0062b2; color:#fff; border:none; padding:4px 10px; border-radius:6px; font-size:11px; font-weight:700;">All</button>
            <button onclick="filterLeague('Premier League')" class="badge-chip" style="cursor:pointer; background:#f1f5f9; color:#334155; border:none; padding:4px 10px; border-radius:6px; font-size:11px; font-weight:700;">Premier League</button>
            <button onclick="filterLeague('La Liga')" class="badge-chip" style="cursor:pointer; background:#f1f5f9; color:#334155; border:none; padding:4px 10px; border-radius:6px; font-size:11px; font-weight:700;">La Liga</button>
            <button onclick="filterLeague('Champions League')" class="badge-chip" style="cursor:pointer; background:#f1f5f9; color:#334155; border:none; padding:4px 10px; border-radius:6px; font-size:11px; font-weight:700;">Champions League</button>
            <button onclick="filterLeague('Serie A')" class="badge-chip" style="cursor:pointer; background:#f1f5f9; color:#334155; border:none; padding:4px 10px; border-radius:6px; font-size:11px; font-weight:700;">Serie A</button>
            <button onclick="filterLeague('Indian Super League')" class="badge-chip" style="cursor:pointer; background:#f1f5f9; color:#334155; border:none; padding:4px 10px; border-radius:6px; font-size:11px; font-weight:700;">ISL</button>
          </div>

          <div class="STING-web-Matches" id="matchesList">
            <!-- CSS Shimmer Skeletons -->
            <div id="matchesSkeletonLoader" class="w-full flex flex-col gap-3 py-2">
              <div class="zeta-match-card animate-pulse" style="display:flex; justify-content:space-between; align-items:center; padding:16px; background:#fff; border:1px solid #e2e8f0; border-radius:12px; margin-bottom:10px;">
                <div style="width:35%; display:flex; align-items:center; gap:8px;">
                  <div style="width:36px; height:36px; border-radius:50%; background:#e2e8f0;"></div>
                  <div style="width:80px; height:14px; background:#e2e8f0; border-radius:4px;"></div>
                </div>
                <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                  <div style="width:40px; height:12px; background:#e2e8f0; border-radius:4px;"></div>
                  <div style="width:50px; height:20px; background:#e2e8f0; border-radius:4px;"></div>
                </div>
                <div style="width:35%; display:flex; align-items:center; justify-content:flex-end; gap:8px;">
                  <div style="width:80px; height:14px; background:#e2e8f0; border-radius:4px;"></div>
                  <div style="width:36px; height:36px; border-radius:50%; background:#e2e8f0;"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- In-Feed AdSense -->
        <div class="STING-web-Ads zeta-ad-slot-card" style="min-height:90px; contain:layout size; margin:20px 0; text-align:center; background:#fff; border:1px dashed #cbd5e1; border-radius:12px; padding:12px;">
          <span class="zeta-ad-label" style="display:block; font-size:10px; font-weight:700; text-transform:uppercase; color:#94a3b8; margin-bottom:4px;">Advertisement • Responsive In-Feed</span>
        </div>
      </div>

      <!-- VIEW 2: MATCH DETAIL VIEW -->
      <div id="matchView" style="display:none; margin-bottom:20px;">
        <div style="margin-bottom: 14px;">
          <button onclick="goHome()" class="match-chip-btn" style="background:#fff; border:1px solid #cbd5e1; padding:8px 16px; border-radius:8px; font-weight:700; font-size:13px; cursor:pointer;">
            ← Back to All Matches
          </button>
        </div>
        <div class="match-page-box" id="matchBox"></div>
        <div class="STING-web-Ads zeta-ad-slot-card" style="min-height:90px; contain:layout size; margin:20px 0; text-align:center; background:#fff; border:1px dashed #cbd5e1; border-radius:12px; padding:12px;">
          <span class="zeta-ad-label" style="display:block; font-size:10px; font-weight:700; text-transform:uppercase; color:#94a3b8; margin-bottom:4px;">Advertisement • In-Article Unit</span>
        </div>
      </div>

      <!-- VIEW 2.5: DEDICATED LINK SELECTION GATEWAY (Blogger Blog 1) -->
      <div id="linksView" style="display:none; margin-bottom:20px;">
        <div style="margin-bottom: 14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <button onclick="returnToMatch()" class="match-chip-btn" id="btnLinksBackToMatch" style="cursor:pointer; min-height:44px;">
            ← Back to Match Post
          </button>
          <span style="font-size:12px; font-weight:700; color:#2563eb; display:flex; align-items:center; gap:6px;">
            <span style="width:8px; height:8px; background:#2563eb; border-radius:50%; display:inline-block;"></span>
            STREAM SELECTION GATEWAY
          </span>
        </div>
        <div class="links-page-box" id="linksBox"></div>
        <div class="STING-web-Ads zeta-ad-slot-card" style="min-height:250px; contain:layout size; margin:20px 0; text-align:center; background:#fff; border:1px dashed #cbd5e1; border-radius:12px; padding:12px;">
          <span class="zeta-ad-label" style="display:block; font-size:10px; font-weight:700; text-transform:uppercase; color:#94a3b8; margin-bottom:4px;">Advertisement • High-CTR Link Gateway</span>
        </div>
      </div>

      <!-- VIEW 3: DEDICATED STREAMING PAGE -->
      <div id="streamView" style="display:none; margin-bottom:20px;">
        <div style="margin-bottom: 14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <a id="btnBackToLinks" href="#" class="match-chip-btn" style="background:#2563eb; color:#fff; border-color:#2563eb; text-decoration:none; min-height:44px; display:inline-flex; align-items:center; padding:0 14px; border-radius:8px; font-size:13px; font-weight:700;">
              🔀 Change Server / Links
            </a>
            <a id="btnBackToPost" href="#" class="match-chip-btn" style="text-decoration:none; min-height:44px; display:inline-flex; align-items:center; padding:0 14px; border-radius:8px; font-size:13px; font-weight:700; background:#f1f5f9; color:#334155; border:1px solid #cbd5e1;">
              ← Match Post
            </a>
            <a id="btnBackToHome" href="#" class="match-chip-btn" style="text-decoration:none; min-height:44px; display:inline-flex; align-items:center; padding:0 14px; border-radius:8px; font-size:13px; font-weight:700; background:#f1f5f9; color:#334155; border:1px solid #cbd5e1;">
              🏠 Home
            </a>
          </div>
          <span style="font-size:12px; font-weight:700; color:#e11d48; display:flex; align-items:center; gap:6px;">
            <span style="width:8px; height:8px; background:#e11d48; border-radius:50%; display:inline-block;"></span>
            LIVE BROADCAST HD
          </span>
        </div>

        <div class="stream-player-container" style="background:#0f172a; border-radius:14px; overflow:hidden; border:1px solid #1e293b;">
          <div class="stream-player-header" style="display:flex; align-items:center; justify-content:space-between; padding:12px 18px; background:#1e293b; border-bottom:1px solid #334155; flex-wrap:wrap; gap:10px;">
            <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
              <h3 id="streamTitle" style="font-size:16px; font-weight:800; color:#f8fafc; margin:0; min-width:0; word-break:break-word;">Live Stream Player</h3>
              <span id="streamBadge" style="font-size:11px; background:#2563eb; color:#fff; padding:3px 8px; border-radius:4px; font-weight:700; letter-spacing:0.5px;">LIVE BROADCAST</span>
            </div>
            <div style="display:flex; gap:6px;">
              <button onclick="reloadCurrentStream()" class="match-chip-btn" style="color:#94a3b8; background:#334155; border:none; font-size:12px; padding:8px 14px; border-radius:6px; cursor:pointer;" title="Reload Stream">🔄 Reload</button>
              <button onclick="togglePlayerFullscreen()" class="match-chip-btn" style="color:#94a3b8; background:#334155; border:none; font-size:12px; padding:8px 14px; border-radius:6px; cursor:pointer;" title="Fullscreen">⛶ Fullscreen</button>
            </div>
          </div>
          <div id="playerFrameWrap" style="aspect-ratio: 16/9; background:#000; position:relative; overflow:hidden;">
            <video id="liveVideo" playsinline="playsinline" controls="controls" crossorigin="anonymous" style="width:100%; height:100%; display:block;"></video>
            <iframe id="streamIframe" src="" sandbox="allow-scripts allow-same-origin allow-presentation allow-forms" allowfullscreen="true" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" frameborder="0" style="display:none; width:100%; height:100%; border:none;"></iframe>
            <div id="noStreamAlert" style="display:none; position:absolute; inset:0; background:radial-gradient(circle at center, #1e293b 0%, #0f172a 100%); flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:24px; z-index:10;">
              <div style="font-size:42px; margin-bottom:12px;">📡</div>
              <h3 style="font-size:18px; font-weight:800; color:#f8fafc; margin-bottom:8px;">No Live Broadcast Active</h3>
              <p style="font-size:13px; color:#94a3b8; max-width:460px; margin:0 auto 18px; line-height:1.6;">
                The live video stream for this fixture has not been published yet or is offline. Official broadcast streams activate 15–30 minutes before kickoff. Join our Telegram for instant stream links!
              </p>
              <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
                <a href="https://t.me/zetasports_official" target="_blank" class="match-chip-btn" style="background:#229ED9; color:#fff; text-decoration:none; display:inline-flex; align-items:center; gap:6px; padding:10px 20px; font-weight:700; border-radius:8px;">
                  📢 Join Telegram for Stream Links
                </a>
                <button onclick="reloadCurrentStream()" class="match-chip-btn" style="background:#334155; color:#fff; border:none; padding:10px 20px; font-weight:700; border-radius:8px; cursor:pointer;">
                  🔄 Refresh Player
                </button>
              </div>
            </div>
          </div>
          <div style="display:flex; gap:10px; padding:12px 16px; background:#1e293b; border-top:1px solid #334155; flex-wrap:wrap; align-items:center; justify-content:space-between;">
            <span style="font-size:12px; color:#94a3b8; font-weight:700; display:flex; align-items:center; gap:6px;">
              📡 <span id="serverCountLabel">Stream Servers:</span>
            </span>
            <div id="serverButtonsList" style="display:flex; gap:8px; flex-wrap:wrap;"></div>
          </div>
        </div>
        <div class="STING-web-Ads zeta-ad-slot-card" style="min-height:90px; contain:layout size; margin:20px 0; text-align:center; background:#fff; border:1px dashed #cbd5e1; border-radius:12px; padding:12px;">
          <span class="zeta-ad-label" style="display:block; font-size:10px; font-weight:700; text-transform:uppercase; color:#94a3b8; margin-bottom:4px;">Advertisement • Beneath Live Player</span>
        </div>
      </div>
`;

if (!xml.includes('id="homeView"')) {
  const mainWrapperTag = "<main id='main-wrapper'>";
  if (xml.includes(mainWrapperTag)) {
    xml = xml.replace(mainWrapperTag, mainWrapperTag + '\n' + viewsMarkup);
    console.log("  ✔ Injected 4 views (#homeView, #matchView, #linksView, #streamView) into <main id='main-wrapper'>");
  }
} else {
  console.log('  ✔ Views already present in <main id="main-wrapper">');
}

// E. Inject Master 2-Blogger Engine & Router Script at the end of the file
console.log('Step E: Injecting Master 2-Blogger Engine & Router...');

// Find and replace the last <script type='text/javascript'> before </body>
const bodyCloseIdx = xml.lastIndexOf('</body>');
const lastScriptOpenIdx = xml.lastIndexOf("<script type='text/javascript'>", bodyCloseIdx);
const lastScriptCloseIdx = xml.lastIndexOf('</script>', bodyCloseIdx);

const wrappedScript = `<script type='text/javascript'>
//<![CDATA[
${jsPart}
//]]>
</script>`;

if (lastScriptOpenIdx !== -1 && lastScriptCloseIdx > lastScriptOpenIdx) {
  xml = xml.substring(0, lastScriptOpenIdx) + wrappedScript + '\n' + xml.substring(lastScriptCloseIdx + 9);
  console.log('  ✔ Replaced bottom script with master scripts/blogger_script_part.js');
} else {
  xml = xml.replace('</body>', wrappedScript + '\n</body>');
  console.log('  ✔ Injected master script before </body>');
}

// Convert back to CRLF if needed
if (hadCRLF) {
  xml = xml.replace(/\n/g, '\r\n');
}

// Write to both targets
console.log('Step F: Writing to zetasports-v3/web/colorify_zetasports_theme.xml and zetasports-colorify-blogger-theme.xml...');
fs.writeFileSync('zetasports-v3/web/colorify_zetasports_theme.xml', xml, 'utf8');
fs.writeFileSync('zetasports-colorify-blogger-theme.xml', xml, 'utf8');
console.log('✔ Both files written successfully.');

// Step G: Run verify_colorify_parity.cjs to validate
console.log('Step G: Running scripts/verify_colorify_parity.cjs...');
try {
  const testOut = execSync('node scripts/verify_colorify_parity.cjs', { encoding: 'utf8' });
  console.log(testOut);
} catch (err) {
  console.error('Verification failed:');
  console.error(err.stdout || err.message);
  process.exit(1);
}

console.log('=== COLORIFY THEME DEPLOYMENT COMPLETED SUCCESSFULLY ===');
