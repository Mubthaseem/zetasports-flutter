import os
import json
import re
import time
import threading
import sys
import subprocess
import requests
import hashlib
import hmac
from telegram_bot import handle_admin_command

# Set up paths relative to this file
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
SETTINGS_FILE = os.path.join(CURRENT_DIR, 'settings.json')
MATCHES_JSON_PATH = os.path.abspath(os.path.join(CURRENT_DIR, '../blogger-widgets/matches.json'))
SCRAPER_SCRIPT_PATH = os.path.abspath(os.path.join(CURRENT_DIR, '../blogger-widgets/scraper.py'))
TELEGRAM_OFFSET_FILE = os.path.join(CURRENT_DIR, 'telegram_offset.txt')
BRIDGE_URL = "http://127.0.0.1:3000"

def log_msg(message):
    """Logs to daemon log structure."""
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    log_line = f"[{timestamp}] [WhatsAppAdmin] {message}"
    print(log_line)
    log_file = os.path.join(CURRENT_DIR, 'agent.log')
    try:
        with open(log_file, 'a', encoding='utf-8') as f:
            f.write(log_line + "\n")
    except Exception as e:
        print(f"Error logging: {e}")

class WhatsAppAdmin:
    def __init__(self):
        self.telegram_thread = None
        self.running = False
        self.lock = threading.Lock()

    def start(self):
        """Starts the Telegram forwarder background thread."""
        with self.lock:
            if not self.running:
                self.running = True
                self.telegram_thread = threading.Thread(target=self.telegram_forwarder_loop, daemon=True)
                self.telegram_thread.start()
                log_msg("Background Telegram-to-WhatsApp forwarder started.")

    def stop(self):
        """Stops the Telegram forwarder background thread."""
        with self.lock:
            if self.running:
                self.running = False
                log_msg("Background Telegram-to-WhatsApp forwarder stopping...")

    # ─── Bridge Communicator ──────────────────────────────────────────────────

    def send_message(self, chat_id, message):
        """Sends a message via the Node.js WhatsApp bridge."""
        if not chat_id or not message:
            return None
        try:
            url = f"{BRIDGE_URL}/send-message"
            payload = {"chatId": chat_id, "message": message}
            res = requests.post(url, json=payload, timeout=10)
            if res.status_code == 200:
                data = res.json()
                if data.get("success"):
                    return data.get("messageId")
            log_msg(f"Failed to send message: HTTP {res.status_code} - {res.text}")
        except Exception as e:
            log_msg(f"Error calling send-message bridge: {e}")
        return None

    def delete_message(self, chat_id, message_id):
        """Deletes a message via the Node.js WhatsApp bridge."""
        if not chat_id or not message_id:
            return False
        try:
            url = f"{BRIDGE_URL}/delete-message"
            payload = {"chatId": chat_id, "messageId": message_id}
            res = requests.post(url, json=payload, timeout=10)
            if res.status_code == 200:
                return res.json().get("success", False)
            log_msg(f"Failed to delete message: HTTP {res.status_code} - {res.text}")
        except Exception as e:
            log_msg(f"Error calling delete-message bridge: {e}")
        return False

    # ─── Webhook Handler (Flask -> here) ──────────────────────────────────────

    def handle_incoming_message(self, payload):
        """Handles a message forwarded from the Node.js WhatsApp Web client."""
        chat_id = payload.get("chatId")
        message_id = payload.get("messageId")
        sender = payload.get("sender")
        sender_name = payload.get("senderName", "WhatsApp User")
        text = payload.get("text", "").strip()
        is_group = payload.get("isGroup", False)

        if not chat_id or not text:
            return

        # Load settings
        settings = self.load_settings()
        if not settings.get("whatsapp_admin_enabled", False):
            return

        # 1. Moderation Check (if Group chat)
        if is_group and settings.get("whatsapp_moderation_enabled", False):
            violation, reason = self.check_moderation(text, settings)
            if violation:
                log_msg(f"Moderation trigger: {sender_name} in {chat_id} violated rules. Reason: {reason}")
                # Delete message
                self.delete_message(chat_id, message_id)
                # Send Warning
                warning = f"⚠️ *Admin Moderation Warning*:\n@{sender_name}, your message was deleted.\nReason: {reason}.\nPlease follow the group rules."
                self.send_message(chat_id, warning)
                return

        # 2. Command Check (starts with /)
        if text.startswith("/"):
            self.process_command(chat_id, text, sender, sender_name, is_group, settings)
            return

        # 3. Mention Check (if group) or DM Check
        is_mentioned = False
        if is_group:
            # Check if mentioned or name Cooper/bot is typed
            bot_tag = "@bot"
            if bot_tag in text or "cooper" in text.lower() or "admin" in text.lower():
                is_mentioned = True
        else:
            # Private chat - always reply to messages
            is_mentioned = True

        if is_mentioned:
            log_msg(f"Processing AI reply for {sender_name} in {chat_id}...")
            # Clean up the text (remove tag)
            clean_text = text.replace("@bot", "").strip()
            reply = self.generate_ai_response(clean_text, settings)
            self.send_message(chat_id, reply)

    # ─── Moderation Logic ─────────────────────────────────────────────────────

    def check_moderation(self, text, settings):
        """Checks if a message violates group rules."""
        # Check allowed domains
        allowed_domains = settings.get("whatsapp_allowed_domains", ["blogspot.com", "github.io", "thinkgovtjobs.com"])
        
        # Regex to find domains
        urls = re.findall(r'https?://(?:www\.)?([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+)', text.lower())
        for domain in urls:
            is_allowed = False
            for allowed in allowed_domains:
                if domain == allowed or domain.endswith("." + allowed):
                    is_allowed = True
                    break
            if not is_allowed:
                return True, f"Link to unauthorized domain: {domain}"

        # Profanity/Spam checks based on rules
        rules = settings.get("whatsapp_moderation_rules", "").lower()
        if "spam" in rules or "scam" in rules:
            spam_triggers = ["free money", "earn fast", "crypto double", "telegram.me/", "t.me/joinchat"]
            for trigger in spam_triggers:
                if trigger in text.lower():
                    return True, "Spam link or trigger text detected"

        return False, ""

    # ─── Command Interpreter ──────────────────────────────────────────────────

    def process_command(self, chat_id, command_text, sender, sender_name, is_group, settings):
        """Processes slash commands."""
        parts = command_text.split(" ", 1)
        cmd = parts[0].lower()
        args = parts[1].strip() if len(parts) > 1 else ""

        log_msg(f"Processing command '{cmd}' from {sender_name} in {chat_id}")

        if cmd in ["/help", "/menu"]:
            help_text = (
                "🤖 *Cooper Local AI Admin Menu*\n\n"
                "Commands available:\n"
                "- `/matches` or `/schedule` - Show scheduled matches.\n"
                "- `/streams` - Show active stream links.\n"
                "- `/sync` - Run live FotMob score synchronization.\n"
                "- `/help` - Show this menu.\n"
            )
            # DM-only admin commands
            if not is_group:
                help_text += (
                    "- `/publish` - Publish upcoming matches to Blogger.\n"
                    "- `/broadcast <msg>` - Post an update to the WhatsApp Channel.\n"
                    "- `/status` - View local system and daemon status.\n"
                )
            self.send_message(chat_id, help_text)

        elif cmd in ["/matches", "/schedule"]:
            schedule = self.get_schedule_text()
            self.send_message(chat_id, schedule)

        elif cmd == "/streams":
            streams = self.get_streams_text()
            self.send_message(chat_id, streams)

        elif cmd == "/sync":
            self.send_message(chat_id, "⚡ *Syncing live scores... Please wait.*")
            success, output = self.run_score_sync()
            if success:
                self.send_message(chat_id, "✅ *Score synchronization complete!*\nSchedule has been updated.")
            else:
                self.send_message(chat_id, f"❌ *Score sync failed*:\n{output}")

        elif cmd == "/publish":
            if is_group:
                return # Admin command only in DM
            self.send_message(chat_id, "📝 *Publishing upcoming matches to Blogger...*")
            success, output = self.publish_to_blogger(settings)
            self.send_message(chat_id, output)

        elif cmd == "/broadcast":
            if is_group:
                return # Admin command only in DM
            channel_id = settings.get("whatsapp_channel_id")
            if not channel_id:
                self.send_message(chat_id, "❌ *No WhatsApp Channel ID configured in settings.*")
                return
            if not args:
                self.send_message(chat_id, "❌ *Usage*: `/broadcast <your message>`")
                return
            
            self.send_message(chat_id, f"📢 *Broadcasting to Channel...*")
            success = self.send_message(channel_id, args)
            if success:
                self.send_message(chat_id, "✅ *Successfully posted to Channel!*")
            else:
                self.send_message(chat_id, "❌ *Failed to post to Channel. Verify channel JID.*")

        elif cmd == "/status":
            if is_group:
                return
            status_text = (
                "🖥️ *ZetaSports Local System Status*\n\n"
                f"- *Autopilot Enabled*: {settings.get('autopilot_enabled', False)}\n"
                f"- *Ollama Enabled*: {settings.get('ollama_enabled', False)} ({settings.get('ollama_model', 'llama3')})\n"
                f"- *WhatsApp Admin*: {settings.get('whatsapp_admin_enabled', False)}\n"
                f"- *WhatsApp Channel*: {settings.get('whatsapp_channel_id', 'None')}\n"
                f"- *Group Moderation*: {settings.get('whatsapp_moderation_enabled', False)}\n"
                f"- *Telegram Forwarding*: {settings.get('telegram_forward_enabled', False)}\n"
                f"- *Time*: {time.strftime('%Y-%m-%d %H:%M:%S')}"
            )
            self.send_message(chat_id, status_text)

    # ─── Data Formatters ──────────────────────────────────────────────────────

    def get_schedule_text(self):
        """Loads and formats the schedule from matches.json."""
        if not os.path.exists(MATCHES_JSON_PATH):
            return "📅 No match schedule file found."
        try:
            with open(MATCHES_JSON_PATH, 'r') as f:
                data = json.load(f)
            matches = data.get('matches', [])
            if not matches:
                return "📅 *No matches scheduled in system.*"
            
            lines = ["⚽ *Current Match Schedule:*"]
            for m in matches:
                status = "🟢 LIVE" if m.get('is_live') else ("⚫ FT" if m.get('is_finished') else "🕒 Upcoming")
                score = f"{m.get('home_score')}-{m.get('away_score')}"
                lines.append(f"- *{m.get('home_team')} vs {m.get('away_team')}* ({m.get('time')})\n  Score: {score} | {status}")
            return "\n\n".join(lines)
        except Exception as e:
            return f"❌ Error reading schedule: {e}"

    def get_streams_text(self):
        """Formats the watch URLs for live/upcoming matches."""
        if not os.path.exists(MATCHES_JSON_PATH):
            return "📡 No match schedule file found."
        try:
            with open(MATCHES_JSON_PATH, 'r') as f:
                data = json.load(f)
            matches = data.get('matches', [])
            live_upcoming = [m for m in matches if not m.get('is_finished')]
            if not live_upcoming:
                return "📡 *No active or upcoming streams scheduled.*"
            
            lines = ["📡 *Active Streaming Links:*"]
            for m in live_upcoming:
                watch_url = m.get('watch_url', '')
                if watch_url:
                    lines.append(f"⚽ *{m.get('home_team')} vs {m.get('away_team')}*\n🔗 Link: {watch_url}")
                else:
                    lines.append(f"⚽ *{m.get('home_team')} vs {m.get('away_team')}*\n🔗 Link: _TBD (Sync Pending)_")
            return "\n\n".join(lines)
        except Exception as e:
            return f"❌ Error reading streams: {e}"

    def run_score_sync(self):
        """Runs the FotMob live score scraper.py."""
        try:
            cwd = os.path.dirname(SCRAPER_SCRIPT_PATH)
            res = subprocess.run([sys.executable, "scraper.py"], cwd=cwd, capture_output=True, text=True)
            return res.returncode == 0, res.stdout or res.stderr
        except Exception as e:
            return False, str(e)

    def publish_to_blogger(self, settings):
        """Triggers Blogger publisher logic via local HTTP or daemon method."""
        # Simple local execution of blogger publisher helper
        # To avoid circular imports, we call local-agent/local_agent.py api endpoint locally!
        try:
            res = requests.post("http://localhost:5000/api/chat", json={
                "message": "post upcoming to blogger"
            }, timeout=20)
            if res.status_code == 200:
                reply = res.json().get("reply", "No reply")
                return True, reply
            return False, f"HTTP Error {res.status_code}"
        except Exception as e:
            return False, f"Blogger publish request failed: {e}"

    # ─── AI Response Generation ───────────────────────────────────────────────

    def generate_ai_response(self, text, settings):
        """Generates AI response using Gemini, Ollama, or rules."""
        gemini_key = settings.get("google_api_key", "").strip()
        ollama_enabled = settings.get("ollama_enabled", False)
        ollama_model = settings.get("ollama_model", "llama3")

        matches_context = self.get_matches_context()

        system_prompt = (
            "You are Cooper, a helpful local sports assistant and administrator of the sports website zetasports.blog.\n"
            "You provide details about scheduled matches, stream links, and help configure the site.\n"
            "Keep your responses concise, friendly, and formatted using WhatsApp markdown (*bold*, _italics_).\n\n"
            f"{matches_context}"
        )

        if ollama_enabled:
            # Query local Ollama
            try:
                url = "http://localhost:11434/api/generate"
                payload = {
                    "model": ollama_model,
                    "prompt": f"{system_prompt}\nUser: {text}\nCooper:",
                    "stream": False
                }
                r = requests.post(url, json=payload, timeout=20)
                if r.status_code == 200:
                    return r.json().get("response", "").strip()
            except Exception as e:
                log_msg(f"Ollama AI failed: {e}. Falling back...")

        if gemini_key:
            # Query Gemini API
            try:
                url = f"https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key={gemini_key}"
                headers = {"Content-Type": "application/json"}
                prompt_content = f"{system_prompt}\nUser Question: {text}"
                payload = {
                    "contents": [{"parts": [{"text": prompt_content}]}]
                }
                r = requests.post(url, json=payload, headers=headers, timeout=15)
                if r.status_code == 200:
                    return r.json()['candidates'][0]['content']['parts'][0]['text'].strip()
            except Exception as e:
                log_msg(f"Gemini AI failed: {e}. Falling back...")

        # Rule-Based fallback
        text_lower = text.lower()
        if "hello" in text_lower or "hi" in text_lower:
            return "👋 *Hello! I am Cooper, your Sports AI Admin.* How can I help you today? Type `/help` to see my commands!"
        if "schedule" in text_lower or "play" in text_lower or "matches" in text_lower:
            return self.get_schedule_text()
        if "stream" in text_lower or "link" in text_lower or "watch" in text_lower:
            return self.get_streams_text()
        
        return "🤖 *Cooper is online!* Type `/help` to see what I can do."

    def get_matches_context(self):
        """Extracts text context of the schedule for AI injecting."""
        if not os.path.exists(MATCHES_JSON_PATH):
            return "No match schedule available."
        try:
            with open(MATCHES_JSON_PATH, 'r') as f:
                data = json.load(f)
            matches = data.get('matches', [])
            if not matches:
                return "No matches are scheduled."
            lines = []
            for m in matches:
                status = "LIVE" if m.get('is_live') else ("FT" if m.get('is_finished') else "Upcoming")
                score = f"{m.get('home_score')}-{m.get('away_score')}"
                lines.append(f"- {m.get('home_team')} vs {m.get('away_team')} ({status}, Score: {score}, Time: {m.get('time')}, Watch URL: {m.get('watch_url', 'TBD')})")
            return "Current Match Schedule context:\n" + "\n".join(lines)
        except Exception:
            return "Could not read match context."

    # ─── Telegram Forwarder Loop ──────────────────────────────────────────────

    def telegram_forwarder_loop(self):
        """Background loop to poll Telegram and forward messages to WhatsApp."""
        log_msg("Telegram-to-WhatsApp forwarder thread active.")
        
        # Load offset
        offset = 0
        if os.path.exists(TELEGRAM_OFFSET_FILE):
            try:
                with open(TELEGRAM_OFFSET_FILE, 'r') as f:
                    offset = int(f.read().strip())
            except Exception:
                pass

        while self.running:
            try:
                settings = self.load_settings()
                
                # Check if forwarding is enabled
                enabled = settings.get("telegram_forward_enabled", False)
                token = settings.get("telegram_token")
                source_chat = str(settings.get("telegram_forward_source_id", "")).strip()
                whatsapp_chan_raw = settings.get("whatsapp_channel_id", "")
                
                # Split whatsapp_channel_id by commas to get a list of chats (groups/channels)
                whatsapp_chats_list = [x.strip() for x in whatsapp_chan_raw.split(",") if x.strip()]

                log_msg(f"Config checking: enabled={enabled}, token_len={len(token) if token else 0}, source_chat='{source_chat}', whatsapp_chats={whatsapp_chats_list}")

                if not enabled:
                    time.sleep(10)
                    continue

                if not token or not source_chat or not whatsapp_chats_list:
                    # Missing credentials/IDS
                    time.sleep(10)
                    continue



                # Poll Telegram Updates
                url = f"https://api.telegram.org/bot{token}/getUpdates"
                params = {"timeout": 15}
                if offset:
                    params["offset"] = offset

                try:
                    res = requests.get(url, params=params, timeout=20)
                except Exception:
                    time.sleep(5)
                    continue

                if res.status_code != 200:
                    time.sleep(5)
                    continue

                data = res.json()
                if not data.get("ok"):
                    time.sleep(5)
                    continue

                results = data.get("result", [])
                if results:
                    log_msg(f"Polled Telegram: Fetched {len(results)} new updates.")
                
                for update in results:
                    update_id = update.get("update_id")
                    # Increment offset
                    offset = update_id + 1
                    # Save offset
                    try:
                        with open(TELEGRAM_OFFSET_FILE, 'w') as f:
                            f.write(str(offset))
                    except Exception:
                        pass

                    # Check if callback_query is present
                    if "callback_query" in update:
                        self.handle_callback_query(token, update["callback_query"])
                        continue

                    # Extract message or channel_post
                    post = update.get("message") or update.get("channel_post")
                    if not post:
                        log_msg(f"Update {update_id} has no message/channel_post. Skipping.")
                        continue

                    chat = post.get("chat", {})
                    chat_id = str(chat.get("id"))
                    chat_username = str(chat.get("username", ""))
                    chat_title = str(chat.get("title", ""))
                    
                    log_msg(f"Processing Telegram post: update_id={update_id}, chat_id={chat_id}, username={chat_username}, title={chat_title}")

                    # Strict validation:
                    # Allow only if:
                    # 1. It is sent by the owner (Mubthaseem28 / ID 1386396531)
                    # 2. Or it is a channel post from the monitored channel
                    sender = post.get("from", {})
                    sender_id = str(sender.get("id", ""))
                    sender_username = str(sender.get("username", "")).lower().lstrip("@")
                    
                    is_owner = (chat_id == "1386396531" or 
                                sender_id == "1386396531" or 
                                chat_username.lower().lstrip("@") == "mubthaseem28" or 
                                sender_username == "mubthaseem28")
                    
                    is_match = False
                    if is_owner:
                        is_match = True
                        log_msg("Message is from owner (Mubthaseem28). Allowing forwarding.")
                    else:
                        # Fallback: check if it is a channel post from monitored source channel
                        src_clean = source_chat.lower().lstrip("@")
                        usr_clean = chat_username.lower().lstrip("@")
                        
                        if source_chat == chat_id:
                            is_match = True
                        elif src_clean and src_clean == usr_clean:
                            is_match = True
                        elif source_chat.replace("-100", "") == chat_id.replace("-100", ""):
                            is_match = True
                            
                        if is_match:
                            log_msg(f"Channel post from monitored channel '{source_chat}'. Allowing forwarding.")
                            
                    if not is_match:
                        log_msg(f"Ignored message: chat_id={chat_id}, sender_id={sender_id}, sender_username={sender_username} (Not owner or monitored channel)")

                    if is_match:
                        # Extract message contents
                        text = post.get("text", "")
                        caption = post.get("caption", "")
                        
                        # Check for Admin Bot Commands from the owner
                        if is_owner and text and text.startswith("/"):
                            log_msg(f"Admin command received: {text}")
                            handle_admin_command(token, chat_id, text)
                            continue
                        
                        media_url = None
                        mimetype = None
                        filename = None
                        width = 1280
                        height = 720

                        if "video" in post:
                            video_obj = post["video"]
                            file_id = video_obj.get("file_id")
                            mimetype = video_obj.get("mime_type", "video/mp4")
                            filename = video_obj.get("file_name", "video.mp4")
                            media_url = self.get_telegram_file_url(token, file_id)
                            width = video_obj.get("width") or 1280
                            height = video_obj.get("height") or 720
                        elif "photo" in post:
                            photo_list = post["photo"]
                            if photo_list:
                                photo_obj = photo_list[-1]  # largest size
                                file_id = photo_obj.get("file_id")
                                mimetype = "image/jpeg"
                                filename = "photo.jpg"
                                media_url = self.get_telegram_file_url(token, file_id)
                        elif "document" in post:
                            doc_obj = post["document"]
                            file_id = doc_obj.get("file_id")
                            mimetype = doc_obj.get("mime_type", "application/octet-stream")
                            filename = doc_obj.get("file_name", "document")
                            media_url = self.get_telegram_file_url(token, file_id)
                            width = doc_obj.get("width") or 1280
                            height = doc_obj.get("height") or 720

                        # Check if it has media (photo/video/doc matching image or video)
                        is_video = ("video" in post) or (mimetype and "video" in mimetype)
                        is_image = ("photo" in post) or (mimetype and "image" in mimetype)
                        
                        if is_video or is_image:
                            media_type = "video" if is_video else "photo"
                            edited_url = None
                            if is_video and media_url:
                                log_msg(f"Video detected (update {update_id}) — pre-processing via Cloudinary to generate preview...")
                                try:
                                    edited_url = self.process_video_via_cloudinary(media_url, settings, width, height)
                                except Exception as e:
                                    log_msg(f"Error pre-processing video via Cloudinary: {e}")
                                    edited_url = None
                            
                            log_msg(f"Media post detected ({media_type}, update {update_id}) — sending approval request to owner.")
                            post_data = {
                                "media_url": media_url,
                                "edited_url": edited_url,
                                "mimetype": mimetype,
                                "filename": filename,
                                "caption": caption,
                                "text": text,
                                "chat_username": chat_username,
                                "media_type": media_type,
                                "width": width,
                                "height": height
                            }
                            self.save_pending_approval(update_id, post_data)
                            self.send_approval_request(token, update_id, media_type, caption or text, chat_username, edited_url)
                            continue  # Skip immediate automatic forwarding pipeline

                        # ── Routing Logic (User's preferred architecture) ─────────────
                        #   Step 0 → If video: Cloudinary processes it (resize 70% + border + watermark)
                        #             Cloudinary fetches from Telegram on THEIR servers. Zero local bandwidth!
                        #   Step 1 → Green API sends processed video → WhatsApp Channel
                        #             Green API downloads from Cloudinary on THEIR servers. Zero local bandwidth!
                        #   Step 2 → Local Bridge server-side forwards from Channel → 9 Groups
                        #             WhatsApp copies the video inside their cloud. Zero local bandwidth!
                        # ─────────────────────────────────────────────────────────────

                        green_instance = settings.get("whatsapp_instance_id")
                        green_token = settings.get("whatsapp_api_token")
                        use_green_api = bool(green_instance and green_token)

                        # Load group list from settings
                        raw_groups = settings.get("whatsapp_group_ids") or settings.get("whatsapp_chat_id", "")
                        group_jids = [j.strip() for j in raw_groups.split(",") if j.strip()]
                        channel_jid = settings.get("whatsapp_channel_id", "").strip()

                        # Step 0: If this is a video, process it via Cloudinary first
                        if media_url and mimetype and "video" in mimetype:
                            log_msg("Video detected — sending to Cloudinary for anti-copyright processing...")
                            media_url = self.process_video_via_cloudinary(media_url, settings)
                            filename = "zetasports_clip.mp4"

                        # Step 1: Green API sends processed video/text → WhatsApp Channel
                        channel_sent = False
                        channel_msg_id = None
                        if use_green_api and channel_jid and not channel_jid.endswith("@newsletter"):
                            log_msg(f"Sending to Channel {channel_jid} via Green API...")
                            channel_sent = self.send_to_green_api(green_instance, green_token, channel_jid, caption or text, media_url, filename)
                            if channel_sent:
                                time.sleep(5)  # Wait for channel post to register before forwarding
                        
                        # If Green API failed or not configured, fall back to local bridge for channel
                        if not channel_sent and channel_jid:
                            log_msg(f"Green API failed/unused for channel, falling back to local bridge...")
                            if media_url:
                                channel_msg_id = self.send_media(channel_jid, media_url, mimetype, filename, caption or text)
                            elif text or caption:
                                channel_msg_id = self.send_message(channel_jid, text or caption)
                            channel_sent = bool(channel_msg_id)

                        # Step 2: Forward the channel message directly to all 18 Groups via local bridge (keeps Forwarded tag)
                        groups_ok = 0
                        if channel_sent and group_jids:
                            if channel_msg_id and not channel_jid.endswith("@newsletter"):
                                log_msg(f"Forwarding channel message {channel_msg_id} to {len(group_jids)} groups via local bridge (keeps Forwarded tag)...")
                                groups_ok = self.forward_message_to_groups(channel_msg_id, group_jids)
                                if groups_ok == 0:
                                    log_msg("Forwarding failed, falling back to direct broadcasting...")
                                    groups_ok = self.send_to_groups(group_jids, media_url, mimetype, filename, caption or text)
                            else:
                                # Fallback if channel was posted via Green API and we don't have a local message ID, or if channel is newsletter
                                log_msg(f"Direct broadcasting to {len(group_jids)} groups...")
                                groups_ok = self.send_to_groups(group_jids, media_url, mimetype, filename, caption or text)

                        # Record forward event in history JSON
                        if channel_sent:
                            media_type = "text"
                            if mimetype:
                                if "video" in mimetype:
                                    media_type = "video"
                                elif "image" in mimetype:
                                    media_type = "image"
                                else:
                                    media_type = "document"
                            self.log_forward_history(update_id, chat_username, caption or text, media_type, channel_sent, groups_ok, len(group_jids))

            except Exception as e:
                log_msg(f"Exception in Telegram forwarder loop: {e}")
                time.sleep(5)
            
            # Simple sleep between checks if timeout is short
            time.sleep(2)

    def get_telegram_file_url(self, token, file_id):
        """Fetches the direct download URL for a file from Telegram using its file_id."""
        try:
            res = requests.get(f"https://api.telegram.org/bot{token}/getFile", params={"file_id": file_id}, timeout=10)
            if res.status_code == 200:
                data = res.json()
                if data.get("ok"):
                    file_path = data["result"]["file_path"]
                    return f"https://api.telegram.org/file/bot{token}/{file_path}"
        except Exception as e:
            log_msg(f"Error fetching Telegram file path: {e}")
        return None

    def send_media(self, chat_id, media_url, mimetype, filename, caption):
        """Sends a media file (image/video/doc) to a WhatsApp Chat ID via local bridge."""
        try:
            payload = {
                "chatId": chat_id,
                "mediaUrl": media_url,
                "mimetype": mimetype,
                "filename": filename,
                "caption": caption
            }
            res = requests.post("http://127.0.0.1:3000/send-media", json=payload, timeout=120)
            if res.status_code == 200:
                data = res.json()
                if data.get("success"):
                    return data.get("messageId")
            log_msg(f"Failed to send media via bridge: {res.status_code} {res.text}")
        except Exception as e:
            log_msg(f"Error calling send-media bridge endpoint: {e}")
        return None

    def process_video_via_cloudinary(self, telegram_video_url, settings, width=1280, height=720):
        """
        Tells Cloudinary to fetch the Telegram video URL on THEIR servers,
        apply anti-copyright transformations (shrink to 70%, black padding border,
        ZetaSports watermark), and returns a processed video URL.
        ZERO bytes of local internet bandwidth used!
        """
        try:
            cloud_name  = settings.get("cloudinary_cloud_name", "").strip()
            api_key     = settings.get("cloudinary_api_key", "").strip()
            api_secret  = settings.get("cloudinary_api_secret", "").strip()

            if not (cloud_name and api_key and api_secret):
                log_msg("Cloudinary credentials not configured, skipping video processing.")
                return telegram_video_url   # fall back to original URL

            log_msg("Uploading video to Cloudinary for server-side processing...")

            timestamp = str(int(time.time()))
            # Read dynamic video editing settings from settings
            scale_pct = settings.get("video_scale_percent", 70)
            opacity = settings.get("video_watermark_opacity", 60)
            logo_id = settings.get("cloudinary_logo_public_id", "").strip()
            
            logo_width = settings.get("cloudinary_logo_width", 150)
            logo_x = settings.get("cloudinary_logo_x", 20)
            logo_y = settings.get("cloudinary_logo_y", 20)
            logo_gravity = settings.get("cloudinary_logo_gravity", "south_east").strip()
            border_theme = settings.get("video_border_theme", "fifa_2026").strip()

            try:
                scale_pct = int(scale_pct)
            except Exception:
                scale_pct = 70
            try:
                opacity = int(opacity)
            except Exception:
                opacity = 60
            try:
                logo_width = int(logo_width)
            except Exception:
                logo_width = 150
            try:
                logo_x = int(logo_x)
            except Exception:
                logo_x = 20
            try:
                logo_y = int(logo_y)
            except Exception:
                logo_y = 20

            # Step 1: Upload the raw video first (no eager transformation)
            public_id = f"zetasports_{timestamp}"
            sign_str = f"public_id={public_id}&timestamp={timestamp}{api_secret}"
            signature = hashlib.sha1(sign_str.encode("utf-8")).hexdigest()

            upload_url = f"https://api.cloudinary.com/v1_1/{cloud_name}/video/upload"
            payload = {
                "file": telegram_video_url,   # Cloudinary fetches this on THEIR servers
                "public_id": public_id,
                "api_key": api_key,
                "timestamp": timestamp,
                "signature": signature,
            }

            res = requests.post(upload_url, data=payload, timeout=120)
            if res.status_code == 200:
                data = res.json()
                raw_url = data.get("secure_url")
                if raw_url:
                    # Step 2: Build the watermark overlays step
                    w_list = []
                    if logo_id:
                        if logo_id.startswith("http://") or logo_id.startswith("https://"):
                            import base64
                            b64_logo = base64.b64encode(logo_id.encode("utf-8")).decode("utf-8")
                            b64_logo = b64_logo.replace("+", "%2B").replace("/", "%2F").replace("=", "%3D")
                            w_list.append(f"l_fetch:{b64_logo},w_{logo_width},o_{opacity},g_{logo_gravity},x_{logo_x},y_{logo_y}")
                        else:
                            logo_overlay = logo_id.replace("/", ":")
                            w_list.append(f"l_{logo_overlay},w_{logo_width},o_{opacity},g_{logo_gravity},x_{logo_x},y_{logo_y}")
                    else:
                        w_list.append(f"l_text:Arial_36_bold:ZetaSports,co_white,o_{opacity},g_{logo_gravity},x_{logo_x},y_{logo_y}")
                    watermark_step = "/".join(w_list)

                    # Step 3: Construct transformation URL based on selected theme
                    scaled_width = int(width * (scale_pct / 100.0))
                    if border_theme == "fifa_2026":
                        # Video overlaid on top of the scaled FIFA 2026 border image base
                        processed_url = f"https://res.cloudinary.com/{cloud_name}/image/upload/w_{width},h_{height},c_scale/l_video:{public_id},w_{scaled_width},c_scale/fl_layer_apply/{watermark_step}/fifa_2026_sports_border.mp4"
                    else:
                        # Standard black padding borders
                        processed_url = f"https://res.cloudinary.com/{cloud_name}/video/upload/c_scale,w_{scaled_width}/c_pad,w_{width},h_{height}/{watermark_step}/{public_id}.mp4"

                    log_msg(f"Cloudinary processed video ready with transformation: {processed_url}")
                    return processed_url
                log_msg(f"Cloudinary upload succeeded but no URL returned: {data}")
            else:
                log_msg(f"Cloudinary upload failed HTTP {res.status_code}: {res.text[:300]}")

        except Exception as e:
            log_msg(f"Error processing video via Cloudinary: {e}")

        # If anything fails, return original URL so forwarding still works
        return telegram_video_url

    def send_to_green_api(self, instance_id, token, chat_id, text, media_url=None, filename=None):
        """Sends text or media to WhatsApp via Green API's cloud servers."""
        try:
            chat_id = str(chat_id).strip()
            if media_url:
                url = f"https://api.green-api.com/waInstance{instance_id}/sendFileByUrl/{token}"
                payload = {
                    "chatId": chat_id,
                    "urlFile": media_url,
                    "fileName": filename or "file",
                    "caption": text or ""
                }
            else:
                url = f"https://api.green-api.com/waInstance{instance_id}/sendMessage/{token}"
                payload = {
                    "chatId": chat_id,
                    "message": text or ""
                }
            res = requests.post(url, json=payload, timeout=20)
            if res.status_code == 200:
                log_msg(f"Successfully posted to {chat_id} via Green API.")
                return True
            log_msg(f"Green API returned HTTP {res.status_code}: {res.text}")
        except Exception as e:
            log_msg(f"Error sending via Green API: {e}")
        return False

    def forward_latest_message(self, source_jid, target_jids):
        """Asks the local bridge to forward the latest message in source_jid to target_jids list (server-side)."""
        try:
            payload = {
                "sourceChatId": source_jid,
                "targetChatIds": target_jids
            }
            res = requests.post("http://127.0.0.1:3000/forward-latest", json=payload, timeout=20)
            if res.status_code == 200:
                data = res.json()
                if data.get("success"):
                    log_msg("Server-side message forwarding completed successfully.")
                    return True
            log_msg(f"Failed to forward message via bridge: {res.status_code} {res.text}")
        except Exception as e:
            log_msg(f"Error calling forward-latest endpoint: {e}")
        return False

    def send_to_groups(self, group_jids, media_url, mimetype, filename, text):
        """Sends media or text directly to a list of group JIDs via the local bridge /send-to-groups endpoint."""
        try:
            payload = {
                "targetChatIds": group_jids,
                "mediaUrl": media_url or "",
                "mimetype": mimetype or "",
                "filename": filename or "",
                "caption": text or "",
                "text": text or ""
            }
            res = requests.post("http://127.0.0.1:3000/send-to-groups", json=payload, timeout=120)
            if res.status_code == 200:
                data = res.json()
                results = data.get("results", [])
                ok = sum(1 for r in results if r.get("success"))
                log_msg(f"send-to-groups: {ok}/{len(results)} groups delivered successfully.")
                return ok
            log_msg(f"send-to-groups failed: {res.status_code} {res.text}")
        except Exception as e:
            log_msg(f"Error calling send-to-groups endpoint: {e}")
        return 0

    def forward_message_to_groups(self, message_id, group_jids):
        """Asks the local bridge to forward a specific message to target groups."""
        try:
            payload = {
                "messageId": message_id,
                "targetChatIds": group_jids
            }
            res = requests.post("http://127.0.0.1:3000/forward-message-by-id", json=payload, timeout=120)
            if res.status_code == 200:
                data = res.json()
                results = data.get("results", [])
                ok = sum(1 for r in results if r.get("success"))
                log_msg(f"forward-message-to-groups: {ok}/{len(results)} groups delivered successfully.")
                return ok
            log_msg(f"Forward message to groups failed: {res.status_code} {res.text}")
        except Exception as e:
            log_msg(f"Error calling forward-message-by-id endpoint: {e}")
        return 0

    def log_forward_history(self, update_id, chat_username, text, media_type, channel_sent, groups_ok, groups_total):
        """Saves a forwarded message event record to forwarded_messages.json."""
        history_file = os.path.join(CURRENT_DIR, 'forwarded_messages.json')
        try:
            history = []
            if os.path.exists(history_file):
                try:
                    with open(history_file, 'r', encoding='utf-8') as f:
                        history = json.load(f)
                except Exception:
                    pass
            
            import datetime
            record = {
                "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "update_id": update_id,
                "telegram_chat": chat_username or "Direct DM",
                "text": text[:150] + "..." if text and len(text) > 150 else (text or ""),
                "media_type": media_type,
                "channel_sent": channel_sent,
                "groups_delivered": groups_ok,
                "groups_total": groups_total
            }
            history.insert(0, record)
            # Limit history list size to 100 entries
            history = history[:100]
            
            with open(history_file, 'w', encoding='utf-8') as f:
                json.dump(history, f, indent=2)
        except Exception as e:
            log_msg(f"Error logging forward history: {e}")

    # ─── Load Settings Helper ────────────────────────────────────────────────

    def load_settings(self):
        """Loads configuration settings from settings.json."""
        if os.path.exists(SETTINGS_FILE):
            try:
                with open(SETTINGS_FILE, 'r') as f:
                    return json.load(f)
            except Exception:
                pass
        return {}

    def save_pending_approval(self, update_id, post_data):
        pending_file = os.path.join(CURRENT_DIR, 'pending_approvals.json')
        try:
            pending = {}
            if os.path.exists(pending_file):
                try:
                    with open(pending_file, 'r', encoding='utf-8') as f:
                        pending = json.load(f)
                except Exception:
                    pass
            pending[str(update_id)] = post_data
            with open(pending_file, 'w', encoding='utf-8') as f:
                json.dump(pending, f, indent=2)
        except Exception as e:
            log_msg(f"Error saving pending approval: {e}")

    def get_pending_approval(self, update_id):
        pending_file = os.path.join(CURRENT_DIR, 'pending_approvals.json')
        try:
            if os.path.exists(pending_file):
                with open(pending_file, 'r', encoding='utf-8') as f:
                    pending = json.load(f)
                    return pending.get(str(update_id))
        except Exception as e:
            log_msg(f"Error getting pending approval: {e}")
        return None

    def delete_pending_approval(self, update_id):
        pending_file = os.path.join(CURRENT_DIR, 'pending_approvals.json')
        try:
            if os.path.exists(pending_file):
                with open(pending_file, 'r', encoding='utf-8') as f:
                    pending = json.load(f)
                if str(update_id) in pending:
                    del pending[str(update_id)]
                    with open(pending_file, 'w', encoding='utf-8') as f:
                        json.dump(pending, f, indent=2)
        except Exception as e:
            log_msg(f"Error deleting pending approval: {e}")

    def send_approval_request(self, token, update_id, media_type, caption, chat_username, edited_url=None):
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        
        preview = caption or "(No caption)"
        if len(preview) > 100:
            preview = preview[:100] + "..."
            
        text = f"🔔 *ZetaSports Approval Request*\n\n"
        text += f"Type: *{media_type.upper()}*\n"
        text += f"Source: @{chat_username if chat_username else 'Direct DM'}\n"
        text += f"Caption: {preview}\n\n"
        
        if media_type == "video" and edited_url:
            text += f"🎬 *[Click here to watch edited video preview]({edited_url})*\n\n"
            
        text += "Do you want to approve sending this?"
        
        keyboard = []
        if media_type == "video":
            keyboard = [
                [
                    {"text": "🎬 Approve & Edit Video (Cloudinary)", "callback_data": f"approve_edit:{update_id}"}
                ],
                [
                    {"text": "📹 Approve & Send Original", "callback_data": f"approve_original:{update_id}"},
                    {"text": "❌ Reject", "callback_data": f"reject:{update_id}"}
                ]
            ]
        else:
            keyboard = [
                [
                    {"text": "🖼️ Approve & Send Photo", "callback_data": f"approve_photo:{update_id}"},
                    {"text": "❌ Reject", "callback_data": f"reject:{update_id}"}
                ]
            ]
            
        payload = {
            "chat_id": "1386396531", # Owner chat ID
            "text": text,
            "parse_mode": "Markdown",
            "reply_markup": json.dumps({"inline_keyboard": keyboard})
        }
        try:
            requests.post(url, json=payload, timeout=10)
        except Exception as e:
            log_msg(f"Error sending Telegram approval request: {e}")

    def handle_callback_query(self, token, callback_query):
        callback_id = callback_query.get("id")
        from_user = callback_query.get("from", {})
        user_id = str(from_user.get("id"))
        username = str(from_user.get("username", "")).lower()
        
        # Verify sender is owner
        if user_id != "1386396531" and username != "mubthaseem28":
            log_msg(f"Unauthorized callback click from {username}/{user_id}")
            requests.post(f"https://api.telegram.org/bot{token}/answerCallbackQuery", json={"callback_query_id": callback_id, "text": "Unauthorized!"}, timeout=5)
            return

        data = callback_query.get("data", "")
        message = callback_query.get("message", {})
        chat_id = message.get("chat", {}).get("id")
        message_id = message.get("message_id")
        
        if not data or ":" not in data:
            return
            
        action, update_id = data.split(":", 1)
        
        requests.post(f"https://api.telegram.org/bot{token}/answerCallbackQuery", json={"callback_query_id": callback_id, "text": "Processing..."}, timeout=5)
        
        post_data = self.get_pending_approval(update_id)
        if not post_data:
            requests.post(f"https://api.telegram.org/bot{token}/editMessageText", json={
                "chat_id": chat_id,
                "message_id": message_id,
                "text": "⚠️ Request expired or post data not found."
            }, timeout=5)
            return

        if action == "reject":
            self.delete_pending_approval(update_id)
            requests.post(f"https://api.telegram.org/bot{token}/editMessageText", json={
                "chat_id": chat_id,
                "message_id": message_id,
                "text": "❌ Rejected & Cancelled."
            }, timeout=5)
            log_msg(f"Post {update_id} rejected and deleted by owner.")
            return

        import threading
        threading.Thread(target=self.execute_approved_forward, args=(token, chat_id, message_id, update_id, action, post_data)).start()

    def execute_approved_forward(self, token, chat_id, message_id, update_id, action, post_data):
        log_msg(f"Executing approved action '{action}' for update {update_id}...")
        requests.post(f"https://api.telegram.org/bot{token}/editMessageText", json={
            "chat_id": chat_id,
            "message_id": message_id,
            "text": f"⏳ Processing approval: {action.replace('approve_', '').upper()}..."
        }, timeout=5)

        try:
            settings = self.load_settings()
            raw_groups = settings.get("whatsapp_group_ids") or settings.get("whatsapp_chat_id", "")
            group_jids = [j.strip() for j in raw_groups.split(",") if j.strip()]
            channel_jid = settings.get("whatsapp_channel_id", "").strip()
            
            green_instance = settings.get("whatsapp_instance_id")
            green_token = settings.get("whatsapp_api_token")
            use_green_api = bool(green_instance and green_token)

            media_url = post_data.get("media_url")
            mimetype = post_data.get("mimetype")
            filename = post_data.get("filename")
            caption = post_data.get("caption")
            text = post_data.get("text")
            chat_username = post_data.get("chat_username")

            # Apply Cloudinary video processing ONLY if approved with 'approve_edit'
            if action == "approve_edit" and media_url and mimetype and "video" in mimetype:
                edited_url = post_data.get("edited_url")
                if edited_url:
                    log_msg("Using pre-generated Cloudinary video URL...")
                    media_url = edited_url
                else:
                    log_msg("Editing approved but pre-generated URL not found — processing now via Cloudinary...")
                    media_url = self.process_video_via_cloudinary(media_url, settings)
                filename = "zetasports_clip.mp4"

            # Post to Channel
            channel_sent = False
            channel_msg_id = None
            if use_green_api and channel_jid and not channel_jid.endswith("@newsletter"):
                log_msg(f"Sending to Channel {channel_jid} via Green API...")
                channel_sent = self.send_to_green_api(green_instance, green_token, channel_jid, caption or text, media_url, filename)
                if channel_sent:
                    time.sleep(5)
            
            if not channel_sent and channel_jid:
                log_msg(f"Falling back to local bridge for channel...")
                if media_url:
                    channel_msg_id = self.send_media(channel_jid, media_url, mimetype, filename, caption or text)
                elif text or caption:
                    channel_msg_id = self.send_message(channel_jid, text or caption)
                channel_sent = bool(channel_msg_id)

            # Forward to Groups
            groups_ok = 0
            if channel_sent and group_jids:
                if channel_msg_id and not channel_jid.endswith("@newsletter"):
                    log_msg(f"Forwarding channel message {channel_msg_id} to {len(group_jids)} groups...")
                    groups_ok = self.forward_message_to_groups(channel_msg_id, group_jids)
                    if groups_ok == 0:
                        log_msg("Forwarding failed, falling back to direct broadcasting...")
                        groups_ok = self.send_to_groups(group_jids, media_url, mimetype, filename, caption or text)
                else:
                    log_msg(f"Direct broadcasting to {len(group_jids)} groups...")
                    groups_ok = self.send_to_groups(group_jids, media_url, mimetype, filename, caption or text)

            # Update history
            if channel_sent:
                media_type = post_data.get("media_type", "text")
                self.log_forward_history(update_id, chat_username, caption or text, media_type, channel_sent, groups_ok, len(group_jids))
                
                requests.post(f"https://api.telegram.org/bot{token}/editMessageText", json={
                    "chat_id": chat_id,
                    "message_id": message_id,
                    "text": f"✅ Successfully Approved and Sent! ({groups_ok}/{len(group_jids)} groups delivered)"
                }, timeout=5)
                self.delete_pending_approval(update_id)
            else:
                requests.post(f"https://api.telegram.org/bot{token}/editMessageText", json={
                    "chat_id": chat_id,
                    "message_id": message_id,
                    "text": "❌ Failed to send to WhatsApp. Check logs."
                }, timeout=5)
                
        except Exception as e:
            log_msg(f"Error in execute_approved_forward: {e}")
            requests.post(f"https://api.telegram.org/bot{token}/editMessageText", json={
                "chat_id": chat_id,
                "message_id": message_id,
                "text": f"❌ Error occurred: {e}"
            }, timeout=5)
