import { FotMobAdapter } from '../adapters/fotmob.adapter.js';
import { DataStorage } from '../utils/storage.js';
import { Fixture } from '../core/types.js';
import { buildApiBundle } from './build-api-bundle.js';

export async function syncMatchDetails(): Promise<void> {
  console.log('=== [ZETA SPORTS] Starting Match Details Synchronization ===');
  const adapter = new FotMobAdapter();
  const storage = new DataStorage();

  await adapter.init();

  // Pick matches from live.json, today.json, and top upcoming matches
  const liveMatches = storage.readJson<Fixture[]>('fixtures/live.json') || [];
  const todayMatches = storage.readJson<Fixture[]>('fixtures/today.json') || [];
  const upcomingMatches = storage.readJson<Fixture[]>('fixtures/upcoming.json') || [];

  // Sort upcoming to prioritize marquee competitions (Champions League, Nations League, Premier League, etc.)
  const priorityCompIds = ['42', '47', '9806', '87', '54', '55'];
  const sortedUpcoming = [...upcomingMatches].sort((a, b) => {
    const aPri = priorityCompIds.indexOf(a.competitionId);
    const bPri = priorityCompIds.indexOf(b.competitionId);
    if (aPri !== -1 && bPri === -1) return -1;
    if (bPri !== -1 && aPri === -1) return 1;
    if (aPri !== -1 && bPri !== -1) return aPri - bPri;
    return new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime();
  });

  const targetMatches = [
    ...liveMatches,
    ...todayMatches,
    ...sortedUpcoming.slice(0, 20)
  ];
  const seenIds = new Set<string>();

  for (const match of targetMatches) {
    if (seenIds.has(match.id)) continue;
    seenIds.add(match.id);

    try {
      console.log(`Syncing details for match ${match.id} (${match.homeTeam.name} vs ${match.awayTeam.name})...`);

      // 1. Match Preview (stadium, team form, poll, fifa rankings)
      if (adapter.getMatchPreview) {
        const preview = await adapter.getMatchPreview(match.id);
        if (preview) {
          await storage.writeJson(`matches/preview/${match.id}.json`, preview);
          console.log(`  -> Saved preview for match ${match.id}`);
        }
      }

      // 2. Lineups
      const lineups = await adapter.getMatchLineups(match.id);
      if (lineups) {
        await storage.writeJson(`matches/lineups/${match.id}.json`, lineups);
        console.log(`  -> Saved lineups for match ${match.id}`);
      }

      // 3. Stats (if match started or finished)
      if (match.status !== 'SCHEDULED') {
        const stats = await adapter.getMatchStatistics(match.id);
        if (stats) {
          await storage.writeJson(`matches/statistics/${match.id}.json`, stats);
          console.log(`  -> Saved statistics for match ${match.id}`);
        }

        // 4. Events
        const events = await adapter.getMatchEvents(match.id);
        if (events) {
          await storage.writeJson(`matches/events/${match.id}.json`, events);
          console.log(`  -> Saved events for match ${match.id}`);
        }
      }

      await new Promise(r => setTimeout(r, 400));
    } catch (e: any) {
      console.warn(`Error syncing details for match ${match.id}: ${e.message}`);
    }
  }

  // Re-build API master and modular bundles
  try {
    await buildApiBundle();
  } catch (err: any) {
    console.warn('Warning: Failed to update API bundle after match details sync:', err.message);
  }

  console.log('=== Match Details sync completed! ===');
}

syncMatchDetails().catch(err => {
  console.error('Fatal match details sync error:', err);
  process.exit(1);
});
