/**
 * ZETASPORTS & KERALAHUB SEO KEYWORDS & CLOUD SETTINGS UPDATER
 * 
 * Updates global SEO keywords, site title, description, and announcement banner
 * directly in Supabase zeta_config and pings Google Search Console sitemaps.
 * 
 * Usage:
 *   node scripts/update_seo_keywords.cjs --keywords="Arsenal vs Chelsea, Live Stream, FotMob Scores"
 *   node scripts/update_seo_keywords.cjs --title="ZetaSports — Live Football Today"
 *   node scripts/update_seo_keywords.cjs --banner="🔥 El Clasico kicks off at 21:00 CET! HD Streams online."
 *   node scripts/update_seo_keywords.cjs --interactive
 */

const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');

const SUPABASE_URL = 'https://udlncusvhmydivtjkjcy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkbG5jdXN2aG15ZGl2dGpramN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4MTE2MDgsImV4cCI6MjEwOTM4NzYwOH0.gsnxlDww-fUC4HG7R7VasXSaQvqkSsDhhmf16KUCLZY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function pingSitemaps() {
  const sitemaps = [
    'https://www.keralahub.online/sitemap.xml',
    'http://www.zetasports.site/sitemap.xml'
  ];

  console.log('\n[SEO] Pinging Google Search Console with updated sitemaps...');
  for (const sm of sitemaps) {
    try {
      const pingUrl = `https://www.google.com/ping?sitemap=${encodeURIComponent(sm)}`;
      const res = await fetch(pingUrl);
      console.log(`  ✔ Googlebot Pinged for ${sm} (Status: ${res.status})`);
    } catch (e) {
      console.log(`  [!] Ping notice for ${sm}: ${e.message}`);
    }
  }
}

async function updateConfig(updates) {
  console.log('\nUpdating Supabase zeta_config (id: global)...');
  const { data, error } = await supabase
    .from('zeta_config')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', 'global')
    .select();

  if (error) {
    console.error('[ERROR] Failed to update zeta_config:', error.message);
    process.exit(1);
  }

  console.log('✔ Successfully updated zeta_config! Live changes:');
  if (updates.site_title) console.log(`  • Site Title: ${updates.site_title}`);
  if (updates.seo_keywords) console.log(`  • SEO Keywords: ${updates.seo_keywords}`);
  if (updates.meta_description) console.log(`  • Meta Description: ${updates.meta_description}`);
  if (updates.announcement_banner) console.log(`  • Announcement Banner: ${updates.announcement_banner}`);

  await pingSitemaps();
  console.log('\n[SUCCESS] Settings and keywords are now live across both websites for all visitors!');
}

async function runInteractive() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const prompt = (query) => new Promise((resolve) => rl.question(query, resolve));

  console.log('\n======================================================================');
  console.log('       INTERACTIVE SEO KEYWORDS & SITE SETTINGS MANAGER');
  console.log('======================================================================\n');

  // Fetch current config
  const { data } = await supabase.from('zeta_config').select('*').eq('id', 'global');
  const current = data && data[0] ? data[0] : {};

  console.log('CURRENT SETTINGS:');
  console.log(`1. Site Title:          ${current.site_title || '(default)'}`);
  console.log(`2. SEO Keywords:        ${current.seo_keywords || '(default)'}`);
  console.log(`3. Meta Description:    ${current.meta_description || '(default)'}`);
  console.log(`4. Announcement Banner: ${current.announcement_banner || '(none)'}`);
  console.log('----------------------------------------------------------------------\n');

  const newTitle = await prompt('Enter new Site Title (press Enter to keep current): ');
  const newKeywords = await prompt('Enter new SEO Keywords (press Enter to keep current): ');
  const newDesc = await prompt('Enter new Meta Description (press Enter to keep current): ');
  const newBanner = await prompt('Enter new Announcement Banner (press Enter to keep current): ');

  rl.close();

  const updates = {};
  if (newTitle.trim()) updates.site_title = newTitle.trim();
  if (newKeywords.trim()) updates.seo_keywords = newKeywords.trim();
  if (newDesc.trim()) updates.meta_description = newDesc.trim();
  if (newBanner.trim()) updates.announcement_banner = newBanner.trim();

  if (Object.keys(updates).length === 0) {
    console.log('\nNo changes entered. Exiting.');
    return;
  }

  await updateConfig(updates);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--interactive') || args.length === 0) {
    await runInteractive();
    return;
  }

  const updates = {};
  for (const arg of args) {
    if (arg.startsWith('--title=')) updates.site_title = arg.substring(8);
    if (arg.startsWith('--keywords=')) updates.seo_keywords = arg.substring(11);
    if (arg.startsWith('--desc=')) updates.meta_description = arg.substring(7);
    if (arg.startsWith('--banner=')) updates.announcement_banner = arg.substring(9);
  }

  if (Object.keys(updates).length > 0) {
    await updateConfig(updates);
  } else {
    console.log('Usage: node scripts/update_seo_keywords.cjs [--interactive | --keywords="..." | --title="..." | --banner="..."]');
  }
}

main();
