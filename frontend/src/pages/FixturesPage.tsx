import React from 'react';
import { Fixture, Competition } from '../types.js';
import { MatchCard } from '../components/MatchCard.js';
import { Calendar, Search, Filter } from 'lucide-react';

interface Props {
  todayMatches: Fixture[];
  upcomingMatches: Fixture[];
  competitions: Competition[];
  onSelectMatch: (match: Fixture) => void;
}

export const FixturesPage: React.FC<Props> = ({
  todayMatches,
  upcomingMatches,
  competitions,
  onSelectMatch
}) => {
  const [activeTab, setActiveTab] = React.useState<'today' | 'upcoming'>('upcoming');
  const [selectedComp, setSelectedComp] = React.useState<string>('all');
  const [searchTerm, setSearchTerm] = React.useState<string>('');
  const [selectedDayOffset, setSelectedDayOffset] = React.useState<number | 'all'>('all');

  // Build list of next 5 days
  const now = new Date();
  const upcomingDays = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    return { offset: i, dateStr, label };
  });

  const currentList = activeTab === 'today' ? todayMatches : upcomingMatches;

  const filteredMatches = currentList.filter(m => {
    const matchesComp = selectedComp === 'all' || m.competitionId === selectedComp;
    const matchesSearch = searchTerm === '' ||
      m.homeTeam.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.awayTeam.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.competitionName.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesDay = true;
    if (activeTab === 'upcoming' && selectedDayOffset !== 'all') {
      const targetDateStr = upcomingDays[selectedDayOffset]?.dateStr;
      matchesDay = m.utcDate.slice(0, 10) === targetDateStr;
    }

    return matchesComp && matchesSearch && matchesDay;
  });

  return (
    <div className="space-y-6">
      {/* Page Title & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zeta-border">
        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-wide font-mono flex items-center gap-2">
            <Calendar className="w-6 h-6 text-zeta-blue" />
            <span>Fixtures & Schedule</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Browse match fixtures for today and upcoming matchdays across 24+ global tournaments.
          </p>
        </div>

      {/* Tab Toggle: Today vs Upcoming 5 Days */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 bg-zeta-card p-1 rounded-xl border border-zeta-border">
          <button
            onClick={() => {
              setActiveTab('today');
              setSelectedDayOffset('all');
            }}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'today'
                ? 'bg-zeta-blue text-black shadow-glow-blue'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Today ({todayMatches.length})
          </button>
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'upcoming'
                ? 'bg-zeta-blue text-black shadow-glow-blue'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Upcoming 5 Days ({upcomingMatches.length})
          </button>
        </div>

        {/* Day Pills when in Upcoming Tab */}
        {activeTab === 'upcoming' && (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setSelectedDayOffset('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                selectedDayOffset === 'all'
                  ? 'bg-zeta-blue/20 text-zeta-blue border-zeta-blue'
                  : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              All 5 Days
            </button>
            {upcomingDays.slice(1).map((day) => (
              <button
                key={day.offset}
                onClick={() => setSelectedDayOffset(day.offset)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                  selectedDayOffset === day.offset
                    ? 'bg-zeta-blue/20 text-zeta-blue border-zeta-blue'
                    : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                {day.label}
              </button>
            ))}
          </div>
        )}
      </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        {/* Search */}
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

        {/* Competition Dropdown */}
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

      {/* Matches Grid */}
      {filteredMatches.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMatches.map(m => (
            <MatchCard key={m.id} match={m} onClick={() => onSelectMatch(m)} />
          ))}
        </div>
      ) : (
        <div className="p-10 rounded-xl bg-zeta-card border border-zeta-border text-center text-slate-400 text-sm">
          No fixtures match your selected filters.
        </div>
      )}
    </div>
  );
};
