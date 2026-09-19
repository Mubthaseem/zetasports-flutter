import React from 'react';
import { Fixture, Competition, NewsItem } from '../types.js';
import { MatchCard } from '../components/MatchCard.js';
import { Radio, Calendar, ArrowRight, Trophy, Flame, Newspaper } from 'lucide-react';

interface Props {
  liveMatches: Fixture[];
  todayMatches: Fixture[];
  news: NewsItem[];
  competitions: Competition[];
  onSelectMatch: (match: Fixture) => void;
  onNavigate: (tab: string) => void;
}

export const HomePage: React.FC<Props> = ({
  liveMatches,
  todayMatches,
  news,
  competitions,
  onSelectMatch,
  onNavigate
}) => {
  return (
    <div className="space-y-10">
      {/* Hero Live Spotlight */}
      {liveMatches.length > 0 ? (
        <section className="relative rounded-2xl overflow-hidden p-6 bg-gradient-to-r from-red-950/40 via-zeta-card to-zeta-dark border border-zeta-live/40 shadow-glow-live">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zeta-live opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-zeta-live"></span>
              </span>
              <h2 className="text-lg font-black tracking-wide text-white uppercase font-mono">
                Live Matches Now ({liveMatches.length})
              </h2>
            </div>
            <button
              onClick={() => onNavigate('live')}
              className="text-xs text-zeta-blue hover:text-white flex items-center gap-1 font-semibold transition-colors"
            >
              <span>View All Live</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {liveMatches.slice(0, 3).map(m => (
              <MatchCard key={m.id} match={m} onClick={() => onSelectMatch(m)} />
            ))}
          </div>
        </section>
      ) : (
        <section className="rounded-2xl p-6 bg-gradient-to-r from-zeta-card via-[#0c1626] to-zeta-card border border-zeta-border">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2 text-xs text-zeta-blue font-mono font-bold tracking-wider uppercase">
                <Flame className="w-4 h-4 text-zeta-blue" />
                <span>Autonomous Broadcast Hub</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Welcome to <span className="text-zeta-blue">ZETA SPORTS</span>
              </h1>
              <p className="text-sm text-slate-400 max-w-xl">
                Real-time football scores, official lineups, advanced match statistics, standings, and global news powered entirely by GitHub Free and automated workflows.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => onNavigate('fixtures')}
                className="px-4 py-2 rounded-lg bg-zeta-blue text-black font-bold text-sm shadow-glow-blue hover:bg-cyan-300 transition-colors"
              >
                Today's Fixtures
              </button>
              <button
                onClick={() => onNavigate('standings')}
                className="px-4 py-2 rounded-lg bg-zeta-card hover:bg-zeta-cardHover text-white font-semibold text-sm border border-zeta-border transition-colors"
              >
                League Tables
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Today's Schedule */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-zeta-blue" />
            <h2 className="text-xl font-bold text-white tracking-wide">Today's Matches</h2>
            <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
              {todayMatches.length}
            </span>
          </div>
          <button
            onClick={() => onNavigate('fixtures')}
            className="text-xs text-zeta-blue hover:text-white flex items-center gap-1 font-semibold transition-colors"
          >
            <span>Full Schedule</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {todayMatches.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {todayMatches.slice(0, 6).map(m => (
              <MatchCard key={m.id} match={m} onClick={() => onSelectMatch(m)} />
            ))}
          </div>
        ) : (
          <div className="p-8 rounded-xl bg-zeta-card border border-zeta-border text-center text-slate-400 text-sm">
            No matches scheduled for today. Check the upcoming fixtures tab.
          </div>
        )}
      </section>

      {/* Quick Competitions Bar */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-zeta-gold" />
            <h2 className="text-xl font-bold text-white tracking-wide">Top Tournaments</h2>
          </div>
          <button
            onClick={() => onNavigate('competitions')}
            className="text-xs text-zeta-blue hover:text-white flex items-center gap-1 font-semibold transition-colors"
          >
            <span>All 24 Competitions</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {competitions.slice(0, 6).map(c => (
            <div
              key={c.id}
              onClick={() => onNavigate('standings')}
              className="p-3 rounded-xl bg-zeta-card hover:bg-zeta-cardHover border border-zeta-border hover:border-zeta-blue/40 text-center cursor-pointer transition-all group"
            >
              <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-slate-900 p-1.5 flex items-center justify-center border border-slate-800 group-hover:scale-105 transition-transform">
                {c.logoUrl ? (
                  <img src={c.logoUrl} alt={c.name} className="w-7 h-7 object-contain" />
                ) : (
                  <Trophy className="w-5 h-5 text-zeta-gold" />
                )}
              </div>
              <div className="text-xs font-bold text-slate-200 truncate group-hover:text-zeta-blue transition-colors">
                {c.name}
              </div>
              <div className="text-[10px] text-slate-400 truncate">{c.country}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Latest Football News */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-zeta-blue" />
            <h2 className="text-xl font-bold text-white tracking-wide">Latest Football News</h2>
          </div>
          <button
            onClick={() => onNavigate('news')}
            className="text-xs text-zeta-blue hover:text-white flex items-center gap-1 font-semibold transition-colors"
          >
            <span>More News</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {news.slice(0, 3).map(item => (
            <a
              key={item.id}
              href={item.sourceUrl.startsWith('http') ? item.sourceUrl : `https://www.fotmob.com${item.sourceUrl}`}
              target="_blank"
              rel="noreferrer"
              className="group rounded-xl overflow-hidden bg-zeta-card hover:bg-zeta-cardHover border border-zeta-border hover:border-zeta-blue/40 flex flex-col transition-all"
            >
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
              <div className="p-4 flex-1 flex flex-col justify-between">
                <h3 className="text-sm font-bold text-slate-100 group-hover:text-zeta-blue transition-colors line-clamp-2">
                  {item.title}
                </h3>
                <span className="text-[11px] text-slate-400 mt-3 font-mono">
                  {new Date(item.publishedAt).toLocaleDateString()}
                </span>
              </div>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
};
