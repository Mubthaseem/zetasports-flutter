import {
  Competition,
  Fixture,
  MatchLineups,
  MatchStatistics,
  MatchEventsData,
  CompetitionStandings,
  CompetitionScorers,
  NewsItem,
  SyncMeta
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
    return (await fetchJson<Fixture[]>('fixtures/live.json')) || [];
  },

  async getUpcomingFixtures(): Promise<Fixture[]> {
    return (await fetchJson<Fixture[]>('fixtures/upcoming.json')) || [];
  },

  async getResultsFixtures(): Promise<Fixture[]> {
    return (await fetchJson<Fixture[]>('fixtures/results.json')) || [];
  },

  async getStandings(competitionId: string): Promise<CompetitionStandings | null> {
    return fetchJson<CompetitionStandings>(`matches/standings/${competitionId}.json`);
  },

  async getScorers(competitionId: string): Promise<CompetitionScorers | null> {
    return fetchJson<CompetitionScorers>(`matches/scorers/${competitionId}.json`);
  },

  async getMatchLineups(matchId: string): Promise<MatchLineups | null> {
    return fetchJson<MatchLineups>(`matches/lineups/${matchId}.json`);
  },

  async getMatchStats(matchId: string): Promise<MatchStatistics | null> {
    return fetchJson<MatchStatistics>(`matches/statistics/${matchId}.json`);
  },

  async getMatchEvents(matchId: string): Promise<MatchEventsData | null> {
    return fetchJson<MatchEventsData>(`matches/events/${matchId}.json`);
  },

  async getLatestNews(): Promise<NewsItem[]> {
    return (await fetchJson<NewsItem[]>('news/latest.json')) || [];
  }
};
