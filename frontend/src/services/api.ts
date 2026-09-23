import {
  Competition,
  Fixture,
  MatchLineups,
  MatchStatistics,
  MatchEventsData,
  CompetitionStandings,
  CompetitionScorers,
  NewsItem,
  NewsArticle,
  SyncMeta,
  MatchPreviewData
} from '../types.js';

// Live GitHub Raw data endpoint and local fallback
const RAW_BASE_URL = 'https://raw.githubusercontent.com/Mubthaseem/zetasports-flutter/main/data';
const LOCAL_BASE_URL = './data';

async function fetchJson<T>(path: string): Promise<T | null> {
  const cacheBuster = `?_t=${Date.now()}`;
  const isLocalhost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  const primaryUrl = isLocalhost 
    ? `${LOCAL_BASE_URL}/${path}${cacheBuster}` 
    : `${RAW_BASE_URL}/${path}${cacheBuster}`;

  const fallbackUrl = isLocalhost 
    ? `${RAW_BASE_URL}/${path}${cacheBuster}` 
    : `${LOCAL_BASE_URL}/${path}${cacheBuster}`;

  try {
    const res = await fetch(primaryUrl);
    if (res.ok) {
      return await res.json() as T;
    }
  } catch {
    // Primary failed, continue to fallback
  }

  try {
    const res = await fetch(fallbackUrl);
    if (res.ok) {
      return await res.json() as T;
    }
  } catch (err) {
    console.warn(`[DataAPI] Failed to load ${path}:`, err);
  }
  return null;
}

// In-memory cache for ultra-fast single bundle delivery
let cachedBundle: { generatedAt: string; matches: any[]; standings?: any } | null = null;
let lastBundleFetch = 0;

async function getLiveBundle() {
  const now = Date.now();
  if (cachedBundle && (now - lastBundleFetch < 15000)) {
    return cachedBundle;
  }
  const bundle = await fetchJson<any>('live_bundle.json');
  if (bundle) {
    cachedBundle = bundle;
    lastBundleFetch = now;
  }
  return cachedBundle;
}

export const DataAPI = {
  async getMeta(): Promise<SyncMeta | null> {
    return fetchJson<SyncMeta>('meta.json');
  },

  async getCompetitions(): Promise<Competition[]> {
    return (await fetchJson<Competition[]>('competitions.json')) || [];
  },

  async getTodayFixtures(): Promise<Fixture[]> {
    return (await fetchJson<Fixture[]>('fixtures/today.json')) || [];
  },

  async getLiveFixtures(): Promise<Fixture[]> {
    const bundle = await getLiveBundle();
    if (bundle && Array.isArray(bundle.matches) && bundle.matches.length > 0) {
      return bundle.matches as Fixture[];
    }
    return (await fetchJson<Fixture[]>('fixtures/live.json')) || [];
  },

  async getUpcomingFixtures(): Promise<Fixture[]> {
    return (await fetchJson<Fixture[]>('fixtures/upcoming.json')) || [];
  },

  async getResultsFixtures(): Promise<Fixture[]> {
    return (await fetchJson<Fixture[]>('fixtures/results.json')) || [];
  },

  async getStandings(competitionId: string): Promise<CompetitionStandings | null> {
    const bundle = await getLiveBundle();
    if (bundle && bundle.standings && (competitionId === '516' || competitionId === 'algerian-ligue-1')) {
      return {
        competitionId: '516',
        competitionName: 'Algerian Ligue 1',
        updatedAt: bundle.generatedAt,
        table: bundle.standings
      } as any;
    }
    return fetchJson<CompetitionStandings>(`matches/standings/${competitionId}.json`);
  },

  async getScorers(competitionId: string): Promise<CompetitionScorers | null> {
    return fetchJson<CompetitionScorers>(`matches/scorers/${competitionId}.json`);
  },

  async getMatchLineups(matchId: string): Promise<MatchLineups | null> {
    const bundle = await getLiveBundle();
    const found = bundle?.matches?.find((m: any) => String(m.id) === String(matchId) || String(m.matchId) === String(matchId));
    if (found && found.lineups) {
      return { matchId, ...found.lineups };
    }
    return fetchJson<MatchLineups>(`matches/lineups/${matchId}.json`);
  },

  async getMatchStats(matchId: string): Promise<MatchStatistics | null> {
    const bundle = await getLiveBundle();
    const found = bundle?.matches?.find((m: any) => String(m.id) === String(matchId) || String(m.matchId) === String(matchId));
    if (found && found.stats) {
      return { matchId, ...found.stats };
    }
    return fetchJson<MatchStatistics>(`matches/statistics/${matchId}.json`);
  },

  async getMatchEvents(matchId: string): Promise<MatchEventsData | null> {
    const bundle = await getLiveBundle();
    const found = bundle?.matches?.find((m: any) => String(m.id) === String(matchId) || String(m.matchId) === String(matchId));
    if (found && found.events) {
      return { matchId, events: found.events, updatedAt: found.updatedAt || new Date().toISOString() };
    }
    return fetchJson<MatchEventsData>(`matches/events/${matchId}.json`);
  },

  async getMatchPreview(matchId: string): Promise<MatchPreviewData | null> {
    return fetchJson<MatchPreviewData>(`matches/preview/${matchId}.json`);
  },

  async getLatestNews(): Promise<NewsItem[]> {
    return (await fetchJson<NewsItem[]>('news/latest.json')) || [];
  },

  async getNewsArticle(articleId: string): Promise<NewsArticle | null> {
    return fetchJson<NewsArticle>(`news/articles/${articleId}.json`);
  }
};


