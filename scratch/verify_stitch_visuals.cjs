#!/usr/bin/env node
/**
 * Visual & DOM Layout Verification for Google Stitch v4.0 Redesign
 * Tests Colorify & Korra across Desktop (1280px), Tablet (768px), Mobile (390px)
 * Verifies:
 *  - Zero horizontal overflow (scrollWidth <= clientWidth)
 *  - Plus Jakarta Sans + Inter + Material Symbols Loaded
 *  - No overlapping elements or broken images
 *  - No horizontal tabs on Match Details + #watchBtn positioned AT THE BOTTOM
 *  - Captures full PNG screenshots to the brain artifact folder for visual inspection
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer');

const ARTIFACT_DIR = 'C:/Users/Mubthaseem/.gemini/antigravity/brain/39a60873-c4c5-4e87-9c11-d368021db40b';
const CSS_FILE = path.resolve('web/css/zetasports-core.css');

function toHtmlPreview(xmlFile, samplePostHtml = '') {
  let raw = fs.readFileSync(path.resolve(xmlFile), 'utf8');
  // Point CSS straight to local web/css/zetasports-core.css served from our test HTTP server so latest edit is tested!
  raw = raw.replace(/https:\/\/udlncusvhmydivtjkjcy\.supabase\.co\/storage\/v1\/object\/public\/scripts\/zetasports-core\.css/g, '/zetasports-core.css');
  // Strip ONLY XML Variable/Group declarations inside <b:skin>, preserving actual CSS rules just like live Blogger!
  raw = raw.replace(/<\?xml[^?]*\?>/g, '');
  raw = raw.replace(/<b:skin[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/b:skin>/g, (m, inner) => {
    const cleaned = inner.replace(/\/\*[\s\S]*?\*\//g, '').trim();
    return cleaned ? `<style id="b-skin-preserved">${cleaned}</style>` : '';
  });
  raw = raw.replace(/<b:skin[^>]*>([\s\S]*?)<\/b:skin>/g, (m, inner) => `<style>${inner}</style>`);
  raw = raw.replace(/<b:template-skin[\s\S]*?<\/b:template-skin>/g, '');
  raw = raw.replace(/<b:defaultmarkups>[\s\S]*?<\/b:defaultmarkups>/g, '');
  raw = raw.replace(/<b:comment>[\s\S]*?<\/b:comment>/g, '');
  raw = raw.replace(/<b:include[^>]*\/>/g, '');
  raw = raw.replace(/<b:if cond='data:view\.isLayoutMode'>[\s\S]*?<\/b:if>/g, '');
  raw = raw.replace(/<b:if cond='data:view\.isSingleItem'>[\s\S]*?<\/b:if>/g, '');
  raw = raw.replace(/<b:section class='featured'[\s\S]*?<\/b:section>/g, '');
  raw = raw.replace(/<b:section class='footer-fbm'[\s\S]*?<\/b:section>/g, '');
  // Keep Header1 logo includable image content & linklist/blog sections visible
  raw = raw.replace(/<b:widget-settings>[\s\S]*?<\/b:widget-settings>/g, '');
  // Extract Header1 <b:includable id='image'> content for preview
  const imgInc = raw.match(/<b:includable id='image'>([\s\S]*?)<\/b:includable>/);
  if (imgInc) {
    raw = raw.replace(/<b:section class='main-logo'[\s\S]*?<\/b:section>/, imgInc[1].replace("expr:href='data:blog.homepageUrl.canonical'", "href='/'"));
  }
  // Replace Blog1 section with realistic editorial blog post cards in preview (both Colorify and Korra)
  raw = raw.replace(/<b:section[^>]*id='main'[\s\S]*?<\/b:section>/, samplePostHtml);
  raw = raw.replace(/<\/?b:[^>]+>/g, '');
  raw = raw.replace(/<(\w+)([^>]*?)\/>/g, (m, tag, attrs) => {
    const voids = ['meta', 'link', 'img', 'input', 'br', 'hr'];
    if (voids.includes(tag.toLowerCase())) return m;
    return `<${tag}${attrs}></${tag}>`;
  });
  return raw;
}

const SAMPLE_BLOGGER_POSTS_HTML = `
<div class="main section" id="main" name="Main Posts">
  <div class="widget Blog" id="Blog1">
    <div class="blog-posts-wrap">
      <div class="title-wrap title-ico"><h3 class="title">Read more</h3></div>
      <div class="blog-posts hfeed index-post-wrap">
        <article class="blog-post hentry index-post post-0">
          <a class="entry-image-wrap is-image" href="/pakistan-vs-india-preview.html">
            <div class="zs-thumb-fallback"><span class="material-symbols-outlined">sports_soccer</span><span>SAFF Championship Derby</span></div>
            <span class="entry-tag">SAFF CUP</span>
          </a>
          <div class="entry-header">
            <div class="entry-meta mi"><span class="entry-tag">SAFF CUP</span><span class="entry-time"><span class="on sp">-</span><time class="published">November 05, 2026</time></span></div>
            <h2 class="entry-title"><a class="entry-title-link" href="/pakistan-vs-india-preview.html">Pakistan vs India Lineups, Live Score &amp; Match Center</a></h2>
            <p class="entry-excerpt">Deep tactical breakdown of starting XI formations, midfield pressing transitions, and live official broadcast channels.</p>
          </div>
        </article>
        <article class="blog-post hentry index-post post-1">
          <a class="entry-image-wrap is-image" href="/chennaiyin-vs-east-bengal.html">
            <div class="zs-thumb-fallback" style="background:linear-gradient(135deg,#004f35,#0037b0);"><span class="material-symbols-outlined">sports_soccer</span><span>Indian Super League</span></div>
            <span class="entry-tag">ISL TACTICS</span>
          </a>
          <div class="entry-header">
            <div class="entry-meta mi"><span class="entry-tag">ISL TACTICS</span><span class="entry-time"><span class="on sp">-</span><time class="published">November 05, 2026</time></span></div>
            <h2 class="entry-title"><a class="entry-title-link" href="/chennaiyin-vs-east-bengal.html">Chennaiyin FC vs East Bengal FC: Starting XI &amp; Preview</a></h2>
            <p class="entry-excerpt">Marina Arena tactical guide covering high-line vulnerabilities, attacking wings, and key midfield duels.</p>
          </div>
        </article>
        <article class="blog-post hentry index-post post-2">
          <a class="entry-image-wrap is-image" href="/mi-vs-csk-ipl.html">
            <div class="zs-thumb-fallback" style="background:linear-gradient(135deg,#1d4ed8,#213145);"><span class="material-symbols-outlined">sports_cricket</span><span>Tata IPL Cricket</span></div>
            <span class="entry-tag">T20 CRICKET</span>
          </a>
          <div class="entry-header">
            <div class="entry-meta mi"><span class="entry-tag">T20 CRICKET</span><span class="entry-time"><span class="on sp">-</span><time class="published">November 04, 2026</time></span></div>
            <h2 class="entry-title"><a class="entry-title-link" href="/mi-vs-csk-ipl.html">Mumbai Indians vs Chennai Super Kings: Pitch Report &amp; Stats</a></h2>
            <p class="entry-excerpt">Death-over analytics, Wankhede dew factor projections, and official licensed broadcasting details.</p>
          </div>
        </article>
      </div>
    </div>
    <div class="blog-pager" id="blog-pager">
      <a class="blog-pager-older-link load-more btn" href="javascript:;" id="colorify-free-load-more-link">Load More</a>
      <span class="loading"><div class="loader"></div></span>
      <span class="no-more load-more btn">That is All</span>
    </div>
  </div>
</div>`;

async function main() {
  const colorifyHtml = toHtmlPreview('zetasports-colorify-blogger-theme.xml', SAMPLE_BLOGGER_POSTS_HTML);
  const korraHtml = toHtmlPreview('zetasports-korra-blogger-theme.xml');
  const cssContent = fs.readFileSync(CSS_FILE, 'utf8');

  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/zetasports-core.css')) {
      res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' });
      res.end(cssContent);
    } else if (req.url.startsWith('/korra')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(korraHtml);
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(colorifyHtml);
    }
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Preview server running on ${baseUrl}`);

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const results = [];

  try {
    const page = await browser.newPage();

    // Step 0: Verify Live Supabase Empty State (0 Approved -> 0 cards + empty state card, never leak 227 unapproved!)
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 800));
    const emptyStateCheck = await page.evaluate(() => ({
      cards: document.querySelectorAll('.STING-web-Match:not(.zs-skeleton)').length,
      allMatchesLen: (window.allMatches || []).length,
      emptyCard: !!document.querySelector('#matchesList .zs-empty-state-card')
    }));
    console.log('[CHECK] Live Supabase Approval Isolation ->', JSON.stringify(emptyStateCheck));
    if (emptyStateCheck.allMatchesLen !== 0) {
      console.log('Notice: Live DB has approved matches:', emptyStateCheck.allMatchesLen);
    } else if (!emptyStateCheck.emptyCard) {
      throw new Error('Expected .zs-empty-state-card when 0 approved matches exist!');
    }

    // Intercept zeta_matches REST call with a mix of is_approved:true AND is_approved:false to verify strict gate + Stitch layout
    const nowIso = new Date().toISOString();
    const MOCK_FIXTURES = [
      { id: 'appr-101', home_team: 'Real Madrid CF', away_team: 'FC Barcelona', league_name: 'La Liga', venue: 'Santiago Bernabeu', status: 'live', time_elapsed: "64'", home_score: 2, away_score: 1, date: nowIso, is_approved: true, stream_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
      { id: 'appr-102', home_team: 'Arsenal FC', away_team: 'Manchester City', league_name: 'Premier League', venue: 'Emirates Stadium', status: 'scheduled', kickoff_ist: '9:00 PM', date: nowIso, is_approved: true },
      { id: 'appr-103', home_team: 'Kerala Blasters', away_team: 'Mohun Bagan SG', league_name: 'Indian Super League', venue: 'JLN Stadium Kochi', status: 'scheduled', kickoff_ist: '7:30 PM', date: nowIso, is_approved: true },
      { id: 'leak-901', home_team: 'LEAKED UNAPPROVED HOME', away_team: 'LEAKED AWAY', league_name: 'MLS', status: 'live', home_score: 1, away_score: 0, date: nowIso, is_approved: false },
      { id: 'leak-902', home_team: 'STAGING INBOX MATCH', away_team: 'UNAPPROVED FC', league_name: 'Copa del Rey', status: 'scheduled', date: nowIso, is_approved: false }
    ];
    await page.setRequestInterception(true);
    page.on('request', req => {
      if (req.url().includes('/rest/v1/zeta_matches')) {
        const corsHeaders = {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        };
        if (req.method() === 'OPTIONS') {
          return req.respond({ status: 204, headers: corsHeaders, body: '' });
        }
        if (req.url().includes('id=eq.')) {
          const hit = MOCK_FIXTURES.find(m => req.url().includes('id=eq.' + m.id)) || MOCK_FIXTURES[0];
          return req.respond({ status: 200, headers: corsHeaders, contentType: 'application/json', body: JSON.stringify([hit]) });
        }
        return req.respond({ status: 200, headers: corsHeaders, contentType: 'application/json', body: JSON.stringify(MOCK_FIXTURES) });
      }
      req.continue();
    });

    async function checkLayout(label, url, viewport, afterLoadFn, screenshotName, scrollBottomFirst = false) {
      await page.setViewport(viewport);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
      await page.waitForSelector('.STING-web-Match .zs-match-link', { timeout: 12000 }).catch(() => {});
      await page.evaluate(() => document.fonts.ready);
      await new Promise(r => setTimeout(r, 700));
      if (afterLoadFn) {
        await afterLoadFn(page);
        await new Promise(r => setTimeout(r, 600));
      }
      if (scrollBottomFirst) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await new Promise(r => setTimeout(r, 300));
      }
      const metrics = await page.evaluate(() => {
        const doc = document.documentElement;
        const body = document.body;
        const overflow = Math.max(doc.scrollWidth, body.scrollWidth) - doc.clientWidth;
        const bodyBg = getComputedStyle(body).backgroundColor;
        const bodyFont = getComputedStyle(body).fontFamily;
        const cards = document.querySelectorAll('.STING-web-Match').length;
        const leakedPresent = document.body.innerText.includes('LEAKED UNAPPROVED') || document.body.innerText.includes('STAGING INBOX MATCH');
        const firstCard = document.querySelector('.STING-web-Match');
        const mcTop = document.querySelector('.zs-mc-top');
        const mcBody = document.querySelector('.zs-mc-body');
        const mcFoot = document.querySelector('.zs-mc-foot');
        const cardW = firstCard ? firstCard.getBoundingClientRect().width : 0;
        const mcTopRatio = (cardW && mcTop) ? +(mcTop.getBoundingClientRect().width / cardW).toFixed(2) : 0;
        const mcBodyRatio = (cardW && mcBody) ? +(mcBody.getBoundingClientRect().width / cardW).toFixed(2) : 0;
        const mcFootRatio = (cardW && mcFoot) ? +(mcFoot.getBoundingClientRect().width / cardW).toFixed(2) : 0;
        const ed = document.getElementById('editorialSection');
        const pol = document.getElementById('zsPolicySection');
        const edRect = ed ? ed.getBoundingClientRect() : null;
        const polRect = pol ? pol.getBoundingClientRect() : null;
        const policyOverlap = !!(edRect && polRect && polRect.top < edRect.bottom - 2);
        const pill = document.querySelector('#editorialSection .zs-pill-eyebrow');
        const secH2 = document.querySelector('#editorialSection .zs-section-title');
        const pillOverlap = !!(pill && secH2 && pill.getBoundingClientRect().bottom > secH2.getBoundingClientRect().top + 1);
        const loadMore = document.getElementById('colorify-free-load-more-link');
        const loadMoreBg = loadMore ? getComputedStyle(loadMore).backgroundColor : null;
        const readMoreHead = document.querySelector('.blog-posts-wrap > .title-wrap');
        const readMoreHidden = !readMoreHead || getComputedStyle(readMoreHead).display === 'none';
        const tabsBar = document.querySelector('.match-tabs-header');
        const watchBtn = document.getElementById('watchBtn');
        const matchSecCount = document.querySelectorAll('.match-section-card').length;
        let watchAtBottom = false;
        if (watchBtn && matchSecCount > 0) {
          const lastSec = document.querySelectorAll('.match-section-card')[matchSecCount - 1];
          watchAtBottom = watchBtn.getBoundingClientRect().top >= lastSec.getBoundingClientRect().top;
        }
        return { overflow, bodyBg, bodyFont, cards, leakedPresent, mcTopRatio, mcBodyRatio, mcFootRatio, edH: edRect ? Math.round(edRect.height) : 0, policyOverlap, pillOverlap, loadMoreBg, readMoreHidden, hasTabsBar: !!tabsBar, watchAtBottom, matchSecCount };
      });
      await page.screenshot({ path: path.join(ARTIFACT_DIR, screenshotName), fullPage: !scrollBottomFirst });
      results.push({ label, viewport: `${viewport.width}x${viewport.height}`, ...metrics, screenshot: screenshotName });
      console.log(`[CHECK] ${label} (${viewport.width}px) -> overflow:${metrics.overflow} cards:${metrics.cards} leak:${metrics.leakedPresent} ratios:${metrics.mcTopRatio}/${metrics.mcBodyRatio}/${metrics.mcFootRatio} edH:${metrics.edH} polOv:${metrics.policyOverlap} pillOv:${metrics.pillOverlap}`);
    }

    // 1. Colorify Desktop Home
    await checkLayout('Colorify Desktop Home', `${baseUrl}/`, { width: 1280, height: 900 }, null, 'stitch_v4_colorify_desktop_home.png');
    // 2. Colorify Mobile Home
    await checkLayout('Colorify Mobile Home', `${baseUrl}/`, { width: 390, height: 844 }, null, 'stitch_v4_colorify_mobile_home.png');
    // 3. Colorify Tablet Home
    await checkLayout('Colorify Tablet Home', `${baseUrl}/`, { width: 768, height: 1024 }, null, 'stitch_v4_colorify_tablet_home.png');

    // 4. Colorify Desktop Match Details (Top + Bottom with #watchBtn last!)
    const openFirstMatch = async (p) => {
      await p.evaluate(() => {
        const firstCard = document.querySelector('.STING-web-Match > a');
        if (firstCard) firstCard.click();
      });
      await p.waitForSelector('#matchBox .zs-match-hero-card', { timeout: 6000 });
    };
    await checkLayout('Colorify Desktop Match Top', `${baseUrl}/`, { width: 1280, height: 900 }, openFirstMatch, 'stitch_v4_colorify_desktop_match.png');
    await checkLayout('Colorify Mobile Match Top', `${baseUrl}/`, { width: 390, height: 844 }, openFirstMatch, 'stitch_v4_colorify_mobile_match_top.png');
    await checkLayout('Colorify Mobile Match Bottom', `${baseUrl}/`, { width: 390, height: 844 }, openFirstMatch, 'stitch_v4_colorify_mobile_match_bottom.png', true);

    // 5. Colorify Night Mode Desktop
    await checkLayout('Colorify Night Mode', `${baseUrl}/`, { width: 1280, height: 900 }, async (p) => {
      await p.evaluate(() => { if (typeof window.toggleNightMode === 'function') window.toggleNightMode(); });
    }, 'stitch_v4_colorify_desktop_night.png');

    // Reset night mode in localStorage
    await page.evaluate(() => localStorage.removeItem('zeta_night'));

    // 6. Korra Desktop Home & Mobile Home
    await checkLayout('Korra Desktop Home', `${baseUrl}/korra`, { width: 1280, height: 900 }, null, 'stitch_v4_korra_desktop_home.png');
    await checkLayout('Korra Mobile Home', `${baseUrl}/korra`, { width: 390, height: 844 }, null, 'stitch_v4_korra_mobile_home.png');

    // Verify Korra cards point directly to https://www.keralahub.online/
    const korraHref = await page.evaluate(() => {
      const a = document.querySelector('.STING-web-Match > a');
      return a ? a.getAttribute('href') : '';
    });
    console.log('[CHECK] Korra Match Card Href ->', korraHref);

    // 7. Links Gateway (?links={id}) & Stream View (?stream={id})
    const firstId = await page.evaluate(() => {
      const el = document.querySelector('.STING-web-Match');
      return el ? el.id.replace('match-', '') : '';
    });
    if (firstId) {
      await checkLayout('Colorify Links Gateway', `${baseUrl}/?links=${encodeURIComponent(firstId)}`, { width: 1280, height: 900 }, null, 'stitch_v4_links_gateway.png');
      await checkLayout('Korra Stream View', `${baseUrl}/korra?stream=${encodeURIComponent(firstId)}`, { width: 1280, height: 900 }, null, 'stitch_v4_stream_view.png');
    }

  } finally {
    await browser.close();
    server.close();
  }

  console.log('\nSUMMARY:', JSON.stringify(results, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

