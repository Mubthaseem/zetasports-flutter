import React from 'react';
import { Competition, CompetitionScorers } from '../types.js';
import { DataAPI } from '../services/api.js';
import { Flame, Shield, RefreshCw, Award } from 'lucide-react';

interface Props {
  competitions: Competition[];
}

export const ScorersPage: React.FC<Props> = ({ competitions }) => {
  const [selectedCompId, setSelectedCompId] = React.useState<string>('47');
  const [scorersData, setScorersData] = React.useState<CompetitionScorers | null>(null);
  const [loading, setLoading] = React.useState<boolean>(false);

  React.useEffect(() => {
    async function loadScorers() {
      setLoading(true);
      try {
        const data = await DataAPI.getScorers(selectedCompId);
        setScorersData(data);
      } catch (err) {
        console.error('Failed to load scorers:', err);
      } finally {
        setLoading(false);
      }
    }
    loadScorers();
  }, [selectedCompId]);

  const selectedComp = competitions.find(c => c.id === selectedCompId);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-wide font-mono flex items-center gap-2">
            <Flame className="w-6 h-6 text-blue-600" />
            <span>Top Goalscorers</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Golden Boot race, top scorers, and attacking performance leaderboards.
          </p>
        </div>

        <select
          value={selectedCompId}
          onChange={(e) => setSelectedCompId(e.target.value)}
          className="bg-white text-slate-800 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600 shadow-sm"
        >
          {competitions.filter(c => c.hasTopScorers).map(l => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </div>

      {/* Scorers Card */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-md">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {selectedComp?.logoUrl && (
              <img src={selectedComp.logoUrl} alt={selectedComp.name} className="w-7 h-7 object-contain" />
            )}
            <h2 className="text-base font-bold text-slate-900">{selectedComp?.name} — Top Scorers</h2>
          </div>
          {scorersData && (
            <span className="text-[11px] font-mono text-slate-500">
              Season: {scorersData.season}
            </span>
          )}
        </div>

        {loading ? (
          <div className="py-20 text-center flex flex-col items-center gap-3 text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-xs">Loading scorers...</span>
          </div>
        ) : scorersData && scorersData.scorers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-600 bg-slate-100/70 font-semibold">
                  <th className="py-3 px-4 w-12 text-center font-mono">Rank</th>
                  <th className="py-3 px-4 font-semibold">Player</th>
                  <th className="py-3 px-4 font-semibold">Club</th>
                  <th className="py-3 px-4 text-center font-mono font-bold text-blue-600">Goals</th>
                  <th className="py-3 px-4 text-center font-mono text-slate-500">Assists</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {scorersData.scorers.map((scorer) => (
                  <tr key={scorer.playerId} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-400">
                      {scorer.rank === 1 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-black">
                          1
                        </span>
                      ) : (
                        scorer.rank
                      )}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {scorer.playerName}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {scorer.teamLogoUrl && (
                          <img
                            src={scorer.teamLogoUrl}
                            alt={scorer.teamName}
                            className="w-4 h-4 object-contain"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        )}
                        <span className="text-slate-700 font-medium">{scorer.teamName}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-black text-sm text-blue-600">
                      {scorer.goals}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-slate-500">
                      {scorer.assists ?? '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-xs text-slate-500">
            Top scorer statistics are currently unavailable for this tournament.
          </div>
        )}
      </div>
    </div>
  );
};
