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

    // Sync full article content for top 15 articles
    console.log('Fetching full article contents for top stories...');
    for (const item of news.slice(0, 15)) {
      try {
        console.log(`  -> Fetching article: ${item.title.substring(0, 50)}...`);
        const article = await adapter.getNewsArticle(item);
        if (article) {
          await storage.writeJson(`news/articles/${item.id}.json`, article);
        }
        await new Promise(r => setTimeout(r, 400));
      } catch (err: any) {
        console.warn(`Failed to fetch article ${item.id}: ${err.message}`);
      }
    }
  } else {
    console.warn('No valid news retrieved.');
  }

  console.log('=== News sync completed! ===');

}

syncNews().catch(err => {
  console.error('Fatal news sync error:', err);
  process.exit(1);
});
