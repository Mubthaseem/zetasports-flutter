import React from 'react';
import { Competition } from '../types.js';
import { Trophy, Check, X, ExternalLink, Shield } from 'lucide-react';

interface Props {
  competitions: Competition[];
  onSelectCompetition: (comp: Competition) => void;
}

export const CompetitionsPage: React.FC<Props> = ({ competitions, onSelectCompetition }) => {
  const [filterCategory, setFilterCategory] = React.useState<string>('all');

  const categories = [
    { id: 'all', label: 'All Tournaments' },
    { id: 'DOMESTIC_LEAGUE', label: 'Domestic Leagues' },
    { id: 'EUROPEAN_CUP', label: 'European Cups' },
    { id: 'DOMESTIC_CUP', label: 'Domestic Cups' },
    { id: 'INTERNATIONAL', label: 'International' },
    { id: 'CONTINENTAL', label: 'Continental' }
  ];

  const filtered = filterCategory === 'all'
    ? competitions
    : competitions.filter(c => c.category === filterCategory);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-wide font-mono flex items-center gap-2">
            <Trophy className="w-6 h-6 text-amber-500" />
            <span>Tracked Competitions</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            24+ global football tournaments tracked and synchronized directly via public data pipelines.
          </p>
        </div>
        <div className="text-xs font-mono text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 self-start sm:self-auto">
          {competitions.length} Competitions Tracked
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap gap-2">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setFilterCategory(cat.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterCategory === cat.id
                ? 'bg-blue-600 text-white font-bold shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Competitions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(c => (
          <div
            key={c.id}
            onClick={() => onSelectCompetition(c)}
            className="group p-5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-blue-300 shadow-sm transition-all cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-slate-50 p-2 flex items-center justify-center border border-slate-200 shrink-0 group-hover:scale-105 transition-transform">
                  {c.logoUrl ? (
                    <img src={c.logoUrl} alt={c.name} className="w-8 h-8 object-contain" />
                  ) : (
                    <Shield className="w-6 h-6 text-slate-400" />
                  )}
                </div>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                  {c.category.replace('_', ' ')}
                </span>
              </div>

              <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                {c.name}
              </h3>
              <p className="text-xs text-slate-500 mb-4">{c.country}</p>
            </div>

            {/* Feature Capability Badges */}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Coverage Capabilities:
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                <div className="flex items-center gap-1 text-slate-700">
                  {c.hasStandings ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600 font-bold" />
                  ) : (
                    <X className="w-3.5 h-3.5 text-slate-300" />
                  )}
                  <span>Standings Table</span>
                </div>
                <div className="flex items-center gap-1 text-slate-700">
                  {c.hasTopScorers ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600 font-bold" />
                  ) : (
                    <X className="w-3.5 h-3.5 text-slate-300" />
                  )}
                  <span>Top Scorers</span>
                </div>
                <div className="flex items-center gap-1 text-slate-700">
                  {c.hasLineups ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600 font-bold" />
                  ) : (
                    <X className="w-3.5 h-3.5 text-slate-300" />
                  )}
                  <span>Tactical Lineups</span>
                </div>
                <div className="flex items-center gap-1 text-slate-700">
                  {c.hasStats ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600 font-bold" />
                  ) : (
                    <X className="w-3.5 h-3.5 text-slate-300" />
                  )}
                  <span>Match Statistics</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
