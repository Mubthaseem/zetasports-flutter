import { Fixture, StandingRow, TopScorer, NewsItem } from '../core/types.js';

export class DataValidator {
  /**
   * Validates a list of fixtures
   */
  public static validateFixtures(fixtures: unknown): fixtures is Fixture[] {
    if (!Array.isArray(fixtures)) return false;
    for (const f of fixtures) {
      if (!f || typeof f !== 'object') return false;
      if (!f.id || !f.homeTeam || !f.awayTeam || !f.utcDate) return false;
      if (!f.homeTeam.name || !f.awayTeam.name) return false;
    }
    return true;
  }

  /**
   * Validates standings table
   */
  public static validateStandings(table: unknown): table is StandingRow[] {
    if (!Array.isArray(table)) return false;
    for (const row of table) {
      if (!row || typeof row !== 'object') return false;
      if (typeof row.position !== 'number' || !row.teamName) return false;
    }
    return true;
  }

  /**
   * Validates top scorers
   */
  public static validateScorers(scorers: unknown): scorers is TopScorer[] {
    if (!Array.isArray(scorers)) return false;
    for (const s of scorers) {
      if (!s || typeof s !== 'object') return false;
      if (!s.playerName || typeof s.goals !== 'number') return false;
    }
    return true;
  }

  /**
   * Validates news items
   */
  public static validateNews(news: unknown): news is NewsItem[] {
    if (!Array.isArray(news)) return false;
    for (const item of news) {
      if (!item || typeof item !== 'object') return false;
      if (!item.id || !item.title) return false;
    }
    return true;
  }
}
