import { FotMobAdapter } from '../adapters/fotmob.adapter.js';
import { DataStorage } from '../utils/storage.js';
import { Fixture, SyncMeta } from '../core/types.js';
import { buildApiBundle } from './build-api-bundle.js';


export async function syncLiveScores(): Promise<void> {
  console.log('=== [ZETA SPORTS] Starting Live Scores Synchronization ===');
  const adapter = new FotMobAdapter();
  const storage = new DataStorage();

  await adapter.init();

  const liveMatches = await adapter.getLiveScores();
  console.log(`Live matches found: ${liveMatches.length}`);

  // Save live.json
  await storage.writeJson('fixtures/live.json', liveMatches);

  // Update today.json if there are live score changes
  const todayMatches = storage.readJson<Fixture[]>('fixtures/today.json') || [];
  let updatedCount = 0;

  if (liveMatches.length > 0) {
    const liveMap = new Map(liveMatches.map(m => [m.id, m]));
    for (let i = 0; i < todayMatches.length; i++) {
      const live = liveMap.get(todayMatches[i].id);
      if (live) {
        todayMatches[i] = live;
        updatedCount++;
      }
    }
    if (updatedCount > 0) {
      await storage.writeJson('fixtures/today.json', todayMatches);
      console.log(`Updated ${updatedCount} live matches in fixtures/today.json`);
    }
  }

  // Update meta.json
  const existingMeta = storage.readJson<SyncMeta>('meta.json');
  if (existingMeta) {
    existingMeta.lastSuccessfulSync = new Date().toISOString();
    existingMeta.activeMatchesCount = liveMatches.length;
    await storage.writeJson('meta.json', existingMeta);
  }

  await buildApiBundle();

  console.log('=== Live scores sync completed ===');
}


syncLiveScores().catch(err => {
  console.error('Fatal live scores sync error:', err);
  process.exit(1);
});
