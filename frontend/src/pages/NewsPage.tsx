import React from 'react';
import { NewsItem } from '../types.js';
import { Newspaper, ExternalLink, Calendar, Search } from 'lucide-react';

interface Props {
  news: NewsItem[];
}

export const NewsPage: React.FC<Props> = ({ news }) => {
  const [searchTerm, setSearchTerm] = React.useState<string>('');

  const filtered = news.filter(n =>
    n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    n.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    n.source.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zeta-border">
        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-wide font-mono flex items-center gap-2">
            <Newspaper className="w-6 h-6 text-zeta-blue" />
            <span>Football News Hub</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Breaking football updates, club statements, transfer scoops, and match reviews.
          </p>
        </div>
        <div className="text-xs font-mono text-slate-400 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 self-start sm:self-auto">
          {news.length} Published Articles
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Filter news by club, player, topic..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-zeta-card text-xs text-white pl-9 pr-3 py-2 rounded-lg border border-zeta-border focus:outline-none focus:border-zeta-blue"
        />
      </div>

      {/* Articles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(item => (
          <a
            key={item.id}
            href={item.sourceUrl.startsWith('http') ? item.sourceUrl : `https://www.fotmob.com${item.sourceUrl}`}
            target="_blank"
            rel="noreferrer"
            className="group rounded-2xl overflow-hidden bg-zeta-card hover:bg-zeta-cardHover border border-zeta-border hover:border-zeta-blue/40 flex flex-col justify-between transition-all duration-200 shadow-md"
          >
            <div>
              {item.imageUrl && (
                <div className="aspect-video w-full overflow-hidden bg-slate-900 relative">
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <span className="absolute bottom-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded bg-black/80 text-zeta-blue border border-zeta-blue/30 backdrop-blur-sm">
                    {item.source}
                  </span>
                </div>
              )}
              <div className="p-5">
                <h3 className="text-sm font-bold text-slate-100 group-hover:text-zeta-blue transition-colors leading-snug line-clamp-3">
                  {item.title}
                </h3>
                {item.description && (
                  <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>
                )}
              </div>
            </div>

            <div className="px-5 pb-4 pt-2 border-t border-zeta-border/50 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1 font-mono">
                <Calendar className="w-3 h-3 text-slate-500" />
                {new Date(item.publishedAt).toLocaleDateString()}
              </span>
              <span className="flex items-center gap-1 text-zeta-blue group-hover:underline">
                Read Article <ExternalLink className="w-3 h-3" />
              </span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
};
