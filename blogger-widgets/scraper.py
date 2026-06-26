"""
ZetaSports Scraper – ESPN primary, FotMob fallback
Runs every 5 min via GitHub Actions to update matches.json with live scores.
"""

import urllib.request
import urllib.error
import json
import datetime
import os
import re

JSON_OUTPUT_PATH = 'blogger-widgets/matches.json'

# ── ESPN league slug map ───────────────────────────────────────────────────────
# Keys are lowercase substrings of the league name entered in the admin panel
ESPN_SLUGS = {
    'world cup':          'fifa.world',
    'fifa world cup':     'fifa.world',
    'premier league':     'eng.1',
    'la liga':            'esp.1',
    'champions league':   'uefa.champions',
    'europa league':      'uefa.europa',
    'serie a':            'ita.1',
    'bundesliga':         'ger.1',
    'ligue 1':            'fra.1',
    'eredivisie':         'ned.1',
    'pro league':         'uae.league',
    'saudi league':       'sau.1',
    'mls':                'usa.1',
    'copa america':       'conmebol.america',
    'euro':               'uefa.euro',
    'nations league':     'uefa.nations',
    'carabao':            'eng.league_cup',
    'fa cup':             'eng.fa',
}

def http_get(url, timeout=20):
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                          'AppleWebKit/537.36 (KHTML, like Gecko) '
                          'Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/html, */*',
            'Accept-Language': 'en-US,en;q=0.9',
        })
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read().decode('utf-8', errors='ignore')
    except Exception as e:
        print(f"  HTTP error [{url[:70]}]: {e}")
        return None

def clean(name):
    if not name:
        return ''
    return re.sub(r'[^a-z0-9]', '', name.lower()
                  .replace('&amp;', '&').replace('&', 'and')
                  .replace('côte', 'cote').replace('é', 'e')
                  .replace('ü', 'u').replace('ö', 'o').replace('ä', 'a'))

def names_match(a, b):
    ca, cb = clean(a), clean(b)
    if ca == cb:
        return True
    # Partial match for very short vs long names (e.g. "USA" vs "United States")
    if len(ca) >= 3 and len(cb) >= 3:
        if ca in cb or cb in ca:
            return True
    return False

def match_found(admin_home, admin_away, feed_home, feed_away):
    return (names_match(admin_home, feed_home) and names_match(admin_away, feed_away)) or \
           (names_match(admin_home, feed_away) and names_match(admin_away, feed_home))

def fmt_clock(clock_str, detail=''):
    """
    Convert ESPN clock to display string.
    detail = 'HT' | 'FT' | 'ET' | 'PEN' | '' etc.
    """
    special = {'HT', 'ET', 'PEN', 'AET', 'P', 'PSO'}
    if detail and detail.upper() in special:
        return detail.upper()
    if not clock_str:
        return ''
    # ESPN returns '45:00', '90:00', '45+5:00' etc — grab leading integer
    m = re.match(r'^(\d+)', clock_str.strip())
    if m:
        return m.group(1) + "'"
    return clock_str

# ── ESPN scoreboard ────────────────────────────────────────────────────────────

def get_espn_slug(league_name):
    key = league_name.lower().strip()
    for pattern, slug in ESPN_SLUGS.items():
        if pattern in key or key in pattern:
            return slug
    return None

def fetch_espn_all_matches(slug, dates_str):
    """
    Fetch ALL matches for a given slug and date from ESPN.
    Tries both the scoreboard (live matches) and the schedule (all matches).
    Returns a deduplicated list of normalised match dicts.
    """
    results = {}   # event_id → dict, for deduplication

    # Try 1: scoreboard (best for live matches, but selective)
    sb_url = f"https://site.api.espn.com/apis/site/v2/sports/soccer/{slug}/scoreboard?dates={dates_str}&limit=100"
    print(f"    ESPN scoreboard → {sb_url}")
    for match in _parse_espn_events(sb_url):
        results[match.get('_event_id', match['home_name'] + match['away_name'])] = match

    # Try 2: schedule (returns ALL events for the day, including finished)
    sc_url = f"https://site.api.espn.com/apis/site/v2/sports/soccer/{slug}/schedule?dates={dates_str}"
    print(f"    ESPN schedule   → {sc_url}")
    for match in _parse_espn_events(sc_url):
        key = match.get('_event_id', match['home_name'] + match['away_name'])
        if key not in results:    # scoreboard data takes priority (fresher)
            results[key] = match

    print(f"    Got {len(results)} unique events for {slug} / {dates_str}.")
    return list(results.values())

def _parse_espn_events(url):
    """Parse ESPN scoreboard or schedule URL → list of normalised match dicts."""
    content = http_get(url)
    if not content:
        return []
    try:
        data = json.loads(content)
    except Exception as e:
        print(f"    ESPN JSON error [{url[:60]}]: {e}")
        return []

    # Both scoreboard and schedule put events at 'events' key
    events = data.get('events', [])
    results = []
    for event in events:
        comps = event.get('competitions', [])
        if not comps:
            continue
        comp = comps[0]
        competitors = comp.get('competitors', [])
        home = next((c for c in competitors if c.get('homeAway') == 'home'), {})
        away = next((c for c in competitors if c.get('homeAway') == 'away'), {})

        status      = event.get('status', {})
        stype       = status.get('type', {})
        state       = stype.get('state', '')          # 'pre','in','post'
        is_live     = state == 'in'
        is_finished = stype.get('completed', False)

        home_score = str(home.get('score', '0') or '0')
        away_score = str(away.get('score', '0') or '0')

        live_min = ''
        if is_live:
            detail = stype.get('shortDetail', '') or stype.get('detail', '')
            live_min = fmt_clock(status.get('displayClock', ''), detail)

        home_name = home.get('team', {}).get('displayName', '')
        away_name = away.get('team', {}).get('displayName', '')

        results.append({
            'home_name':   home_name,
            'away_name':   away_name,
            'home_score':  home_score,
            'away_score':  away_score,
            'is_live':     is_live,
            'is_finished': is_finished,
            'live_minute': live_min,
        })

    print(f"    Got {len(results)} events from ESPN.")
    return results

# ── FotMob fallback ────────────────────────────────────────────────────────────

def fetch_fotmob_by_date(date_str):
    url = f"https://www.fotmob.com/api/matches?date={date_str}"
    print(f"    FotMob → {url}")
    content = http_get(url)
    if not content:
        return []
    try:
        data = json.loads(content)
        rows = []
        for league in data.get('leagues', []):
            for m in league.get('matches', []):
                rows.append(m)
        print(f"    Got {len(rows)} FotMob events.")
        return rows
    except Exception as e:
        print(f"    FotMob JSON error: {e}")
        return []

def parse_fotmob(sm):
    status = sm.get('status', {})
    is_started  = bool(status.get('started', False))
    is_finished = bool(status.get('finished', False))
    is_cancelled= bool(status.get('cancelled', False))
    is_live = is_started and not is_finished and not is_cancelled

    home_score, away_score = '0', '0'
    score_str = status.get('scoreStr', '')
    if score_str and ' - ' in score_str:
        parts = score_str.split(' - ')
        if len(parts) == 2:
            home_score, away_score = parts[0].strip(), parts[1].strip()

    lt = status.get('liveTime', {})
    live_min = ''
    if isinstance(lt, dict):
        live_min = lt.get('short', '') or lt.get('long', '')
    if live_min and not live_min.endswith("'"):
        live_min = live_min + "'"

    home_name = (sm.get('home') or sm.get('homeTeam') or {}).get('name', '')
    away_name = (sm.get('away') or sm.get('awayTeam') or {}).get('name', '')
    home_id   = (sm.get('home') or sm.get('homeTeam') or {}).get('id')
    away_id   = (sm.get('away') or sm.get('awayTeam') or {}).get('id')

    return {
        'home_name':   home_name,
        'away_name':   away_name,
        'home_score':  home_score,
        'away_score':  away_score,
        'is_live':     is_live,
        'is_finished': is_finished,
        'live_minute': live_min,
        'home_id':     home_id,
        'away_id':     away_id,
    }

# ── Date helpers ───────────────────────────────────────────────────────────────

def date_keys_for_iso(iso_str):
    """Return YYYYMMDD strings for the match date ±1 day (UTC safety margin)."""
    keys = set()
    try:
        dt_str = re.sub(r'([+-]\d{2}:\d{2}|Z)$', '', iso_str).split('.')[0]
        dt = datetime.datetime.fromisoformat(dt_str)
        for delta in [-1, 0, 1]:
            keys.add((dt + datetime.timedelta(days=delta)).strftime('%Y%m%d'))
    except Exception:
        pass
    return keys

# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    now_utc = datetime.datetime.now(datetime.timezone.utc)

    # 1. Load existing admin-selected matches
    existing_matches = []
    if os.path.exists(JSON_OUTPUT_PATH):
        try:
            with open(JSON_OUTPUT_PATH, 'r', encoding='utf-8') as f:
                old_data = json.load(f)
            existing_matches = old_data.get('matches', [])
            print(f"Loaded {len(existing_matches)} existing matches.")
        except Exception as e:
            print(f"Error loading existing matches: {e}")

    if not existing_matches:
        print("No matches in JSON. Nothing to update.")
        return

    # 2. Collect all unique league slugs needed
    league_slugs_needed = set()
    for em in existing_matches:
        slug = get_espn_slug(em.get('league', ''))
        if slug:
            league_slugs_needed.add(slug)

    # 3. Fetch ESPN data (keyed by home+away name)
    espn_pool = []   # list of normalised dicts
    for slug in league_slugs_needed:
        # Fetch today AND yesterday/tomorrow to cover late-night games crossing UTC midnight
        for delta in [0, -1, 1]:
            d = (now_utc + datetime.timedelta(days=delta)).strftime('%Y%m%d')
            print(f"\nFetching ESPN [{slug}] for date {d}...")
            espn_pool.extend(fetch_espn_all_matches(slug, d))

    # 4. Fetch FotMob data for needed dates
    dates_needed = set()
    for em in existing_matches:
        dates_needed.update(date_keys_for_iso(em.get('date', '')))
    for d in [-1, 0, 1]:
        dates_needed.add((now_utc + datetime.timedelta(days=d)).strftime('%Y%m%d'))

    fotmob_raw = []
    print(f"\nFetching FotMob for dates: {sorted(dates_needed)}")
    for ds in sorted(dates_needed):
        fotmob_raw.extend(fetch_fotmob_by_date(ds))

    fotmob_pool = [parse_fotmob(sm) for sm in fotmob_raw]

    # 5. Update each match
    print(f"\n── Updating {len(existing_matches)} matches ──")
    updated_matches = []
    for em in existing_matches:
        home_name = em.get('home_team', '')
        away_name = em.get('away_team', '')
        print(f"\n  {home_name} vs {away_name}")

        updated = False

        # Try ESPN first
        for feed in espn_pool:
            if match_found(home_name, away_name, feed['home_name'], feed['away_name']):
                em['home_score']  = feed['home_score']
                em['away_score']  = feed['away_score']
                em['is_live']     = feed['is_live']
                em['is_finished'] = feed['is_finished']
                em['live_minute'] = feed['live_minute']
                print(f"    ✓ ESPN: {feed['home_score']}-{feed['away_score']} live={feed['is_live']} min='{feed['live_minute']}'")
                updated = True
                break

        # FotMob fallback
        if not updated:
            for feed in fotmob_pool:
                if match_found(home_name, away_name, feed['home_name'], feed['away_name']):
                    em['home_score']  = feed['home_score']
                    em['away_score']  = feed['away_score']
                    em['is_live']     = feed['is_live']
                    em['is_finished'] = feed['is_finished']
                    em['live_minute'] = feed['live_minute']
                    # Update logos if missing
                    if feed.get('home_id') and not em.get('home_logo'):
                        em['home_logo'] = f"https://images.fotmob.com/image_resources/logo/teamlogo/{feed['home_id']}_small.png"
                    if feed.get('away_id') and not em.get('away_logo'):
                        em['away_logo'] = f"https://images.fotmob.com/image_resources/logo/teamlogo/{feed['away_id']}_small.png"
                    print(f"    ✓ FotMob: {feed['home_score']}-{feed['away_score']} live={feed['is_live']} min='{feed['live_minute']}'")
                    updated = True
                    break

        if not updated:
            print(f"    ✗ Not found in any source — keeping existing data.")

        updated_matches.append(em)

    # 6. Save
    output = {
        "success": True,
        "matches": updated_matches,
        "last_updated": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }
    os.makedirs(os.path.dirname(JSON_OUTPUT_PATH), exist_ok=True)
    with open(JSON_OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    print(f"\nSaved {len(updated_matches)} matches → {JSON_OUTPUT_PATH}")

if __name__ == '__main__':
    main()
