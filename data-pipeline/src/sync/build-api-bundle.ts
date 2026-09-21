import fs from 'fs';
import path from 'path';
import { DataStorage } from '../utils/storage.js';

function loadDirectoryJson<T = any>(storage: DataStorage, relativeSubdir: string): Record<string, T> {
  const result: Record<string, T> = {};
  const fullDir = storage.resolvePath(relativeSubdir);
  if (fs.existsSync(fullDir)) {
    const files = fs.readdirSync(fullDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const id = file.replace('.json', '');
      const data = storage.readJson<T>(`${relativeSubdir}/${file}`);
      if (data) {
        result[id] = data;
      }
    }
  }
  return result;
}

export async function buildApiBundle(): Promise<void> {
  console.log('=== [ZETA SPORTS] Building Unified Master & Modular API Bundles ===');
  const storage = new DataStorage();

  // Core metadata
  const meta = storage.readJson<any>('meta.json') || {};

  // Competitions & Fixtures
  const competitions = storage.readJson<any[]>('competitions.json') || [];
  const live = storage.readJson<any[]>('fixtures/live.json') || [];
  const today = storage.readJson<any[]>('fixtures/today.json') || [];
  const upcoming = storage.readJson<any[]>('fixtures/upcoming.json') || [];
  const results = storage.readJson<any[]>('fixtures/results.json') || [];

  // News headlines & Full articles
  const news = storage.readJson<any[]>('news/latest.json') || [];
  const articles = loadDirectoryJson(storage, 'news/articles');

  // Match details & league data
  const previews = loadDirectoryJson(storage, 'matches/preview');
  const standings = loadDirectoryJson(storage, 'matches/standings');
  const scorers = loadDirectoryJson(storage, 'matches/scorers');
  const lineups = loadDirectoryJson(storage, 'matches/lineups');
  const events = loadDirectoryJson(storage, 'matches/events');
  const statistics = loadDirectoryJson(storage, 'matches/statistics');

  const generatedAt = new Date().toISOString();
  const apiKey = 'zeta_public_free_feed';
  const repoRawBase = 'https://raw.githubusercontent.com/Mubthaseem/zetasports-flutter/main/data';
  const pagesBase = 'https://mubthaseem.github.io/zetasports-flutter/data';

  const summary = {
    competitionsCount: competitions.length,
    liveMatches: live.length,
    todayMatches: today.length,
    upcomingMatches: upcoming.length,
    resultsMatches: results.length,
    newsHeadlinesCount: news.length,
    fullArticlesCount: Object.keys(articles).length,
    standingsLeaguesCount: Object.keys(standings).length,
    scorersLeaguesCount: Object.keys(scorers).length,
    previewsCount: Object.keys(previews).length,
    lineupsCount: Object.keys(lineups).length,
    eventsCount: Object.keys(events).length,
    statisticsCount: Object.keys(statistics).length
  };

  const endpointLinks = {
    master: {
      raw: `${repoRawBase}/api.json`,
      pages: `${pagesBase}/api.json`
    },
    matches: {
      raw: `${repoRawBase}/api/matches.json`,
      pages: `${pagesBase}/api/matches.json`
    },
    news: {
      raw: `${repoRawBase}/api/news.json`,
      pages: `${pagesBase}/api/news.json`
    },
    leagues: {
      raw: `${repoRawBase}/api/leagues.json`,
      pages: `${pagesBase}/api/leagues.json`
    },
    details: {
      raw: `${repoRawBase}/api/details.json`,
      pages: `${pagesBase}/api/details.json`
    }
  };

  // 1. MASTER ALL-IN-ONE BUNDLE (api.json)
  const masterBundle = {
    status: 'success',
    meta: {
      platform: 'Zeta Sports Open Football API',
      version: '1.2.0',
      generatedAt,
      provider: meta.provider || 'FotMob Free Public Gateway',
      apiKey,
      summary,
      endpoints: endpointLinks
    },
    competitions,
    live,
    today,
    upcoming,
    results,
    news,
    articles,
    standings,
    scorers,
    previews,
    lineups,
    events,
    statistics
  };

  // 2. MODULAR MATCHES ENDPOINT (api/matches.json)
  const matchesBundle = {
    status: 'success',
    meta: {
      platform: 'Zeta Sports Open Football API - Matches Feed',
      generatedAt,
      apiKey,
      summary: {
        liveMatches: live.length,
        todayMatches: today.length,
        upcomingMatches: upcoming.length,
        resultsMatches: results.length
      },
      endpoints: endpointLinks.matches
    },
    live,
    today,
    upcoming,
    results
  };

  // 3. MODULAR NEWS & ARTICLES ENDPOINT (api/news.json)
  const newsBundle = {
    status: 'success',
    meta: {
      platform: 'Zeta Sports Open Football API - News & Articles Feed',
      generatedAt,
      apiKey,
      summary: {
        newsHeadlinesCount: news.length,
        fullArticlesCount: Object.keys(articles).length
      },
      endpoints: endpointLinks.news
    },
    news,
    articles
  };

  // 4. MODULAR LEAGUES & STANDINGS & SCORERS ENDPOINT (api/leagues.json)
  const leaguesBundle = {
    status: 'success',
    meta: {
      platform: 'Zeta Sports Open Football API - Leagues & Tables Feed',
      generatedAt,
      apiKey,
      summary: {
        competitionsCount: competitions.length,
        standingsLeaguesCount: Object.keys(standings).length,
        scorersLeaguesCount: Object.keys(scorers).length
      },
      endpoints: endpointLinks.leagues
    },
    competitions,
    standings,
    scorers
  };

  // 5. MODULAR MATCH DETAILS ENDPOINT (api/details.json)
  const detailsBundle = {
    status: 'success',
    meta: {
      platform: 'Zeta Sports Open Football API - Match Details & Analytics Feed',
      generatedAt,
      apiKey,
      summary: {
        previewsCount: Object.keys(previews).length,
        lineupsCount: Object.keys(lineups).length,
        eventsCount: Object.keys(events).length,
        statisticsCount: Object.keys(statistics).length
      },
      endpoints: endpointLinks.details
    },
    previews,
    lineups,
    events,
    statistics
  };

  // Ensure api/ directory exists
  const apiDir = storage.resolvePath('api');
  if (!fs.existsSync(apiDir)) {
    fs.mkdirSync(apiDir, { recursive: true });
  }

  // Write all bundles
  await storage.writeJson('api.json', masterBundle);
  await storage.writeJson('api/matches.json', matchesBundle);
  await storage.writeJson('api/news.json', newsBundle);
  await storage.writeJson('api/leagues.json', leaguesBundle);
  await storage.writeJson('api/details.json', detailsBundle);

  const masterKb = Math.round(JSON.stringify(masterBundle).length / 1024);
  const matchesKb = Math.round(JSON.stringify(matchesBundle).length / 1024);
  const newsKb = Math.round(JSON.stringify(newsBundle).length / 1024);
  const leaguesKb = Math.round(JSON.stringify(leaguesBundle).length / 1024);
  const detailsKb = Math.round(JSON.stringify(detailsBundle).length / 1024);

  console.log(`Saved master api.json (${masterKb} KB)`);
  console.log(`Saved modular api/matches.json (${matchesKb} KB)`);
  console.log(`Saved modular api/news.json (${newsKb} KB)`);
  console.log(`Saved modular api/leagues.json (${leaguesKb} KB)`);
  console.log(`Saved modular api/details.json (${detailsKb} KB)`);
  console.log('=== All Unified and Modular API Bundles Built Successfully! ===');
}

// Auto-run if executed directly
if (process.argv[1] && (process.argv[1].endsWith('build-api-bundle.ts') || process.argv[1].endsWith('build-api-bundle.js'))) {
  buildApiBundle().catch(err => {
    console.error('Fatal bundle error:', err);
    process.exit(1);
  });
}

