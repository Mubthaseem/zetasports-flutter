import urllib.request
import json
import datetime
import os
import re
import html

# Configuration
JSON_OUTPUT_PATH = 'blogger-widgets/matches.json'

def get_attr(name, attrs_string):
    pattern = rf'data-{name}=["\']([^"\']*)["\']'
    m = re.search(pattern, attrs_string, re.IGNORECASE)
    return m.group(1) if m else ''

def format_display_time(iso_str):
    try:
        # iso_str e.g., "2026-06-25T00:30:00+05:30"
        time_part = iso_str.split('T')[1]
        hours_str, minutes_str = time_part.split(':')[:2]
        hours = int(hours_str)
        ampm = "PM" if hours >= 12 else "AM"
        display_hours = hours % 12
        if display_hours == 0:
            display_hours = 12
        return f"{display_hours:02d}:{minutes_str} {ampm}"
    except Exception:
        return "12:00 AM"

def fetch_hellosports_matches():
    print("Fetching matches from hellosports.live...")
    url = "https://www.hellosports.live/"
    try:
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            content = response.read().decode('utf-8', errors='ignore')
            
        card_regex = re.compile(r"<div\s+class=['\"]msw-card['\"]([\s\S]*?)>", re.IGNORECASE)
        cards = card_regex.findall(content)
        print(f"Found {len(cards)} match cards in HTML.")
        
        matches = []
        for attrs in cards:
            scraped_id = get_attr('id', attrs)
            if not scraped_id:
                continue
                
            home = html.unescape(get_attr('home', attrs))
            home_id = get_attr('home-id', attrs)
            away = html.unescape(get_attr('away', attrs))
            away_id = get_attr('away-id', attrs)
            start = get_attr('start', attrs)
            sport = get_attr('sport', attrs)
            comp_name = html.unescape(get_attr('comp-name', attrs))
            detail = html.unescape(get_attr('detail', attrs))
            watch_url = get_attr('url', attrs)
            
            matches.append({
                "scraped_id": scraped_id,
                "home_team": home,
                "home_id": home_id,
                "away_team": away,
                "away_id": away_id,
                "start": start,
                "sport": sport if sport else "football",
                "league": comp_name,
                "group": detail,
                "url": watch_url
            })
        return matches
    except Exception as e:
        print(f"Error fetching hellosports matches: {e}")
        return []

def fetch_365scores_game(game_id):
    url = f"https://webws.365scores.com/web/game/?gameId={game_id}"
    try:
        req = urllib.request.Request(
            url,
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Origin': 'https://www.365scores.com',
                'Referer': 'https://www.365scores.com/'
            }
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode('utf-8'))
            return data.get('game')
    except Exception as e:
        print(f"Error fetching 365scores game {game_id}: {e}")
        return None

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
            
    # 2. Fetch matches from hellosports.live
    scraped_list = fetch_hellosports_matches()
    
    # 3. Process matches using 365scores API
    processed_scraped_matches = []
    merged_existing_ids = set()
    
    for match in scraped_list:
        scraped_id = match["scraped_id"]
        hs_id = f"hs_{scraped_id}"
        print(f"Processing match: {match['home_team']} vs {match['away_team']} ({scraped_id})...")
        
        # Check if there's a matching existing match (by ID or by team names)
        matched_existing = None
        for em in existing_matches:
            em_id = em.get('id', '')
            if em_id == hs_id:
                matched_existing = em
                break
            # Also check if it's a manual match representing the same fixture
            if not em_id.startswith('hs_'):
                if is_duplicate_match(em.get('home_team'), em.get('away_team'), match['home_team'], match['away_team']):
                    matched_existing = em
                    break
                    
        if matched_existing:
            merged_existing_ids.add(matched_existing['id'])
            print(f"  Matched with existing entry: {matched_existing['id']}")
            
        # Query 365scores API
        game = fetch_365scores_game(scraped_id)
        
        home_score = "0"
        away_score = "0"
        is_live = False
        is_finished = False
        
        if game:
            h_score_val = game.get('homeCompetitor', {}).get('score', -1)
            a_score_val = game.get('awayCompetitor', {}).get('score', -1)
            
            home_score = str(h_score_val) if h_score_val != -1 else "0"
            away_score = str(a_score_val) if a_score_val != -1 else "0"
            
            status_text = game.get('statusText', '').lower()
            status_group = game.get('statusGroup')
            
            if status_text in ['ended', 'finished', 'cancelled', 'postponed', 'aborted']:
                is_finished = True
            elif status_text == 'scheduled':
                is_live = False
                is_finished = False
            else:
                if status_group == 3:
                    is_live = True
                elif status_group == 4:
                    is_finished = True
                else:
                    # Fallback check: if start time is past but status is not ended
                    try:
                        # Use current time comparison
                        now = datetime.datetime.now(datetime.timezone.utc)
                        clean_start = match["start"]
                        if clean_start.endswith('Z'):
                            clean_start = clean_start[:-1] + '+00:00'
                        start_dt = datetime.datetime.fromisoformat(clean_start)
                        if start_dt <= now <= (start_dt + datetime.timedelta(hours=3)):
                            is_live = True
                        elif now > (start_dt + datetime.timedelta(hours=3)):
                            is_finished = True
                    except Exception as te:
                        print(f"Time parsing error fallback: {te}")
        else:
            print(f"No API response for {scraped_id}. Using time-based status fallbacks.")
            try:
                now = datetime.datetime.now(datetime.timezone.utc)
                clean_start = match["start"]
                if clean_start.endswith('Z'):
                    clean_start = clean_start[:-1] + '+00:00'
                start_dt = datetime.datetime.fromisoformat(clean_start)
                if start_dt <= now <= (start_dt + datetime.timedelta(hours=3)):
                    is_live = True
                elif now > (start_dt + datetime.timedelta(hours=3)):
                    is_finished = True
            except Exception as te:
                print(f"Time parsing error: {te}")
                
        # Fallback and Map team logos using 365scores CDN
        home_logo = f"https://widgets.365scores.com/images/teams/width/80/{match['home_id']}.png" if match['home_id'] else "https://i.ibb.co/qF41b08G/HELLO-THUM.png"
        away_logo = f"https://widgets.365scores.com/images/teams/width/80/{match['away_id']}.png" if match['away_id'] else "https://i.ibb.co/qF41b08G/HELLO-THUM.png"
        
        # Preserving customized watch URLs from admin panel manually
        watch_url = match["url"]
        if matched_existing:
            old_watch_url = matched_existing.get('watch_url', '')
            if old_watch_url and old_watch_url.startswith('http'):
                watch_url = old_watch_url
                print(f"  Preserved watch URL: {watch_url}")
                
        processed_scraped_matches.append({
            "id": hs_id,
            "sport": match["sport"],
            "home_team": match["home_team"],
            "home_logo": home_logo,
            "away_team": match["away_team"],
            "away_logo": away_logo,
            "time": format_display_time(match["start"]),
            "date": match["start"],
            "league": match["league"],
            "group": match["group"],
            "is_live": is_live,
            "is_finished": is_finished,
            "home_score": home_score,
            "away_score": away_score,
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
