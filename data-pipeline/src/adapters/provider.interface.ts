import {
  Competition,
  Fixture,
  MatchLineups,
  MatchStatistics,
  MatchEventsData,
  CompetitionStandings,
  CompetitionScorers,
  NewsItem
} from '../core/types.js';

export interface IFootballDataProvider {
  readonly name: string;
  readonly supportsLiveScores: boolean;
  readonly supportsLineups: boolean;
  readonly supportsStatistics: boolean;
  readonly supportsEvents: boolean;
  readonly supportsNews: boolean;

  /**
   * Initializes any connection tokens, dynamic build IDs, or session cookies
   */
  init(): Promise<void>;

  /**
   * Fetches supported competitions
   */
  getCompetitions(): Promise<Competition[]>;

  /**
   * Fetches fixtures for a given competition
   */
  getCompetitionFixtures(competitionId: string): Promise<Fixture[]>;

  /**
   * Fetches currently live / ongoing matches across all tracked competitions
   */
  getLiveScores(): Promise<Fixture[]>;

  /**
   * Fetches detailed lineup data for a specific match
   */
  getMatchLineups(matchId: string): Promise<MatchLineups | null>;

  /**
   * Fetches match statistics (possession, shots, passes, etc.)
   */
  getMatchStatistics(matchId: string): Promise<MatchStatistics | null>;

  /**
   * Fetches match events timeline (goals, cards, substitutions, VAR)
   */
  getMatchEvents(matchId: string): Promise<MatchEventsData | null>;

  /**
   * Fetches league table standings for a competition
   */
  getStandings(competitionId: string): Promise<CompetitionStandings | null>;

  /**
   * Fetches top scorers & assists for a competition
   */
  getTopScorers(competitionId: string): Promise<CompetitionScorers | null>;

  /**
   * Fetches latest football news articles
   */
  getNews(): Promise<NewsItem[]>;
}
