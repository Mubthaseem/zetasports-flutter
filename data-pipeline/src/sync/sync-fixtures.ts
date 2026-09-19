import { FotMobAdapter } from '../adapters/fotmob.adapter.js';
import { DataStorage } from '../utils/storage.js';
import { DataValidator } from '../utils/validator.js';
import { Fixture, SyncMeta } from '../core/types.js';
import { SUPPORTED_COMPETITIONS } from '../config/competitions.js';

export async function syncFixtures(): Promise<void> {
  console.log('=== [ZETA SPORTS] Starting Fixtures Synchronization ===');
  const adapter = new FotMobAdapter();
  const storage = new DataStorage();

  await adapter.init();

  const competitions = await adapter.getCompetitions();
  await storage.writeJson('competitions.json', competitions);
  console.log(`Saved ${competitions.length} competitions to data/competitions.json`);

  const allFixtures: Fixture[] = [];
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  // Sync fixtures for top tier leagues first
  for (const comp of SUPPORTED_COMPETITIONS) {
    try {
      console.log(`Fetching fixtures for ${comp.name}...`);
      const fixtures = await adapter.getCompetitionFixtures(comp.id);
      if (DataValidator.validateFixtures(fixtures)) {
        allFixtures.push(...fixtures);
      }
      // Polite rate limit sleep
      await new Promise(r => setTimeout(r, 250));
    } catch (e: any) {
      console.warn(`Error fetching fixtures for ${comp.name}: ${e.message}`);
    }
  }

  console.log(`Total fixtures collected: ${allFixtures.length}`);

  // Sort chronologically
  allFixtures.sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime());

  // Split into categories
  const nowTime = now.getTime();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const sevenDaysMs = 7 * oneDayMs;

  const todayMatches: Fixture[] = [];
  const liveMatches: Fixture[] = [];
  const upcomingMatches: Fixture[] = [];
  const resultsMatches: Fixture[] = [];

  for (const f of allFixtures) {
    const fTime = new Date(f.utcDate).getTime();

    // Check if match is live
    if (f.status === 'IN_PLAY' || f.status === 'PAUSED') {
      liveMatches.push(f);
    }

    // Match is today (within 14 hours of now or same date string)
    const matchDateStr = f.utcDate.slice(0, 10);
    if (matchDateStr === todayStr || Math.abs(fTime - nowTime) < 14 * 60 * 60 * 1000) {
      todayMatches.push(f);
    }

    // Upcoming (next 7 days)
    if (f.status === 'SCHEDULED' && fTime > nowTime && fTime <= nowTime + sevenDaysMs) {
      upcomingMatches.push(f);
    }

    // Results (past 7 days, finished)
    if (f.status === 'FINISHED' && fTime < nowTime && fTime >= nowTime - sevenDaysMs) {
      resultsMatches.push(f);
    }
  }

  // Reverse results so most recent are first
  resultsMatches.sort((a, b) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime());

  await storage.writeJson('fixtures/today.json', todayMatches);
  await storage.writeJson('fixtures/live.json', liveMatches);
  await storage.writeJson('fixtures/upcoming.json', upcomingMatches.slice(0, 150));
  await storage.writeJson('fixtures/results.json', resultsMatches.slice(0, 150));

  console.log(`Saved:
  - today.json: ${todayMatches.length}
  - live.json: ${liveMatches.length}
  - upcoming.json: ${upcomingMatches.length}
  - results.json: ${resultsMatches.length}`);

  // Update meta.json
  const existingMeta = storage.readJson<SyncMeta>('meta.json');
  const meta: SyncMeta = {
    platform: 'ZETA SPORTS Autonomous Football Hub',
    version: '2.0.0',
    provider: adapter.name,
    lastSuccessfulSync: new Date().toISOString(),
    activeMatchesCount: liveMatches.length,
    totalCompetitions: competitions.length,
    staleThresholdMinutes: existingMeta?.staleThresholdMinutes || {
      live: 10,
      fixtures: 360,
      standings: 720,
      news: 60
    }
  };
  await storage.writeJson('meta.json', meta);

  console.log('=== Fixtures sync finished successfully! ===');
}

syncFixtures().catch(err => {
  console.error('Fatal fixture sync error:', err);
  process.exit(1);
});

