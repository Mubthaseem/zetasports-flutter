import React from 'react';
import { DataAPI } from './services/api.js';
import { Fixture, Competition, NewsItem, SyncMeta } from './types.js';
import { Navbar } from './components/Navbar.js';
import { Footer } from './components/Footer.js';
import { StaleDataBanner } from './components/StaleDataBanner.js';
import { HomePage } from './pages/HomePage.js';
import { LiveScoresPage } from './pages/LiveScoresPage.js';
import { FixturesPage } from './pages/FixturesPage.js';
import { ResultsPage } from './pages/ResultsPage.js';
import { CompetitionsPage } from './pages/CompetitionsPage.js';
import { MatchDetailPage } from './pages/MatchDetailPage.js';
import { StandingsPage } from './pages/StandingsPage.js';
import { ScorersPage } from './pages/ScorersPage.js';
import { NewsPage } from './pages/NewsPage.js';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<string>('home');
  const [selectedMatch, setSelectedMatch] = React.useState<Fixture | null>(null);

  const [meta, setMeta] = React.useState<SyncMeta | null>(null);
  const [competitions, setCompetitions] = React.useState<Competition[]>([]);
  const [liveMatches, setLiveMatches] = React.useState<Fixture[]>([]);
  const [todayMatches, setTodayMatches] = React.useState<Fixture[]>([]);
  const [upcomingMatches, setUpcomingMatches] = React.useState<Fixture[]>([]);
  const [resultsMatches, setResultsMatches] = React.useState<Fixture[]>([]);
  const [news, setNews] = React.useState<NewsItem[]>([]);
  const [isRefreshing, setIsRefreshing] = React.useState<boolean>(false);

  const loadAllData = async () => {
    setIsRefreshing(true);
    try {
      const [m, c, l, t, u, r, n] = await Promise.all([
        DataAPI.getMeta(),
        DataAPI.getCompetitions(),
        DataAPI.getLiveFixtures(),
        DataAPI.getTodayFixtures(),
        DataAPI.getUpcomingFixtures(),
        DataAPI.getResultsFixtures(),
        DataAPI.getLatestNews()
      ]);

      setMeta(m);
      setCompetitions(c);
      setLiveMatches(l);
      setTodayMatches(t);
      setUpcomingMatches(u);
      setResultsMatches(r);
      setNews(n);
    } catch (err) {
      console.error('Failed to load initial data:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  React.useEffect(() => {
    loadAllData();
    // Auto-refresh live data every 45 seconds if tab is active
    const timer = setInterval(() => {
      DataAPI.getLiveFixtures().then(setLiveMatches);
      DataAPI.getMeta().then(setMeta);
    }, 45000);
    return () => clearInterval(timer);
  }, []);

  const handleSelectMatch = (match: Fixture) => {
    setSelectedMatch(match);
  };

  const handleBackFromMatch = () => {
    setSelectedMatch(null);
  };

  const handleSelectCompetition = (comp: Competition) => {
    setActiveTab('standings');
  };

  return (
    <div className="min-h-screen flex flex-col bg-broadcast-grid bg-zeta-dark">
      <Navbar
        activeTab={selectedMatch ? 'match-detail' : activeTab}
        setActiveTab={(tab) => {
          setSelectedMatch(null);
          setActiveTab(tab);
        }}
        liveCount={liveMatches.length}
        onRefresh={loadAllData}
        isRefreshing={isRefreshing}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <StaleDataBanner meta={meta} />

        {/* If a match is selected, render the dedicated Match Center */}
        {selectedMatch ? (
          <MatchDetailPage match={selectedMatch} onBack={handleBackFromMatch} />
        ) : (
          <>
            {activeTab === 'home' && (
              <HomePage
                liveMatches={liveMatches}
                todayMatches={todayMatches}
                resultsMatches={resultsMatches}
                news={news}
                competitions={competitions}
                onSelectMatch={handleSelectMatch}
                onNavigate={setActiveTab}
              />
            )}

            {activeTab === 'live' && (
              <LiveScoresPage
                liveMatches={liveMatches}
                onSelectMatch={handleSelectMatch}
              />
            )}

            {activeTab === 'fixtures' && (
              <FixturesPage
                todayMatches={todayMatches}
                upcomingMatches={upcomingMatches}
                competitions={competitions}
                onSelectMatch={handleSelectMatch}
              />
            )}

            {activeTab === 'results' && (
              <ResultsPage
                results={resultsMatches}
                competitions={competitions}
                onSelectMatch={handleSelectMatch}
              />
            )}

            {activeTab === 'competitions' && (
              <CompetitionsPage
                competitions={competitions}
                onSelectCompetition={handleSelectCompetition}
              />
            )}

            {activeTab === 'standings' && (
              <StandingsPage competitions={competitions} />
            )}

            {activeTab === 'scorers' && (
              <ScorersPage competitions={competitions} />
            )}

            {activeTab === 'news' && (
              <NewsPage news={news} />
            )}
          </>
        )}
      </main>

      <Footer meta={meta} />
    </div>
  );
};
