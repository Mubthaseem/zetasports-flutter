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

// Base data path: in Vite dev mode or GitHub pages, public JSON files are under data/
const DATA_BASE_URL = './data';

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    // Append timestamp cache buster for live updates
    const cacheBuster = `?_t=${Date.now()}`;
    const res = await fetch(`${DATA_BASE_URL}/${path}${cacheBuster}`);
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`HTTP ${res.status} fetching ${path}`);
    }
    return await res.json() as T;
  } catch (err) {
    console.warn(`[DataAPI] Failed to load ${path}:`, err);
    return null;
  }
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
