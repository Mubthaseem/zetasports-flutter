import { FotMobAdapter } from '../adapters/fotmob.adapter.js';
import { DataStorage } from '../utils/storage.js';
import { DataValidator } from '../utils/validator.js';

export async function syncNews(): Promise<void> {
  console.log('=== [ZETA SPORTS] Starting News Synchronization ===');
  const adapter = new FotMobAdapter();
  const storage = new DataStorage();

  await adapter.init();

  const news = await adapter.getNews();
  if (DataValidator.validateNews(news) && news.length > 0) {
    await storage.writeJson('news/latest.json', news);
    console.log(`Saved ${news.length} news articles to data/news/latest.json`);
  } else {
    console.warn('No valid news retrieved.');
  }

  console.log('=== News sync completed! ===');
}

syncNews().catch(err => {
  console.error('Fatal news sync error:', err);
  process.exit(1);
});
