import { DataStorage } from '../utils/storage.js';
import { Fixture } from '../core/types.js';

export async function syncHistorical(): Promise<void> {
  console.log('=== [ZETA SPORTS] Starting Historical Data Maintenance ===');
  const storage = new DataStorage();

  const results = storage.readJson<Fixture[]>('fixtures/results.json') || [];
  const today = storage.readJson<Fixture[]>('fixtures/today.json') || [];

  // Find newly finished matches in today and prepend to results
  const finishedToday = today.filter(m => m.status === 'FINISHED');
  const existingIds = new Set(results.map(r => r.id));

  let added = 0;
  for (const m of finishedToday) {
    if (!existingIds.has(m.id)) {
      results.unshift(m);
      existingIds.add(m.id);
      added++;
    }
  }

  // Keep up to 300 recent historical results
  const trimmed = results.slice(0, 300);
  await storage.writeJson('fixtures/results.json', trimmed);

  console.log(`Historical maintenance complete. Added ${added} new results. Total retained: ${trimmed.length}`);
}

syncHistorical().catch(err => {
  console.error('Fatal historical sync error:', err);
  process.exit(1);
});
