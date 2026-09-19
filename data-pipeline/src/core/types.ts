/**
 * ZETA SPORTS — Canonical Football Data Models
 */

export type MatchStatus = 'SCHEDULED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED' | 'POSTPONED' | 'CANCELLED';

export interface Competition {
  id: string;
  name: string;
  slug: string;
  country: string;
  countryCode?: string;
  category: 'DOMESTIC_LEAGUE' | 'DOMESTIC_CUP' | 'EUROPEAN_CUP' | 'INTERNATIONAL' | 'CONTINENTAL';
  tier: number;
  logoUrl?: string;
  currentSeason?: string;
  hasStandings: boolean;
  hasTopScorers: boolean;
  hasLineups: boolean;
  hasStats: boolean;
  updatedAt: string;
}

export interface Team {
  id: string;
  name: string;
  shortName: string;
  logoUrl: string;
  score?: number | null;
  penaltyScore?: number | null;
}

export interface MatchScore {
  home: number | null;
  away: number | null;
  halfTimeHome?: number | null;
  halfTimeAway?: number | null;
  penaltyHome?: number | null;
  penaltyAway?: number | null;
}

export interface Fixture {
  id: string;
  competitionId: string;
  competitionName: string;
  competitionSlug: string;
  country: string;
  round?: string | number;
  utcDate: string;
  status: MatchStatus;
  minute?: number | string | null;
  homeTeam: Team;
  awayTeam: Team;
  score: MatchScore;
  venue?: string;
  referee?: string;
  updatedAt: string;
}

export interface MatchEvent {
  id: string;
  type: 'GOAL' | 'ASSIST' | 'CARD_YELLOW' | 'CARD_RED' | 'SUBSTITUTION' | 'VAR' | 'PENALTY_MISS';
  minute: number;
  extraTimeMinute?: number;
  teamId: string;
  playerName: string;
  assistPlayerName?: string;
  subOffPlayerName?: string;
  description?: string;
}

export interface LineupPlayer {
  id: string;
  name: string;
  number: number | string;
  position: 'GK' | 'DF' | 'MF' | 'FW' | 'SUB';
  rating?: number | null;
  captain?: boolean;
  grid?: string; // e.g. "1:1" for visual pitch representation
}

export interface TeamLineup {
  formation: string;
  coach?: string;
  starters: LineupPlayer[];
  bench: LineupPlayer[];
}

export interface MatchLineups {
  matchId: string;
  updatedAt: string;
  home: TeamLineup;
  away: TeamLineup;
}

export interface StatItem {
  title: string;
  homeValue: number | string;
  awayValue: number | string;
  type?: 'percentage' | 'number';
}

export interface MatchStatistics {
  matchId: string;
  updatedAt: string;
  stats: StatItem[];
}

export interface MatchEventsData {
  matchId: string;
  updatedAt: string;
  events: MatchEvent[];
}

export interface StandingRow {
  position: number;
  teamId: string;
  teamName: string;
  shortName: string;
  logoUrl: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form?: string[]; // e.g. ['W', 'D', 'W', 'L', 'W']
  qualificationZone?: string; // e.g. 'Champions League', 'Relegation'
}

export interface CompetitionStandings {
  competitionId: string;
  competitionName: string;
  season: string;
  updatedAt: string;
  table: StandingRow[];
}

export interface TopScorer {
  rank: number;
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  teamLogoUrl: string;
  goals: number;
  assists?: number;
  penalties?: number;
  playedMatches?: number;
}

export interface CompetitionScorers {
  competitionId: string;
  competitionName: string;
  season: string;
  updatedAt: string;
  scorers: TopScorer[];
}

export interface NewsItem {
  id: string;
  title: string;
  description: string;
  source: string;
  sourceUrl: string;
  imageUrl?: string;
  publishedAt: string;
}

export interface SyncMeta {
  platform: string;
  version: string;
  provider: string;
  lastSuccessfulSync: string;
  activeMatchesCount: number;
  totalCompetitions: number;
  staleThresholdMinutes: {
    live: number;
    fixtures: number;
    standings: number;
    news: number;
  };
}
