import React from 'react';
import { Fixture } from '../types.js';
import { MatchCard } from '../components/MatchCard.js';
import { Radio, Filter, AlertCircle } from 'lucide-react';

interface Props {
  liveMatches: Fixture[];
  onSelectMatch: (match: Fixture) => void;
}

export const LiveScoresPage: React.FC<Props> = ({ liveMatches, onSelectMatch }) => {
  const [selectedLeague, setSelectedLeague] = React.useState<string>('all');

  // Extract distinct leagues with active matches
  const leagues = Array.from(new Set(liveMatches.map(m => m.competitionName)));

  const filteredMatches = selectedLeague === 'all'
    ? liveMatches
    : liveMatches.filter(m => m.competitionName === selectedLeague);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-wide font-mono">
              Live Scores Now
            </h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white font-mono shadow-sm">
              {liveMatches.length}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time in-play football matches updated automatically via scheduled pipeline.
          </p>
        </div>

        {/* League Filter */}
        {leagues.length > 1 && (
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={selectedLeague}
              onChange={(e) => setSelectedLeague(e.target.value)}
              className="bg-white text-slate-800 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600 shadow-sm"
            >
              <option value="all">All Live Competitions ({liveMatches.length})</option>
              {leagues.map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Matches Grid */}
      {filteredMatches.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMatches.map(m => (
            <MatchCard key={m.id} match={m} onClick={() => onSelectMatch(m)} />
          ))}
        </div>
      ) : (
        <div className="p-12 rounded-2xl bg-white border border-slate-200 text-center space-y-3 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
            <Radio className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">No Live Matches at This Exact Moment</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            There are no ongoing matches actively in play in the tracked competitions right now. Check today's upcoming matches or recent results.
          </p>
        </div>
      )}
    </div>
  );
};
