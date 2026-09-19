# ZETA SPORTS — API Quota, Rate Limits & Budget Plan

This document details the request budget, execution times, and zero-cost resource architecture for the ZETA SPORTS platform.

---

## 1. Zero Infrastructure Budget Guarantee

| Resource | Service | Monthly Cost | Allocation |
| :--- | :--- | :--- | :--- |
| **Automation & Cron** | GitHub Actions | **$0.00** | Unlimited for Public repos (or 2,000 mins/mo for private) |
| **Data Storage** | Git Repository (`data/`) | **$0.00** | Git LFS not required; compressed JSON files (< 15 MB total) |
| **Web Hosting** | GitHub Pages | **$0.00** | 100 GB bandwidth / month; SSL included |
| **Football API** | FotMob Public Endpoints | **$0.00** | Public Next.js endpoints; no credit card or paid tier |
| **Database / VPS** | None Required | **$0.00** | Pure serverless, static file architecture |

---

## 2. API Request Budget Analysis

FotMob provides public Next.js data endpoints (`/_next/data/...`) and API gateways used by their web app. To remain a polite consumer and avoid rate limiting (HTTP 429), our synchronization scripts incorporate:
1. **Polite Request Delays**: 250ms–500ms delay between consecutive league requests.
2. **Rotating User-Agents**: Mimics modern desktop browsers.
3. **Atomic File Writes**: Prevents partial file writes if an execution is interrupted.
4. **Targeted Caching**: Syncs only live/active leagues during the 5-minute schedule.

### Daily Request Breakdown

| Workflow | Frequency | Calls per Run | Daily Calls |
| :--- | :--- | :--- | :--- |
| `live-scores.yml` | Every 5 min during active periods | 10 (top leagues overview) | ~120 – 180 |
| `daily-fixtures.yml` | Every 6 hours (4x/day) | 24 (competitions) | 96 |
| `match-details.yml` | Every 15 min during matchday | ~15 (live/recent games) | ~90 – 150 |
| `standings.yml` | Every 6 hours (4x/day) | 24 (standings + scorers) | 96 |
| `news-sync.yml` | Every 30 min (48x/day) | 1 (world news) | 48 |
| `historical-sync.yml`| Once daily (1x/day) | 0 (local maintenance) | 0 |
| **Total Daily Requests** | | | **~450 – 570 requests/day** |

> **Verdict**: Under 600 total requests per day across 24 hours averages to **less than 1 request every 2 minutes**. This is exceptionally low volume and easily sustained by any web infrastructure without risk of blacklisting.

---

## 3. GitHub Actions Runtime Budget (For Private Repositories)

For private GitHub repositories subject to the 2,000 minutes/month free quota:

- **Live sync run duration**: ~15 seconds = 0.25 min
- **Fixtures sync run duration**: ~30 seconds = 0.50 min
- **Match details run duration**: ~20 seconds = 0.33 min
- **Standings sync run duration**: ~30 seconds = 0.50 min
- **News sync run duration**: ~10 seconds = 0.16 min

With selective scheduling (or on a public repository where minutes are 100% free and unlimited), total consumption remains well below 400 runner minutes per month.

---

## 4. Provider Swapping (`IFootballDataProvider`)

The data pipeline uses a clean provider adapter pattern:

```typescript
// src/adapters/provider.interface.ts
export interface IFootballDataProvider {
  getCompetitions(): Promise<Competition[]>;
  getCompetitionFixtures(competitionId: string): Promise<Fixture[]>;
  getLiveScores(): Promise<Fixture[]>;
  getMatchLineups(matchId: string): Promise<MatchLineups | null>;
  getMatchStatistics(matchId: string): Promise<MatchStatistics | null>;
  getMatchEvents(matchId: string): Promise<MatchEventsData | null>;
  getStandings(competitionId: string): Promise<CompetitionStandings | null>;
  getTopScorers(competitionId: string): Promise<CompetitionScorers | null>;
  getNews(): Promise<NewsItem[]>;
}
```

To switch from FotMob to another provider (e.g. `football-data.org`, `API-Football`, or a custom backend):
1. Create `src/adapters/custom.adapter.ts` implementing `IFootballDataProvider`.
2. In `src/sync/*.ts`, swap `new FotMobAdapter()` with `new CustomAdapter()`.
3. The frontend and public JSON schema will remain 100% identical without requiring any changes.
