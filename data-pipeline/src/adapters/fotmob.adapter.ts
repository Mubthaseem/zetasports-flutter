import { IFootballDataProvider } from './provider.interface.js';
import {
  Competition,
  Fixture,
  MatchLineups,
  MatchStatistics,
  MatchEventsData,
  CompetitionStandings,
  CompetitionScorers,
  NewsItem,
  MatchStatus,
  LineupPlayer,
  StatItem,
  MatchEvent,
  StandingRow,
  TopScorer,
  MatchPreviewData,
  TeamFormMatch,
  MatchPollFact,
  NewsArticle
} from '../core/types.js';
import { SUPPORTED_COMPETITIONS, CompetitionConfig } from '../config/competitions.js';

export class FotMobAdapter implements IFootballDataProvider {
  public readonly name = 'FotMob Free Public Gateway';
  public readonly supportsLiveScores = true;
  public readonly supportsLineups = true;
  public readonly supportsStatistics = true;
  public readonly supportsEvents = true;
  public readonly supportsNews = true;

  private buildId: string = 'LEwAcGN56r2MQmO2ML6Xl'; // Default fallback
  private userAgents: string[] = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  ];

  public async init(): Promise<void> {
    try {
      const res = await this.fetchWithRetry('https://www.fotmob.com/', 2);
      const html = await res.text();
      const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
      if (match) {
        const data = JSON.parse(match[1]);
        if (data.buildId) {
          this.buildId = data.buildId;
          console.log(`[FotMobAdapter] Detected active buildId: ${this.buildId}`);
        }
      }
    } catch (e) {
      console.warn(`[FotMobAdapter] Failed to resolve dynamic buildId, using fallback ${this.buildId}:`, e);
    }
  }

  private getRandomUserAgent(): string {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  private async fetchWithRetry(url: string, retries = 3, delayMs = 1000): Promise<Response> {
    for (let i = 0; i < retries; i++) {
      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': this.getRandomUserAgent(),
            'Accept': 'application/json, text/html, */*'
          }
        });

        if (res.status === 429) {
          console.warn(`[FotMobAdapter] 429 Rate limited on ${url}, waiting ${delayMs * 2}ms...`);
          await new Promise(r => setTimeout(r, delayMs * 2));
          continue;
        }

        if (res.ok) {
          return res;
        }

        if (res.status === 404) {
          throw new Error(`HTTP 404 Not Found for ${url}`);
        }
      } catch (err: any) {
        if (i === retries - 1) throw err;
        await new Promise(r => setTimeout(r, delayMs * Math.pow(2, i)));
      }
    }
    throw new Error(`Failed to fetch ${url} after ${retries} attempts`);
  }

  public async getCompetitions(): Promise<Competition[]> {
    return SUPPORTED_COMPETITIONS.map(c => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      country: c.country,
      countryCode: c.countryCode,
      category: c.category,
      tier: c.tier,
      logoUrl: c.logoUrl,
      hasStandings: c.hasStandings,
      hasTopScorers: c.hasTopScorers,
      hasLineups: c.hasLineups,
      hasStats: c.hasStats,
      updatedAt: new Date().toISOString()
    }));
  }

  public async getCompetitionFixtures(competitionId: string): Promise<Fixture[]> {
    const config = SUPPORTED_COMPETITIONS.find(c => c.id === competitionId);
    if (!config) return [];

    const url = `https://www.fotmob.com/_next/data/${this.buildId}/en/leagues/${config.fotmobId}/fixtures/${config.fotmobSlug || config.slug}.json`;
    try {
      const res = await this.fetchWithRetry(url);
      const data: any = await res.json();
      const allMatches = data.pageProps?.fixtures?.allMatches || [];

      return allMatches.map((m: any) => this.mapRawFixture(m, config));
    } catch (e: any) {
      console.warn(`[FotMobAdapter] Failed to fetch fixtures for ${config.name}: ${e.message}`);
      return [];
    }
  }

  public async getLiveScores(): Promise<Fixture[]> {
    const liveMatches: Fixture[] = [];

    // Check overview for top active leagues
    for (const comp of SUPPORTED_COMPETITIONS.slice(0, 10)) {
      try {
        const url = `https://www.fotmob.com/_next/data/${this.buildId}/en/leagues/${comp.fotmobId}/overview/${comp.fotmobSlug || comp.slug}.json`;
        const res = await this.fetchWithRetry(url, 2, 500);
        const data: any = await res.json();
        const overviewMatches = data.pageProps?.overview?.matches || data.pageProps?.overview?.leagueOverviewMatches || [];

        for (const m of overviewMatches) {
          const status = this.mapStatus(m.status);
          if (status === 'IN_PLAY' || status === 'PAUSED') {
            liveMatches.push(this.mapRawFixture(m, comp));
          }
        }
      } catch (e) {
        // Continue silently for next league
      }
    }

    return liveMatches;
  }

  public async getMatchLineups(matchId: string): Promise<MatchLineups | null> {
    const data = await this.fetchMatchData(matchId);
    if (!data) return null;

    const lineupContent = data.content?.lineup;
    if (!lineupContent) return null;

    const parseTeamLineup = (teamData: any) => {
      if (!teamData) return { formation: 'Unknown', starters: [], bench: [] };

      const starters: LineupPlayer[] = (teamData.starters || teamData.startingLineup || []).map((p: any) => ({
        id: String(p.id || p.playerId || Math.random()),
        name: p.name || p.usualPlayingPosition || 'Player',
        number: p.shirtNumber || p.jerseyNumber || '',
        position: (p.positionString || p.role || 'MF') as any,
        rating: p.rating ? parseFloat(p.rating) : null,
        captain: !!p.isCaptain,
        grid: p.grid || ''
      }));

      const bench: LineupPlayer[] = (teamData.subs || teamData.substitutes || []).map((p: any) => ({
        id: String(p.id || p.playerId || Math.random()),
        name: p.name || 'Substitute',
        number: p.shirtNumber || p.jerseyNumber || '',
        position: 'SUB',
        rating: p.rating ? parseFloat(p.rating) : null,
        captain: !!p.isCaptain
      }));

      return {
        formation: teamData.formation || '4-3-3',
        coach: teamData.coach?.name || undefined,
        starters,
        bench
      };
    };

    return {
      matchId,
      updatedAt: new Date().toISOString(),
      home: parseTeamLineup(lineupContent.lineup?.[0] || lineupContent.homeTeam),
      away: parseTeamLineup(lineupContent.lineup?.[1] || lineupContent.awayTeam)
    };
  }

  public async getMatchStatistics(matchId: string): Promise<MatchStatistics | null> {
    const data = await this.fetchMatchData(matchId);
    if (!data) return null;

    const statsContent = data.content?.stats;
    if (!statsContent) return null;

    const statsList: StatItem[] = [];
    const periods = statsContent.Periods?.All?.stats || statsContent.stats || [];

    for (const group of periods) {
      if (group.stats) {
        for (const item of group.stats) {
          statsList.push({
            title: item.title,
            homeValue: item.stats?.[0] ?? 0,
            awayValue: item.stats?.[1] ?? 0,
            type: item.type === 'percent' ? 'percentage' : 'number'
          });
        }
      }
    }

    return {
      matchId,
      updatedAt: new Date().toISOString(),
      stats: statsList
    };
  }

  public async getMatchEvents(matchId: string): Promise<MatchEventsData | null> {
    const data = await this.fetchMatchData(matchId);
    if (!data) return null;

    const rawIncidents = data.content?.matchFacts?.events?.events ||
                         data.content?.incidents?.allIncidents ||
                         data.content?.incidents || [];

    const events: MatchEvent[] = [];

    for (const inc of rawIncidents) {
      let type: MatchEvent['type'] = 'GOAL';
      const incType = String(inc.type || inc.incidentType || '').toLowerCase();

      if (incType.includes('goal')) type = 'GOAL';
      else if (incType.includes('yellow')) type = 'CARD_YELLOW';
      else if (incType.includes('red')) type = 'CARD_RED';
      else if (incType.includes('sub')) type = 'SUBSTITUTION';
      else if (incType.includes('var')) type = 'VAR';
      else if (incType.includes('miss')) type = 'PENALTY_MISS';

      events.push({
        id: String(inc.id || Math.random().toString(36).substring(2)),
        type,
        minute: inc.time || inc.minute || 0,
        extraTimeMinute: inc.addedTime || undefined,
        teamId: String(inc.teamId || ''),
        playerName: inc.player?.name || inc.name || 'Player',
        assistPlayerName: inc.assist?.name || inc.assistStr || undefined,
        subOffPlayerName: inc.swapPlayer?.name || undefined,
        description: inc.cardDescription || inc.description || undefined
      });
    }

    return {
      matchId,
      updatedAt: new Date().toISOString(),
      events
    };
  }

  public async getMatchPreview(matchId: string): Promise<MatchPreviewData | null> {
    const data = await this.fetchMatchData(matchId);
    if (!data) return null;

    const infoBox = data.content?.matchFacts?.infoBox;
    const teamFormRaw = data.content?.matchFacts?.teamForm;
    const pollRaw = data.content?.matchFacts?.poll;
    const weatherRaw = data.content?.weather;
    const h2hRaw = data.content?.h2h;
    const headerTeams = data.header?.teams || [];

    const parseTeamForm = (matches: any[]): TeamFormMatch[] => {
      if (!Array.isArray(matches)) return [];
      return matches.map((m: any) => {
        const isOurTeam = !!m.home?.isOurTeam;
        const opponent = isOurTeam ? m.away : m.home;
        let res: 'W' | 'D' | 'L' = 'D';
        if (m.resultString === 'W' || m.result === 1) res = 'W';
        else if (m.resultString === 'L' || m.result === -1) res = 'L';

        return {
          result: res,
          score: m.score || '',
          opponentId: String(opponent?.id || ''),
          opponentName: opponent?.name || 'Opponent',
          opponentLogo: m.imageUrl || (opponent?.id ? `https://images.fotmob.com/image_resources/logo/teamlogo/${opponent.id}.png` : ''),
          isHome: isOurTeam,
          date: m.date?.utcTime || ''
        };
      });
    };

    const pollFacts: MatchPollFact[] = [];
    if (pollRaw?.oddspoll?.Facts && Array.isArray(pollRaw.oddspoll.Facts)) {
      for (const f of pollRaw.oddspoll.Facts) {
        pollFacts.push({
          oddsType: f.OddsType || '',
          defaultLabel: f.DefaultLabel || 'Poll',
          defaultText: f.defaultText || '',
          options: f.DefaultLabels || []
        });
      }
    }

    return {
      matchId,
      updatedAt: new Date().toISOString(),
      tournament: infoBox?.Tournament ? {
        name: infoBox.Tournament.leagueName || '',
        round: infoBox.Tournament.roundName || String(infoBox.Tournament.round || '')
      } : undefined,
      venue: infoBox?.Stadium ? {
        name: infoBox.Stadium.name || '',
        city: infoBox.Stadium.city || '',
        country: infoBox.Stadium.country || '',
        capacity: infoBox.Stadium.capacity,
        surface: infoBox.Stadium.surface
      } : undefined,
      weather: weatherRaw ? {
        temperature: weatherRaw.temperature,
        description: weatherRaw.description || weatherRaw.defaultTitle || ''
      } : undefined,
      fifaRank: {
        home: headerTeams[0]?.fifaRank,
        away: headerTeams[1]?.fifaRank
      },
      teamForm: {
        home: parseTeamForm(teamFormRaw?.[0]),
        away: parseTeamForm(teamFormRaw?.[1])
      },
      poll: pollFacts.length > 0 ? { facts: pollFacts } : undefined,
      h2h: h2hRaw?.summary ? {
        summary: h2hRaw.summary as [number, number, number]
      } : undefined
    };
  }

  public async getStandings(competitionId: string): Promise<CompetitionStandings | null> {
    const config = SUPPORTED_COMPETITIONS.find(c => c.id === competitionId);
    if (!config) return null;

    const url = `https://www.fotmob.com/_next/data/${this.buildId}/en/leagues/${config.fotmobId}/overview/${(config.fotmobSlug || config.slug)}.json`;
    try {
      const res = await this.fetchWithRetry(url);
      const data: any = await res.json();
      const rawTable = data.pageProps?.table?.[0]?.data?.table?.all ||
                       data.pageProps?.overview?.table?.[0]?.data?.table?.all || [];

      const table: StandingRow[] = rawTable.map((row: any, idx: number) => ({
        position: row.idx || idx + 1,
        teamId: String(row.id || ''),
        teamName: row.name || 'Team',
        shortName: row.shortName || row.name || 'Team',
        logoUrl: `https://images.fotmob.com/image_resources/logo/teamlogo/${row.id}.png`,
        played: row.played ?? 0,
        won: row.wins ?? 0,
        drawn: row.draws ?? 0,
        lost: row.losses ?? 0,
        goalsFor: row.scoresStr ? parseInt(row.scoresStr.split('-')[0]) : 0,
        goalsAgainst: row.scoresStr ? parseInt(row.scoresStr.split('-')[1]) : 0,
        goalDifference: row.goalConDiff ?? 0,
        points: row.pts ?? 0,
        form: row.qualColor ? [row.qualColor] : undefined,
        qualificationZone: row.ongoing ? 'Active' : undefined
      }));

      return {
        competitionId,
        competitionName: config.name,
        season: data.pageProps?.overview?.season || 'Current',
        updatedAt: new Date().toISOString(),
        table
      };
    } catch (e: any) {
      console.warn(`[FotMobAdapter] Could not get standings for ${config.name}: ${e.message}`);
      return null;
    }
  }

  public async getTopScorers(competitionId: string): Promise<CompetitionScorers | null> {
    const config = SUPPORTED_COMPETITIONS.find(c => c.id === competitionId);
    if (!config) return null;

    const url = `https://www.fotmob.com/_next/data/${this.buildId}/en/leagues/${config.fotmobId}/overview/${(config.fotmobSlug || config.slug)}.json`;
    try {
      const res = await this.fetchWithRetry(url);
      const data: any = await res.json();
      const topPlayers = data.pageProps?.overview?.topPlayers?.byGoals?.players ||
                         data.pageProps?.stats?.players?.[0]?.topThree || [];

      const scorers: TopScorer[] = (Array.isArray(topPlayers) ? topPlayers : []).map((p: any, idx: number) => ({
        rank: p.rank || idx + 1,
        playerId: String(p.id || ''),
        playerName: p.name || 'Player',
        teamId: String(p.teamId || ''),
        teamName: p.teamName || '',
        teamLogoUrl: `https://images.fotmob.com/image_resources/logo/teamlogo/${p.teamId}.png`,
        goals: p.goals ?? p.value ?? p.stat?.value ?? 0,
        assists: p.assists ?? 0,
        playedMatches: p.matches ?? undefined
      }));

      return {
        competitionId,
        competitionName: config.name,
        season: data.pageProps?.overview?.season || 'Current',
        updatedAt: new Date().toISOString(),
        scorers
      };
    } catch (e: any) {
      console.warn(`[FotMobAdapter] Could not get scorers for ${config.name}: ${e.message}`);
      return null;
    }
  }

  public async getNews(): Promise<NewsItem[]> {
    try {
      const res = await this.fetchWithRetry('https://www.fotmob.com/api/worldnews', 2);
      const articles: any = await res.json();

      return (Array.isArray(articles) ? articles : []).slice(0, 30).map((a: any) => ({
        id: String(a.id || Math.random().toString(36).substring(2)),
        title: a.title || 'Football News',
        description: a.description || a.sourceStr || '',
        source: a.sourceStr || 'FotMob News',
        sourceUrl: a.page?.url || a.sourceUrl || 'https://www.fotmob.com/news',
        imageUrl: a.imageUrl || undefined,
        publishedAt: a.gmtTime || new Date().toISOString()
      }));
    } catch (e: any) {
      console.warn(`[FotMobAdapter] Failed to fetch news: ${e.message}`);
      return [];
    }
  }

  public async getNewsArticle(item: NewsItem): Promise<NewsArticle> {
    const cleanSlug = (item.sourceUrl || '').replace(/^\/(news|topnews|embed\/news)\//, '');
    const fotmobUrl = `https://www.fotmob.com/_next/data/${this.buildId}/en/news/${cleanSlug}.json`;

    // 1. Try FotMob Next.js endpoint for direct articles
    try {
      const res = await this.fetchWithRetry(fotmobUrl, 2, 500);
      if (res.ok) {
        const json: any = await res.json();
        const fallback = json?.pageProps?.fallback || {};
        for (const k of Object.keys(fallback)) {
          if (k.startsWith('newsArticle:') && fallback[k]) {
            const art = fallback[k];
            if (art.html || art.content) {
              const htmlStr = art.html || art.content || '';
              const rawMatches = htmlStr.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
              const paragraphs = rawMatches
                .map((p: string) => p.replace(/<[^>]+>/g, '').trim())
                .filter((p: string) => p.length > 20);

              return {
                id: item.id,
                title: art.title || item.title,
                subtitle: art.subtitle || item.description,
                source: art.source || item.source,
                sourceUrl: item.sourceUrl,
                imageUrl: art.imageUrl || item.imageUrl,
                publishedAt: art.time || item.publishedAt,
                paragraphs: paragraphs.length > 0 ? paragraphs : (item.description ? [item.description] : []),
                html: htmlStr,
                author: art.author || undefined
              };
            }
          }
        }
      }
    } catch {
      // Continue to web scraping fallback
    }

    // 2. Try fetching full web article or embed source
    let targetUrl = item.sourceUrl.startsWith('http')
      ? item.sourceUrl
      : `https://www.fotmob.com${item.sourceUrl}`;

    try {
      if (item.sourceUrl.includes('/embed/news/')) {
        const embedRes = await this.fetchWithRetry(targetUrl, 2, 500);
        const embedHtml = await embedRes.text();
        const srcMatch = embedHtml.match(/"src":"(https:\/\/[^"]+)"/);
        if (srcMatch) {
          targetUrl = srcMatch[1].replace(/\\u0026/g, '&');
        }
      }

      const articleRes = await this.fetchWithRetry(targetUrl, 2, 800);
      if (articleRes.ok) {
        const pageHtml = await articleRes.text();
        const rawP = pageHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
        const paragraphs = rawP
          .map((p: string) =>
            p
              .replace(/<style[\s\S]*?<\/style>/gi, '')
              .replace(/<script[\s\S]*?<\/script>/gi, '')
              .replace(/<[^>]+>/g, '')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .replace(/&#8217;/g, "'")
              .replace(/&#8211;/g, "–")
              .replace(/&amp;/g, '&')
              .replace(/&nbsp;/g, ' ')
              .trim()
          )
          .filter(
            (p: string) =>
              p.length > 40 &&
              !p.startsWith('.') &&
              !p.includes('{') &&
              !p.includes('}') &&
              !p.toLowerCase().includes('cookie') &&
              !p.toLowerCase().includes('privacy policy') &&
              !p.toLowerCase().includes('rights reserved') &&
              !p.toLowerCase().includes('sign up for')
          );

        if (paragraphs.length > 0) {
          return {
            id: item.id,
            title: item.title,
            subtitle: item.description,
            source: item.source,
            sourceUrl: targetUrl,
            imageUrl: item.imageUrl,
            publishedAt: item.publishedAt,
            paragraphs: paragraphs.slice(0, 20)
          };
        }
      }

    } catch {
      // Fallback
    }

    return {
      id: item.id,
      title: item.title,
      subtitle: item.description,
      source: item.source,
      sourceUrl: item.sourceUrl,
      imageUrl: item.imageUrl,
      publishedAt: item.publishedAt,
      paragraphs: item.description ? [item.description] : []
    };
  }


  private async fetchMatchData(matchId: string): Promise<any> {
    const url = `https://www.fotmob.com/_next/data/${this.buildId}/en/match/${matchId}.json`;
    try {
      const res = await this.fetchWithRetry(url);
      const data: any = await res.json();
      return data.pageProps;
    } catch (e: any) {
      console.warn(`[FotMobAdapter] Match ${matchId} details unavailable: ${e.message}`);
      return null;
    }
  }

  private mapStatus(status: any): MatchStatus {
    if (!status) return 'SCHEDULED';
    if (status.cancelled) return 'CANCELLED';
    if (status.finished) return 'FINISHED';
    if (status.started && !status.finished) {
      if (status.reason?.short === 'HT') return 'PAUSED';
      return 'IN_PLAY';
    }
    return 'SCHEDULED';
  }

  private mapRawFixture(m: any, comp: CompetitionConfig): Fixture {
    const homeTeam = m.home || {};
    const awayTeam = m.away || {};
    const status = this.mapStatus(m.status);

    let homeScore: number | null = null;
    let awayScore: number | null = null;

    if (m.status?.scoreStr) {
      const parts = m.status.scoreStr.split('-').map((s: string) => parseInt(s.trim(), 10));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        homeScore = parts[0];
        awayScore = parts[1];
      }
    } else if (typeof homeTeam.score === 'number' && typeof awayTeam.score === 'number') {
      homeScore = homeTeam.score;
      awayScore = awayTeam.score;
    }

    return {
      id: String(m.id || Math.random()),
      competitionId: comp.id,
      competitionName: comp.name,
      competitionSlug: comp.slug,
      country: comp.country,
      round: m.roundName || m.round || undefined,
      utcDate: m.status?.utcTime || m.time || new Date().toISOString(),
      status,
      minute: m.status?.liveTime?.short || m.status?.reason?.short || (status === 'IN_PLAY' ? 'LIVE' : null),
      homeTeam: {
        id: String(homeTeam.id || ''),
        name: homeTeam.name || 'Home Team',
        shortName: homeTeam.shortName || homeTeam.name || 'Home',
        logoUrl: `https://images.fotmob.com/image_resources/logo/teamlogo/${homeTeam.id}.png`,
        score: homeScore
      },
      awayTeam: {
        id: String(awayTeam.id || ''),
        name: awayTeam.name || 'Away Team',
        shortName: awayTeam.shortName || awayTeam.name || 'Away',
        logoUrl: `https://images.fotmob.com/image_resources/logo/teamlogo/${awayTeam.id}.png`,
        score: awayScore
      },
      score: {
        home: homeScore,
        away: awayScore
      },
      updatedAt: new Date().toISOString()
    };
  }
}
