import urllib.request
import json
import datetime
import os

# Configuration
JSON_OUTPUT_PATH = 'blogger-widgets/matches.json'
MANUAL_INPUT_PATH = 'blogger-widgets/manual_matches.json'

FLAG_MAP = {
    'Switzerland': 'ch', 'Canada': 'ca', 'Bosnia & Herzegovina': 'ba', 'Qatar': 'qa',
    'Scotland': 'gb-sct', 'Brazil': 'br', 'Morocco': 'ma', 'Haiti': 'ht',
    'India': 'in', 'Australia': 'au', 'Colombia': 'co', 'DR Congo': 'cd',
    'South Africa': 'za', 'South Korea': 'kr', 'Czechia': 'cz', 'Mexico': 'mx',
    'England': 'gb-eng', 'Spain': 'es', 'Germany': 'de', 'France': 'fr',
    'Italy': 'it', 'Argentina': 'ar', 'Portugal': 'pt', 'Netherlands': 'nl',
    'Belgium': 'be', 'Croatia': 'hr', 'Uruguay': 'uy', 'USA': 'us',
    'Japan': 'jp', 'Senegal': 'sn', 'Wales': 'gb-wls', 'Iran': 'ir'
}

def get_flag_url(team_name):
    code = FLAG_MAP.get(team_name)
    if code:
        return f"https://flagcdn.com/w80/{code}.png"
    for name, code in FLAG_MAP.items():
        if name.lower() in team_name.lower():
            return f"https://flagcdn.com/w80/{code}.png"
    return "https://i.ibb.co/qF41b08G/HELLO-THUM.png"

def fetch_public_fixtures():
    print("Fetching public football fixtures...")
    url = "https://fixturedownload.com/feed/json/epl-2025"
    try:
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode())
            return data
    except Exception as e:
        print(f"Error fetching public fixtures: {e}")
        return []

def process_fixtures(raw_fixtures):
    processed = []
    now = datetime.datetime.now(datetime.timezone.utc)
    
    for item in raw_fixtures:
        try:
            date_str = item.get('DateUtc')
            if not date_str:
                continue
                
            match_date = datetime.datetime.strptime(date_str, "%Y-%m-%d %H:%M:%SZ").replace(tzinfo=datetime.timezone.utc)
            delta = match_date - now
            if abs(delta.days) > 2:
                continue
                
            home = item.get('HomeTeam')
            away = item.get('AwayTeam')
            time_display = match_date.strftime("%I:%M %p")
            
            home_score = item.get('HomeTeamScore')
            away_score = item.get('AwayTeamScore')
            is_finished = home_score is not None and away_score is not None
            is_live = False
            
            if not is_finished and match_date <= now <= (match_date + datetime.timedelta(hours=2)):
                is_live = True
                
            slug = f"{home.lower().replace(' ', '-')}-vs-{away.lower().replace(' ', '-')}"
            watch_url = f"https://sportsevo.thinkgovtjobs.com/watch/{slug}"
            
            processed.append({
                "id": f"epl_{item.get('MatchNumber', '0')}",
                "sport": "football",
                "home_team": home,
                "home_logo": get_flag_url(home),
                "away_team": away,
                "away_logo": get_flag_url(away),
                "time": time_display,
                "date": match_date.isoformat(),
                "league": "Premier League",
                "group": f"Matchweek {item.get('RoundNumber', '1')}",
                "is_live": is_live,
                "is_finished": is_finished,
                "home_score": str(home_score) if home_score is not None else "0",
                "away_score": str(away_score) if away_score is not None else "0",
                "watch_url": watch_url
            })
        except Exception as ex:
            print(f"Error processing fixture: {ex}")
    return processed

def main():
    public_matches = []
    raw_data = fetch_public_fixtures()
    if raw_data:
        public_matches = process_fixtures(raw_data)
        print(f"Processed {len(public_matches)} public matches.")
        
    manual_matches = []
    if os.path.exists(MANUAL_INPUT_PATH):
        try:
            with open(MANUAL_INPUT_PATH, 'r') as f:
                data = json.load(f)
                manual_matches = data.get('matches', [])
                print(f"Loaded {len(manual_matches)} manual matches.")
        except Exception as e:
            print(f"Error reading manual matches: {e}")
            
    final_matches = []
    merged_ids = set()
    
    for m in manual_matches:
        final_matches.append(m)
        if 'id' in m:
            merged_ids.add(m['id'])
            
    for m in public_matches:
        if m['id'] not in merged_ids:
            team_combo = (m['home_team'], m['away_team'])
            duplicate = False
            for mm in manual_matches:
                if mm.get('home_team') == m['home_team'] and mm.get('away_team') == m['away_team']:
                    duplicate = True
                    break
            if not duplicate:
                final_matches.append(m)
                
    output_data = {
        "success": True,
        "matches": final_matches,
        "last_updated": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }
    
    with open(JSON_OUTPUT_PATH, 'w') as f:
        json.dump(output_data, f, indent=2)
    print(f"Saved {len(final_matches)} total matches to {JSON_OUTPUT_PATH}.")

if __name__ == '__main__':
    main()
