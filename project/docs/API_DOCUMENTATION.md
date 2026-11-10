# API Documentation & Integration Specification

**Gateway:** Supabase PostgREST & FotMob Telemetry Proxy  
**Base REST URL:** `https://udlncusvhmydivtjkjcy.supabase.co/rest/v1/`  
**Author:** Senior Database Engineer & API Specialist  
**Version:** 4.0.0 (Production Master)  
**Status:** Approved & Enforced  

---

## 1. Overview & Authentication

ZetaSports utilizes a hybrid API architecture consisting of:
1. **Supabase PostgREST Data Layer:** Provides ultra-fast declarative querying over PostgreSQL tables for matches, leagues, teams, stream links, and global configuration.
2. **FotMob Live Ingestion & Telemetry Proxy:** Delivers real-time scores, clock minutes, player ratings, tactical pitch lineups, and attack momentum.
3. **Cross-Domain Stream Dispatcher:** Orchestrates live streaming servers (Server 1 HD, Server 2 Backup, Server 3 Sandboxed Embed) between the Details Domain (`keralahub.online`) and the Player Gateway (`zetasports.site`).

### 1.1. Security Headers & Client Token Discipline

All client-side requests from the browser must include the public `anon` publishable key:

```http
apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkbG5jdXN2aG15ZGl2dGpramN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4MTE2MDgsImV4cCI6MjEwOTM4NzYwOH0.gsnxlDww-fUC4HG7R7VasXSaQvqkSsDhhmf16KUCLZY
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkbG5jdXN2aG15ZGl2dGpramN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4MTE2MDgsImV4cCI6MjEwOTM4NzYwOH0.gsnxlDww-fUC4HG7R7VasXSaQvqkSsDhhmf16KUCLZY
Content-Type: application/json
Accept: application/json
```

> **CRITICAL SECURITY REQUIREMENT (OWASP A01 / Least Privilege):**  
> The `service_role` secret key must **NEVER** be embedded in web frontend templates, CSS files, Blogger XML configurations, or client-side JavaScript. It is strictly reserved for automated serverless crawlers and backend ingestion daemons running in secure environments.

---

## 2. Supabase PostgREST Endpoints Reference

### 2.1. Matches (`/rest/v1/matches` & `/rest/v1/zeta_matches`)

#### A. Fetch Today Fixtures (Default Feed)
Retrieves fixtures scheduled for the current UTC day or currently in play, sorted chronologically.

- **Method:** `GET`
- **URL:** `/rest/v1/matches`
- **Query Parameters:**
  - `select`: `*`
  - `is_approved`: `eq.true`
  - `match_time`: `gte.2026-11-10T00:00:00Z&lte.2026-11-10T23:59:59Z`
  - `order`: `match_time.asc`
  - `limit`: `50`
- **Sample Request:**
  ```http
  GET /rest/v1/matches?is_approved=eq.true&match_time=gte.2026-11-10T00:00:00Z&match_time=lte.2026-11-10T23:59:59Z&order=match_time.asc&limit=50 HTTP/1.1
  Host: udlncusvhmydivtjkjcy.supabase.co
  apikey: eyJhbGciOiJIUzI1...
  Authorization: Bearer eyJhbGciOiJIUzI1...
  ```
- **Response (200 OK):**
  ```json
  [
    {
      "id": "15366038-b321-4e06-a42c-90712b422692",
      "fotmob_id": "4421980",
      "league_id": "8a72b0c1-3f41-4e89-9b90-1c5e6720f121",
      "home_team": "Al Mokawloon Al Arab",
      "away_team": "WE SC",
      "home_logo": "https://images.fotmob.com/image_resources/logo/teamlogo/10234.png",
      "away_logo": "https://images.fotmob.com/image_resources/logo/teamlogo/10289.png",
      "home_score": 1,
      "away_score": 0,
      "status": "1H",
      "is_live": true,
      "match_time": "2026-11-10T13:30:00Z",
      "minute": "34",
      "period": "First Half",
      "venue": "Arab Contractors Stadium, Cairo",
      "referee": "Mahmoud Ashour",
      "round": "Matchweek 12",
      "viewers": 1420,
      "article_url": "https://www.keralahub.online/al-mokawloon-al-arab-vs-we-sc-15366038-b321-4e06-a42c-90712b422692",
      "thumbnail_url": "https://udlncusvhmydivtjkjcy.supabase.co/storage/v1/object/public/match-thumbnails/15366038.png",
      "match_stats": {
        "possession": [58, 42],
        "xg": [1.14, 0.38],
        "shots": [8, 3]
      },
      "is_approved": true,
      "is_featured": false
    }
  ]
  ```

#### B. Fetch Single Match with Nested Lineups & Streams (Relational Embed)
Performs an atomic query joining the match with its tactical lineup and active stream servers.

- **Method:** `GET`
- **URL:** `/rest/v1/matches`
- **Query Parameters:**
  - `id`: `eq.15366038-b321-4e06-a42c-90712b422692`
  - `select`: `*,match_lineups(*),stream_links(*)`
- **Sample Request:**
  ```http
  GET /rest/v1/matches?id=eq.15366038-b321-4e06-a42c-90712b422692&select=*,match_lineups(*),stream_links(*) HTTP/1.1
  Host: udlncusvhmydivtjkjcy.supabase.co
  apikey: eyJhbGciOiJIUzI1...
  Authorization: Bearer eyJhbGciOiJIUzI1...
  ```
- **Response (200 OK):**
  ```json
  [
    {
      "id": "15366038-b321-4e06-a42c-90712b422692",
      "home_team": "Al Mokawloon Al Arab",
      "away_team": "WE SC",
      "home_score": 1,
      "away_score": 0,
      "status": "1H",
      "is_live": true,
      "match_lineups": [
        {
          "home_formation": "4-3-3",
          "away_formation": "4-2-3-1",
          "home_coach": "Shawky Gharieb",
          "away_coach": "Gomaa Mashhoor",
          "starting_xi_home": [
            { "name": "M. Abou El-Saoud", "pos": "GK", "rating": "7.2", "x": 50, "y": 92 },
            { "name": "A. Kabore", "pos": "DEF", "rating": "7.5", "x": 38, "y": 80 }
          ],
          "pitch_coordinates": { "home": [], "away": [] }
        }
      ],
      "stream_links": [
        {
          "id": "98e4f1a2-...",
          "quality": "1080p",
          "language": "Arabic",
          "stream_url": "https://live.zetasports.site/hls/mokawloon_wesc_1080p.m3u8",
          "priority": 1,
          "is_active": true
        }
      ]
    }
  ]
  ```

#### C. Real-Time Viewer Count Telemetry Update
Allows anonymous clients to increment viewer engagement count.

- **Method:** `PATCH`
- **URL:** `/rest/v1/matches?id=eq.{id}`
- **Headers:** `Prefer: return=minimal`
- **Body:**
  ```json
  {
    "viewers": 1421
  }
  ```
- **Response:** `204 No Content`

---

### 2.2. Leagues (`/rest/v1/leagues` & `/rest/v1/zeta_leagues`)

Retrieves active competitions for the horizontal category filter bar.

- **Method:** `GET`
- **URL:** `/rest/v1/leagues?is_active=eq.true&order=priority.asc`
- **Response (200 OK):**
  ```json
  [
    {
      "id": "8a72b0c1-3f41-4e89-9b90-1c5e6720f121",
      "name": "Premier League",
      "slug": "premier-league",
      "country": "England",
      "logo_url": "https://images.fotmob.com/image_resources/logo/leaguelogo/47.png",
      "priority": 1,
      "is_active": true
    },
    {
      "id": "7b83c1d2-4e52-4f90-8c01-2d6f7831a232",
      "name": "UEFA Champions League",
      "slug": "champions-league",
      "country": "Europe",
      "logo_url": "https://images.fotmob.com/image_resources/logo/leaguelogo/42.png",
      "priority": 2,
      "is_active": true
    }
  ]
  ```

---

### 2.3. Stream Links & Server Selection (`/rest/v1/stream_links`)

Retrieves operational streams for the live player gateway on `zetasports.site`.

- **Method:** `GET`
- **URL:** `/rest/v1/stream_links?match_id=eq.{id}&is_active=eq.true&order=priority.asc`
- **Response (200 OK):**
  ```json
  [
    {
      "id": "3391b120-1a2b-4c3d-8e4f-0123456789ab",
      "match_id": "15366038-b321-4e06-a42c-90712b422692",
      "server_id": "server-1-uuid",
      "stream_url": "https://edge1.zetastreams.com/live/match-15366038/index.m3u8",
      "backup_url": "https://edge2.zetastreams.com/live/match-15366038/index.m3u8",
      "quality": "1080p",
      "language": "English",
      "headers": {
        "Origin": "https://www.zetasports.site",
        "Referer": "https://www.zetasports.site/"
      },
      "priority": 1,
      "is_active": true
    }
  ]
  ```

---

### 2.4. Global Application Configuration (`/rest/v1/zeta_config`)

Dynamic CMS settings controlling Telegram links, SEO headers, and announcements.

- **Method:** `GET`
- **URL:** `/rest/v1/zeta_config?id=eq.global&select=*`
- **Response (200 OK):**
  ```json
  [
    {
      "id": "global",
      "site_title": "ZetaSports — Live Football Scores, Fixtures & HD Streams",
      "meta_description": "Watch live football scores, fixtures, lineups, H2H statistics, and HD streams on ZetaSports.",
      "seo_keywords": "Live Football, Today Matches, ZetaSports, KeralaHub, Premier League, Champions League, FotMob Scores",
      "announcement_banner": "📢 HD Live Broadcasts active for today fixtures!",
      "telegram_enabled": true,
      "telegram_url": "https://t.me/zetasports_official",
      "telegram_title": "📢 Join Our Official Telegram",
      "telegram_message": "Get instant live match streams, backup links, and real-time goal alerts directly on Telegram!",
      "telegram_interval_mins": 5
    }
  ]
  ```

---

## 3. FotMob Live Scores & Match Details Proxy Integration

Due to Cross-Origin Resource Sharing (CORS) enforcement in web browsers, direct requests from `keralahub.online` to `https://www.fotmob.com` are blocked. ZetaSports implements a resilient proxy fallback cascade.

### 3.1. Proxy Architecture & Routing

```
Browser Client (KeralaHub / ZetaSports)
     │
     ├── 1. Primary Proxy: Cloudflare Worker Edge Proxy
     │      URL: https://proxy.zetasports.site/fotmob/matchDetails?matchId={id}
     │      Caching: Cache-Control: public, max-age=15, stale-while-revalidate=45
     │
     └── 2. Secondary Failover Proxy: AllOrigins Raw Gateway
            URL: https://api.allorigins.win/raw?url=https%3A%2F%2Fwww.fotmob.com%2Fapi%2FmatchDetails%3FmatchId%3D{id}
```

### 3.2. Match Details Payload Schema & Extraction Contract

```javascript
/**
 * Transforms raw FotMob matchDetails payload into ZetaSports domain model
 * @param {Object} raw - Upstream FotMob JSON response
 * @returns {Object} Normalized telemetry object
 */
function parseFotMobTelemetry(raw) {
  if (!raw || !raw.header) return null;

  const header = raw.header;
  const status = header.status || {};
  const teams = header.teams || [];

  return {
    homeScore: teams[0]?.score ?? null,
    awayScore: teams[1]?.score ?? null,
    isStarted: Boolean(status.started),
    isFinished: Boolean(status.finished),
    isLive: Boolean(status.started && !status.finished),
    liveMinute: status.liveTime?.short ?? (status.finished ? 'FT' : '0\''),
    period: status.scoreStr ?? '',
    momentum: raw.content?.matchFacts?.momentum ?? [],
    lineups: {
      homeFormation: raw.content?.lineup?.lineup?.[0]?.formation ?? '4-3-3',
      awayFormation: raw.content?.lineup?.lineup?.[1]?.formation ?? '4-2-3-1',
      startersHome: raw.content?.lineup?.lineup?.[0]?.players ?? [],
      startersAway: raw.content?.lineup?.lineup?.[1]?.players ?? [],
      benchHome: raw.content?.lineup?.bench?.[0]?.players ?? [],
      benchAway: raw.content?.lineup?.bench?.[1]?.players ?? []
    }
  };
}
```

---

## 4. Stream Server Contract & Iframe Security

The streaming player on `http://www.zetasports.site/` supports three distinct server engines:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   STREAM PLAYER DISPATCH CONTROLLER                    │
├────────────────────────────────────────────────────────────────────────┤
│  [ Server 1: 1080p HD HLS ]   [ Server 2: 720p Backup ]   [ Server 3 ] │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.1. Server 1: Primary HD HLS Engine (Plyr + Hls.js)
- **Engine Type:** Direct JavaScript MSE video player (`<video id="zetaVideoPlayer">`).
- **URL Format:** `https://cdn1.zetastreams.com/live/{slug}/master.m3u8`
- **Security Requirements:**
  - Token-authenticated query parameter: `?token=exp={ts}~hmac={hash}`
  - Origin verification: Must match `https://www.zetasports.site` or `https://www.keralahub.online`.

### 4.2. Server 2: Low-Latency Failover Engine
- **Engine Type:** Multi-bitrate HLS with fallback MP4 segments.
- **URL Format:** `https://cdn2.zetastreams.com/edge/{slug}/playlist.m3u8`

### 4.3. Server 3: Sandboxed Web Iframe Embed Engine
Used when upstream broadcasters deliver proprietary web players.

- **Iframe URL Structure:**
  ```html
  <iframe 
    id="streamIframe" 
    src="https://embed.partner-stream.com/live.php?matchId=15366038"
    sandbox="allow-scripts allow-same-origin allow-presentation"
    allowfullscreen="true"
    allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
    referrerpolicy="no-referrer"
    frameborder="0"
    style="width: 100%; height: 100%; border: none;">
  </iframe>
  ```

### 4.4. Strict OWASP Iframe Sandbox Enforcement

| Directive | Status | Security Rationale |
| :--- | :--- | :--- |
| `allow-scripts` | **ENABLED** | Required for video player initialization and controls. |
| `allow-same-origin` | **ENABLED** | Required for HLS MSE blob buffers and HTML5 Canvas audio context. |
| `allow-presentation`| **ENABLED** | Allows wireless AirPlay and Google Cast projection. |
| `allow-top-navigation`| ❌ **BLOCKED** | Prevents rogue iframes from hijacking the parent Blogger page. |
| `allow-popups` | ❌ **BLOCKED** | Prevents intrusive ad popups and casino spam windows. |
| `allow-forms` | ❌ **BLOCKED** | Prevents fake phishing credential forms inside the stream player. |
| `allow-modals` | ❌ **BLOCKED** | Prevents deceptive `alert()` / prompt modal phishing dialogs. |

---

## 5. Client-Side Error Handling & Resilient Retry Engine

To guarantee zero infinite loading skeletons during intermittent network disruptions, all client-side API requests pass through a Jittered Exponential Backoff wrapper.

```javascript
/**
 * Executes a resilient fetch with jittered exponential backoff
 * @param {string} url - Target REST API endpoint
 * @param {Object} options - Standard fetch options
 * @param {number} maxRetries - Maximum retry count (default 3)
 * @param {number} baseDelayMs - Initial delay in milliseconds (default 1000)
 * @returns {Promise<Response>}
 */
async function fetchWithResilientBackoff(url, options = {}, maxRetries = 3, baseDelayMs = 1000) {
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      // Offline fast-bail
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('NETWORK_OFFLINE: Device is currently disconnected from internet.');
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8-second timeout
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);

      // Return immediately on HTTP 2xx
      if (response.ok) {
        return response;
      }

      // Do NOT retry client errors (400, 401, 403, 404)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        throw new Error(`CLIENT_ERROR: HTTP ${response.status} - Not retryable.`);
      }

      // Retryable status: 429 (Rate Limit) or 5xx (Server Error)
      attempt++;
      if (attempt > maxRetries) {
        throw new Error(`HTTP_ERROR: Server returned status ${response.status} after ${maxRetries} attempts.`);
      }

    } catch (err) {
      attempt++;
      if (attempt > maxRetries || err.message.startsWith('CLIENT_ERROR')) {
        throw err;
      }
    }

    // Full Jitter Backoff Formula: sleep = min(maxDelay, base * 2^attempt) + random_jitter
    const exponentialDelay = Math.min(10000, baseDelayMs * Math.pow(2, attempt));
    const jitter = Math.random() * 500;
    const finalSleep = exponentialDelay + jitter;

    console.warn(`[ZetaSports API]: Request to ${url} failed. Retrying attempt ${attempt}/${maxRetries} in ${Math.round(finalSleep)}ms...`);
    await new Promise(resolve => setTimeout(resolve, finalSleep));
  }
}
```

### 5.1. Standard HTTP Status Code Reference

| Status Code | Meaning | Client Behavior |
| :--- | :--- | :--- |
| `200 OK` | Query succeeded with results. | Parse payload, render DOM, clear skeleton loader. |
| `206 Partial Content` | Pagination range served (`Range: 0-49`). | Append batch to infinite scroll container. |
| `304 Not Modified` | Cached ETag matches server state. | Retain current DOM tree; zero re-render overhead. |
| `400 Bad Request` | Malformed PostgREST filter syntax. | Log error to console; display friendly empty state. |
| `401 Unauthorized` | Invalid or expired API key. | Trigger fallback to public mirror credentials. |
| `403 Forbidden` | RLS policy rejection. | Fail safe; hide unapproved or restricted resources. |
| `404 Not Found` | Match ID does not exist in database. | Render "Match Not Found" banner with back-to-home button. |
| `429 Too Many Requests`| PostgREST rate limiter triggered. | Pause requests for `Retry-After` seconds; apply backoff. |
| `502 / 503 / 504` | Supabase Cloud Gateway degradation. | Switch to secondary AllOrigins proxy or local cache. |
