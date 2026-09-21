import React from 'react';
import { Fixture, MatchLineups, MatchStatistics, MatchEventsData, MatchEvent, MatchPreviewData } from '../types.js';
import { DataAPI } from '../services/api.js';
import { PitchLineup } from '../components/PitchLineup.js';
import { StatBar } from '../components/StatBar.js';
import {
  ArrowLeft,
  Clock,
  Shield,
  MapPin,
  Trophy,
  Flame,
  ChevronRight,
  Users,
  CloudSun,
  Calendar,
  Globe,
  RefreshCw,
  Info
} from 'lucide-react';

interface Props {
  match: Fixture;
  onBack: () => void;
  onSelectMatch?: (match: Fixture) => void;
  roundMatches?: Fixture[];
}

function getTimezoneDetails(): { label: string; offset: string } {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const parts = new Date().toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ');
    const short = parts.length > 2 ? parts[parts.length - 1] : '';
    const offsetMin = -new Date().getTimezoneOffset();
    const sign = offsetMin >= 0 ? '+' : '-';
    const hrs = String(Math.floor(Math.abs(offsetMin) / 60)).padStart(2, '0');
    const mins = String(Math.abs(offsetMin) % 60).padStart(2, '0');
    const offset = `UTC${sign}${hrs}:${mins}`;
    return {
      label: short ? `${short}` : (tz.split('/').pop()?.replace(/_/g, ' ') || 'Local'),
      offset
    };
  } catch {
    return { label: 'Local Time', offset: '' };
  }
}

function formatRelativeKickoff(dateStr: string): string {
  const matchDate = new Date(dateStr);
  const now = new Date();
  const diffMs = matchDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));

  if (diffMs < 0) return 'Recent';
  if (diffHours <= 1) return 'Starting soon';
  if (diffHours < 24) return `in ${diffHours}h`;
  if (diffDays === 1) return 'Tomorrow';
  return `in ${diffDays} days`;
}

function formatKickoffTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatUtcKickoffTime(dateStr: string): string {
  const d = new Date(dateStr);
  const hrs = String(d.getUTCHours()).padStart(2, '0');
  const mins = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hrs}:${mins} UTC`;
}

function formatFullMatchDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatShortMatchDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
}

export const MatchDetailPage: React.FC<Props> = ({
  match,
  onBack,
  onSelectMatch,
  roundMatches = []
}) => {
  const isScheduled = match.status === 'SCHEDULED';
  const isLive = match.status === 'IN_PLAY' || match.status === 'PAUSED';

  const [activeTab, setActiveTab] = React.useState<'preview' | 'events' | 'lineups' | 'stats' | 'round'>(
    isScheduled ? 'preview' : 'events'
  );

  const [preview, setPreview] = React.useState<MatchPreviewData | null>(null);
  const [lineups, setLineups] = React.useState<MatchLineups | null>(null);
  const [stats, setStats] = React.useState<MatchStatistics | null>(null);
  const [eventsData, setEventsData] = React.useState<MatchEventsData | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);

  // Fan Poll user vote state
  const [userVote, setUserVote] = React.useState<'1' | 'X' | '2' | null>(null);
  const [voteStats, setVoteStats] = React.useState({ home: 49, draw: 22, away: 29 });

  const tzInfo = getTimezoneDetails();

  React.useEffect(() => {
    setActiveTab(match.status === 'SCHEDULED' ? 'preview' : 'events');
    setUserVote(null);

    async function loadDetails() {
      setLoading(true);
      try {
        const [prev, l, s, e] = await Promise.all([
          DataAPI.getMatchPreview(match.id),
          DataAPI.getMatchLineups(match.id),
          DataAPI.getMatchStats(match.id),
          DataAPI.getMatchEvents(match.id)
        ]);
        setPreview(prev);
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
  }, [match.id, match.status]);

  const handleVote = (choice: '1' | 'X' | '2') => {
    if (userVote) return;
    setUserVote(choice);
    if (choice === '1') {
      setVoteStats(prev => ({ ...prev, home: prev.home + 2, away: Math.max(0, prev.away - 1), draw: Math.max(0, prev.draw - 1) }));
    } else if (choice === '2') {
      setVoteStats(prev => ({ ...prev, away: prev.away + 2, home: Math.max(0, prev.home - 1), draw: Math.max(0, prev.draw - 1) }));
    } else {
      setVoteStats(prev => ({ ...prev, draw: prev.draw + 2, home: Math.max(0, prev.home - 1), away: Math.max(0, prev.away - 1) }));
    }
  };

  const renderEventIcon = (event: MatchEvent) => {
    switch (event.type) {
      case 'GOAL':
        return <span className="text-base">⚽</span>;
      case 'CARD_YELLOW':
        return <span className="w-3 h-4 rounded-sm bg-yellow-400 inline-block shadow"></span>;
      case 'CARD_RED':
        return <span className="w-3 h-4 rounded-sm bg-red-600 inline-block shadow"></span>;
      case 'SUBSTITUTION':
        return <span className="text-emerald-500 font-bold text-xs">⇄</span>;
      case 'VAR':
        return <span className="text-[10px] font-black px-1 rounded bg-purple-100 text-purple-700 border border-purple-300">VAR</span>;
      default:
        return <span className="w-2 h-2 rounded-full bg-slate-400"></span>;
    }
  };

  const tournamentName = preview?.tournament?.name || match.competitionName;
  const roundInfo = preview?.tournament?.round
    ? `Round ${preview.tournament.round}`
    : match.round
    ? `Round ${match.round}`
    : '';

  const venueName = preview?.venue?.name || match.venue || '';
  const venueLocation = [preview?.venue?.city, preview?.venue?.country].filter(Boolean).join(', ');

  const mainFact = preview?.poll?.facts?.[0];

  return (
    <div className="space-y-6">
      {/* Top Header / Back Button */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-blue-600 transition-colors bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Matches</span>
        </button>

        {/* Global Timezone Indicator */}
        <div className="inline-flex items-center gap-1.5 text-xs text-slate-500 font-medium bg-slate-100/80 px-3 py-1.5 rounded-xl border border-slate-200">
          <Globe className="w-3.5 h-3.5 text-slate-400" />
          <span>Timezone: </span>
          <span className="font-bold text-slate-800">{tzInfo.label}</span>
          <span className="text-slate-400 font-mono text-[11px]">({tzInfo.offset})</span>
        </div>
      </div>

      {/* Hero Scoreboard Banner */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-b from-white via-white to-slate-50/60 border border-slate-200 p-6 sm:p-8 shadow-sm">
        {/* Subheader: Tournament & Location & Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 pb-5 border-b border-slate-100 gap-2 mb-6">
          <div>
            <span className="font-bold text-slate-900 text-sm">{tournamentName}</span>
            {roundInfo && <span className="text-slate-400 ml-1.5 font-medium">• {roundInfo}</span>}
            {venueName && (
              <span className="block sm:inline text-slate-500 sm:ml-2 font-medium">
                <span className="hidden sm:inline">• </span>
                {venueName} {venueLocation ? `(${venueLocation})` : ''}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {isLive ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-sm animate-pulse">
                <span className="w-2 h-2 rounded-full bg-rose-600"></span>
                <span>{match.minute || 'LIVE'}</span>
              </span>
            ) : match.status === 'FINISHED' ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                Full Time
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-sm">
                <Clock className="w-3.5 h-3.5" />
                <span>Upcoming • {formatRelativeKickoff(match.utcDate)}</span>
              </span>
            )}
          </div>
        </div>

        {/* Teams & Scoreboard Center */}
        <div className="grid grid-cols-3 items-center text-center py-2 sm:py-4">
          {/* Home Team */}
          <div className="flex flex-col items-center space-y-3">
            <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-3xl bg-slate-50/80 p-3 sm:p-4 flex items-center justify-center border border-slate-200/90 shadow-sm hover:shadow transition-shadow">
              {match.homeTeam.logoUrl ? (
                <img
                  src={match.homeTeam.logoUrl}
                  alt={match.homeTeam.name}
                  className="w-full h-full object-contain filter drop-shadow-sm"
                />
              ) : (
                <Shield className="w-10 h-10 text-slate-400" />
              )}
            </div>
            <div>
              <h2 className="text-base sm:text-2xl font-black text-slate-900 max-w-[130px] sm:max-w-[240px] truncate tracking-tight">
                {match.homeTeam.name}
              </h2>
              {preview?.fifaRank?.home ? (
                <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  FIFA #{preview.fifaRank.home}
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Home</span>
              )}
            </div>
          </div>

          {/* Center Column: Kickoff or Scoreboard */}
          <div className="flex flex-col items-center justify-center space-y-2 px-2">
            {isScheduled ? (
              // Scheduled: Prominent Date, Time, and Timezone
              <div className="flex flex-col items-center space-y-2">
                <div className="px-3.5 py-1 rounded-full bg-slate-100 text-slate-600 font-bold text-xs tracking-wider uppercase border border-slate-200">
                  VS
                </div>

                {/* Big Kickoff Time */}
                <div className="font-mono text-3xl sm:text-5xl font-black tracking-tight text-slate-900">
                  {formatKickoffTime(match.utcDate)}
                </div>

                {/* Timezone Badge */}
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold">
                  <Globe className="w-3 h-3 text-blue-500" />
                  <span>{tzInfo.label} ({tzInfo.offset})</span>
                  <span className="text-blue-400">•</span>
                  <span className="text-slate-500 font-mono text-[11px]">{formatUtcKickoffTime(match.utcDate)}</span>
                </div>

                {/* Full Match Date */}
                <div className="text-xs sm:text-sm font-bold text-slate-700 mt-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>{formatFullMatchDate(match.utcDate)}</span>
                </div>
              </div>
            ) : (
              // Live or Finished: Score
              <div className="flex flex-col items-center space-y-1">
                <div className="font-mono text-3xl sm:text-6xl font-black tracking-tight text-slate-900 flex items-center gap-2 sm:gap-4">
                  <span className={isLive ? 'text-rose-600 font-extrabold' : ''}>
                    {match.score.home ?? 0}
                  </span>
                  <span className="text-slate-300">:</span>
                  <span className={isLive ? 'text-rose-600 font-extrabold' : ''}>
                    {match.score.away ?? 0}
                  </span>
                </div>
                <div className="text-xs font-mono uppercase text-slate-500 font-bold tracking-wider">
                  {isLive ? match.minute || 'LIVE' : 'FULL TIME'}
                </div>
                <div className="text-[11px] text-slate-400 font-medium">
                  {formatShortMatchDate(match.utcDate)} • {formatKickoffTime(match.utcDate)} {tzInfo.label}
                </div>
              </div>
            )}
          </div>

          {/* Away Team */}
          <div className="flex flex-col items-center space-y-3">
            <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-3xl bg-slate-50/80 p-3 sm:p-4 flex items-center justify-center border border-slate-200/90 shadow-sm hover:shadow transition-shadow">
              {match.awayTeam.logoUrl ? (
                <img
                  src={match.awayTeam.logoUrl}
                  alt={match.awayTeam.name}
                  className="w-full h-full object-contain filter drop-shadow-sm"
                />
              ) : (
                <Shield className="w-10 h-10 text-slate-400" />
              )}
            </div>
            <div>
              <h2 className="text-base sm:text-2xl font-black text-slate-900 max-w-[130px] sm:max-w-[240px] truncate tracking-tight">
                {match.awayTeam.name}
              </h2>
              {preview?.fifaRank?.away ? (
                <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  FIFA #{preview.fifaRank.away}
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Away</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center justify-center gap-2 border-b border-slate-200 pb-4 overflow-x-auto">
        <button
          onClick={() => setActiveTab('preview')}
          className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all border shrink-0 ${
            activeTab === 'preview'
              ? 'bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-500/20'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          Preview & Insights
        </button>

        {!isScheduled && (
          <button
            onClick={() => setActiveTab('events')}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all border shrink-0 ${
              activeTab === 'events'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-500/20'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Match Events
          </button>
        )}

        <button
          onClick={() => setActiveTab('lineups')}
          className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all border shrink-0 ${
            activeTab === 'lineups'
              ? 'bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-500/20'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          Tactical Lineups
        </button>

        {!isScheduled && (
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all border shrink-0 ${
              activeTab === 'stats'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-500/20'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Statistics
          </button>
        )}

        {roundMatches.length > 0 && (
          <button
            onClick={() => setActiveTab('round')}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all border shrink-0 ${
              activeTab === 'round'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-500/20'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Round Fixtures ({roundMatches.length})
          </button>
        )}
      </div>

      {/* Tab Contents */}
      {loading ? (
        <div className="py-20 text-center flex flex-col items-center gap-3 text-slate-400 bg-white rounded-3xl border border-slate-200 shadow-sm">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-xs font-semibold">Loading match center data...</span>
        </div>
      ) : (
        <div>
          {/* TAB 1: Preview & Insights */}
          {activeTab === 'preview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left / Main Column (Col span 2) */}
              <div className="lg:col-span-2 space-y-6">
                {/* 1. "Who will win?" Fan Prediction Poll */}
                <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-sm space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
                        <Trophy className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">
                          Who will win?
                        </h3>
                        <p className="text-xs text-slate-400">Fan Community Prediction Poll</p>
                      </div>
                    </div>
                    {userVote && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Vote Recorded ✓
                      </span>
                    )}
                  </div>

                  {/* Poll voting buttons */}
                  <div className="grid grid-cols-3 gap-3">
                    {/* Home Team */}
                    <button
                      onClick={() => handleVote('1')}
                      className={`flex flex-col items-center justify-center p-4 rounded-2xl border text-center transition-all ${
                        userVote === '1'
                          ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20 shadow-sm'
                          : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-xs font-mono font-black text-slate-400 mb-1">1</span>
                      <span className="text-xs sm:text-sm font-bold text-slate-900 truncate max-w-full">
                        {match.homeTeam.shortName || match.homeTeam.name}
                      </span>
                      {userVote && (
                        <span className="mt-1.5 text-xs font-mono font-bold text-blue-600 bg-blue-100/70 px-2 py-0.5 rounded-full">
                          {voteStats.home}%
                        </span>
                      )}
                    </button>

                    {/* Draw */}
                    <button
                      onClick={() => handleVote('X')}
                      className={`flex flex-col items-center justify-center p-4 rounded-2xl border text-center transition-all ${
                        userVote === 'X'
                          ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20 shadow-sm'
                          : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-xs font-mono font-black text-slate-400 mb-1">X</span>
                      <span className="text-xs sm:text-sm font-bold text-slate-900">
                        Draw
                      </span>
                      {userVote && (
                        <span className="mt-1.5 text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                          {voteStats.draw}%
                        </span>
                      )}
                    </button>

                    {/* Away Team */}
                    <button
                      onClick={() => handleVote('2')}
                      className={`flex flex-col items-center justify-center p-4 rounded-2xl border text-center transition-all ${
                        userVote === '2'
                          ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20 shadow-sm'
                          : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-xs font-mono font-black text-slate-400 mb-1">2</span>
                      <span className="text-xs sm:text-sm font-bold text-slate-900 truncate max-w-full">
                        {match.awayTeam.shortName || match.awayTeam.name}
                      </span>
                      {userVote && (
                        <span className="mt-1.5 text-xs font-mono font-bold text-amber-600 bg-amber-100/70 px-2 py-0.5 rounded-full">
                          {voteStats.away}%
                        </span>
                      )}
                    </button>
                  </div>

                  {/* Percentage Progress Bar */}
                  {userVote && (
                    <div className="space-y-1.5 pt-1">
                      <div className="w-full h-3 rounded-full overflow-hidden flex bg-slate-100">
                        <div
                          style={{ width: `${voteStats.home}%` }}
                          className="bg-blue-600 transition-all duration-500"
                        />
                        <div
                          style={{ width: `${voteStats.draw}%` }}
                          className="bg-slate-400 transition-all duration-500"
                        />
                        <div
                          style={{ width: `${voteStats.away}%` }}
                          className="bg-amber-500 transition-all duration-500"
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="text-blue-600">{voteStats.home}% {match.homeTeam.shortName || match.homeTeam.name}</span>
                        <span className="text-slate-500">{voteStats.draw}% Draw</span>
                        <span className="text-amber-600">{voteStats.away}% {match.awayTeam.shortName || match.awayTeam.name}</span>
                      </div>
                    </div>
                  )}

                  {/* Streak Fact Banner */}
                  {mainFact && mainFact.defaultText && (
                    <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-900">
                      <Flame className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div className="text-xs font-medium leading-relaxed">
                        <span className="font-bold text-amber-950">Match Insight: </span>
                        {mainFact.defaultText}
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Team Form (Last 5 matches) */}
                <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-sm space-y-6">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">
                      Recent Form (Last 5 Matches)
                    </h3>
                    <span className="text-xs text-slate-400 font-medium">All Competitions</span>
                  </div>

                  {/* Home Form */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        {match.homeTeam.logoUrl && (
                          <img
                            src={match.homeTeam.logoUrl}
                            alt=""
                            className="w-5 h-5 object-contain"
                          />
                        )}
                        <span className="font-bold text-sm text-slate-900">{match.homeTeam.name}</span>
                      </div>

                      {/* Badges row */}
                      <div className="flex items-center gap-1.5">
                        {preview?.teamForm?.home && preview.teamForm.home.length > 0 ? (
                          preview.teamForm.home.slice(0, 5).map((m, i) => (
                            <span
                              key={i}
                              title={`${m.opponentName} (${m.score})`}
                              className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center text-white shadow-sm ${
                                m.result === 'W'
                                  ? 'bg-emerald-500'
                                  : m.result === 'D'
                                  ? 'bg-slate-400'
                                  : 'bg-rose-500'
                              }`}
                            >
                              {m.result}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400 italic">No recent matches recorded</span>
                        )}
                      </div>
                    </div>

                    {/* Past Matches List */}
                    {preview?.teamForm?.home && preview.teamForm.home.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        {preview.teamForm.home.slice(0, 4).map((m, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-slate-50 border border-slate-100"
                          >
                            <div className="flex items-center gap-2.5">
                              <span
                                className={`w-5 h-5 rounded-md text-[11px] font-bold flex items-center justify-center text-white ${
                                  m.result === 'W'
                                    ? 'bg-emerald-500'
                                    : m.result === 'D'
                                    ? 'bg-slate-400'
                                    : 'bg-rose-500'
                                }`}
                              >
                                {m.result}
                              </span>
                              {m.opponentLogo && (
                                <img
                                  src={m.opponentLogo}
                                  alt=""
                                  className="w-4 h-4 object-contain"
                                />
                              )}
                              <span className="font-semibold text-slate-700">{m.opponentName}</span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                ({m.isHome ? 'H' : 'A'})
                              </span>
                            </div>
                            <span className="font-mono font-bold text-slate-900 bg-white px-2.5 py-0.5 rounded-md border border-slate-200">
                              {m.score}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-slate-100 pt-5 space-y-3">
                    {/* Away Form */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        {match.awayTeam.logoUrl && (
                          <img
                            src={match.awayTeam.logoUrl}
                            alt=""
                            className="w-5 h-5 object-contain"
                          />
                        )}
                        <span className="font-bold text-sm text-slate-900">{match.awayTeam.name}</span>
                      </div>

                      {/* Badges row */}
                      <div className="flex items-center gap-1.5">
                        {preview?.teamForm?.away && preview.teamForm.away.length > 0 ? (
                          preview.teamForm.away.slice(0, 5).map((m, i) => (
                            <span
                              key={i}
                              title={`${m.opponentName} (${m.score})`}
                              className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center text-white shadow-sm ${
                                m.result === 'W'
                                  ? 'bg-emerald-500'
                                  : m.result === 'D'
                                  ? 'bg-slate-400'
                                  : 'bg-rose-500'
                              }`}
                            >
                              {m.result}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400 italic">No recent matches recorded</span>
                        )}
                      </div>
                    </div>

                    {/* Past Matches List */}
                    {preview?.teamForm?.away && preview.teamForm.away.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        {preview.teamForm.away.slice(0, 4).map((m, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-slate-50 border border-slate-100"
                          >
                            <div className="flex items-center gap-2.5">
                              <span
                                className={`w-5 h-5 rounded-md text-[11px] font-bold flex items-center justify-center text-white ${
                                  m.result === 'W'
                                    ? 'bg-emerald-500'
                                    : m.result === 'D'
                                    ? 'bg-slate-400'
                                    : 'bg-rose-500'
                                }`}
                              >
                                {m.result}
                              </span>
                              {m.opponentLogo && (
                                <img
                                  src={m.opponentLogo}
                                  alt=""
                                  className="w-4 h-4 object-contain"
                                />
                              )}
                              <span className="font-semibold text-slate-700">{m.opponentName}</span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                ({m.isHome ? 'H' : 'A'})
                              </span>
                            </div>
                            <span className="font-mono font-bold text-slate-900 bg-white px-2.5 py-0.5 rounded-md border border-slate-200">
                              {m.score}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Head to Head Record */}
                {preview?.h2h?.summary && (
                  <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-sm space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                          <Users className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">
                            Head-to-Head History
                          </h3>
                          <p className="text-xs text-slate-400">All-time competitive meetings</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 text-center gap-3 py-2">
                      <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                        <div className="text-xs text-slate-500 font-semibold mb-1 truncate">
                          {match.homeTeam.shortName || match.homeTeam.name}
                        </div>
                        <div className="font-mono text-2xl sm:text-3xl font-black text-blue-600">
                          {preview.h2h.summary[0]}
                        </div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Wins</div>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                        <div className="text-xs text-slate-500 font-semibold mb-1">Draws</div>
                        <div className="font-mono text-2xl sm:text-3xl font-black text-slate-700">
                          {preview.h2h.summary[1]}
                        </div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Drawn</div>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                        <div className="text-xs text-slate-500 font-semibold mb-1 truncate">
                          {match.awayTeam.shortName || match.awayTeam.name}
                        </div>
                        <div className="font-mono text-2xl sm:text-3xl font-black text-amber-600">
                          {preview.h2h.summary[2]}
                        </div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Wins</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Match Schedule, Venue Card & Round Matches */}
              <div className="space-y-6">
                {/* Match Date & Time Info Card */}
                <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">
                      Schedule & Broadcast
                    </h3>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <div className="text-slate-400 text-[11px] font-medium">Match Date</div>
                      <div className="font-bold text-slate-900 text-sm">
                        {formatFullMatchDate(match.utcDate)}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                      <div>
                        <div className="text-slate-400 text-[11px] font-medium">Your Local Time</div>
                        <div className="font-bold text-slate-900 font-mono text-sm">
                          {formatKickoffTime(match.utcDate)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">
                          {tzInfo.label} ({tzInfo.offset})
                        </div>
                      </div>

                      <div>
                        <div className="text-slate-400 text-[11px] font-medium">Universal (UTC)</div>
                        <div className="font-bold text-slate-700 font-mono text-sm">
                          {formatUtcKickoffTime(match.utcDate)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">
                          Greenwich Mean Time
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Venue & Stadium Card */}
                <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                    <MapPin className="w-5 h-5 text-blue-600" />
                    <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">
                      Match Venue
                    </h3>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <div className="text-slate-400 text-[11px] font-medium">Stadium</div>
                      <div className="font-bold text-slate-900 text-sm">
                        {preview?.venue?.name || match.venue || 'Stadium to be announced'}
                      </div>
                    </div>

                    {(preview?.venue?.city || preview?.venue?.country) && (
                      <div>
                        <div className="text-slate-400 text-[11px] font-medium">Location</div>
                        <div className="font-semibold text-slate-700">
                          {[preview.venue.city, preview.venue.country].filter(Boolean).join(', ')}
                        </div>
                      </div>
                    )}

                    {preview?.venue?.capacity && (
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                        <div>
                          <div className="text-slate-400 text-[11px] font-medium">Capacity</div>
                          <div className="font-bold text-slate-800 font-mono">
                            {preview.venue.capacity.toLocaleString()}
                          </div>
                        </div>
                        {preview.venue.surface && (
                          <div>
                            <div className="text-slate-400 text-[11px] font-medium">Surface</div>
                            <div className="font-bold text-slate-800 capitalize">
                              {preview.venue.surface}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Weather Forecast */}
                    {preview?.weather && (
                      <div className="mt-3 p-3.5 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-between text-sky-950">
                        <div className="flex items-center gap-2.5">
                          <CloudSun className="w-5 h-5 text-sky-600" />
                          <div>
                            <div className="text-[11px] font-semibold text-sky-700">Match Forecast</div>
                            <div className="font-bold text-xs">{preview.weather.description}</div>
                          </div>
                        </div>
                        <div className="font-mono text-lg font-black text-sky-900">
                          {preview.weather.temperature}°C
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Round Matches Sidebar Rail */}
                {roundMatches.length > 0 && (
                  <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-blue-600" />
                        <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">
                          Round Fixtures
                        </h3>
                      </div>
                      <span className="text-xs text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded-full">
                        {roundMatches.length}
                      </span>
                    </div>

                    <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                      {roundMatches.slice(0, 8).map((rm) => (
                        <div
                          key={rm.id}
                          onClick={() => onSelectMatch && onSelectMatch(rm)}
                          className="p-3 rounded-2xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 transition-all cursor-pointer group"
                        >
                          <div className="flex items-center justify-between text-xs mb-2">
                            <span className="font-semibold text-slate-500 text-[11px]">
                              {formatShortMatchDate(rm.utcDate)}
                            </span>
                            <span className="font-mono font-bold text-blue-600 text-[11px]">
                              {formatKickoffTime(rm.utcDate)} {tzInfo.label}
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 truncate">
                                {rm.homeTeam.logoUrl && (
                                  <img
                                    src={rm.homeTeam.logoUrl}
                                    alt=""
                                    className="w-4 h-4 object-contain shrink-0"
                                  />
                                )}
                                <span className="font-bold text-slate-800 text-xs truncate">
                                  {rm.homeTeam.name}
                                </span>
                              </div>
                              {rm.score.home !== null && (
                                <span className="font-mono font-bold text-xs">{rm.score.home}</span>
                              )}
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 truncate">
                                {rm.awayTeam.logoUrl && (
                                  <img
                                    src={rm.awayTeam.logoUrl}
                                    alt=""
                                    className="w-4 h-4 object-contain shrink-0"
                                  />
                                )}
                                <span className="font-bold text-slate-800 text-xs truncate">
                                  {rm.awayTeam.name}
                                </span>
                              </div>
                              {rm.score.away !== null && (
                                <span className="font-mono font-bold text-xs">{rm.score.away}</span>
                              )}
                            </div>
                          </div>

                          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-end text-[11px] text-blue-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                            <span>View Match</span>
                            <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Incidents Timeline */}
          {activeTab === 'events' && (
            <div className="max-w-2xl mx-auto bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-sm">
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
                <div className="text-center py-12 text-xs text-slate-500 space-y-2">
                  <Info className="w-6 h-6 text-slate-400 mx-auto" />
                  <p>No major incidents recorded yet for this fixture.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Tactical Lineups */}
          {activeTab === 'lineups' && (
            <div>
              {lineups && lineups.home.starters.length > 0 ? (
                <PitchLineup
                  lineups={lineups}
                  homeTeamName={match.homeTeam.name}
                  awayTeamName={match.awayTeam.name}
                />
              ) : (
                <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 max-w-lg mx-auto shadow-sm space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 mx-auto flex items-center justify-center border border-blue-100">
                    <Shield className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-slate-900 text-base">Lineups Not Announced Yet</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                    Official starting lineups and tactical formations are published approximately 60 minutes prior to kickoff.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Statistics */}
          {activeTab === 'stats' && (
            <div className="max-w-xl mx-auto bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-sm space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 pb-2 border-b border-slate-100">
                Team Statistics Comparison
              </h3>

              {stats && stats.stats.length > 0 ? (
                stats.stats.map((s, idx) => (
                  <StatBar key={idx} stat={s} />
                ))
              ) : (
                <div className="text-center py-12 text-xs text-slate-500 space-y-2">
                  <Info className="w-6 h-6 text-slate-400 mx-auto" />
                  <p>Match statistics will become available once the fixture kicks off.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: Round Matches */}
          {activeTab === 'round' && (
            <div className="max-w-3xl mx-auto bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-sm space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 pb-3 border-b border-slate-100">
                All Matches in {tournamentName}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {roundMatches.map(rm => (
                  <div
                    key={rm.id}
                    onClick={() => onSelectMatch && onSelectMatch(rm)}
                    className="p-4 rounded-2xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 transition-all cursor-pointer space-y-2.5 group"
                  >
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="font-semibold">{formatFullMatchDate(rm.utcDate)}</span>
                      <span className="font-mono font-bold text-blue-600">{formatKickoffTime(rm.utcDate)} {tzInfo.label}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 truncate">
                        {rm.homeTeam.logoUrl && (
                          <img src={rm.homeTeam.logoUrl} alt="" className="w-5 h-5 object-contain" />
                        )}
                        <span className="font-bold text-xs text-slate-900 truncate">{rm.homeTeam.name}</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-slate-400">vs</span>
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-bold text-xs text-slate-900 truncate">{rm.awayTeam.name}</span>
                        {rm.awayTeam.logoUrl && (
                          <img src={rm.awayTeam.logoUrl} alt="" className="w-5 h-5 object-contain" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

