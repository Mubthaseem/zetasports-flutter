# ZetaSports v2 - 24/7 Cloudflare Worker Telemetry Engine

Runs **100% Free** on Cloudflare Workers edge network with **10-second sub-minute polling**!
- **Zero Credit Card Required**
- **Immune to IP Bans** (FotMob uses Cloudflare)
- **100,000 Free Requests/Day**

---

## 🚀 Quick Deployment (In Browser - Takes 60 Seconds)

### Step 1: Create a Free Cloudflare Worker
1. Log into your free Cloudflare account at 👉 **[dash.cloudflare.com](https://dash.cloudflare.com/)**
2. In the left sidebar, click **Workers & Pages** $\rightarrow$ Click **Create Application** $\rightarrow$ **Create Worker**.
3. Name it `zetasports-live-worker` and click **Deploy**.

### Step 2: Paste the Code
1. Click **Edit code** in the top right.
2. Select all and paste the entire contents of **[`worker.js`](worker.js)**.
3. Click **Deploy** in the top right.

### Step 3: Add the Cron Schedule (10-Second Sub-Minute Poller)
1. Go back to your Worker's main page $\rightarrow$ Click **Settings** tab $\rightarrow$ **Triggers**.
2. Scroll to **Cron Triggers** $\rightarrow$ Click **Add Cron Trigger**.
3. Set the Cron to: `* * * * *` (Every minute).
   *(Inside each 1-minute window, the worker automatically loops every 10 seconds to update live match scores).*

### Step 4: Add Environment Secrets
1. In the Worker's **Settings** tab $\rightarrow$ Click **Variables and Secrets**.
2. Add:
   - `SUPABASE_URL`: `https://voocdrpetiyspuhyeapi.supabase.co`
   - `SUPABASE_SERVICE_KEY`: *(Your `sb_secret_...` key)*
3. Click **Deploy**.

Done! Your 24/7 serverless engine is live and updating scores every 10 seconds with zero downtime!

---

## 💻 Alternative: Deploy via Wrangler CLI

```bash
cd cloudflare-worker
npx wrangler login
npx wrangler secret put SUPABASE_SERVICE_KEY
npx wrangler deploy
```
