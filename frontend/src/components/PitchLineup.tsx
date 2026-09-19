import React from 'react';
import { MatchLineups, LineupPlayer } from '../types.js';
import { Users, Star } from 'lucide-react';

interface Props {
  lineups: MatchLineups;
  homeTeamName: string;
  awayTeamName: string;
}

export const PitchLineup: React.FC<Props> = ({ lineups, homeTeamName, awayTeamName }) => {
  const [activeSide, setActiveSide] = React.useState<'home' | 'away'>('home');
  const activeTeam = activeSide === 'home' ? lineups.home : lineups.away;
  const activeTeamName = activeSide === 'home' ? homeTeamName : awayTeamName;

  // Group players by position: GK, DF, MF, FW
  const gk = activeTeam.starters.filter(p => p.position === 'GK');
  const df = activeTeam.starters.filter(p => p.position === 'DF');
  const mf = activeTeam.starters.filter(p => p.position === 'MF');
  const fw = activeTeam.starters.filter(p => p.position === 'FW');

  const renderPlayerDot = (player: LineupPlayer) => (
    <div key={player.id} className="flex flex-col items-center group cursor-pointer">
      <div className="relative w-9 h-9 rounded-full bg-slate-900 border-2 border-zeta-blue flex items-center justify-center font-bold text-xs text-white shadow-glow-blue transition-transform group-hover:scale-110">
        <span>{player.number}</span>
        {player.captain && (
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-zeta-gold text-black text-[9px] font-black flex items-center justify-center">
            C
          </span>
        )}
      </div>
      <span className="mt-1 text-[11px] font-medium text-slate-200 bg-slate-950/80 px-1.5 py-0.5 rounded shadow max-w-[85px] truncate text-center">
        {player.name}
      </span>
      {player.rating && (
        <span className="text-[10px] font-mono text-zeta-green font-bold flex items-center gap-0.5">
          <Star className="w-2.5 h-2.5 fill-zeta-green" /> {player.rating.toFixed(1)}
        </span>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Team selector tabs */}
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={() => setActiveSide('home')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors border ${
            activeSide === 'home'
              ? 'bg-zeta-blue/20 text-zeta-blue border-zeta-blue/50 shadow-glow-blue'
              : 'bg-zeta-card text-slate-400 border-zeta-border hover:text-white'
          }`}
        >
          {homeTeamName} ({lineups.home.formation || 'Starting XI'})
        </button>
        <button
          onClick={() => setActiveSide('away')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors border ${
            activeSide === 'away'
              ? 'bg-zeta-blue/20 text-zeta-blue border-zeta-blue/50 shadow-glow-blue'
              : 'bg-zeta-card text-slate-400 border-zeta-border hover:text-white'
          }`}
        >
          {awayTeamName} ({lineups.away.formation || 'Starting XI'})
        </button>
      </div>

      {/* Visual Pitch Graphic */}
      <div className="relative w-full max-w-xl mx-auto aspect-[3/4] bg-gradient-to-b from-[#092218] to-[#0d3425] border-2 border-emerald-500/40 rounded-2xl overflow-hidden shadow-2xl p-4 flex flex-col justify-between">
        {/* Pitch Lines */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Halfway line & circle */}
          <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-emerald-400/20"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full border border-emerald-400/20"></div>
          {/* Top Penalty Box */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-44 h-20 border-b border-x border-emerald-400/20"></div>
          {/* Bottom Penalty Box */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-44 h-20 border-t border-x border-emerald-400/20"></div>
        </div>

        {/* Goalkeeper Row */}
        <div className="relative z-10 flex justify-around items-center pt-2">
          {gk.map(renderPlayerDot)}
        </div>

        {/* Defenders Row */}
        <div className="relative z-10 flex justify-around items-center px-4">
          {df.map(renderPlayerDot)}
        </div>

        {/* Midfielders Row */}
        <div className="relative z-10 flex justify-around items-center px-2">
          {mf.map(renderPlayerDot)}
        </div>

        {/* Forwards Row */}
        <div className="relative z-10 flex justify-around items-center pb-2">
          {fw.map(renderPlayerDot)}
        </div>
      </div>

      {/* Coach & Bench */}
      <div className="max-w-xl mx-auto bg-zeta-card rounded-xl border border-zeta-border p-4 space-y-3">
        {activeTeam.coach && (
          <div className="text-xs text-slate-400 pb-2 border-b border-zeta-border flex items-center justify-between">
            <span className="font-semibold">Manager / Coach:</span>
            <span className="text-slate-200 font-medium">{activeTeam.coach}</span>
          </div>
        )}

        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            <Users className="w-3.5 h-3.5 text-zeta-blue" />
            <span>Substitutes</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {activeTeam.bench.map(p => (
              <div key={p.id} className="flex items-center justify-between p-2 rounded bg-slate-900/60 border border-slate-800">
                <div className="flex items-center gap-2 truncate">
                  <span className="font-mono text-slate-500 font-bold w-4 text-right">{p.number}</span>
                  <span className="text-slate-200 truncate">{p.name}</span>
                </div>
                {p.rating && (
                  <span className="font-mono text-[10px] text-zeta-green font-bold">{p.rating.toFixed(1)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
