import React from 'react';
import { Radio, Calendar, Trophy, BarChart2, Newspaper, RefreshCw, Menu, X, Activity } from 'lucide-react';

interface Props {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  liveCount: number;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const Navbar: React.FC<Props> = ({
  activeTab,
  setActiveTab,
  liveCount,
  onRefresh,
  isRefreshing
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const navItems = [
    { id: 'home', label: 'Home' },
    { id: 'live', label: 'Live Scores', badge: liveCount > 0 ? liveCount : null, live: true },
    { id: 'fixtures', label: 'Fixtures' },
    { id: 'results', label: 'Results' },
    { id: 'competitions', label: 'Competitions' },
    { id: 'standings', label: 'Standings' },
    { id: 'scorers', label: 'Top Scorers' },
    { id: 'news', label: 'News' }
  ];

  return (
    <header className="sticky top-0 z-50 bg-zeta-dark/95 backdrop-blur-md border-b border-zeta-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <div
            onClick={() => setActiveTab('home')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-zeta-blue to-zeta-neon flex items-center justify-center text-black font-black text-xl shadow-glow-blue transition-transform group-hover:scale-105">
              Z
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black tracking-wider text-lg text-white font-mono">ZETA</span>
                <span className="font-extrabold text-xs px-1.5 py-0.5 rounded bg-zeta-blue/10 text-zeta-blue border border-zeta-blue/30 tracking-widest uppercase">
                  SPORTS
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono tracking-wider -mt-0.5">
                AUTONOMOUS DATA HUB
              </div>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(item => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`relative px-3.5 py-2 rounded-md text-sm font-semibold transition-all duration-150 flex items-center gap-2 ${
                    isActive
                      ? 'bg-zeta-card text-zeta-blue shadow-inner border border-zeta-border'
                      : 'text-slate-300 hover:text-white hover:bg-zeta-cardHover/60'
                  }`}
                >
                  {item.live && liveCount > 0 && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zeta-live opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-zeta-live"></span>
                    </span>
                  )}
                  <span>{item.label}</span>
                  {item.badge !== null && item.badge !== undefined && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-zeta-live text-white font-mono shadow-glow-live">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Actions: Refresh & Mobile Menu Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Refresh Data"
              className="p-2 rounded-lg bg-zeta-card hover:bg-zeta-cardHover text-slate-300 hover:text-zeta-blue border border-zeta-border transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-zeta-blue' : ''}`} />
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg bg-zeta-card text-slate-300 hover:text-white border border-zeta-border"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-zeta-border bg-zeta-dark/98 px-4 pt-2 pb-4 space-y-1">
          {navItems.map(item => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-semibold ${
                  isActive
                    ? 'bg-zeta-card text-zeta-blue border border-zeta-border'
                    : 'text-slate-300 hover:bg-zeta-cardHover'
                }`}
              >
                <div className="flex items-center gap-2">
                  {item.live && liveCount > 0 && (
                    <span className="h-2 w-2 rounded-full bg-zeta-live animate-pulse"></span>
                  )}
                  <span>{item.label}</span>
                </div>
                {item.badge !== null && item.badge !== undefined && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-zeta-live text-white font-mono">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
};
