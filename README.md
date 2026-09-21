# ZETA SPORTS — Autonomous Football Data Platform

> **100% Free, Automated Football Data Infrastructure powered by GitHub Actions, Static Public JSON Feeds, and GitHub Pages.**

---

## Overview

**ZETA SPORTS** is a serverless, zero-cost football statistics and live score platform. It eliminates the need for expensive cloud servers, VPS, Firebase, Supabase, or paid sports API subscriptions by utilizing:

1. **GitHub Free & GitHub Actions**: Automated scheduled workflows sync fixtures, live scores, lineups, player statistics, league tables, and global news.
2. **Public JSON Repository Layer (`data/`)**: Version-controlled, static JSON feeds published directly to the repository and served via GitHub Pages.
3. **FotMob Free Data Adapter**: Direct integration with FotMob's public Next.js endpoints with automated build ID discovery, request throttling, and schema validation.
4. **React + Vite + Tailwind Broadcast Frontend (`frontend/`)**: A responsive dark sports broadcast web application with electric blue accents, interactive pitch formations, match timelines, and statistical comparisons.

---

## System Architecture

```
                               ┌────────────────────────────────┐
                               │       FotMob Public API        │
                               │  (Next.js Endpoints & Feeds)   │
                               └───────────────┬────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           GITHUB ACTIONS SCHEDULERS                             │
│                                                                                 │
│   • live-scores.yml   (Every 5m)  ──► Fast In-Play Updates                      │
│   • daily-fixtures.yml(Every 6h)  ──► 24+ Leagues Fixtures & Schedule           │
│   • match-details.yml (Every 15m) ──► Pitch Lineups, Stats & Incident Timelines│
│   • standings.yml     (Every 6h)  ──► Tables, Points & Top Scorers              │
│   • news-sync.yml     (Every 30m) ──► Breaking Football News Feed               │
│   • historical-sync.yml(Daily)    ──► Match Results Archiving                   │
└──────────────────────────────────────┬──────────────────────────────────────────┘
                                       │ (Atomic Validated Commits)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        PUBLIC JSON REPOSITORY DATA STORE                        │
│                                                                                 │
│   data/                                                                         │
│     ├── meta.json                (Last sync timestamps & freshness metrics)     │
│     ├── competitions.json        (24+ tournaments with capability flags)        │
│     ├── fixtures/                                                               │
│     │     ├── today.json         (Today's schedule & in-flight matches)         │
│     │     ├── live.json          (Currently active in-play matches)             │
│     │     ├── upcoming.json      (Next 7 days scheduled games)                 │
│     │     └── results.json       (Completed past matches & scores)              │
│     ├── matches/                                                                │
│     │     ├── standings/         ({compId}.json - League tables & points)       │
│     │     ├── scorers/           ({compId}.json - Top goalscorers & assists)    │
│     │     ├── lineups/           ({matchId}.json - Starting XI, bench & grid)   │
│     │     ├── statistics/        ({matchId}.json - Possession, shots, fouls)    │
│     │     └── events/            ({matchId}.json - Goals, cards, VAR incidents) │
│     └── news/                                                                   │
│           └── latest.json        (Breaking football articles)                   │
└──────────────────────────────────────┬──────────────────────────────────────────┘
                                       │ (Vite Build & Static Deployment)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                       ZETA SPORTS WEB BROADCAST APP                             │
│                       (Hosted on GitHub Pages)                                  │
│                                                                                 │
│   • Home         • Live Scores    • Fixtures       • Results                    │
│   • Competitions • Match Center   • Pitch Lineups  • Head-to-Head Stats         │
│   • Standings    • Top Scorers    • Football News                               │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Tournament Coverage (24+ Competitions)

| ID | Tournament | Category | Country | Standings | Scorers | Lineups | Stats |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| **47** | Premier League | Domestic League | England | Yes | Yes | Yes | Yes |
| **42** | UEFA Champions League | European Cup | Europe | Yes | Yes | Yes | Yes |
| **87** | LaLiga | Domestic League | Spain | Yes | Yes | Yes | Yes |
| **55** | Serie A | Domestic League | Italy | Yes | Yes | Yes | Yes |
| **54** | Bundesliga | Domestic League | Germany | Yes | Yes | Yes | Yes |
| **53** | Ligue 1 | Domestic League | France | Yes | Yes | Yes | Yes |
| **73** | UEFA Europa League | European Cup | Europe | Yes | Yes | Yes | Yes |
| **10216**| UEFA Conference League | European Cup | Europe | Yes | Yes | Yes | Yes |
| **132**| FA Cup | Domestic Cup | England | Cup | Yes | Yes | Yes |
| **133**| Carabao Cup | Domestic Cup | England | Cup | Yes | Yes | Yes |
| **138**| Copa del Rey | Domestic Cup | Spain | Cup | Yes | Yes | Yes |
| **209**| DFB-Pokal | Domestic Cup | Germany | Cup | Yes | Yes | Yes |
| **141**| Coppa Italia | Domestic Cup | Italy | Cup | Yes | Yes | Yes |
| **130**| Major League Soccer (MLS) | Domestic League | USA | Yes | Yes | Yes | Yes |
| **536**| Saudi Pro League | Domestic League | Saudi Arabia | Yes | Yes | Yes | Yes |
| **264**| AFC Champions League | Continental | Asia | Yes | Yes | Yes | Yes |
| **9380**| Indian Super League (ISL) | Domestic League | India | Yes | Yes | Yes | Yes |
| **57** | Eredivisie | Domestic League | Netherlands | Yes | Yes | Yes | Yes |
| **61** | Liga Portugal | Domestic League | Portugal | Yes | Yes | Yes | Yes |
| **268**| Brasileirão Série A | Domestic League | Brazil | Yes | Yes | Yes | Yes |
| **77** | FIFA World Cup | International | Global | Tournament | Yes | Yes | Yes |
| **50** | UEFA EURO | International | Europe | Tournament | Yes | Yes | Yes |
| **44** | Copa América | International | South America | Tournament | Yes | Yes | Yes |
| **100**| Africa Cup of Nations | International | Africa | Tournament | Yes | Yes | Yes |
| **9806**| UEFA Nations League | International | Europe | Yes | Yes | Yes | Yes |

---

## Directory Structure

```
zetasports/
├── .github/
│   └── workflows/
│       ├── live-scores.yml         # 5-min live score sync
│       ├── daily-fixtures.yml      # 6-hour fixtures sync
│       ├── match-details.yml       # 15-min lineups, stats, events sync
│       ├── standings.yml           # 6-hour league tables & scorers sync
│       ├── news-sync.yml           # 30-min news sync
│       ├── historical-sync.yml     # Daily results maintenance
│       └── deploy-pages.yml        # Build & deploy to GitHub Pages
├── data/                           # Public static JSON repository
│   ├── meta.json                   # Sync health & metadata
│   ├── competitions.json           # Tracked competitions catalog
│   ├── fixtures/                   # today, live, upcoming, results
│   ├── matches/                    # standings, scorers, lineups, stats, events
│   └── news/                       # latest.json
├── data-pipeline/                  # TypeScript Data Sync Engine
│   ├── src/
│   │   ├── core/types.ts           # Canonical data models
│   │   ├── config/competitions.ts  # 24+ tournament configurations
│   │   ├── adapters/               # FotMob & IFootballDataProvider
│   │   ├── utils/                  # Atomic storage & validator
│   │   └── sync/                   # Sync CLI scripts
│   ├── package.json
│   └── tsconfig.json
├── frontend/                       # React 18 + Vite + Tailwind Web App
│   ├── src/
│   │   ├── components/             # Navbar, Footer, MatchCard, PitchLineup, StatBar
│   │   ├── pages/                  # Home, Live, Fixtures, Results, Match Center, Standings...
│   │   ├── services/api.ts         # Public JSON client
│   │   └── App.tsx
│   ├── index.html
│   └── vite.config.ts
├── docs/
│   ├── SETUP_GUIDE.md              # Detailed deployment & operations guide
│   └── API_BUDGET.md               # Request quotas & rate limit budget
└── README.md
```

---

## Quick Start (Local Setup)

### 1. Run Data Sync Pipeline
```bash
cd data-pipeline
npm install

# Run full initial data harvest:
npm run sync:all
```

### 2. Launch React Frontend
```bash
cd ../frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the live dashboard.

---

## Enabling GitHub Pages & Automatic Sync

1. Go to your GitHub repository **Settings** > **Actions** > **General** > **Workflow permissions** and select **Read and write permissions**.
2. Go to **Settings** > **Pages** > **Build and deployment** > **Source** and select **GitHub Actions**.
3. Push to `main` or trigger `Deploy ZETA SPORTS to GitHub Pages` from the **Actions** tab.

For complete documentation, see [`docs/SETUP_GUIDE.md`](./docs/SETUP_GUIDE.md) and [`docs/API_BUDGET.md`](./docs/API_BUDGET.md).
