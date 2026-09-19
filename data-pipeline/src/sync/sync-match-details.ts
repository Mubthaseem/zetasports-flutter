import { FotMobAdapter } from '../adapters/fotmob.adapter.js';
import { DataStorage } from '../utils/storage.js';
import { Fixture } from '../core/types.js';

export async function syncMatchDetails(): Promise<void> {
  console.log('=== [ZETA SPORTS] Starting Match Details Synchronization ===');
  const adapter = new FotMobAdapter();
  const storage = new DataStorage();

  await adapter.init();

  // Pick matches from live.json and today.json
  const liveMatches = storage.readJson<Fixture[]>('fixtures/live.json') || [];
  const todayMatches = storage.readJson<Fixture[]>('fixtures/today.json') || [];

  // Focus on live, recently finished, or soon-to-start matches
  const targetMatches = [...liveMatches, ...todayMatches].slice(0, 15);
  const seenIds = new Set<string>();

  for (const match of targetMatches) {
    if (seenIds.has(match.id)) continue;
    seenIds.add(match.id);

    try {
      console.log(`Syncing details for match ${match.id} (${match.homeTeam.name} vs ${match.awayTeam.name})...`);

      // 1. Lineups
      const lineups = await adapter.getMatchLineups(match.id);
      if (lineups) {
        await storage.writeJson(`matches/lineups/${match.id}.json`, lineups);
        console.log(`  -> Saved lineups for match ${match.id}`);
      }

      // 2. Stats
      const stats = await adapter.getMatchStatistics(match.id);
      if (stats) {
        await storage.writeJson(`matches/statistics/${match.id}.json`, stats);
        console.log(`  -> Saved statistics for match ${match.id}`);
      }

      // 3. Events
      const events = await adapter.getMatchEvents(match.id);
      if (events) {
        await storage.writeJson(`matches/events/${match.id}.json`, events);
        console.log(`  -> Saved events for match ${match.id}`);
      }

      await new Promise(r => setTimeout(r, 400));
    } catch (e: any) {
      console.warn(`Error syncing details for match ${match.id}: ${e.message}`);
    }
  }

  console.log('=== Match Details sync completed! ===');
}

syncMatchDetails().catch(err => {
  console.error('Fatal match details sync error:', err);
  process.exit(1);
});
