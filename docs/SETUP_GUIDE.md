# ZETA SPORTS — Deployment & Operations Guide

This guide explains how to set up, configure, and maintain the **ZETA SPORTS Autonomous Football Data Platform** using 100% free GitHub infrastructure.

---

## 1. Repository Prerequisites & Settings

### Step 1: Enable GitHub Actions Workflow Write Permissions
GitHub Actions needs permission to commit updated JSON data files back to the repository:

1. Navigate to your repository on GitHub.
2. Go to **Settings** > **Actions** > **General**.
3. Scroll down to **Workflow permissions**.
4. Select **Read and write permissions**.
5. Check the box **Allow GitHub Actions to create and approve pull requests** (optional, recommended).
6. Click **Save**.

### Step 2: Configure GitHub Pages
1. Go to **Settings** > **Pages**.
2. Under **Build and deployment** > **Source**, select **GitHub Actions**.
3. That's it! When `.github/workflows/deploy-pages.yml` runs, it will automatically publish the site to:
   `https://<your-username>.github.io/<repo-name>/`

---

## 2. GitHub Actions Workflows Overview

| Workflow | File | Frequency | What It Synchronizes |
| :--- | :--- | :--- | :--- |
| **Live Scores** | `live-scores.yml` | Every 5 minutes (`*/5 * * * *`) | Active matches, in-play scores, live minute |
| **Daily Fixtures** | `daily-fixtures.yml` | Every 6 hours + midnight | Today's games, upcoming 7 days, results |
| **Match Details** | `match-details.yml` | Every 15 minutes | Lineups, formations, player ratings, stats, events |
| **Standings & Scorers** | `standings.yml` | Every 6 hours | League tables, points, GD, top goalscorers |
| **News Sync** | `news-sync.yml` | Every 30 minutes | Global football news feed |
| **Historical Sync** | `historical-sync.yml` | Daily at 01:00 UTC | Archived results retention |
| **Deploy Website** | `deploy-pages.yml` | Push to `main` (`data/` or `frontend/`) | Builds Vite app and deploys to GitHub Pages |

---

## 3. Manual Workflow Dispatch (Testing & On-Demand Refresh)

You can trigger any workflow on-demand without waiting for scheduled crons:

1. In GitHub, go to the **Actions** tab.
2. Select any workflow on the left (e.g., **Daily Fixtures Sync** or **Live Scores Sync**).
3. Click the **Run workflow** dropdown on the right.
4. Select branch `main` and click **Run workflow**.

---

## 4. Local Development

### Prerequisites
- Node.js 18+ or 20+ installed.

### Run Local Data Pipeline
```bash
cd data-pipeline
npm install

# Run individual syncs:
npm run sync:fixtures   # Updates data/fixtures/ and data/competitions.json
npm run sync:live       # Updates data/fixtures/live.json
npm run sync:standings  # Updates data/matches/standings/ and scorers/
npm run sync:details    # Updates data/matches/lineups/, statistics/, events/
npm run sync:news       # Updates data/news/latest.json

# Or run the master sync:
npm run sync:all
```

### Run Frontend Locally
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser. The app will immediately load data from the root `data/` directory.

### Build Frontend
```bash
cd frontend
npm run build
```
This produces `frontend/dist/` with the production bundle and an embedded copy of `dist/data/`.

---

## 5. Troubleshooting & FAQ

### Q: Why didn't a scheduled GitHub Action run at the exact minute?
> GitHub Actions schedules operate on best-effort execution for free accounts. During peak hours, GitHub may delay crons by 5–15 minutes. The frontend handles this by displaying a clean timestamp and a stale-data notice only if data is over 60 minutes old. You can always click **Run workflow** to force an immediate refresh.

### Q: Does this consume private repository Action minutes?
> On public GitHub repositories, GitHub Actions minutes are **100% free and unlimited**. On private repositories, GitHub Free accounts receive **2,000 free minutes per month**. Because our sync scripts are highly optimized to finish in 15–30 seconds, a full month of live sync uses well under 500 minutes.

### Q: What happens if an API endpoint is temporarily down?
> The `FotMobAdapter` includes automated exponential backoff with retry mechanisms and rate-limit detection (HTTP 429). If an endpoint fails, the workflow logs a warning and exits cleanly without corrupting existing JSON files on disk.
