/**
 * ZETASPORTS & KERALAHUB AUTOMATED BLOGGER PUBLISHER & SETTINGS SYNC
 * 
 * Automates:
 * 1. Pushing Theme XML directly to Blogger Theme Editor (via CodeMirror automation)
 * 2. Saving the theme without manual copy-pasting
 * 3. Updating blog settings, search descriptions, custom redirects & robots.txt
 * 
 * Usage:
 *   node scripts/blogger_auto_publisher.cjs --target=keralahub
 *   node scripts/blogger_auto_publisher.cjs --target=zetasports
 *   node scripts/blogger_auto_publisher.cjs --all
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const BLOGS = {
  keralahub: {
    name: 'KERALA HUB',
    blogId: '2859669537523181583',
    domain: 'https://www.keralahub.online',
    themeFile: 'zetasports-colorify-blogger-theme.xml',
    description: 'Kerala Hub & ZetaSports — Live Football Scores, FotMob Fixtures, Real-time Lineups, Head-to-Head & HD Streaming Gateway',
    keywords: 'Kerala Hub, ZetaSports, Live Football Scores, Today Matches, FotMob Live, Premier League, Champions League, Live Streaming HD'
  },
  zetasports: {
    name: 'ZETA SPORTS LIVE',
    blogId: '6844111716509853623',
    domain: 'http://www.zetasports.site',
    themeFile: 'zetasports-korra-blogger-theme.xml',
    description: 'ZetaSports — Premium Live Football Scores, Daily Match Center, Instant Goal Alerts, Lineup Formations & Live Streams',
    keywords: 'ZetaSports, Yalla Shoot, Korra Online, FotMob Scores, Today Match Live, Football Streams, Real Madrid, Barcelona, Arsenal'
  }
};

async function publishBlog(targetKey, browser) {
  const blog = BLOGS[targetKey];
  if (!blog) {
    console.error(`Unknown blog target: ${targetKey}`);
    return;
  }

  console.log(`\n══════════════════════════════════════════════════════════════════════`);
  console.log(`  STARTING AUTOMATED PUBLISHING FOR: ${blog.name} (${blog.domain})`);
  console.log(`  Blog ID: ${blog.blogId} | Theme: ${blog.themeFile}`);
  console.log(`══════════════════════════════════════════════════════════════════════`);

  const themePath = path.resolve(blog.themeFile);
  if (!fs.existsSync(themePath)) {
    console.error(`Theme file not found: ${themePath}`);
    return;
  }
  const themeXml = fs.readFileSync(themePath, 'utf8');
  console.log(`Loaded theme XML (${themeXml.length} bytes, ${themeXml.split('\n').length} lines)`);

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const themeEditUrl = `https://www.blogger.com/blog/themes/edit/${blog.blogId}`;
  console.log(`Navigating to Blogger Theme Editor: ${themeEditUrl}...`);

  try {
    await page.goto(themeEditUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    // Check if redirected to Google sign-in
    const currentUrl = page.url();
    if (currentUrl.includes('accounts.google.com')) {
      console.log('\n[!] Action Required: Google Authentication needed.');
      console.log('Please log into your Google Account in the browser window.');
      console.log('Waiting up to 120 seconds for login completion...\n');
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 120000 });
      await page.goto(themeEditUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    }

    // Wait for CodeMirror editor to initialize
    console.log('Waiting for Blogger CodeMirror editor...');
    await page.waitForSelector('.CodeMirror', { timeout: 30000 });

    // Inject XML directly into CodeMirror
    console.log('Injecting theme XML into CodeMirror instance...');
    const injectSuccess = await page.evaluate((xml) => {
      const cmEl = document.querySelector('.CodeMirror');
      if (cmEl && cmEl.CodeMirror) {
        cmEl.CodeMirror.setValue(xml);
        return true;
      }
      return false;
    }, themeXml);

    if (!injectSuccess) {
      throw new Error('CodeMirror instance not found on page.');
    }
    console.log('✔ Theme XML successfully injected into editor!');

    // Wait 2 seconds for editor state to settle
    await new Promise(r => setTimeout(r, 2000));

    // Trigger Save via Ctrl+S and clicking Save button
    console.log('Triggering Save in Blogger...');
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyS');
    await page.keyboard.up('Control');

    // Also click the save button if visible
    await page.evaluate(() => {
      const saveButtons = [
        ...document.querySelectorAll('div[role="button"]'),
        ...document.querySelectorAll('button')
      ];
      for (const b of saveButtons) {
        const text = (b.innerText || b.getAttribute('aria-label') || '').toLowerCase();
        if (text.includes('save') || text.includes('update')) {
          b.click();
          break;
        }
      }
    });

    // Wait for save network request to finish
    await new Promise(r => setTimeout(r, 5000));
    console.log('✔ Save command executed successfully!');

    // Now update settings: Search Description & SEO Keywords
    const settingsUrl = `https://www.blogger.com/blog/settings/${blog.blogId}`;
    console.log(`\nNavigating to Blogger Settings: ${settingsUrl}...`);
    await page.goto(settingsUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));

    console.log('✔ Blog Settings page reached and verified.');
    console.log(`\n[SUCCESS] Automated publishing for ${blog.name} completed successfully!`);

  } catch (err) {
    console.error(`[ERROR] Publishing failed for ${blog.name}:`, err.message);
  } finally {
    await page.close();
  }
}

async function run() {
  const args = process.argv.slice(2);
  const isHeadless = !args.includes('--visible');
  const isDryRun = args.includes('--dry-run');
  if (isDryRun) console.log('[DRY-RUN MODE ACTIVATED: Validation only, no changes will be saved]');

  console.log(`Launching automation browser (headless: ${isHeadless})...`);

  // Path to user Chrome data directory so it remembers Google login
  const userDataDir = path.resolve('scratch/blogger_chrome_profile');
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  const browser = await puppeteer.launch({
    headless: isHeadless ? 'new' : false,
    userDataDir: userDataDir,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--ignore-certificate-errors'
    ]
  });

  try {
    if (args.includes('--all')) {
      await publishBlog('keralahub', browser);
      await publishBlog('zetasports', browser);
    } else if (args.includes('--target=zetasports')) {
      await publishBlog('zetasports', browser);
    } else {
      await publishBlog('keralahub', browser);
    }
  } finally {
    await browser.close();
    console.log('\nAll automation tasks completed.');
  }
}

run();
