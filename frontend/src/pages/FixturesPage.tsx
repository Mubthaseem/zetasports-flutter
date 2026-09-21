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
  const [selectedDayFilter, setSelectedDayFilter] = React.useState<string>('all');

  // Build list of next 5 days
  const now = new Date();
  const upcomingDays = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    return { offset: i, dateStr, label };
  });

  const next5DaysLimit = new Date(now);
  next5DaysLimit.setDate(next5DaysLimit.getDate() + 5);

  const currentList = activeTab === 'today' ? todayMatches : upcomingMatches;

  const filteredMatches = currentList.filter(m => {
    const matchesComp = selectedComp === 'all' || m.competitionId === selectedComp;
    const matchesSearch = searchTerm === '' ||
      m.homeTeam.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.awayTeam.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.competitionName.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesDay = true;
    if (activeTab === 'upcoming') {
      if (selectedDayFilter === 'next5') {
        const mDate = new Date(m.utcDate);
        matchesDay = mDate <= next5DaysLimit;
      } else if (selectedDayFilter !== 'all') {
        matchesDay = m.utcDate.slice(0, 10) === selectedDayFilter;
      }
    }

    return matchesComp && matchesSearch && matchesDay;
  });

  return (
    <div className="space-y-6">
      {/* Page Title & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-wide font-mono flex items-center gap-2">
            <Calendar className="w-6 h-6 text-blue-600" />
            <span>Fixtures & Schedule</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Browse match fixtures for today and upcoming matchdays across 24+ global tournaments.
          </p>
        </div>

      {/* Tab Toggle: Today vs Upcoming */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => {
              setActiveTab('today');
              setSelectedDayFilter('all');
            }}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'today'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Today ({todayMatches.length})
          </button>
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'upcoming'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Upcoming ({upcomingMatches.length})
          </button>
        </div>

        {/* Day Pills when in Upcoming Tab */}
        {activeTab === 'upcoming' && (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setSelectedDayFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                selectedDayFilter === 'all'
                  ? 'bg-blue-50 text-blue-700 border-blue-300 font-bold shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              All Matchdays ({upcomingMatches.length})
            </button>
            <button
              onClick={() => setSelectedDayFilter('next5')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                selectedDayFilter === 'next5'
                  ? 'bg-blue-50 text-blue-700 border-blue-300 font-bold shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              Next 5 Days
            </button>
            {upcomingDays.slice(1).map((day) => (
              <button
                key={day.offset}
                onClick={() => setSelectedDayFilter(day.dateStr)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                  selectedDayFilter === day.dateStr
                    ? 'bg-blue-50 text-blue-700 border-blue-300 font-bold shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
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
            className="w-full bg-white text-xs text-slate-900 pl-9 pr-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600 shadow-sm"
          />
        </div>

        {/* Competition Dropdown */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={selectedComp}
            onChange={(e) => setSelectedComp(e.target.value)}
            className="w-full sm:w-auto bg-white text-slate-800 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600 shadow-sm"
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
        <div className="p-10 rounded-xl bg-white border border-slate-200 text-center text-slate-500 text-sm shadow-sm">
          No fixtures match your selected filters.
        </div>
      )}
    </div>
  );
};
