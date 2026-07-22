import sys
import os
import json
import re
import requests
import subprocess
import time
import datetime
from flask import Flask, render_template, request, jsonify, session

# Add current directory to path for portable environment imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import background daemon and other components
from agent_daemon import AutopilotDaemon, MATCHES_JSON_PATH, LOG_FILE, SCRAPER_SCRIPT_PATH, log_message
from stream_scraper import scrape_streams

app = Flask(__name__, template_folder='templates', static_folder='static')
app.secret_key = 'cooper_blogger_oauth_secret_key'
daemon = AutopilotDaemon()

# Start background daemon on startup
daemon.start()

def get_logs_tail(num_lines=80):
    """Reads the last N lines of agent.log."""
    if not os.path.exists(LOG_FILE):
        return "Log file empty or not generated yet."
    try:
        with open(LOG_FILE, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
            return "".join(lines[-num_lines:])
    except Exception as e:
        return f"Error reading logs: {e}"

@app.route('/')
def home():
    """Serves the dashboard interface."""
    return render_template('index.html')

@app.route('/api/fotmob/<match_id>', methods=['GET'])
def get_fotmob_match(match_id):
    """Fetches and parses a FotMob match page directly, returning the embedded JSON."""
    url = f"https://www.fotmob.com/match/{match_id}"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    try:
        res = requests.get(url, headers=headers, timeout=10)
        if res.status_code != 200:
            response = jsonify({"success": False, "error": f"FotMob returned status {res.status_code}"})
            response.headers.add('Access-Control-Allow-Origin', '*')
            return response, res.status_code
        
        html = res.text
        start_tag = '<script id="__NEXT_DATA__" type="application/json">'
        end_tag = '</script>'
        
        start_idx = html.find(start_tag)
        if start_idx == -1:
            response = jsonify({"success": False, "error": "No __NEXT_DATA__ script block found"})
            response.headers.add('Access-Control-Allow-Origin', '*')
            return response, 500
        
        content_idx = start_idx + len(start_tag)
        end_idx = html.find(end_tag, content_idx)
        if end_idx == -1:
            response = jsonify({"success": False, "error": "No closing script tag found"})
            response.headers.add('Access-Control-Allow-Origin', '*')
            return response, 500
        
        json_str = html[content_idx:end_idx]
        data = json.loads(json_str)
        
        response = jsonify({"success": True, "data": data})
        response.headers.add('Access-Control-Allow-Origin', '*')
        return response
    except Exception as e:
        response = jsonify({"success": False, "error": str(e)})
        response.headers.add('Access-Control-Allow-Origin', '*')
        return response, 500

SB_URL = 'https://voocdrpetiyspuhyeapi.supabase.co'
SB_KEY = 'sb_publishable_luDUt769BBrrApn8z-Cgvw_W9VE0rIV'

@app.route('/api/sb/<path:table>', methods=['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'])
def supabase_proxy(table):
    """Proxies Supabase REST API calls to bypass browser CORS restrictions."""
    if request.method == 'OPTIONS':
        resp = app.make_default_options_response()
        resp.headers['Access-Control-Allow-Origin'] = '*'
        resp.headers['Access-Control-Allow-Methods'] = 'GET, POST, PATCH, DELETE, OPTIONS'
        resp.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, apikey, Prefer'
        return resp
    try:
        qs = request.query_string.decode()
        url = f"{SB_URL}/rest/v1/{table}"
        if qs:
            url += f"?{qs}"
        headers = {
            'Content-Type': 'application/json',
            'apikey': SB_KEY,
            'Authorization': f'Bearer {SB_KEY}',
            'Prefer': request.headers.get('Prefer', 'return=minimal')
        }
        body = request.get_data()
        resp = requests.request(request.method, url, headers=headers, data=body, timeout=15)
        response = app.response_class(
            response=resp.content,
            status=resp.status_code,
            mimetype='application/json'
        )
        response.headers['Access-Control-Allow-Origin'] = '*'
        return response
    except Exception as e:
        r = jsonify({"error": str(e)})
        r.headers['Access-Control-Allow-Origin'] = '*'
        return r, 500

@app.route('/api/matches', methods=['GET', 'POST'])
def handle_matches():
    """Fetches or updates the matches.json file."""
    if request.method == 'GET':
        if os.path.exists(MATCHES_JSON_PATH):
            try:
                with open(MATCHES_JSON_PATH, 'r') as f:
                    return jsonify(json.load(f))
            except Exception as e:
                return jsonify({"success": False, "error": str(e)}), 500
        return jsonify({"success": True, "matches": [], "last_updated": ""})
    
    # POST - update whole matches array
    try:
        req_data = request.json
        out_data = {
            "success": True,
            "matches": req_data.get('matches', []),
            "last_updated": req_data.get('last_updated', '')
        }
        with open(MATCHES_JSON_PATH, 'w') as f:
            json.dump(out_data, f, indent=2)
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/matches/<match_id>', methods=['DELETE'])
def delete_match(match_id):
    """Deletes a match from matches.json."""
    try:
        if not os.path.exists(MATCHES_JSON_PATH):
            return jsonify({"success": False, "error": "Matches file not found."}), 404
            
        with open(MATCHES_JSON_PATH, 'r') as f:
            data = json.load(f)
        matches = data.get('matches', [])
        
        # Filter match
        initial_len = len(matches)
        matches = [m for m in matches if m.get('id') != match_id]
        
        if len(matches) == initial_len:
            return jsonify({"success": False, "error": "Match ID not found."}), 404
            
        data['matches'] = matches
        with open(MATCHES_JSON_PATH, 'w') as f:
            json.dump(data, f, indent=2)
            
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/settings', methods=['GET', 'POST'])
def handle_settings():
    """Gets or sets agent settings."""
    if request.method == 'GET':
        return jsonify(daemon.load_settings())
    
    try:
        new_settings = request.json
        daemon.save_settings(new_settings)
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/scrape-streams', methods=['POST'])
def handle_scrape():
    """Manually triggers the web stream scraper."""
    data = request.json
    url = data.get('url', '')
    if not url:
        return jsonify({"success": False, "error": "URL is required"}), 400
    try:
        results = scrape_streams(url)
        return jsonify({"success": True, "streams": results})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/run-scraper', methods=['POST'])
def trigger_scorer_scraper():
    """Triggers the local FotMob live scores update script scraper.py."""
    try:
        cwd = os.path.dirname(SCRAPER_SCRIPT_PATH)
        res = subprocess.run(["python", "scraper.py"], cwd=cwd, capture_output=True, text=True)
        if res.returncode == 0:
            return jsonify({"success": True, "output": res.stdout})
        else:
            return jsonify({"success": False, "error": res.stderr}), 500
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/push-github', methods=['POST'])
def trigger_github_push():
    """Triggers manual git commit and push to GitHub."""
    try:
        success = daemon.git_commit_and_push("Manual update from Agent Control Panel")
        if success:
            return jsonify({"success": True})
        return jsonify({"success": False, "error": "Push failed. Check agent logs."}), 500
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/logs', methods=['GET'])
def get_logs():
    """Endpoint to stream agent logs."""
    return jsonify({"success": True, "logs": get_logs_tail()})

@app.route('/api/whatsapp-history', methods=['GET'])
def get_whatsapp_history():
    """Endpoint to get WhatsApp forwarded message history."""
    history_file = os.path.join(os.path.dirname(__file__), 'forwarded_messages.json')
    if os.path.exists(history_file):
        try:
            with open(history_file, 'r', encoding='utf-8') as f:
                return jsonify({"success": True, "history": json.load(f)})
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500
    return jsonify({"success": True, "history": []})

@app.route('/api/whatsapp-abort', methods=['POST'])
def whatsapp_abort():
    """Requests the local bridge to abort any active message forwarding queue."""
    try:
        res = requests.post("http://127.0.0.1:3000/abort-sending", timeout=5)
        if res.status_code == 200:
            return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
    return jsonify({"success": False, "error": "Failed to call bridge abort endpoint."}), 500

@app.route('/api/blogger/status', methods=['GET'])
def blogger_status():
    """Gets Blogger API authentication status."""
    has_secrets = daemon.blogger.has_secrets()
    is_auth = daemon.blogger.is_authenticated()
    return jsonify({
        "has_secrets": has_secrets,
        "is_authenticated": is_auth
    })

@app.route('/api/blogger/auth-url', methods=['GET'])
def blogger_auth_url():
    """Returns Google OAuth authorization link."""
    try:
        flow = daemon.blogger.get_flow()
        url, state = flow.authorization_url(prompt='consent')
        # Store state and code_verifier in flask session for PKCE validation
        session['oauth_state'] = state
        session['code_verifier'] = flow.code_verifier
        return jsonify({"success": True, "url": url})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/blogger/auth-code', methods=['POST'])
def blogger_auth_code():
    """Submits the Google OAuth verification code (legacy copy-paste fallback)."""
    data = request.json
    code = data.get('code', '').strip()
    if not code:
        return jsonify({"success": False, "error": "Code is required"}), 400
    try:
        flow = daemon.blogger.get_flow()
        code_verifier = session.get('code_verifier')
        flow.fetch_token(code=code, code_verifier=code_verifier)
        daemon.blogger.creds = flow.credentials
        
        # Save token
        with open(daemon.blogger.TOKEN_FILE, 'w') as token:
            token.write(flow.credentials.to_json())
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/blogger/oauth2callback', methods=['GET'])
def blogger_oauth2callback():
    """OAuth callback URL called by Google."""
    code = request.args.get('code')
    if not code:
        return "Authentication failed: No authorization code received.", 400
    try:
        flow = daemon.blogger.get_flow()
        code_verifier = session.get('code_verifier')
        flow.fetch_token(code=code, code_verifier=code_verifier)
        
        daemon.blogger.creds = flow.credentials
        
        # Save token file
        with open(daemon.blogger.TOKEN_FILE, 'w') as token:
            token.write(flow.credentials.to_json())
            
        return """
        <html>
        <head>
            <title>Authentication Successful</title>
            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;800&display=swap" rel="stylesheet">
            <style>
                body { background: #030712; color: #f3f4f6; font-family: 'Plus Jakarta Sans', sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                .box { text-align: center; background: rgba(17, 24, 39, 0.45); border: 1px solid rgba(255,255,255,0.08); padding: 40px; border-radius: 20px; max-width: 400px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
                h2 { color: #10b981; margin-bottom: 12px; font-size: 24px; }
                p { color: #9ca3af; font-size: 14px; line-height: 1.5; }
            </style>
        </head>
        <body>
            <div class="box">
                <h2>✓ Connected Successfully</h2>
                <p>Cooper is now authorized to publish articles to your Blogger. You can close this browser tab and return to the dashboard.</p>
            </div>
        </body>
        </html>
        """
    except Exception as e:
        return f"Authentication error: {e}", 500

# ─── Free WhatsApp Bridge Webhook & Status Endpoints ─────────────────────────

@app.route('/api/whatsapp-webhook', methods=['POST'])
def whatsapp_webhook():
    """Receives incoming messages forwarded from the Node.js WhatsApp Web client."""
    payload = request.json
    try:
        # Pass to the WhatsAppAdmin instance running inside the background daemon
        daemon.wa_admin.handle_incoming_message(payload)
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/whatsapp-status', methods=['GET'])
def whatsapp_status():
    """Checks the connection status of the local Node.js WhatsApp Web client."""
    try:
        # Call status of local Node.js bridge server
        res = requests.get("http://127.0.0.1:3000/status", timeout=2)
        if res.status_code == 200:
            return jsonify(res.json())
    except Exception:
        pass
    return jsonify({"status": "OFFLINE", "qr": False})

@app.route('/api/whatsapp-chats', methods=['GET'])
def whatsapp_chats():
    """Fetches the list of active chats/groups/channels from the local Node.js bridge."""
    try:
        res = requests.get("http://127.0.0.1:3000/chats", timeout=5)
        if res.status_code == 200:
            return jsonify(res.json())
        return jsonify({"success": False, "error": f"Bridge returned HTTP {res.status_code}"}), res.status_code
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

active_whatsapp_jids = []

@app.route('/api/whatsapp-active-jid', methods=['POST'])
def whatsapp_active_jid():
    """Receives and stores a recently active WhatsApp Chat ID."""
    payload = request.json
    chat_id = payload.get("chatId")
    name = payload.get("name")
    is_group = payload.get("isGroup", False)
    is_channel = payload.get("isChannel", False)
    text = payload.get("text", "")
    
    if not chat_id:
        return jsonify({"success": False, "error": "chatId required"}), 400
        
    global active_whatsapp_jids
    # Remove existing duplicate
    active_whatsapp_jids = [x for x in active_whatsapp_jids if x["chatId"] != chat_id]
    
    # Prepend new active JID
    active_whatsapp_jids.insert(0, {
        "chatId": chat_id,
        "name": name or chat_id,
        "isGroup": is_group,
        "isChannel": is_channel,
        "lastText": text[:40],
        "timestamp": time.strftime("%H:%M:%S")
    })
    
    # Cap at 10 items
    active_whatsapp_jids = active_whatsapp_jids[:10]
    return jsonify({"success": True})

@app.route('/api/whatsapp-active-jids', methods=['GET'])
def whatsapp_active_jids_get():
    """Returns the list of recently active JIDs."""
    return jsonify({"success": True, "jids": active_whatsapp_jids})

# ─── Chat AI Agent Endpoint ──────────────────────────────────────────────────

@app.route('/api/chat', methods=['POST'])
def chat():
    """Chat endpoint to process user commands via LLMs or fallback regex parser."""
    message = request.json.get('message', '').strip()
    if not message:
        return jsonify({"reply": "I couldn't hear you. Please send a message!"})
        
    settings = daemon.load_settings()
    gemini_key = settings.get("google_api_key", "").strip()
    ollama_enabled = settings.get("ollama_enabled", False)
    
    # Let's route the message to the best available intelligence
    if ollama_enabled:
        reply = process_with_ollama(message, settings.get("ollama_model", "llama3"))
    elif gemini_key:
        reply = process_with_gemini(message, gemini_key)
    else:
        reply = process_with_rules(message)
        
    return jsonify({"reply": reply})

# ─── Intelligence Engines ────────────────────────────────────────────────────

SYSTEM_PROMPT = """
You are Cooper, a helpful local AI agent that manages a sports streaming site.
You can carry out user requests by calling specific commands.
When you output your response, choose exactly ONE of the following JSON actions based on the user's intent. Do not output anything else other than raw JSON.

JSON Schema format to follow:
{
  "action": "add_match" | "delete_match" | "scrape_streams" | "score_sync" | "push_github" | "set_autopilot" | "get_logs" | "list_matches" | "post_all_to_blogger" | "chat_reply",
  "home_team": "Home team name if adding",
  "away_team": "Away team name if adding",
  "date": "ISO date string (YYYY-MM-DDTHH:MM:00Z) if adding",
  "time": "Display time string (e.g. 8:30 PM) if adding",
  "sport": "football" | "cricket" (default football),
  "league": "Tournament/league name if adding",
  "watch_url": "Streaming watch link if provided",
  "thumbnail": "Thumbnail / cover image URL if provided",
  "id": "Match ID to delete",
  "url": "Scraping URL target",
  "enabled": true | false (for autopilot),
  "reply": "Conversational text reply if action is chat_reply"
}
"""

def execute_agent_action(action_data):
    """Executes structural agent command outputs."""
    action = action_data.get('action')
    
    if action == 'add_match':
        # Create match entry
        try:
            matches = []
            if os.path.exists(MATCHES_JSON_PATH):
                with open(MATCHES_JSON_PATH, 'r') as f:
                    matches = json.load(f).get('matches', [])
            
            # Auto logo mappings
            home = action_data.get('home_team', 'TBD')
            away = action_data.get('away_team', 'TBD')
            
            new_match = {
                "id": f"match_ai_{int(time.time() * 1000)}",
                "sport": action_data.get('sport', 'football'),
                "home_team": home,
                "home_logo": "https://i.ibb.co/qF41b08G/HELLO-THUM.png",
                "away_team": away,
                "away_logo": "https://i.ibb.co/qF41b08G/HELLO-THUM.png",
                "time": action_data.get('time', '8:30 PM'),
                "date": action_data.get('date', datetime.datetime.now().isoformat() + 'Z'),
                "league": action_data.get('league', 'World Cup'),
                "group": "",
                "is_live": False,
                "is_finished": False,
                "home_score": "0",
                "away_score": "0",
                "watch_url": action_data.get('watch_url', ''),
                "thumbnail": action_data.get('thumbnail', '')
            }
            matches.append(new_match)
            
            out_data = {
                "success": True,
                "matches": matches,
                "last_updated": datetime.datetime.now(datetime.timezone.utc).isoformat()
            }
            with open(MATCHES_JSON_PATH, 'w') as f:
                json.dump(out_data, f, indent=2)
                
            return f"✅ Added match: *{home} vs {away}* on {new_match['time']}."
        except Exception as e:
            return f"❌ Failed to add match: {e}"
            
    elif action == 'delete_match':
        match_id = action_data.get('id')
        if not match_id:
            return "❌ Which match would you like to delete? I need a match ID."
        try:
            with open(MATCHES_JSON_PATH, 'r') as f:
                data = json.load(f)
            matches = data.get('matches', [])
            filtered = [m for m in matches if m.get('id') != match_id]
            
            if len(filtered) == len(matches):
                return f"❌ Match ID `{match_id}` was not found."
                
            data['matches'] = filtered
            with open(MATCHES_JSON_PATH, 'w') as f:
                json.dump(data, f, indent=2)
            return f"🗑️ Deleted match ID `{match_id}`."
        except Exception as e:
            return f"❌ Delete error: {e}"
            
    elif action == 'scrape_streams':
        url = action_data.get('url')
        if not url:
            return "❌ URL required to scrape streams."
        try:
            res = scrape_streams(url)
            if not res:
                return "🔍 Scraped site but found no active stream formats (.m3u8 or player embeds)."
            
            links_text = "\n".join([f"- [{s['type'].upper()}] {s['label']}: `{s['url']}`" for s in res])
            return f"📡 **Scraped Streaming Sources from {url}:**\n{links_text}"
        except Exception as e:
            return f"❌ Scraping failure: {e}"
            
    elif action == 'score_sync':
        try:
            cwd = os.path.dirname(SCRAPER_SCRIPT_PATH)
            res = subprocess.run([sys.executable, "scraper.py"], cwd=cwd, capture_output=True, text=True)
            if res.returncode == 0:
                return "⚡ Score syncing complete! Live matches have been updated in `matches.json`."
            return f"❌ Score scraping failed: {res.stderr}"
        except Exception as e:
            return f"❌ Score script error: {e}"
            
    elif action == 'push_github':
        success = daemon.git_commit_and_push("Update from AI Agent Chat")
        if success:
            return "🚀 Successfully committed changes and pushed to GitHub main!"
        return "❌ Git push failed. Verify repository credentials."
        
    elif action == 'set_autopilot':
        enabled = action_data.get('enabled', False)
        s = daemon.load_settings()
        s['autopilot_enabled'] = enabled
        daemon.save_settings(s)
        state = "ENABLED" if enabled else "DISABLED"
        return f"🤖 Autopilot background daemon is now *{state}*."
        
    elif action == 'get_logs':
        logs = get_logs_tail(15)
        return f"📋 **Recent Agent Logs:**\n```\n{logs}\n```"
        
    elif action == 'post_all_to_blogger':
        try:
            with open(MATCHES_JSON_PATH, 'r') as f:
                matches = json.load(f).get('matches', [])
            upcoming = [m for m in matches if not m.get('is_finished') and not m.get('is_live')]
            if not upcoming:
                return "📅 No upcoming matches found in schedule to post."
            
            force_new = action_data.get('force', False)
            if force_new:
                log_message("Blogger Publisher: FORCE REPUBLISH requested. Clearing blogger_post_id for all upcoming matches.")
                for m in upcoming:
                    if 'blogger_post_id' in m:
                        del m['blogger_post_id']
            
            count_new = 0
            count_updated = 0
            updated = False
            for m in upcoming:
                watch_url = m.get('watch_url') or ""
                is_update = bool(m.get('blogger_post_id'))
                
                # Reconstruct original GitHub player URL if already published on Blogger
                if "blogspot." in watch_url or "blogger." in watch_url or "thinkgovtjobs." in watch_url:
                    h_slug = re.sub(r'[^a-z0-9]', '-', m.get('home_team', '').lower())
                    a_slug = re.sub(r'[^a-z0-9]', '-', m.get('away_team', '').lower())
                    watch_url = f"https://{daemon.settings.get('github_username', 'Mubthaseem')}.github.io/{daemon.settings.get('github_repo', 'zetasports-flutter')}/watch/{h_slug}-vs-{a_slug}.html"

                if not watch_url:
                    h_slug = re.sub(r'[^a-z0-9]', '-', m.get('home_team', '').lower())
                    a_slug = re.sub(r'[^a-z0-9]', '-', m.get('away_team', '').lower())
                    watch_url = f"https://{daemon.settings.get('github_username', 'Mubthaseem')}.github.io/{daemon.settings.get('github_repo', 'zetasports-flutter')}/watch/{h_slug}-vs-{a_slug}.html"
                
                blogger_url = daemon.post_to_blogger(m, watch_url)
                if blogger_url:
                    m['watch_url'] = blogger_url
                    updated = True
                    if is_update:
                        count_updated += 1
                    else:
                        count_new += 1
                
                # Add 5-second sleep to prevent Blogger API rate limiting (HTTP 429)
                time.sleep(5)
            
            if updated:
                out_data = {
                    "success": True,
                    "matches": matches,
                    "last_updated": datetime.datetime.now(datetime.timezone.utc).isoformat()
                }
                with open(MATCHES_JSON_PATH, 'w') as f:
                    json.dump(out_data, f, indent=2)
                    
            return f"📝 Successfully processed matches: {count_new} new posts published, {count_updated} existing posts updated on Blogger!"
        except Exception as e:
            return f"❌ Failed to publish upcoming matches: {e}"
    elif action == 'list_matches':
        try:
            with open(MATCHES_JSON_PATH, 'r') as f:
                matches = json.load(f).get('matches', [])
            if not matches:
                return "📅 No matches scheduled in `matches.json`."
            
            lines = []
            for m in matches:
                status = "🟢 LIVE" if m['is_live'] else ("⚫ FT" if m['is_finished'] else "🕒 UPCOMING")
                lines.append(f"- *{m['home_team']} vs {m['away_team']}* ({m['time']}) | {status} | Score: {m['home_score']}-{m['away_score']} | ID: `{m['id']}`")
            return "📅 **Current Match Schedule:**\n" + "\n".join(lines)
        except Exception as e:
            return f"❌ Error loading matches: {e}"
            
    return action_data.get('reply', "How can I help you today?")

def process_with_gemini(message, key):
    """Sends query to Gemini API."""
    url = f"https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key={key}"
    headers = {"Content-Type": "application/json"}
    payload = {
        "contents": [{"parts": [{"text": f"{SYSTEM_PROMPT}\nUser Query: {message}"}]}]
    }
    try:
        r = requests.post(url, json=payload, headers=headers, timeout=15)
        if r.status_code == 200:
            res_json = r.json()
            text = res_json['candidates'][0]['content']['parts'][0]['text']
            action_data = json.loads(text.strip())
            return execute_agent_action(action_data)
        else:
            return f"⚠️ Gemini API Error (Status {r.status_code}): {r.text}. Falling back to Rule-Based parser."
    except Exception as e:
        print(f"Gemini API failure: {e}")
        return process_with_rules(message)

def process_with_ollama(message, model):
    """Sends query to local Ollama server."""
    url = "http://localhost:11434/api/generate"
    payload = {
        "model": model,
        "prompt": f"{SYSTEM_PROMPT}\nUser Query: {message}",
        "format": "json",
        "stream": False
    }
    try:
        r = requests.post(url, json=payload, timeout=20)
        if r.status_code == 200:
            text = r.json().get('response', '{}')
            action_data = json.loads(text.strip())
            return execute_agent_action(action_data)
        else:
            return f"⚠️ Ollama Error (Status {r.status_code}). Falling back to Rule-Based parser."
    except Exception as e:
        print(f"Ollama failure: {e}")
        return process_with_rules(message)

def process_with_rules(message):
    """Rule-Based Regex command interpreter (fallback)."""
    m = message.lower().strip()
    
    # 1. Add match
    # e.g., "add match France vs Senegal tomorrow at 8:30 PM"
    add_match_match = re.search(r'add\s+(?:football\s+|cricket\s+)?match\s+([^v]+)\s+vs\s+([^\s]+)\s+(?:at\s+([0-9:]+\s*[a-z]+))?', m)
    if add_match_match:
        home = add_match_match.group(1).title().strip()
        away = add_match_match.group(2).title().strip()
        time_str = add_match_match.group(3) or "8:30 PM"
        
        # Call execute action
        return execute_agent_action({
            "action": "add_match",
            "home_team": home,
            "away_team": away,
            "time": time_str.upper(),
            "date": datetime.datetime.now().isoformat() + 'Z',
            "league": "World Cup"
        })
        
    # 2. Delete match
    delete_match = re.search(r'(?:delete|remove)\s+(?:match\s+)?(match_[a-zA-Z0-9_]+)', m)
    if delete_match:
        mid = delete_match.group(1)
        return execute_agent_action({"action": "delete_match", "id": mid})
        
    # 3. Scrape streams
    scrape_match = re.search(r'(?:scrape|find)\s+streams?\s+(?:from\s+)?(https?://[^\s]+)', m)
    if scrape_match:
        url = scrape_match.group(1)
        return execute_agent_action({"action": "scrape_streams", "url": url})
        
    # 4. Sync scores
    if any(k in m for k in ['sync scores', 'run scraper', 'update score', 'score sync']):
        return execute_agent_action({"action": "score_sync"})
        
    # 5. Push changes
    if any(k in m for k in ['push', 'git push', 'deploy', 'upload github']):
        return execute_agent_action({"action": "push_github"})
        
    # 6. Autopilot controls
    if "enable autopilot" in m or "turn on autopilot" in m:
        return execute_agent_action({"action": "set_autopilot", "enabled": True})
    if "disable autopilot" in m or "turn off autopilot" in m:
        return execute_agent_action({"action": "set_autopilot", "enabled": False})
        
    # 7. Get logs
    if "logs" in m or "view logs" in m:
        return execute_agent_action({"action": "get_logs"})
        
    # 8. Post all upcoming matches to Blogger
    if any(k in m for k in ['add all upcoming matches to blogger', 'post upcoming to blogger', 'publish upcoming matches', 'add matches to blogger', 'republish matches']):
        force = "force" in m or "republish" in m
        return execute_agent_action({"action": "post_all_to_blogger", "force": force})
        
    # 9. List matches
    if any(k in m for k in ['list matches', 'show schedule', 'matches', 'show matches']):
        return execute_agent_action({"action": "list_matches"})
        
    # Default chat response
    return (
        "🤖 **Cooper is ready!**\n\n"
        "You can control me using natural language. Try saying:\n"
        "- *'List all scheduled matches'*\n"
        "- *'Add match Germany vs Spain at 9:00 PM'*\n"
        "- *'Delete match match_ai_12345'*\n"
        "- *'Scrape streams from http://stream-link.com'*\n"
        "- *'Run score sync now'*\n"
        "- *'Push changes to GitHub'*\n"
        "- *'Enable/Disable Autopilot mode'*\n\n"
        "💡 *Note:* I will automatically post harvested stream links and health recovery alerts directly to your configured Telegram and WhatsApp groups!"
    )

@app.route('/api/telegram/command', methods=['POST', 'OPTIONS'])
def telegram_command():
    if request.method == 'OPTIONS':
        resp = app.make_default_options_response()
        resp.headers['Access-Control-Allow-Origin'] = '*'
        resp.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        resp.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        return resp
    try:
        data = request.json or {}
        text = data.get("text", "").strip()
        if not text:
            resp = jsonify({"success": False, "error": "Empty command"})
            resp.headers['Access-Control-Allow-Origin'] = '*'
            return resp
            
        settings = daemon.load_settings()
        token = settings.get("telegram_token")
        chat_id = settings.get("telegram_chat_id") or "1386396531"  # Default owner chat ID
        
        from telegram_bot import handle_admin_command
        reply_msg = handle_admin_command(token, chat_id, text)
        
        resp = jsonify({
            "success": True,
            "reply": reply_msg
        })
        resp.headers['Access-Control-Allow-Origin'] = '*'
        return resp
    except Exception as e:
        resp = jsonify({"success": False, "error": str(e)})
        resp.headers['Access-Control-Allow-Origin'] = '*'
        return resp, 500

@app.route('/api/telegram/status', methods=['GET', 'OPTIONS'])
def telegram_status():
    if request.method == 'OPTIONS':
        resp = app.make_default_options_response()
        resp.headers['Access-Control-Allow-Origin'] = '*'
        resp.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
        resp.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        return resp
    try:
        settings = daemon.load_settings()
        token = settings.get("telegram_token")
        chat_id = settings.get("telegram_chat_id") or "1386396531"
        source_chat = settings.get("telegram_forward_source_id")
        
        bot_name = "ZetaSports Admin Bot"
        is_valid = False
        if token:
            try:
                res = requests.get(f"https://api.telegram.org/bot{token}/getMe", timeout=5)
                if res.status_code == 200:
                    bot_name = res.json().get("result", {}).get("first_name", bot_name)
                    is_valid = True
            except Exception:
                pass
                
        resp = jsonify({
            "success": True,
            "bot_name": bot_name,
            "token_configured": bool(token),
            "token_valid": is_valid,
            "chat_id": chat_id,
            "source_chat": source_chat,
            "daemon_running": daemon.running
        })
        resp.headers['Access-Control-Allow-Origin'] = '*'
        return resp
    except Exception as e:
        resp = jsonify({"success": False, "error": str(e)})
        resp.headers['Access-Control-Allow-Origin'] = '*'
        return resp, 500

if __name__ == '__main__':
    log_message("Flask Web Controller started.")
    app.run(host='0.0.0.0', port=5000, debug=False)
