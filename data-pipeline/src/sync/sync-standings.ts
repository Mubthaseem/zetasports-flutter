import { FotMobAdapter } from '../adapters/fotmob.adapter.js';
import { DataStorage } from '../utils/storage.js';
import { DataValidator } from '../utils/validator.js';
import { SUPPORTED_COMPETITIONS } from '../config/competitions.js';

export async function syncStandings(): Promise<void> {
  console.log('=== [ZETA SPORTS] Starting Standings & Scorers Synchronization ===');
  const adapter = new FotMobAdapter();
  const storage = new DataStorage();

  await adapter.init();

  for (const comp of SUPPORTED_COMPETITIONS) {
    if (comp.hasStandings) {
      try {
        console.log(`Fetching standings for ${comp.name} (${comp.id})...`);
        const standings = await adapter.getStandings(comp.id);
        if (standings && DataValidator.validateStandings(standings.table)) {
          await storage.writeJson(`matches/standings/${comp.id}.json`, standings);
          console.log(`  -> Saved ${standings.table.length} rows for ${comp.name}`);
        }
      } catch (e: any) {
        console.warn(`Could not sync standings for ${comp.name}: ${e.message}`);
      }
    }

    if (comp.hasTopScorers) {
      try {
        console.log(`Fetching top scorers for ${comp.name} (${comp.id})...`);
        const scorers = await adapter.getTopScorers(comp.id);
        if (scorers && DataValidator.validateScorers(scorers.scorers)) {
          await storage.writeJson(`matches/scorers/${comp.id}.json`, scorers);
          console.log(`  -> Saved ${scorers.scorers.length} scorers for ${comp.name}`);
        }
      } catch (e: any) {
        console.warn(`Could not sync top scorers for ${comp.name}: ${e.message}`);
      }
    }

    // Rate limiting delay
    await new Promise(r => setTimeout(r, 400));
  }

  console.log('=== Standings & Scorers sync completed! ===');
}

syncStandings().catch(err => {
  console.error('Fatal standings sync error:', err);
  process.exit(1);
});
