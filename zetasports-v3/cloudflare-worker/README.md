# ZetaSports v3 - 24/7 Cloudflare Worker Telemetry Engine

Runs **100% Free** on Cloudflare Workers edge network with **10-second sub-minute polling**!
- **Zero Credit Card Required**
- **Immune to IP Bans** (FotMob uses Cloudflare edge)
- **100,000 Free Requests/Day**
- **Integrated with ZetaSports Enterprise Database (`udlncusvhmydivtjkjcy`)**

---

## 🚀 Quick Deployment (In Browser - Takes 60 Seconds)

### Step 1: Create a Free Cloudflare Worker
1. Log into your Cloudflare account at 👉 **[dash.cloudflare.com](https://dash.cloudflare.com/)**
2. In the left sidebar, click **Workers & Pages** $\rightarrow$ Click **Create Application** $\rightarrow$ **Create Worker**.
3. Name it `zetasports-live-worker` and click **Deploy**.

### Step 2: Paste the Code
1. Click **Edit code** in the top right.
2. Select all and paste the entire contents of **[`worker.js`](worker.js)**.
3. Click **Deploy** in the top right.

### Step 3: Add the Cron Schedules
1. Go back to your Worker's main page $\rightarrow$ Click **Settings** tab $\rightarrow$ **Triggers**.
2. Scroll to **Cron Triggers** $\rightarrow$ Click **Add Cron Trigger**.
3. Add two cron triggers:
   - `* * * * *` (Every minute - live match 10-second sub-minute poller)
   - `5 0 * * *` (00:05 UTC - daily 4-day sliding window fixture ingestion)

### Step 4: Add Environment Secrets
1. In the Worker's **Settings** tab $\rightarrow$ Click **Variables and Secrets**.
2. Add:
   - `SUPABASE_URL`: `https://udlncusvhmydivtjkjcy.supabase.co`
   - `SUPABASE_KEY`: `sb_publishable_VXZvAq86GvVgqY-c23gwmQ_RtuTSlWF`
   - `SUPABASE_SERVICE_KEY`: *(Your Supabase Service Role secret key for writing live match updates)*
3. Click **Deploy**.

Done! Your 24/7 serverless engine is live and updating scores every 10 seconds with zero downtime!

---

## 🎨 Edge Matchday Poster & Canvas Engine

The worker includes an **in-memory 16:9 Vector Poster Engine** that generates dynamic broadcast graphics directly at the edge:

- **Dynamic URL:** `https://zetasports-live-worker.<your-subdomain>.workers.dev/api/poster?matchId=<supabase-match-id>`
- **Direct Parameters:** `https://zetasports-live-worker.<your-subdomain>.workers.dev/api/poster?home=Arsenal&away=Chelsea&league=Premier%20League&status=live&timeElapsed=45%27&homeScore=1&awayScore=0`

### Poster Features:
- Official ZetaSports electric blue shield (`#0062b2`) and network typography
- High-res FotMob team crests
- Dynamic states:
  - **Upcoming:** Glowing central `VS` emblem with `STARTING XI • HD STREAM`
  - **Live In-Play:** Red pulsing badge with minute (e.g., `LIVE 67'`) and score
  - **Full Time:** Emerald `FULL TIME` card with final scoreline

---

## 💻 Alternative: Deploy via Wrangler CLI

```bash
cd zetasports-v3/cloudflare-worker
npx wrangler login
npx wrangler secret put SUPABASE_SERVICE_KEY
npx wrangler deploy
```
