// ============================================================================
// Tier 1 Primary Provider: FotMob API
// Provides deep tactical telemetry, live xG, goalscorers with minutes, and lineups
// ============================================================================

const BASE_URL = 'https://www.fotmob.com/api/data';

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.fotmob.com/'
};

/**
 * Fetch matches for a specific date in YYYYMMDD format
 * @param {string} dateStr - 'YYYYMMDD' (e.g. '20260925')
 * @returns {Promise<Array>} List of raw matches
 */
export async function getMatchesByDate(dateStr) {
  const url = `${BASE_URL}/matches?date=${dateStr}`;
  const response = await fetch(url, { headers: DEFAULT_HEADERS, signal: AbortSignal.timeout(10000) });
  if (!response.ok) {
    throw new Error(`FotMob getMatchesByDate HTTP ${response.status}: ${response.statusText}`);
  }
  const data = await response.json();
  const matches = [];

  // Default major & approved competition whitelist to prevent low-tier clutter
  const MAJOR_LEAGUE_KEYWORDS = [
    'premier league', 'champions league', 'laliga', 'la liga', 'serie a', 'bundesliga',
    'ligue 1', 'europa league', 'conference league', 'nations league', 'friendlies',
    'international', 'fa cup', 'carabao cup', 'copa del rey', 'dfb pokal', 'coppa italia',
    'coupe de france', 'indian super league', 'isl', 'mls', 'world cup', 'euro',
    'copa america', 'afcon', 'asian cup'
  ];

  if (Array.isArray(data.leagues)) {
    for (const league of data.leagues) {
      const lgNameLower = (league.name || '').toLowerCase();
      // Allow only leagues matching approved competitions or major tournaments
      const isApprovedOrMajor = MAJOR_LEAGUE_KEYWORDS.some(kw => lgNameLower.includes(kw));

      if (isApprovedOrMajor && Array.isArray(league.matches)) {
        for (const m of league.matches) {
          matches.push({
            ...m,
            _leagueName: league.name,
            _leagueId: league.id,
            _parentLeagueId: league.parentLeagueId,
            _countryCode: league.ccode
          });
        }
      }
    }
  }
  return matches;
}

/**
 * Fetch full live match details by FotMob Match ID
 * @param {string|number} matchId
 * @returns {Promise<Object>} Full match telemetry
 */
export async function getMatchDetails(matchId) {
  const url = `${BASE_URL}/matchDetails?matchId=${matchId}`;
  const response = await fetch(url, { headers: DEFAULT_HEADERS, signal: AbortSignal.timeout(10000) });
  if (!response.ok) {
    throw new Error(`FotMob getMatchDetails HTTP ${response.status}: ${response.statusText}`);
  }
  const data = await response.json();
  return data;
}

export default {
  name: 'fotmob',
  tier: 1,
  getMatchesByDate,
  getMatchDetails
};
