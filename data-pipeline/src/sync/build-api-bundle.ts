import fs from 'fs';
import path from 'path';
import { DataStorage } from '../utils/storage.js';

export async function buildApiBundle(): Promise<void> {
  console.log('=== [ZETA SPORTS] Building Unified Master api.json Bundle ===');
  const storage = new DataStorage();

  const meta = storage.readJson<any>('meta.json') || {};
  const competitions = storage.readJson<any[]>('competitions.json') || [];
  const live = storage.readJson<any[]>('fixtures/live.json') || [];
  const today = storage.readJson<any[]>('fixtures/today.json') || [];
  const upcoming = storage.readJson<any[]>('fixtures/upcoming.json') || [];
  const results = storage.readJson<any[]>('fixtures/results.json') || [];
  const news = storage.readJson<any[]>('news/latest.json') || [];

  // Read preview files
  const previews: Record<string, any> = {};
  const previewDir = storage.resolvePath('matches/preview');
  if (fs.existsSync(previewDir)) {
    const files = fs.readdirSync(previewDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const matchId = file.replace('.json', '');
      const prevData = storage.readJson<any>(`matches/preview/${file}`);
      if (prevData) previews[matchId] = prevData;
    }
  }

  // Read standings
  const standings: Record<string, any> = {};
  const standingsDir = storage.resolvePath('matches/standings');
  if (fs.existsSync(standingsDir)) {
    const files = fs.readdirSync(standingsDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const compId = file.replace('.json', '');
      const sData = storage.readJson<any>(`matches/standings/${file}`);
      if (sData) standings[compId] = sData;
    }
  }

  const bundle = {
    status: 'success',
    meta: {
      platform: 'Zeta Sports Open Football API',
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      provider: meta.provider || 'FotMob Free Public Gateway',
      apiKey: 'zeta_public_free_feed',
      summary: {
        liveMatches: live.length,
        todayMatches: today.length,
        upcomingMatches: upcoming.length,
        resultsMatches: results.length,
        newsCount: news.length,
        previewsCount: Object.keys(previews).length,
        competitionsCount: competitions.length
      },
      endpoints: {
        raw: 'https://raw.githubusercontent.com/Mubthaseem/zetasports-flutter/main/data/api.json',
        githubPages: 'https://mubthaseem.github.io/zetasports-flutter/data/api.json'
      }
    },
    competitions,
    live,
    today,
    upcoming,
    results,
    news,
    previews,
    standings
  };

  await storage.writeJson('api.json', bundle);
  console.log(`Saved unified api.json (${Math.round(JSON.stringify(bundle).length / 1024)} KB)`);
  console.log('=== Unified API Bundle Built Successfully! ===');
}

// Auto-run if executed directly
if (process.argv[1] && (process.argv[1].endsWith('build-api-bundle.ts') || process.argv[1].endsWith('build-api-bundle.js'))) {
  buildApiBundle().catch(err => {
    console.error('Fatal bundle error:', err);
    process.exit(1);
  });
}
