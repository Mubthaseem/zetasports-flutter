import React from 'react';
import { Fixture, MatchLineups, MatchStatistics, MatchEventsData, MatchEvent } from '../types.js';
import { DataAPI } from '../services/api.js';
import { PitchLineup } from '../components/PitchLineup.js';
import { StatBar } from '../components/StatBar.js';
import { ArrowLeft, Clock, Shield, Award, AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  match: Fixture;
  onBack: () => void;
}

export const MatchDetailPage: React.FC<Props> = ({ match, onBack }) => {
  const [activeTab, setActiveTab] = React.useState<'events' | 'lineups' | 'stats'>('events');
  const [lineups, setLineups] = React.useState<MatchLineups | null>(null);
  const [stats, setStats] = React.useState<MatchStatistics | null>(null);
  const [eventsData, setEventsData] = React.useState<MatchEventsData | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);

  React.useEffect(() => {
    async function loadDetails() {
      setLoading(true);
      try {
        const [l, s, e] = await Promise.all([
          DataAPI.getMatchLineups(match.id),
          DataAPI.getMatchStats(match.id),
          DataAPI.getMatchEvents(match.id)
        ]);
        setLineups(l);
        setStats(s);
        setEventsData(e);
      } catch (err) {
        console.error('Failed to load match detail data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadDetails();
  }, [match.id]);

  const isLive = match.status === 'IN_PLAY' || match.status === 'PAUSED';

  const renderEventIcon = (event: MatchEvent) => {
    switch (event.type) {
      case 'GOAL':
        return <span className="text-base">⚽</span>;
      case 'CARD_YELLOW':
        return <span className="w-3 h-4 rounded-sm bg-yellow-400 inline-block shadow"></span>;
      case 'CARD_RED':
        return <span className="w-3 h-4 rounded-sm bg-red-600 inline-block shadow"></span>;
      case 'SUBSTITUTION':
        return <span className="text-emerald-400 font-bold text-xs">⇄</span>;
      case 'VAR':
        return <span className="text-[10px] font-black px-1 rounded bg-purple-900 text-purple-200 border border-purple-500">VAR</span>;
      default:
        return <span className="w-2 h-2 rounded-full bg-slate-500"></span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-blue-600 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Fixtures</span>
      </button>

      {/* Main Broadcast Match Header Banner */}
      <div className="relative rounded-2xl overflow-hidden bg-white border border-slate-200 p-6 shadow-md">
        {/* Subheader: League & Venue */}
        <div className="flex items-center justify-between text-xs text-slate-500 pb-4 border-b border-slate-100 mb-6">
          <div className="font-bold text-slate-900">
            {match.competitionName} {match.round ? `• ${match.round}` : ''}
          </div>
          <div className="flex items-center gap-2">
            {isLive ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
                <span>{match.minute || 'LIVE'}</span>
              </span>
            ) : match.status === 'FINISHED' ? (
              <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                Full Time
              </span>
            ) : (
              <span className="flex items-center gap-1 text-slate-600 font-mono">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {new Date(match.utcDate).toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* Score & Teams Display */}
        <div className="grid grid-cols-3 items-center text-center py-2">
          {/* Home Team */}
          <div className="flex flex-col items-center space-y-3">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-slate-50 p-2.5 flex items-center justify-center border border-slate-200 shadow-sm">
              {match.homeTeam.logoUrl ? (
                <img
                  src={match.homeTeam.logoUrl}
                  alt={match.homeTeam.name}
                  className="w-full h-full object-contain"
                />
              ) : (
                <Shield className="w-8 h-8 text-slate-400" />
              )}
            </div>
            <h2 className="text-sm sm:text-lg font-bold text-slate-900 max-w-[150px] sm:max-w-[200px] truncate">
              {match.homeTeam.name}
            </h2>
          </div>

          {/* Scores */}
          <div className="flex flex-col items-center space-y-1">
            <div className="font-mono text-3xl sm:text-5xl font-black tracking-tight text-slate-900 flex items-center gap-3">
              <span className={isLive ? 'text-rose-600 font-extrabold' : ''}>
                {match.score.home ?? 0}
              </span>
              <span className="text-slate-300">:</span>
              <span className={isLive ? 'text-rose-600 font-extrabold' : ''}>
                {match.score.away ?? 0}
              </span>
            </div>
            <div className="text-[11px] font-mono uppercase text-slate-400 tracking-wider">
              {match.status}
            </div>
          </div>

          {/* Away Team */}
          <div className="flex flex-col items-center space-y-3">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-slate-50 p-2.5 flex items-center justify-center border border-slate-200 shadow-sm">
              {match.awayTeam.logoUrl ? (
                <img
                  src={match.awayTeam.logoUrl}
                  alt={match.awayTeam.name}
                  className="w-full h-full object-contain"
                />
              ) : (
                <Shield className="w-8 h-8 text-slate-400" />
              )}
            </div>
            <h2 className="text-sm sm:text-lg font-bold text-slate-900 max-w-[150px] sm:max-w-[200px] truncate">
              {match.awayTeam.name}
            </h2>
          </div>
        </div>
      </div>

      {/* Detail Navigation Tabs */}
      <div className="flex items-center justify-center gap-2 border-b border-slate-200 pb-4">
        <button
          onClick={() => setActiveTab('events')}
          className={`px-5 py-2 rounded-xl text-sm font-bold transition-all border ${
            activeTab === 'events'
              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          Match Facts & Events
        </button>
        <button
          onClick={() => setActiveTab('lineups')}
          className={`px-5 py-2 rounded-xl text-sm font-bold transition-all border ${
            activeTab === 'lineups'
              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          Tactical Lineups
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`px-5 py-2 rounded-xl text-sm font-bold transition-all border ${
            activeTab === 'stats'
              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          Statistics
        </button>
      </div>

      {/* Tab Contents */}
      {loading ? (
        <div className="py-20 text-center flex flex-col items-center gap-3 text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-xs">Loading match center data...</span>
        </div>
      ) : (
        <div>
          {/* TAB 1: Events Timeline */}
          {activeTab === 'events' && (
            <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-6 pb-2 border-b border-slate-100">
                Match Incidents Timeline
              </h3>

              {eventsData && eventsData.events.length > 0 ? (
                <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {eventsData.events.map(ev => (
                    <div key={ev.id} className="relative flex items-start gap-4 text-sm">
                      <div className="absolute -left-6 mt-0.5 w-4 h-4 rounded-full bg-white border-2 border-blue-600 flex items-center justify-center text-[10px]">
                      </div>
                      <div className="font-mono font-bold text-xs text-blue-600 min-w-[32px]">
                        {ev.minute}'
                      </div>
                      <div className="flex items-center gap-2">
                        {renderEventIcon(ev)}
                        <div>
                          <span className="font-bold text-slate-900">{ev.playerName}</span>
                          {ev.assistPlayerName && (
                            <span className="text-xs text-slate-500 ml-1.5">
                              (Assist: {ev.assistPlayerName})
                            </span>
                          )}
                          {ev.subOffPlayerName && (
                            <span className="text-xs text-slate-500 ml-1.5">
                              (Off: {ev.subOffPlayerName})
                            </span>
                          )}
                          {ev.description && (
                            <div className="text-xs text-slate-500 mt-0.5">{ev.description}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 text-xs text-slate-500">
                  No major incidents recorded yet for this fixture.
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Tactical Lineups */}
          {activeTab === 'lineups' && (
            <div>
              {lineups ? (
                <PitchLineup
                  lineups={lineups}
                  homeTeamName={match.homeTeam.name}
                  awayTeamName={match.awayTeam.name}
                />
              ) : (
                <div className="p-12 text-center text-xs text-slate-500 bg-white rounded-2xl border border-slate-200 max-w-lg mx-auto shadow-sm">
                  Official lineups are announced approximately 60 minutes prior to kickoff.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Statistics */}
          {activeTab === 'stats' && (
            <div className="max-w-xl mx-auto bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 pb-2 border-b border-slate-100">
                Team Statistics Comparison
              </h3>

              {stats && stats.stats.length > 0 ? (
                stats.stats.map((s, idx) => (
                  <StatBar key={idx} stat={s} />
                ))
              ) : (
                <div className="text-center py-10 text-xs text-slate-500">
                  Match statistics will become available once the fixture kicks off.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
