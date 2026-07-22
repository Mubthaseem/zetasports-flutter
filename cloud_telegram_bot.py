import os
import time
import json
import datetime
import requests

# Configuration (Uses Environment Variables for cloud hosting, falls back to defaults)
TELEGRAM_TOKEN = os.environ.get("TELEGRAM_TOKEN", "8611917546:AAH3C1LZ6QhwaSGpPYJTGTXJR52SmO3Va_k")
OWNER_CHAT_ID = os.environ.get("OWNER_CHAT_ID", "1386396531")
SB_URL = os.environ.get("SUPABASE_URL", "https://voocdrpetiyspuhyeapi.supabase.co")
SB_KEY = os.environ.get("SUPABASE_KEY", "sb_publishable_luDUt769BBrrApn8z-Cgvw_W9VE0rIV")

SB_HEADERS = {
    'apikey': SB_KEY,
    'Authorization': f'Bearer {SB_KEY}',
    'Content-Type': 'application/json'
}

OFFSET_FILE = "telegram_offset.txt"

def send_telegram_message(text):
    """Sends a message back to the owner."""
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    payload = {
        'chat_id': OWNER_CHAT_ID,
        'text': text,
        'parse_mode': 'Markdown'
    }
    try:
        requests.post(url, json=payload, timeout=10)
    except Exception as e:
        print(f"Error sending message: {e}")

def send_start_menu():
    """Sends the help menu along with a Telegram WebApp button to open the visual Admin Panel."""
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    web_app_url = os.environ.get("WEB_APP_URL", "https://mubthaseem.github.io/zetasports-flutter/admin_panel/index.html")
    
    help_text = (
        "☁️ *ZetaSports Cloud Admin Bot* ☁️\n"
        "Running 24/7 in the cloud without your laptop!\n\n"
        "📺 *STREAMS MANAGEMENT*\n"
        "• `/streams` — List all streams\n"
        "• `/addstream <label> | <url> | [quality] | [color]` — Add stream\n"
        "• `/editstream <id> | [label=...] | [url=...] | [quality=...] | [color=...] | [active=true/false]` — Edit stream\n"
        "• `/delstream <id>` — Delete stream\n\n"
        "⚽ *MATCHES MANAGEMENT*\n"
        "• `/matches [search]` — List matches\n"
        "• `/addmatch <home_team_id> | <away_team_id> | <league_id> | <date_time> | [status] | [fotmob_id]` — Add match\n"
        "• `/editmatch <id> | [status=...] | [home_score=...] | [away_score=...] | [time_elapsed=...] | [round=...] | [stream_ids=...] | [fotmob_id=...]` — Edit match\n"
        "• `/delmatch <id>` — Delete match\n"
        "• `/teams [query]` — Search team ID & details\n"
        "• `/leagues [query]` — Search league ID & details\n\n"
        "🔄 *FOTMOB SYNC*\n"
        "• `/sync <match_id> | <fotmob_id>` — Sync live stats, lineup, events, & commentary from FotMob"
    )

    payload = {
        'chat_id': OWNER_CHAT_ID,
        'text': help_text,
        'parse_mode': 'Markdown',
        'reply_markup': {
            'inline_keyboard': [[
                {
                    'text': '🚀 Open Visual Admin Panel',
                    'web_app': {'url': web_app_url}
                }
            ]],
            'keyboard': [[
                {
                    'text': '📱 Open Admin Panel',
                    'web_app': {'url': web_app_url}
                }
            ]],
            'resize_keyboard': True,
            'persistent': True
        }
    }
    try:
        requests.post(url, json=payload, timeout=10)
    except Exception as e:
        print(f"Error sending start menu: {e}")

def handle_admin_command(text):
    """Processes incoming admin commands from the owner."""
    text = text.strip()
    parts = text.split(" ", 1)
    cmd = parts[0].lower()
    args_str = parts[1].strip() if len(parts) > 1 else ""

    try:
        if cmd in ["/start", "/help"]:
            send_start_menu()

        elif cmd == "/streams":
            res = requests.get(f"{SB_URL}/rest/v1/zeta_streams?deleted=neq.true&order=created_at.desc", headers=SB_HEADERS, timeout=10)
            if res.status_code != 200:
                send_telegram_message(f"❌ Error fetching streams: HTTP {res.status_code}")
                return
            streams = res.json()
            if not streams:
                send_telegram_message("📺 No active streams found.")
                return
            
            lines = ["📺 *Current Live Streams:*"]
            for s in streams:
                status = "🟢 LIVE" if s.get("active") else "🔴 OFFLINE"
                lines.append(
                    f"• *{s['label']}* ({s.get('quality', '1080p')}) - {status}\n"
                    f"  `{s['id']}`\n"
                    f"  Link: {s['url']}"
                )
            send_telegram_message("\n\n".join(lines))

        elif cmd == "/addstream":
            if not args_str:
                send_telegram_message("📝 Usage: `/addstream <label> | <url> | [quality] | [color]`")
                return
            args = [a.strip() for a in args_str.split("|")]
            if len(args) < 2:
                send_telegram_message("❌ Error: Minimum `label` and `url` required. Split arguments using `|`.")
                return
            
            label = args[0]
            url = args[1]
            quality = args[2] if len(args) > 2 else "1080p"
            color = args[3] if len(args) > 3 else "#00ff88"

            payload = {
                "label": label,
                "url": url,
                "quality": quality,
                "color": color,
                "active": True,
                "deleted": False
            }
            res = requests.post(f"{SB_URL}/rest/v1/zeta_streams", headers=SB_HEADERS, json=payload, timeout=10)
            if res.status_code in [200, 201]:
                send_telegram_message(f"✅ Stream *{label}* added successfully!")
            else:
                send_telegram_message(f"❌ Failed to add stream: HTTP {res.status_code}\n{res.text}")

        elif cmd == "/editstream":
            if not args_str:
                send_telegram_message("📝 Usage: `/editstream <id> | [label=...] | [url=...] | [quality=...] | [color=...] | [active=true/false]`")
                return
            args = [a.strip() for a in args_str.split("|")]
            stream_id = args[0]
            if len(args) < 2:
                send_telegram_message("❌ Error: Specify at least one attribute to update (e.g. `label=New Label`).")
                return
            
            payload = {}
            for param in args[1:]:
                if "=" not in param:
                    continue
                k, v = [x.strip() for x in param.split("=", 1)]
                if k == "active":
                    payload[k] = v.lower() == "true"
                else:
                    payload[k] = v

            if not payload:
                send_telegram_message("❌ No valid attributes to edit. Example: `label=HD Link | active=true`")
                return

            res = requests.patch(f"{SB_URL}/rest/v1/zeta_streams?id=eq.{stream_id}", headers=SB_HEADERS, json=payload, timeout=10)
            if res.status_code in [200, 204]:
                send_telegram_message(f"✅ Stream `{stream_id}` updated successfully!")
            else:
                send_telegram_message(f"❌ Failed to update stream: HTTP {res.status_code}\n{res.text}")

        elif cmd == "/delstream":
            if not args_str:
                send_telegram_message("📝 Usage: `/delstream <id>`")
                return
            res = requests.patch(f"{SB_URL}/rest/v1/zeta_streams?id=eq.{args_str}", headers=SB_HEADERS, json={"deleted": True}, timeout=10)
            if res.status_code in [200, 204]:
                send_telegram_message(f"✅ Stream `{args_str}` marked as deleted.")
            else:
                send_telegram_message(f"❌ Failed to delete stream: HTTP {res.status_code}\n{res.text}")

        elif cmd == "/matches":
            url = f"{SB_URL}/rest/v1/zeta_matches?order=date.desc"
            if args_str:
                url += f"&or=(home_team.ilike.*{args_str}*,away_team.ilike.*{args_str}*)"
            url += "&limit=10"
            
            res = requests.get(url, headers=SB_HEADERS, timeout=10)
            if res.status_code != 200:
                send_telegram_message(f"❌ Error fetching matches: HTTP {res.status_code}")
                return
            matches = res.json()
            if not matches:
                send_telegram_message("⚽ No matches found.")
                return
            
            lines = ["⚽ *Recent Matches:*"]
            for m in matches:
                lines.append(
                    f"• *{m['home_team']}* vs *{m['away_team']}*\n"
                    f"  Score: `{m['home_score']} - {m['away_score']}` | Status: *{m['status'].upper()}*\n"
                    f"  Date: {m['date']}\n"
                    f"  ID: `{m['id']}`\n"
                    f"  FotMob ID: `{m.get('fotmob_id') or '—'}` | Streams: `{len(m.get('stream_ids') or [])}`"
                )
            send_telegram_message("\n\n".join(lines))

        elif cmd == "/addmatch":
            if not args_str:
                send_telegram_message("📝 Usage: `/addmatch <home_team_id> | <away_team_id> | <league_id> | <date_time> | [status] | [fotmob_id]`")
                return
            args = [a.strip() for a in args_str.split("|")]
            if len(args) < 4:
                send_telegram_message("❌ Error: Home Team ID, Away Team ID, League ID, and Date Time (YYYY-MM-DD HH:MM) are required.")
                return
            
            home_id, away_id, league_id, date_val = args[0], args[1], args[2], args[3]
            status = args[4] if len(args) > 4 else "scheduled"
            fotmob_id = args[5] if len(args) > 5 else None

            t_res = requests.get(f"{SB_URL}/rest/v1/zeta_teams?id=in.({home_id},{away_id})", headers=SB_HEADERS, timeout=10)
            l_res = requests.get(f"{SB_URL}/rest/v1/zeta_leagues?id=eq.{league_id}", headers=SB_HEADERS, timeout=10)
            
            if t_res.status_code != 200 or l_res.status_code != 200:
                send_telegram_message("❌ Error: Invalid team or league IDs. Verify using `/teams` or `/leagues`.")
                return
            
            teams = {t["id"]: t for t in t_res.json()}
            leagues = l_res.json()
            
            if home_id not in teams or away_id not in teams or not leagues:
                send_telegram_message("❌ Error: Could not find team or league records for the provided IDs.")
                return

            payload = {
                "home_team_id": home_id,
                "away_team_id": away_id,
                "league_id": league_id,
                "home_team": teams[home_id]["name"],
                "away_team": teams[away_id]["name"],
                "home_logo": teams[home_id]["logo"],
                "away_logo": teams[away_id]["logo"],
                "league_name": leagues[0]["name"],
                "date": date_val,
                "status": status,
                "home_score": 0,
                "away_score": 0,
                "fotmob_id": fotmob_id,
                "stream_ids": []
            }

            res = requests.post(f"{SB_URL}/rest/v1/zeta_matches", headers=SB_HEADERS, json=payload, timeout=10)
            if res.status_code in [200, 201]:
                send_telegram_message(f"✅ Match *{teams[home_id]['name']} vs {teams[away_id]['name']}* created!")
            else:
                send_telegram_message(f"❌ Failed to create match: HTTP {res.status_code}\n{res.text}")

        elif cmd == "/editmatch":
            if not args_str:
                send_telegram_message("📝 Usage: `/editmatch <id> | [status=...] | [home_score=...] | [away_score=...] | [time_elapsed=...] | [round=...] | [stream_ids=...] | [fotmob_id=...]`")
                return
            args = [a.strip() for a in args_str.split("|")]
            match_id = args[0]
            if len(args) < 2:
                send_telegram_message("❌ Error: Specify at least one attribute to update.")
                return
            
            payload = {}
            for param in args[1:]:
                if "=" not in param:
                    continue
                k, v = [x.strip() for x in param.split("=", 1)]
                if k in ["home_score", "away_score"]:
                    payload[k] = int(v)
                elif k == "stream_ids":
                    payload[k] = [s.strip() for s in v.split(",") if s.strip()]
                else:
                    payload[k] = v

            if not payload:
                send_telegram_message("❌ No valid attributes to edit. Example: `status=live | time_elapsed=15'`")
                return

            res = requests.patch(f"{SB_URL}/rest/v1/zeta_matches?id=eq.{match_id}", headers=SB_HEADERS, json=payload, timeout=10)
            if res.status_code in [200, 204]:
                send_telegram_message(f"✅ Match `{match_id}` updated successfully!")
            else:
                send_telegram_message(f"❌ Failed to update match: HTTP {res.status_code}\n{res.text}")

        elif cmd == "/delmatch":
            if not args_str:
                send_telegram_message("📝 Usage: `/delmatch <id>`")
                return
            res = requests.delete(f"{SB_URL}/rest/v1/zeta_matches?id=eq.{args_str}", headers=SB_HEADERS, timeout=10)
            if res.status_code in [200, 204]:
                send_telegram_message(f"✅ Match `{args_str}` deleted.")
            else:
                send_telegram_message(f"❌ Failed to delete match: HTTP {res.status_code}\n{res.text}")

        elif cmd == "/teams":
            url = f"{SB_URL}/rest/v1/zeta_teams?order=name.asc"
            if args_str:
                url += f"&name.ilike.*{args_str}*"
            url += "&limit=15"
            
            res = requests.get(url, headers=SB_HEADERS, timeout=10)
            if res.status_code != 200:
                send_telegram_message(f"❌ Error fetching teams: HTTP {res.status_code}")
                return
            teams = res.json()
            if not teams:
                send_telegram_message("🤷 No matching teams found.")
                return
            
            lines = ["⚽ *Teams List:*"]
            for t in teams:
                lines.append(f"• *{t['name']}*\n  ID: `{t['id']}`")
            send_telegram_message("\n".join(lines))

        elif cmd == "/leagues":
            url = f"{SB_URL}/rest/v1/zeta_leagues?order=name.asc"
            if args_str:
                url += f"&name.ilike.*{args_str}*"
            url += "&limit=15"
            
            res = requests.get(url, headers=SB_HEADERS, timeout=10)
            if res.status_code != 200:
                send_telegram_message(f"❌ Error fetching leagues: HTTP {res.status_code}")
                return
            leagues = res.json()
            if not leagues:
                send_telegram_message("🏆 No matching leagues found.")
                return
            
            lines = ["🏆 *Leagues List:*"]
            for l in leagues:
                lines.append(f"• *{l['name']}* ({l.get('sport', 'football')})\n  ID: `{l['id']}`")
            send_telegram_message("\n".join(lines))

        elif cmd == "/sync":
            if not args_str:
                send_telegram_message("📝 Usage: `/sync <match_id> | <fotmob_id>`")
                return
            args = [a.strip() for a in args_str.split("|")]
            if len(args) < 2:
                send_telegram_message("❌ Error: Specify both Match ID and FotMob Match ID. Split with `|`.")
                return
            
            match_id = args[0]
            fotmob_id = args[1]
            
            send_telegram_message(f"⏳ Syncing match `{match_id}` with FotMob `{fotmob_id}`...")
            status = sync_match_from_fotmob(match_id, fotmob_id)
            if status == "success":
                send_telegram_message("✅ FotMob Sync successful! Stats, Lineups, & Commentary updated.")
            else:
                send_telegram_message(f"❌ Sync failed: {status}")

    except Exception as e:
        send_telegram_message(f"💥 Bot error processing command: {e}")

def sync_match_from_fotmob(match_id, fotmob_id):
    """Fetches details from FotMob API and writes to Supabase."""
    url = f"https://www.fotmob.com/api/matchDetails?matchId={fotmob_id}"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    try:
        res = requests.get(url, headers=headers, timeout=15)
        if res.status_code != 200:
            return f"Failed to fetch FotMob details (HTTP {res.status_code})"
        
        data = res.json()
        
        # 1. Update Match venue/referee
        info_box = data.get("content", {}).get("matchFacts", {}).get("infoBox", {})
        referee_name = info_box.get("Referee", "—")
        stadium = info_box.get("Stadium", {})
        venue_name = stadium.get("name") or data.get("stadium", {}).get("name") or "—"
        
        match_payload = {
            "referee": referee_name,
            "venue": venue_name,
            "fotmob_id": str(fotmob_id)
        }
        requests.patch(f"{SB_URL}/rest/v1/zeta_matches?id=eq.{match_id}", headers=SB_HEADERS, json=match_payload, timeout=10)
        
        # 2. Stats
        stats_periods = data.get("content", {}).get("stats", {}).get("periods", {})
        stats_list = stats_periods.get("All", {}).get("stats", []) if isinstance(stats_periods, dict) else []
        stats_map = {}
        for grp in stats_list:
            if isinstance(grp, dict) and "stats" in grp:
                for s in grp["stats"]:
                    if isinstance(s, dict) and "title" in s:
                        stats_map[s["title"].lower()] = s
                        
        def get_stat(title, def_home=0, def_away=0):
            s = stats_map.get(title.lower())
            if not s or "stats" not in s or len(s["stats"]) < 2:
                return {"home": def_home, "away": def_away}
            h_val = s["stats"][0]
            a_val = s["stats"][1]
            if isinstance(h_val, str):
                h_val = float(h_val.replace('%', '')) if '%' in h_val else float(h_val)
            if isinstance(a_val, str):
                a_val = float(a_val.replace('%', '')) if '%' in a_val else float(a_val)
            return {"home": h_val, "away": a_val}
            
        poss = get_stat('Ball possession', 50, 50)
        shots = get_stat('Total shots')
        target_shots = get_stat('Shots on target')
        passes = get_stat('Passes')
        corners = get_stat('Corner kicks')
        xg = get_stat('Expected goals (xG)')
        fouls = get_stat('Fouls committed')
        yellow = get_stat('Yellow cards')
        red = get_stat('Red cards')
        
        stats_payload = {
            "match_id": match_id,
            "home_stats": {
                "possession": int(round(poss["home"])),
                "shots": int(round(shots["home"])),
                "shots_on_target": int(round(target_shots["home"])),
                "pass_accuracy": int(round(passes["home"])),
                "corners": int(round(corners["home"])),
                "xg": float(xg["home"]),
                "fouls": int(round(fouls["home"])),
                "yellow_cards": int(round(yellow["home"])),
                "red_cards": int(round(red["home"]))
            },
            "away_stats": {
                "possession": int(round(poss["away"])),
                "shots": int(round(shots["away"])),
                "shots_on_target": int(round(target_shots["away"])),
                "pass_accuracy": int(round(passes["away"])),
                "corners": int(round(corners["away"])),
                "xg": float(xg["away"]),
                "fouls": int(round(fouls["away"])),
                "yellow_cards": int(round(yellow["away"])),
                "red_cards": int(round(red["away"]))
            }
        }
        requests.post(
            f"{SB_URL}/rest/v1/zeta_match_stats",
            headers={**SB_HEADERS, "Prefer": "resolution=merge-duplicates,return=minimal"},
            json=stats_payload,
            timeout=10
        )
        
        # 3. Lineups
        lineups_data = data.get("content", {}).get("lineup", {}).get("lineup", {})
        home_lineup_data = lineups_data.get("home", {})
        away_lineup_data = lineups_data.get("away", {})
        
        home_form = home_lineup_data.get("formation", "4-3-3")
        away_form = away_lineup_data.get("formation", "4-3-3")
        
        def parse_players(players_list):
            result = []
            for p in (players_list or []):
                if not isinstance(p, dict):
                    continue
                rating_val = 6.0
                if "stats" in p and isinstance(p["stats"], list):
                    for s in p["stats"]:
                        if isinstance(s, dict) and s.get("title") == "Rating":
                            try:
                                rating_val = float(s.get("value", 6.0))
                            except Exception:
                                pass
                elif "rating" in p and isinstance(p["rating"], dict):
                    try:
                        rating_val = float(p["rating"].get("num", 6.0))
                    except Exception:
                        pass
                result.append({
                    "name": p.get("name", {}).get("fullName") or p.get("name") or "Player",
                    "num": str(p.get("shirt") or p.get("number") or "0"),
                    "pos": p.get("position") or "MF",
                    "x": float(p.get("positionX") or p.get("x") or 0.5),
                    "y": float(p.get("positionY") or p.get("y") or 0.5),
                    "rating": rating_val
                })
            return result
            
        home_players = parse_players(home_lineup_data.get("starting11"))
        away_players = parse_players(away_lineup_data.get("starting11"))
        
        def normalize_coords(players):
            if not players:
                return []
            xs = [p["x"] for p in players]
            ys = [p["y"] for p in players]
            min_x, max_x = min(xs), max(xs)
            min_y, max_y = min(ys), max(ys)
            
            for p in players:
                nx = (p["x"] - min_x) / (max_x - min_x) if (max_x - min_x) > 0 else 0.5
                ny = (p["y"] - min_y) / (max_y - min_y) if (max_y - min_y) > 0 else 0.5
                p["x"] = 0.05 + nx * 0.9
                p["y"] = 0.05 + ny * 0.9
            return players
            
        home_players = normalize_coords(home_players)
        away_players = normalize_coords(away_players)
        
        lineup_payload = {
            "match_id": match_id,
            "home_lineup": { "formation": home_form, "players": home_players },
            "away_lineup": { "formation": away_form, "players": away_players }
        }
        requests.post(
            f"{SB_URL}/rest/v1/zeta_match_lineups",
            headers={**SB_HEADERS, "Prefer": "resolution=merge-duplicates,return=minimal"},
            json=lineup_payload,
            timeout=10
        )
        
        # 4. Commentary
        ticker_data = data.get("content", {}).get("liveticker", {}) or {}
        ticker_list = ticker_data.get("teams", []) or ticker_data.get("events", []) or []
        if ticker_list:
            commentary_rows = []
            for idx, evt in enumerate(ticker_list):
                if not isinstance(evt, dict):
                    continue
                evt_type = evt.get("type") or ("goal" if evt.get("isGoal") else "card" if evt.get("isCard") else "info")
                text = evt.get("text") or evt.get("comment") or ""
                if text.strip():
                    commentary_rows.append({
                        "min": str(evt.get("time") or evt.get("minute") or "—"),
                        "type": str(evt_type),
                        "text": text,
                        "time_stamp": datetime.datetime.utcnow().isoformat()
                    })
            if commentary_rows:
                requests.post(
                    f"{SB_URL}/rest/v1/zeta_match_commentary",
                    headers={**SB_HEADERS, "Prefer": "resolution=merge-duplicates,return=minimal"},
                    json={
                        "match_id": match_id,
                        "commentary": commentary_rows
                    },
                    timeout=10
                )
        return "success"
    except Exception as e:
        return str(e)

def main():
    print(f"☁️ ZetaSports Cloud Bot Started. Polling Telegram every 3 seconds...")
    print(f"Connecting to Supabase URL: {SB_URL}")
    print(f"Using Telegram Token: {TELEGRAM_TOKEN[:10]}...")

    # Set up offset
    offset = 0
    if os.path.exists(OFFSET_FILE):
        try:
            with open(OFFSET_FILE, "r") as f:
                offset = int(f.read().strip())
        except Exception:
            pass

    while True:
        try:
            url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/getUpdates"
            params = {"timeout": 10}
            if offset:
                params["offset"] = offset

            res = requests.get(url, params=params, timeout=15)
            if res.status_code != 200:
                time.sleep(3)
                continue

            data = res.json()
            if not data.get("ok"):
                time.sleep(3)
                continue

            results = data.get("result", [])
            for update in results:
                update_id = update.get("update_id")
                offset = update_id + 1
                try:
                    with open(OFFSET_FILE, "w") as f:
                        f.write(str(offset))
                except Exception:
                    pass

                # Handle text message
                post = update.get("message")
                if not post:
                    continue

                sender = post.get("from", {})
                sender_id = str(sender.get("id", ""))
                sender_username = str(sender.get("username", "")).lower()

                # Security check: Only process commands sent by the owner chat ID or username
                is_owner = (sender_id == OWNER_CHAT_ID or sender_username == "mubthaseem28")
                if not is_owner:
                    print(f"Ignored unauthorized message from sender_id={sender_id}, username={sender_username}")
                    continue

                text = post.get("text", "")
                if text and text.startswith("/"):
                    print(f"Processing command: {text}")
                    handle_admin_command(text)

        except Exception as e:
            print(f"Polling loop error: {e}")
            time.sleep(5)

        time.sleep(2)

if __name__ == "__main__":
    main()
