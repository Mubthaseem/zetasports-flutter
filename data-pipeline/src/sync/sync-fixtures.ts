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

  // Precise Calendar Windows: Past 7 Days & Upcoming 30 Days (all major league upcoming matchdays)
  const nowTime = now.getTime();

  // Past 7 days start (00:00:00 UTC 7 days ago)
  const past7Days = new Date(now);
  past7Days.setUTCDate(past7Days.getUTCDate() - 7);
  past7Days.setUTCHours(0, 0, 0, 0);
  const past7DaysTime = past7Days.getTime();

  // Upcoming 30 days end (23:59:59 UTC 30 days from now - covers next matchday for all leagues including post-international break)
  const next30Days = new Date(now);
  next30Days.setUTCDate(next30Days.getUTCDate() + 30);
  next30Days.setUTCHours(23, 59, 59, 999);
  const next30DaysTime = next30Days.getTime();

  // Start & End of today UTC
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayStartTime = todayStart.getTime();

  const todayEnd = new Date(now);
  todayEnd.setUTCHours(23, 59, 59, 999);
  const todayEndTime = todayEnd.getTime();

  const todayMatches: Fixture[] = [];
  const liveMatches: Fixture[] = [];
  const upcomingMatches: Fixture[] = [];
  const resultsMatches: Fixture[] = [];

  for (const f of allFixtures) {
    const fTime = new Date(f.utcDate).getTime();

    // Check if match is currently live
    if (f.status === 'IN_PLAY' || f.status === 'PAUSED') {
      liveMatches.push(f);
    }

    // Today matches (matches scheduled or played on today's calendar date)
    if (fTime >= todayStartTime && fTime <= todayEndTime) {
      todayMatches.push(f);
    }

    // Upcoming matches: Next 30 days covering next round of Premier League, UCL, La Liga, Serie A, etc.
    if (fTime > nowTime && fTime <= next30DaysTime) {
      upcomingMatches.push(f);
    }

    // Results: Past 7 days (finished or played)
    if (fTime >= past7DaysTime && fTime < nowTime) {
      resultsMatches.push(f);
    }
  }

  // Sort upcoming chronologically (closest first)
  upcomingMatches.sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime());

  // Sort results in reverse chronological order (most recent first)
  resultsMatches.sort((a, b) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime());

  await storage.writeJson('fixtures/today.json', todayMatches);
  await storage.writeJson('fixtures/live.json', liveMatches);
  await storage.writeJson('fixtures/upcoming.json', upcomingMatches);
  await storage.writeJson('fixtures/results.json', resultsMatches);

  console.log(`Saved fixtures:
  - today.json: ${todayMatches.length} (Today's matches)
  - live.json: ${liveMatches.length} (In-play live)
  - upcoming.json: ${upcomingMatches.length} (Next 30 days: ${now.toISOString().slice(0, 10)} to ${next30Days.toISOString().slice(0, 10)})
  - results.json: ${resultsMatches.length} (Past 7 days: ${past7Days.toISOString().slice(0, 10)} to ${now.toISOString().slice(0, 10)})`);

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

