import React from 'react';
import { Competition, CompetitionStandings } from '../types.js';
import { DataAPI } from '../services/api.js';
import { Trophy, Shield, RefreshCw } from 'lucide-react';

interface Props {
  competitions: Competition[];
}

export const StandingsPage: React.FC<Props> = ({ competitions }) => {
  const standingsLeagues = competitions.filter(c => c.hasStandings);
  const [selectedCompId, setSelectedCompId] = React.useState<string>(
    standingsLeagues[0]?.id || '47'
  );
  const [standings, setStandings] = React.useState<CompetitionStandings | null>(null);
  const [loading, setLoading] = React.useState<boolean>(false);

  React.useEffect(() => {
    async function loadStandings() {
      setLoading(true);
      try {
        const data = await DataAPI.getStandings(selectedCompId);
        setStandings(data);
      } catch (err) {
        console.error('Failed to load standings:', err);
      } finally {
        setLoading(false);
      }
    }
    loadStandings();
  }, [selectedCompId]);

  const selectedComp = competitions.find(c => c.id === selectedCompId);

  return (
    <div className="space-y-6">
      {/* Page Title & League Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zeta-border">
        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-wide font-mono flex items-center gap-2">
            <Trophy className="w-6 h-6 text-zeta-gold" />
            <span>League Standings</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Official league tables, points, goal difference, and qualification zones.
          </p>
        </div>

        {/* Dropdown */}
        <select
          value={selectedCompId}
          onChange={(e) => setSelectedCompId(e.target.value)}
          className="bg-zeta-card text-slate-200 text-xs font-semibold px-3 py-2 rounded-lg border border-zeta-border focus:outline-none focus:border-zeta-blue"
        >
          {standingsLeagues.map(l => (
            <option key={l.id} value={l.id}>{l.name} ({l.country})</option>
          ))}
        </select>
      </div>

      {/* Standings Table Card */}
      <div className="bg-zeta-card rounded-2xl border border-zeta-border overflow-hidden shadow-lg">
        {/* Table Header Banner */}
        <div className="p-4 bg-slate-900/80 border-b border-zeta-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            {selectedComp?.logoUrl && (
              <img src={selectedComp.logoUrl} alt={selectedComp.name} className="w-7 h-7 object-contain" />
            )}
            <div>
              <h2 className="text-base font-bold text-white">{selectedComp?.name}</h2>
              <span className="text-xs text-slate-400 font-mono">Season: {standings?.season || 'Current'}</span>
            </div>
          </div>
          {standings && (
            <span className="text-[11px] font-mono text-slate-500">
              Updated: {new Date(standings.updatedAt).toLocaleDateString()}
            </span>
          )}
        </div>

        {loading ? (
          <div className="py-20 text-center flex flex-col items-center gap-3 text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin text-zeta-blue" />
            <span className="text-xs">Loading table standings...</span>
          </div>
        ) : standings && standings.table.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zeta-border/80 text-[11px] uppercase tracking-wider text-slate-400 bg-slate-900/40">
                  <th className="py-3 px-3 w-10 text-center font-mono">#</th>
                  <th className="py-3 px-3 font-semibold">Club</th>
                  <th className="py-3 px-2 text-center font-mono">P</th>
                  <th className="py-3 px-2 text-center font-mono">W</th>
                  <th className="py-3 px-2 text-center font-mono">D</th>
                  <th className="py-3 px-2 text-center font-mono">L</th>
                  <th className="py-3 px-2 text-center font-mono hidden sm:table-cell">GF</th>
                  <th className="py-3 px-2 text-center font-mono hidden sm:table-cell">GA</th>
                  <th className="py-3 px-2 text-center font-mono">GD</th>
                  <th className="py-3 px-3 text-center font-mono font-bold text-white">Pts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zeta-border/50">
                {standings.table.map((row) => (
                  <tr
                    key={row.teamId}
                    className="hover:bg-zeta-cardHover/80 transition-colors group"
                  >
                    {/* Position */}
                    <td className="py-3 px-3 text-center font-mono font-bold text-slate-400 group-hover:text-zeta-blue">
                      {row.position}
                    </td>

                    {/* Team */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-5 h-5 rounded bg-slate-900 p-0.5 flex items-center justify-center shrink-0">
                          {row.logoUrl ? (
                            <img
                              src={row.logoUrl}
                              alt={row.teamName}
                              className="w-4 h-4 object-contain"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <Shield className="w-3.5 h-3.5 text-slate-500" />
                          )}
                        </div>
                        <span className="font-semibold text-slate-200 group-hover:text-white transition-colors truncate max-w-[140px] sm:max-w-none">
                          {row.teamName}
                        </span>
                      </div>
                    </td>

                    {/* Stats */}
                    <td className="py-3 px-2 text-center font-mono text-slate-400">{row.played}</td>
                    <td className="py-3 px-2 text-center font-mono text-slate-300">{row.won}</td>
                    <td className="py-3 px-2 text-center font-mono text-slate-400">{row.drawn}</td>
                    <td className="py-3 px-2 text-center font-mono text-slate-400">{row.lost}</td>
                    <td className="py-3 px-2 text-center font-mono text-slate-400 hidden sm:table-cell">{row.goalsFor}</td>
                    <td className="py-3 px-2 text-center font-mono text-slate-400 hidden sm:table-cell">{row.goalsAgainst}</td>
                    <td className="py-3 px-2 text-center font-mono font-semibold text-slate-300">
                      {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-black text-sm text-zeta-blue">
                      {row.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-xs text-slate-400">
            No standings data available for this competition yet.
          </div>
        )}
      </div>
    </div>
  );
};
