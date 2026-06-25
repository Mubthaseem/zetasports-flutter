import urllib.request
import json
import datetime
import os
import re
import html

# Configuration
JSON_OUTPUT_PATH = 'blogger-widgets/matches.json'

def parse_utc_to_ist(utc_str):
    try:
        # utc_str e.g., "2026-06-24T19:00:00.000Z" or "2026-06-24T19:00:00Z"
        dt_str = utc_str.replace('Z', '').split('.')[0]
        dt = datetime.datetime.strptime(dt_str, "%Y-%m-%dT%H:%M:%S")
        ist_dt = dt + datetime.timedelta(hours=5, minutes=30)
        
        iso_date = ist_dt.strftime("%Y-%m-%dT%H:%M:%S+05:30")
        
        hours = ist_dt.hour
        ampm = "PM" if hours >= 12 else "AM"
        display_hours = hours % 12
        if display_hours == 0:
            display_hours = 12
        time_str = f"{display_hours:02d}:{ist_dt.minute:02d} {ampm}"
        
        return iso_date, time_str
    except Exception as e:
        print(f"Error parsing date {utc_str}: {e}")
        return utc_str, "12:00 AM"

def clean_team_name(name):
    if not name:
        return ""
    name = name.lower()
    name = name.replace('&amp;', '&').replace('&', 'and')
    name = re.sub(r'[^a-z0-9]', '', name)
    return name

def is_duplicate_match(team_a1, team_a2, team_b1, team_b2):
    a1 = clean_team_name(team_a1)
    a2 = clean_team_name(team_a2)
    b1 = clean_team_name(team_b1)
    b2 = clean_team_name(team_b2)
    return (a1 == b1 and a2 == b2) or (a1 == b2 and a2 == b1)

def fetch_fotmob_fixtures():
    print("Fetching fixtures from fotmob.com...")
    url = "https://www.fotmob.com/leagues/77/fixtures/world-cup"
    try:
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
        )
        with urllib.request.urlopen(req, timeout=15) as response:
            content = response.read().decode('utf-8', errors='ignore')
            
        next_data_regex = re.compile(r'<script\s+id="__NEXT_DATA__"\s+type="application/json">([\s\S]*?)</script>', re.IGNORECASE)
        m = next_data_regex.search(content)
        if not m:
            print("Could not find __NEXT_DATA__ script tag in HTML.")
            return []
            
        data = json.loads(m.group(1).strip())
        fixtures_data = data.get('props', {}).get('pageProps', {}).get('fixtures', {})
        
        all_matches = []
        if isinstance(fixtures_data, dict):
            all_matches = fixtures_data.get('allMatches', [])
        return all_matches
    except Exception as e:
        print(f"Error fetching FotMob matches: {e}")
        return []

def main():
    # 1. Load existing matches
    existing_matches = []
    if os.path.exists(JSON_OUTPUT_PATH):
        try:
            with open(JSON_OUTPUT_PATH, 'r') as f:
                old_data = json.load(f)
                existing_matches = old_data.get('matches', [])
            print(f"Loaded {len(existing_matches)} matches from existing JSON.")
        except Exception as e:
            print(f"Error loading existing matches: {e}")
            
    # 2. Fetch matches from FotMob
    scraped_list = fetch_fotmob_fixtures()
    print(f"Fetched {len(scraped_list)} fixtures from FotMob.")
    
    # 3. Process matches
    processed_scraped_matches = []
    merged_existing_ids = set()
    
    now = datetime.datetime.now(datetime.timezone.utc)
    now_ist = now + datetime.timedelta(hours=5, minutes=30)
    today_ist = now_ist.date()
    
    for match in scraped_list:
        utc_time_str = match.get('status', {}).get('utcTime')
        if not utc_time_str:
            continue
            
        iso_date, time_str = parse_utc_to_ist(utc_time_str)
        
        # Filter: Keep matches within 2 days of today (IST)
        try:
            match_dt = datetime.datetime.strptime(iso_date.split('T')[0], "%Y-%m-%d").date()
            diff_days = (match_dt - today_ist).days
            if not (-2 <= diff_days <= 2):
                continue
        except Exception as e:
            print(f"Error filtering match date: {e}")
            continue
            
        scraped_id = match.get('id')
        hs_id = f"hs_fm_{scraped_id}"
        
        home_name = match.get('home', {}).get('name')
        away_name = match.get('away', {}).get('name')
        print(f"Processing match: {home_name} vs {away_name} ({scraped_id})...")
        
        # Check if there's a matching existing match (by ID or by team names)
        matched_existing = None
        for em in existing_matches:
            em_id = em.get('id', '')
            if em_id == hs_id:
                matched_existing = em
                break
            if not em_id.startswith('hs_'):
                if is_duplicate_match(em.get('home_team'), em.get('away_team'), home_name, away_name):
                    matched_existing = em
                    break
                    
        if matched_existing:
            merged_existing_ids.add(matched_existing['id'])
            print(f"  Matched with existing entry: {matched_existing['id']}")
            
        status = match.get('status', {})
        is_finished = status.get('finished', False)
        is_started = status.get('started', False)
        is_cancelled = status.get('cancelled', False)
        
        is_live = is_started and not is_finished and not is_cancelled
        
        # Extract scores
        score_str = status.get('scoreStr', '')
        if score_str and ' - ' in score_str:
            try:
                home_score, away_score = score_str.split(' - ')
            except Exception:
                home_score, away_score = "0", "0"
        else:
            home_score, away_score = "0", "0"
            
        # FotMob crest URLs
        home_id = match.get('home', {}).get('id')
        away_id = match.get('away', {}).get('id')
        home_logo = f"https://images.fotmob.com/image_resources/logo/teamlogo/{home_id}_small.png" if home_id else "https://i.ibb.co/qF41b08G/HELLO-THUM.png"
        away_logo = f"https://images.fotmob.com/image_resources/logo/teamlogo/{away_id}_small.png" if away_id else "https://i.ibb.co/qF41b08G/HELLO-THUM.png"
        
        # Match watch page link on FotMob as fallback
        page_url = match.get('pageUrl', '')
        fallback_watch_url = f"https://www.fotmob.com{page_url}" if page_url else ""
        
        watch_url = fallback_watch_url
        if matched_existing:
            old_watch_url = matched_existing.get('watch_url', '')
            if old_watch_url and old_watch_url.startswith('http'):
                watch_url = old_watch_url
                print(f"  Preserved custom watch URL: {watch_url}")
                
        # Group name / Round details
        group_name = match.get('group', '')
        round_val = match.get('round', '')
        group_detail = ""
        if group_name:
            group_detail = f"Group {group_name}"
        elif round_val:
            group_detail = f"Round {round_val}"
            
        processed_scraped_matches.append({
            "id": hs_id,
            "sport": "football",
            "home_team": home_name,
            "home_logo": home_logo,
            "away_team": away_name,
            "away_logo": away_logo,
            "time": time_str,
            "date": iso_date,
            "league": "FIFA World Cup",
            "group": group_detail,
            "is_live": is_live,
            "is_finished": is_finished,
            "home_score": home_score.strip(),
            "away_score": away_score.strip(),
            "watch_url": watch_url
        })
        
    # 4. Retain only manual matches that were not merged
    remaining_manual_matches = []
    for em in existing_matches:
        em_id = em.get('id', '')
        if em_id not in merged_existing_ids and not em_id.startswith('hs_'):
            remaining_manual_matches.append(em)
            
    print(f"Retained {len(remaining_manual_matches)} manual matches that do not duplicate scraped ones.")
    
    # 5. Merge remaining manual matches and new scraped matches
    final_matches = remaining_manual_matches + processed_scraped_matches
    
    output_data = {
        "success": True,
        "matches": final_matches,
        "last_updated": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }
    
    # Ensure folder directory exists
    os.makedirs(os.path.dirname(JSON_OUTPUT_PATH), exist_ok=True)
    with open(JSON_OUTPUT_PATH, 'w') as f:
        json.dump(output_data, f, indent=2)
    print(f"Saved {len(final_matches)} total matches to {JSON_OUTPUT_PATH}.")

if __name__ == '__main__':
    main()
