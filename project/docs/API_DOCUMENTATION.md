# API Documentation & Integration Guide

**Gateway:** Supabase PostgREST & Edge Functions  
**Base URL:** `https://udlncusvhmydivtjkjcy.supabase.co/rest/v1/`  
**Author:** Senior Backend Developer  
**Version:** 3.6.0  

---

## 1. Authentication & Security Headers

All client API requests include the public anon key for read-only query authorization:

```http
apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

---

## 2. Core Endpoints

### 1. Fetch Today Fixtures
Retrieves matches scheduled for today or currently live:
```http
GET /matches?order=kickoff_time.asc&limit=50
```
**Response Format (200 OK):**
```json
[
  {
    "id": "15366038-b321-4e06-a42c-90712b422692",
    "home_name": "Al Mokawloon Al Arab",
    "away_name": "WE SC",
    "home_score": 1,
    "away_score": 0,
    "is_live": true,
    "kickoff_time": "2026-11-10T13:30:00Z",
    "league_name": "Egyptian Second Division A",
    "home_logo": "https://...",
    "away_logo": "https://..."
  }
]
```

### 2. Fetch Match Details & Sub-Tables
```http
GET /matches?id=eq.{MATCH_ID}&select=*,stream_servers(*),match_events(*),match_lineups(*)
```

### 3. Fetch Global Configuration & SEO Settings
```http
GET /zeta_config?id=eq.global&select=*
```
**Response Format (200 OK):**
```json
[
  {
    "id": "global",
    "site_title": "ZetaSports — Live Football Scores, Fixtures & HD Streams",
    "meta_description": "Watch live football scores, fixtures, lineups, H2H statistics, and HD streams on ZetaSports.",
    "seo_keywords": "Live Football, Today Matches, ZetaSports, KeralaHub, Premier League, Champions League, FotMob Scores",
    "announcement_banner": "📢 HD Live Broadcasts active for today fixtures!",
    "telegram_enabled": true,
    "telegram_url": "https://t.me/zetasports_official"
  }
]
```

---

## 3. Real-Time FotMob Synchronization Daemon

The background sync daemon continuously polls FotMob live endpoints and updates match statuses, live scores, and minute tickers:
```powershell
node scripts/start_live_updater_daemon.mjs
```
- Polling cadence: Every 25 seconds for live matches, every 5 minutes for scheduled fixtures.
- Score reconciliation: Dual-verified via FotMob match detail payloads.
