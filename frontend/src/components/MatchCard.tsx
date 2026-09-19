import React from 'react';
import { Fixture } from '../types.js';
import { Clock, Shield, ChevronRight } from 'lucide-react';

interface Props {
  match: Fixture;
  onClick?: () => void;
}

export const MatchCard: React.FC<Props> = ({ match, onClick }) => {
  const isLive = match.status === 'IN_PLAY' || match.status === 'PAUSED';
  const isFinished = match.status === 'FINISHED';
  const isScheduled = match.status === 'SCHEDULED';

  const formatMatchTime = (utcDate: string) => {
    try {
      const date = new Date(utcDate);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '--:--';
    }
  };

  const getStatusBadge = () => {
    if (isLive) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-zeta-live/20 text-zeta-live border border-zeta-live/40 shadow-glow-live">
          <span className="w-1.5 h-1.5 rounded-full bg-zeta-live animate-pulse"></span>
          <span>{match.minute || 'LIVE'}</span>
        </span>
      );
    }
    if (isFinished) {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
          FT
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-slate-400 bg-slate-900 border border-slate-800 font-mono">
        <Clock className="w-3 h-3 text-slate-500" />
        {formatMatchTime(match.utcDate)}
      </span>
    );
  };

  return (
    <div
      onClick={onClick}
      className={`group relative rounded-xl p-4 transition-all duration-200 cursor-pointer border ${
        isLive
          ? 'bg-gradient-to-br from-zeta-card to-[#190c13] border-zeta-live/30 shadow-glow-live hover:border-zeta-live/60'
          : 'bg-zeta-card hover:bg-zeta-cardHover border-zeta-border hover:border-zeta-blue/40 shadow-sm'
      }`}
    >
      {/* Header: Competition & Status */}
      <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-zeta-border/50 text-xs">
        <div className="flex items-center gap-1.5 truncate text-slate-400">
          <span className="font-semibold text-slate-200 truncate">{match.competitionName}</span>
          {match.round && <span className="text-[11px] text-slate-500">&bull; {match.round}</span>}
        </div>
        <div>{getStatusBadge()}</div>
      </div>

      {/* Teams and Scores */}
      <div className="space-y-3">
        {/* Home Team */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-7 h-7 rounded-full bg-slate-800 p-1 flex items-center justify-center border border-slate-700/60 shrink-0">
              {match.homeTeam.logoUrl ? (
                <img
                  src={match.homeTeam.logoUrl}
                  alt={match.homeTeam.name}
                  className="w-5 h-5 object-contain"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <Shield className="w-3.5 h-3.5 text-slate-400" />
              )}
            </div>
            <span className={`text-sm font-semibold truncate ${
              isFinished && (match.score.home ?? 0) > (match.score.away ?? 0) ? 'text-white font-bold' : 'text-slate-200'
            }`}>
              {match.homeTeam.name}
            </span>
          </div>

          <div className="font-mono text-base font-bold min-w-[24px] text-right">
            {match.score.home !== null && match.score.home !== undefined ? (
              <span className={isLive ? 'text-zeta-blue' : 'text-slate-100'}>
                {match.score.home}
              </span>
            ) : (
              <span className="text-slate-600">-</span>
            )}
          </div>
        </div>

        {/* Away Team */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-7 h-7 rounded-full bg-slate-800 p-1 flex items-center justify-center border border-slate-700/60 shrink-0">
              {match.awayTeam.logoUrl ? (
                <img
                  src={match.awayTeam.logoUrl}
                  alt={match.awayTeam.name}
                  className="w-5 h-5 object-contain"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <Shield className="w-3.5 h-3.5 text-slate-400" />
              )}
            </div>
            <span className={`text-sm font-semibold truncate ${
              isFinished && (match.score.away ?? 0) > (match.score.home ?? 0) ? 'text-white font-bold' : 'text-slate-200'
            }`}>
              {match.awayTeam.name}
            </span>
          </div>

          <div className="font-mono text-base font-bold min-w-[24px] text-right">
            {match.score.away !== null && match.score.away !== undefined ? (
              <span className={isLive ? 'text-zeta-blue' : 'text-slate-100'}>
                {match.score.away}
              </span>
            ) : (
              <span className="text-slate-600">-</span>
            )}
          </div>
        </div>
      </div>

      {/* Hover action prompt */}
      <div className="mt-3 pt-2 flex items-center justify-end text-[11px] text-slate-400 group-hover:text-zeta-blue transition-colors">
        <span className="flex items-center gap-0.5">
          Match Center <ChevronRight className="w-3 h-3" />
        </span>
      </div>
    </div>
  );
};
