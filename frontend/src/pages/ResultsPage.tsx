import React from 'react';
import { Fixture, Competition } from '../types.js';
import { MatchCard } from '../components/MatchCard.js';
import { CheckCircle2, Search, Filter } from 'lucide-react';

interface Props {
  results: Fixture[];
  competitions: Competition[];
  onSelectMatch: (match: Fixture) => void;
}

export const ResultsPage: React.FC<Props> = ({ results, competitions, onSelectMatch }) => {
  const [selectedComp, setSelectedComp] = React.useState<string>('all');
  const [searchTerm, setSearchTerm] = React.useState<string>('');
  const [selectedDayOffset, setSelectedDayOffset] = React.useState<number | 'all'>('all');

  // Build past 3 days list
  const now = new Date();
  const pastDays = [1, 2, 3].map((daysAgo) => {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - daysAgo);
    const dateStr = d.toISOString().slice(0, 10);
    const label = daysAgo === 1 ? 'Yesterday' : `${daysAgo} Days Ago`;
    return { daysAgo, dateStr, label };
  });

  const filteredResults = results.filter(m => {
    const matchesComp = selectedComp === 'all' || m.competitionId === selectedComp;
    const matchesSearch = searchTerm === '' ||
      m.homeTeam.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.awayTeam.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.competitionName.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesDay = true;
    if (selectedDayOffset !== 'all') {
      const targetDateStr = pastDays.find(d => d.daysAgo === selectedDayOffset)?.dateStr;
      matchesDay = m.utcDate.slice(0, 10) === targetDateStr;
    }

    return matchesComp && matchesSearch && matchesDay;
  });

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zeta-border">
        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-wide font-mono flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-zeta-green" />
            <span>Match Results (Past 3 Days)</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Scores and final outcomes from the past 3 days across all 24 tracked competitions.
          </p>
        </div>

        {/* Day Pills */}
        <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto">
          <button
            onClick={() => setSelectedDayOffset('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              selectedDayOffset === 'all'
                ? 'bg-zeta-green text-black font-bold'
                : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            All Past 3 Days ({results.length})
          </button>
          {pastDays.map(day => (
            <button
              key={day.daysAgo}
              onClick={() => setSelectedDayOffset(day.daysAgo)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                selectedDayOffset === day.daysAgo
                  ? 'bg-zeta-green text-black font-bold'
                  : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              {day.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search teams or leagues..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zeta-card text-xs text-white pl-9 pr-3 py-2 rounded-lg border border-zeta-border focus:outline-none focus:border-zeta-blue"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={selectedComp}
            onChange={(e) => setSelectedComp(e.target.value)}
            className="w-full sm:w-auto bg-zeta-card text-slate-200 text-xs font-semibold px-3 py-2 rounded-lg border border-zeta-border focus:outline-none focus:border-zeta-blue"
          >
            <option value="all">All Competitions</option>
            {competitions.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Results Grid */}
      {filteredResults.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredResults.map(m => (
            <MatchCard key={m.id} match={m} onClick={() => onSelectMatch(m)} />
          ))}
        </div>
      ) : (
        <div className="p-10 rounded-xl bg-zeta-card border border-zeta-border text-center text-slate-400 text-sm">
          No results match your selected filters.
        </div>
      )}
    </div>
  );
};
