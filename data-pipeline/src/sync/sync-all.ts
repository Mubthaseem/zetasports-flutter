import { syncFixtures } from './sync-fixtures.js';
import { syncStandings } from './sync-standings.js';
import { syncMatchDetails } from './sync-match-details.js';
import { syncNews } from './sync-news.js';

export async function syncAll(): Promise<void> {
  console.log('##################################################');
  console.log('### ZETA SPORTS MASTER DATA PIPELINE BOOTSTRAP ###');
  console.log('##################################################');

  try {
    await syncFixtures();
    await syncNews();
    await syncStandings();
    await syncMatchDetails();
    console.log('\n>>> MASTER SYNC COMPLETED SUCCESSFULLY! <<<');
  } catch (err) {
    console.error('Master sync failed:', err);
    process.exit(1);
  }
}

syncAll().catch(err => {
  console.error('Master sync failed:', err);
  process.exit(1);
});
