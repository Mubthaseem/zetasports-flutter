import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'dart:convert';
import 'package:video_player/video_player.dart';
import 'package:chewie/chewie.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../services/firestore_service.dart';
import '../services/ad_service.dart';
import '../theme/app_theme.dart';
import 'dart:math' as math;

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 13 — LIVE PLAYER  (JioHotstar / FanCode style)
//  Uses a gradient preview since webview_flutter needs native setup.
//  All controls, chat, stream/quality selectors are present.
// ─────────────────────────────────────────────────────────────────────────────
class PlayerScreen extends StatefulWidget {
  final Map<String, dynamic> match;
  final String username;
  final String deviceId;

  const PlayerScreen({
    super.key,
    required this.match,
    required this.username,
    required this.deviceId,
  });

  @override
  State<PlayerScreen> createState() => _PlayerScreenState();
}

class _PlayerScreenState extends State<PlayerScreen>
    with SingleTickerProviderStateMixin {
  bool _hudVisible = true;
  Timer? _hudTimer;
  bool _playing = true;
  bool _muted = false;
  bool _fullscreen = false;
  double _volume = 0.8;
  double _progress = 0.0;          // 0..1
  Timer? _progressTimer;

  // Stream & Quality
  String _quality  = 'Auto';
  String _stream   = 'Stream 1';
  List<String> _qualities = ['Auto'];
  List<Map<String, String>> _parsedQualities = [];
  List<String> _streams   = ['Stream 1'];
  
  final GlobalKey _playerKey = GlobalKey();
  VideoPlayerController? _videoController;
  ChewieController? _chewieController;
  WebViewController? _webViewController;
  bool _useWebView = false;
  List<Map<String, dynamic>> _parsedServers = [];
  int _currentServerIndex = 0;
  bool _audioOnly = false;

  // Live Chat
  bool _chatOpen = false;
  final _chatCtrl = TextEditingController();
  final _chatScroll = ScrollController();
  final List<Map<String, dynamic>> _messages = [];

  int _viewers = 14287;

  late Map<String, dynamic> _matchState;
  dynamic _matchSubscription;
  dynamic _chatSubscription;

  int get _liveViewers => int.tryParse(_matchState['viewers']?.toString() ?? '') ?? 14287;

  @override
  void initState() {
    super.initState();
    _matchState = Map<String, dynamic>.from(widget.match);
    _viewers = _liveViewers;
    
    if (_matchState['id'] != null) {
      final mId = _matchState['id'].toString();
      SupabaseService.incrementViewers(mId);
      _matchSubscription = SupabaseService.subscribeToMatchUpdates(
        mId,
        (newMatch) {
          if (mounted) setState(() => _matchState.addAll(newMatch));
        },
      );
      // Subscribe to live chat updates
      _chatSubscription = SupabaseService.subscribeToChatUpdates(
        mId,
        (newMsg) {
          if (mounted) {
            setState(() {
              if (!_messages.any((m) => m['id'] == newMsg['id'])) {
                _messages.add({
                  'id': newMsg['id'],
                  'user': newMsg['username'] ?? 'User',
                  'msg': newMsg['message'] ?? '',
                  'col': _getUserColor(newMsg['color']),
                });
              }
            });
            _scrollToBottom();
          }
        },
      );
      _loadChatMessages();
    }

    // Trigger interstitial ad on entry
    AdService.showInterstitial();

    // Go landscape + immersive
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
    ]);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);

    // Simulate live progress and dynamic viewers count floating
    _progressTimer = Timer.periodic(const Duration(seconds: 2), (_) {
      if (!mounted) return;
      setState(() {
        if (_playing) {
          _progress = (_progress + 0.003).clamp(0.0, 1.0);
        }
        // float dynamically around database viewers count
        final diff = math.Random().nextInt(21) - 10;
        _viewers = _liveViewers + diff;
      });
    });

    _parseStreams();
    _showHudTemporarily();
  }

  Future<void> _parseStreams() async {
    List<dynamic> streamIds = [];
    final rawStreamIds = _matchState['stream_ids'];
    if (rawStreamIds != null) {
      if (rawStreamIds is List) {
        streamIds = rawStreamIds;
      } else if (rawStreamIds is String) {
        streamIds = rawStreamIds.split(',').map((s) => s.trim()).where((s) => s.isNotEmpty).toList();
      }
    }

    List<Map<String, dynamic>> loadedStreams = [];

    if (streamIds.isNotEmpty) {
      final futures = streamIds.map((id) => SupabaseService.fetchStreamById(id.toString()));
      final results = await Future.wait(futures);
      for (var s in results) {
        if (s != null && s['url'] != null) {
          loadedStreams.add(Map<String, dynamic>.from(s));
        }
      }
    }

    // Fallback to stream_url if stream_ids is empty or fetched nothing
    if (loadedStreams.isEmpty) {
      String streamUrlStr = _matchState['stream_url']?.toString() ?? '';
      
      if (streamUrlStr.isNotEmpty && !streamUrlStr.startsWith('[') && !streamUrlStr.contains('http')) {
        final s = await SupabaseService.fetchStreamById(streamUrlStr);
        if (s != null && s['url'] != null) {
          loadedStreams.add(Map<String, dynamic>.from(s));
        }
      } else if (streamUrlStr.startsWith('[')) {
        try {
          final list = jsonDecode(streamUrlStr) as List;
          loadedStreams = list.map((e) => Map<String, dynamic>.from(e)).toList();
        } catch (e) {
          loadedStreams = [];
        }
      } else if (streamUrlStr.isNotEmpty) {
        String guessedType = 'm3u8';
        if (streamUrlStr.contains('.mpd')) {
          guessedType = 'mpd';
        } else if (!streamUrlStr.contains('.m3u8') && !streamUrlStr.contains('.ts') && !streamUrlStr.contains('.mp4')) {
          guessedType = 'iframe';
        }
        loadedStreams = [{
          'label': 'Main Server',
          'url': streamUrlStr,
          'type': guessedType,
          'keyId': '',
          'key': '',
        }];
      }
    }

    if (!mounted) return;

    if (loadedStreams.isNotEmpty) {
      setState(() {
        _parsedServers = loadedStreams.map((s) {
          return {
            'serverName': s['label'] ?? s['serverName'] ?? 'Server ${loadedStreams.indexOf(s) + 1}',
            'url': s['url'].toString(),
            'type': s['type']?.toString().toLowerCase() ?? 'm3u8',
            'keyId': s['keyId']?.toString() ?? s['key_id']?.toString() ?? '',
            'key': s['key']?.toString() ?? '',
            'drmType': 'none'
          };
        }).toList();
        _streams = _parsedServers.map((s) => s['serverName'].toString()).toList();
        _stream = _streams.first;
      });
      _initPlayer(0);
    }
  }

  void _initPlayer(int index) {
    if (index >= _parsedServers.length) return;
    _currentServerIndex = index;
    _initPlayerWithServer(_parsedServers[index]);
  }

  void _initPlayerWithServer(Map<String, dynamic> server) {
    _chewieController?.dispose();
    _videoController?.dispose();
    _chewieController = null;
    _videoController = null;
    _webViewController = null;

    final url = server['url']?.toString() ?? '';
    if (url.isEmpty) return;

    final type = server['type']?.toString().toLowerCase() ?? '';
    final isDrm = (server['keyId']?.toString().isNotEmpty ?? false) || (server['key']?.toString().isNotEmpty ?? false);

    // Use Webview for explicit iFrame, OK.ru, or DRM streams
    if (type == 'iframe' || type == 'okru' || isDrm) {
      setState(() {
        _useWebView = true;
        _playing = true;
      });
      _initWebView(url, type: type, keyId: server['keyId']?.toString(), key: server['key']?.toString());
    } else {
      setState(() {
        _useWebView = false;
        _playing = true;
      });

      // Parse HLS master manifest for quality options in Dart (for non-webview playback)
      if (url.contains('.m3u8') && _quality == 'Auto') {
        _parseHlsQualities(url);
      }

      _videoController = VideoPlayerController.networkUrl(
        Uri.parse(url),
        httpHeaders: const {},
      );

      bool fallbackTriggered = false;
      Timer? initTimeout;

      void triggerFallback() {
        if (fallbackTriggered || !mounted) return;
        fallbackTriggered = true;
        initTimeout?.cancel();
        
        debugPrint('VideoPlayer failed to play within timeout. Falling back to WebView.');
        _chewieController?.dispose();
        _videoController?.dispose();
        _chewieController = null;
        _videoController = null;

        setState(() {
          _useWebView = true;
          _playing = true;
        });
        _initWebView(url, type: type, keyId: server['keyId']?.toString(), key: server['key']?.toString());
      }

      // Check after 7 seconds if native playback has successfully started
      initTimeout = Timer(const Duration(seconds: 7), () {
        if (!mounted || fallbackTriggered) return;
        final controller = _videoController;
        if (controller == null) {
          triggerFallback();
          return;
        }
        
        final val = controller.value;
        final ok = val.isInitialized && val.isPlaying && !val.isBuffering;
        if (!ok) {
          triggerFallback();
        }
      });

      _videoController!.initialize().then((_) {
        if (fallbackTriggered || !mounted) return;

        _chewieController = ChewieController(
          videoPlayerController: _videoController!,
          autoPlay: true,
          looping: false,
          isLive: _live,
          showControls: false, // Custom HUD overlay
          aspectRatio: 16 / 9,
          allowMuting: true,
        );

        _videoController!.addListener(() {
          if (!mounted || fallbackTriggered) return;
          final isPlaying = _videoController!.value.isPlaying;
          if (isPlaying != _playing) {
            setState(() => _playing = isPlaying);
          }
          // If native player starts playing and finishes buffering, we can safely cancel the timeout early
          final val = _videoController!.value;
          if (val.isInitialized && val.isPlaying && !val.isBuffering) {
            initTimeout?.cancel();
          }
        });

        setState(() {});
      }).catchError((e) {
        triggerFallback();
      });
    }
  }

  void _initWebView(String url, {required String type, String? keyId, String? key}) {
    _webViewController = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.black)
      ..setNavigationDelegate(
        NavigationDelegate(
          onWebResourceError: (error) {
            debugPrint('WebView Player Error: ${error.description}');
          },
        ),
      );

    if (type == 'iframe') {
      _webViewController!.loadRequest(Uri.parse(url));
    } else {
      final html = _getShakaHtml(url, keyId: keyId, key: key);
      _webViewController!.loadHtmlString(html);
    }
  }

  String _getShakaHtml(String url, {String? keyId, String? key}) {
    final drmConfig = (keyId != null && keyId.isNotEmpty && key != null && key.isNotEmpty)
        ? """
        player.configure({
          drm: {
            clearKeys: {
              '$keyId': '$key'
            }
          }
        });
        """
        : "";

    return """
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <script src="https://ajax.googleapis.com/ajax/libs/shaka-player/4.3.5/shaka-player.ui.js"></script>
      <link rel="stylesheet" href="https://ajax.googleapis.com/ajax/libs/shaka-player/4.3.5/controls.css" />
      <style>
        body, html { margin: 0; padding: 0; width: 100%; height: 100%; background-color: black; overflow: hidden; }
        .shaka-video-container { width: 100% !important; height: 100% !important; }
        video { width: 100%; height: 100%; object-fit: contain; }
        /* Custom premium look matching ZetaSports */
        .shaka-play-button-container { transform: scale(1.2); }
        .shaka-seek-bar-container { display: none !important; } /* Hide seek bar since it is a live stream */
      </style>
    </head>
    <body>
      <div data-shaka-player-container id="video-container" style="width:100%; height:100%;">
        <video data-shaka-player id="video" autoplay playsinline></video>
      </div>
      <script>
        async function initPlayer() {
          const video = document.getElementById('video');
          const videoContainer = document.getElementById('video-container');
          const player = new shaka.Player(video);
          
          // Attach UI Overlay
          const ui = new shaka.ui.Overlay(player, videoContainer, video);
          const controls = ui.getControls();
          
          player.addEventListener('error', (event) => {
            console.error('Shaka Player Error:', event.detail);
          });

          $drmConfig
          
          try {
            await player.load('$url');
            console.log('Stream loaded successfully!');
          } catch (e) {
            console.error('Shaka load error:', e);
          }
        }
        
        document.addEventListener('DOMContentLoaded', () => {
          shaka.polyfill.installAll();
          if (shaka.Player.isBrowserSupported()) {
            initPlayer();
          } else {
            console.error('Shaka Player not supported on this browser!');
          }
        });
      </script>
    </body>
    </html>
    """;
  }

  Future<void> _parseHlsQualities(String masterUrl) async {
    try {
      final client = HttpClient();
      final request = await client.getUrl(Uri.parse(masterUrl));
      final response = await request.close();
      if (response.statusCode == 200) {
        final content = await response.transform(utf8.decoder).join();
        final lines = content.split('\n');
        final List<String> parsedQ = ['Auto'];
        final List<Map<String, String>> parsedMaps = [];
        String? currentRes;
        
        for (var line in lines) {
          line = line.trim();
          if (line.startsWith('#EXT-X-STREAM-INF:')) {
            final regRes = RegExp(r'RESOLUTION=(\d+x\d+)');
            final matchRes = regRes.firstMatch(line);
            if (matchRes != null) {
              final res = matchRes.group(1);
              currentRes = res?.split('x')[1] ?? '';
            }
          } else if (line.isNotEmpty && !line.startsWith('#') && currentRes != null) {
            var streamUrl = line;
            if (!streamUrl.startsWith('http')) {
              final uri = Uri.parse(masterUrl);
              final segments = List<String>.from(uri.pathSegments);
              if (segments.isNotEmpty) segments.removeLast();
              segments.add(streamUrl);
              streamUrl = uri.replace(pathSegments: segments).toString();
            }
            
            if (currentRes.isNotEmpty) {
              final label = '${currentRes}p';
              parsedQ.add(label);
              parsedMaps.add({'label': label, 'url': streamUrl});
            }
            currentRes = null;
          }
        }
        if (parsedQ.length > 1 && mounted) {
          setState(() {
            _qualities = parsedQ;
            _parsedQualities = parsedMaps;
          });
        }
      }
    } catch (e) {
      debugPrint('HLS Quality parse error: $e');
    }
  }

  void _loadChatMessages() async {
    if (_matchState['id'] == null) return;
    final msgs = await SupabaseService.fetchChatMessages(_matchState['id'].toString());
    if (mounted) {
      setState(() {
        _messages.clear();
        for (var m in msgs) {
          _messages.add({
            'id': m['id'],
            'user': m['username'] ?? 'User',
            'msg': m['message'] ?? '',
            'col': _getUserColor(m['color']),
          });
        }
      });
      _scrollToBottom();
    }
  }

  Color _getUserColor(String? colorStr) {
    if (colorStr == 'primary') return AppTheme.primary;
    if (colorStr == 'secondary') return AppTheme.secondary;
    if (colorStr == 'success') return AppTheme.success;
    if (colorStr == 'warning') return AppTheme.warning;
    if (colorStr == 'danger') return AppTheme.danger;
    return AppTheme.primary;
  }

  String _getColorName(Color col) {
    if (col == AppTheme.secondary) return 'secondary';
    if (col == AppTheme.success) return 'success';
    if (col == AppTheme.warning) return 'warning';
    if (col == AppTheme.danger) return 'danger';
    return 'primary';
  }

  @override
  void dispose() {
    if (_matchState['id'] != null) {
      SupabaseService.decrementViewers(_matchState['id'].toString());
    }
    _matchSubscription?.unsubscribe();
    _chatSubscription?.unsubscribe();
    _hudTimer?.cancel();
    _progressTimer?.cancel();
    _chatCtrl.dispose();
    _chatScroll.dispose();
    _chewieController?.dispose();
    _videoController?.dispose();
    // Restore portrait
    SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    super.dispose();
  }

  void _showHudTemporarily() {
    setState(() => _hudVisible = true);
    _hudTimer?.cancel();
    _hudTimer = Timer(const Duration(seconds: 4), () {
      if (mounted) setState(() => _hudVisible = false);
    });
  }

  void _sendMessage() async {
    final text = _chatCtrl.text.trim();
    if (text.isEmpty || _matchState['id'] == null) return;
    
    _chatCtrl.clear();
    final user = widget.username.isNotEmpty ? widget.username : 'User';
    final matchId = _matchState['id'].toString();
    final colorName = _getColorName(AppTheme.primary);
    
    await SupabaseService.sendChatMessage(matchId, user, text, colorName);
  }

  void _scrollToBottom() {
    Future.delayed(const Duration(milliseconds: 100), () {
      if (_chatScroll.hasClients) {
        _chatScroll.animateTo(
          _chatScroll.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final home  = _matchState['home_team']?.toString() ?? 'Home';
    final away  = _matchState['away_team']?.toString() ?? 'Away';
    final score = _matchState['score']?.toString() ?? '0 - 0';
    final min   = _matchState['time_elapsed']?.toString() ?? '45\'';
    final live  = _matchState['status'] == 'live';

    return Scaffold(
      backgroundColor: Colors.black,
      body: GestureDetector(
        onTap: _showHudTemporarily,
        child: Stack(
          children: [
            // ── VIDEO AREA (stadium gradient preview)
            Positioned.fill(child: _buildVideoArea(home, away, score, min, live)),

            // ── HUD OVERLAY
            AnimatedOpacity(
              opacity: _hudVisible ? 1.0 : 0.0,
              duration: const Duration(milliseconds: 300),
              child: _buildHUD(home, away, score, min, live),
            ),

            // ── LIVE CHAT PANEL
            if (_chatOpen)
              Positioned(
                right: 0, top: 0, bottom: 0,
                width: 220,
                child: _buildChatPanel(),
              ),
          ],
        ),
      ),
    );
  }

  // ── VIDEO AREA ─────────────────────────────────────────────────────────────
  Widget _buildVideoArea(String home, String away, String score, String min, bool live) {
    if (_useWebView && _webViewController != null) {
      return Container(
        color: Colors.black,
        child: Center(
          child: AspectRatio(
            aspectRatio: 16 / 9,
            child: WebViewWidget(controller: _webViewController!),
          ),
        ),
      );
    }

    if (_videoController != null || _parsedServers.isNotEmpty) {
      return Container(
        color: Colors.black,
        child: Center(
          child: AspectRatio(
            aspectRatio: 16 / 9,
            child: _audioOnly
              ? Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.audiotrack_rounded, color: AppTheme.primary, size: 64),
                    const SizedBox(height: 16),
                    Text('Audio-Only Mode', style: GoogleFonts.outfit(color: Colors.white70, fontSize: 16)),
                  ],
                )
              : _chewieController != null && _videoController != null && _videoController!.value.isInitialized
                ? Chewie(
                    key: _playerKey,
                    controller: _chewieController!,
                  )
                : const Center(child: CircularProgressIndicator(color: AppTheme.primary)),
          ),
        ),
      );
    }

    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF0A2E15), Color(0xFF07132B), Color(0xFF0A0A1A)],
          begin: Alignment.topLeft, end: Alignment.bottomRight),
      ),
      child: Stack(
        children: [
          // Stadium grid lines (subtle)
          Positioned.fill(child: Opacity(
            opacity: 0.04,
            child: CustomPaint(painter: _StadiumPainter()))),
          // Center match info
          Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _teamBadge(home, AppTheme.primary),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 32),
                      child: Column(
                        children: [
                          Text(score, style: GoogleFonts.rajdhani(
                            fontSize: 48, fontWeight: FontWeight.w900, color: Colors.white)),
                          if (live)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                              decoration: BoxDecoration(
                                color: AppTheme.danger,
                                borderRadius: BorderRadius.circular(6)),
                              child: Text(min, style: GoogleFonts.outfit(
                                color: Colors.white, fontSize: 12, fontWeight: FontWeight.w900))),
                        ],
                      ),
                    ),
                    _teamBadge(away, AppTheme.secondary),
                  ],
                ),
                const SizedBox(height: 12),
                if (!live)
                  const Icon(Icons.play_circle_fill_rounded,
                    color: Colors.white38, size: 72),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _teamBadge(String name, Color col) {
    final abbr = name.length >= 3 ? name.substring(0, 3).toUpperCase() : name.toUpperCase();
    return Column(
      children: [
        Container(
          width: 60, height: 60,
          decoration: BoxDecoration(
            color: col.withOpacity(0.15),
            shape: BoxShape.circle,
            border: Border.all(color: col.withOpacity(0.5), width: 2)),
          child: Center(child: Text(abbr, style: GoogleFonts.outfit(
            fontSize: 16, fontWeight: FontWeight.w900, color: col)))),
        const SizedBox(height: 6),
        Text(name, style: GoogleFonts.outfit(
          fontSize: 12, fontWeight: FontWeight.w700, color: Colors.white70)),
      ],
    );
  }

  // ── FULL HUD OVERLAY ───────────────────────────────────────────────────────
  Widget _buildHUD(String home, String away, String score, String min, bool live) {
    return Column(
      children: [
        // ── TOP BAR
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [Colors.black87, Colors.transparent],
              begin: Alignment.topCenter, end: Alignment.bottomCenter)),
          child: Row(
            children: [
              GestureDetector(
                onTap: () => Navigator.pop(context),
                child: const Icon(Icons.arrow_back_ios_new_rounded,
                  color: Colors.white, size: 18)),
              const SizedBox(width: 12),
              Expanded(
                child: Text('$home vs $away', style: GoogleFonts.outfit(
                  color: Colors.white, fontSize: 13, fontWeight: FontWeight.w800))),
              // Viewer count
              Row(children: [
                Container(
                  width: 6, height: 6,
                  decoration: const BoxDecoration(color: AppTheme.danger, shape: BoxShape.circle)),
                const SizedBox(width: 5),
                Text('${_formatViewers(_viewers)} watching',
                  style: GoogleFonts.outfit(color: Colors.white70, fontSize: 10)),
              ]),
              const SizedBox(width: 12),
              // Chromecast
              GestureDetector(
                onTap: _showCastDialog,
                child: const Icon(Icons.cast_rounded, color: Colors.white70, size: 20)),
              const SizedBox(width: 12),
              // PiP (not supported by video_player natively)
              GestureDetector(
                onTap: () {
                  // PiP not available with video_player
                },
                child: const Icon(Icons.picture_in_picture_alt_rounded,
                  color: Colors.white70, size: 20)),
              const SizedBox(width: 12),
              // Chat
              GestureDetector(
                onTap: () => setState(() => _chatOpen = !_chatOpen),
                child: Icon(Icons.chat_bubble_outline_rounded,
                  color: _chatOpen ? AppTheme.primary : Colors.white70, size: 20)),
            ],
          ),
        ),

        // ── CENTER — empty spacer
        const Spacer(),

        // ── BOTTOM CONTROLS
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [Colors.transparent, Colors.black87],
              begin: Alignment.topCenter, end: Alignment.bottomCenter)),
          child: Column(
            children: [
              // Progress bar (Hidden for live matches)
              if (!_live)
                Row(children: [
                  Text(_live ? min : _formatDuration(_progress),
                    style: GoogleFonts.outfit(color: Colors.white70, fontSize: 9)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: SliderTheme(
                      data: SliderTheme.of(context).copyWith(
                        thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 5),
                        overlayShape: const RoundSliderOverlayShape(overlayRadius: 10),
                        trackHeight: 3,
                        activeTrackColor: AppTheme.primary,
                        inactiveTrackColor: Colors.white24,
                        thumbColor: AppTheme.primary),
                      child: Slider(
                        value: _progress,
                        onChanged: (v) => setState(() => _progress = v)),
                    ),
                  ),
                  if (live)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppTheme.danger, borderRadius: BorderRadius.circular(4)),
                      child: Text('LIVE', style: GoogleFonts.outfit(
                        color: Colors.white, fontSize: 8, fontWeight: FontWeight.w900))),
                ]),
              if (!_live) const SizedBox(height: 6),
              // Control row
              Row(children: [
                // Play/Pause
                GestureDetector(
                  onTap: () {
                    setState(() => _playing = !_playing);
                    if (_useWebView) {
                      if (_playing) {
                        _webViewController?.runJavaScript("document.getElementById('video').play();");
                      } else {
                        _webViewController?.runJavaScript("document.getElementById('video').pause();");
                      }
                    } else {
                      if (_playing) {
                        _videoController?.play();
                      } else {
                        _videoController?.pause();
                      }
                    }
                  },
                  child: Icon(
                    _playing ? Icons.pause_circle_filled_rounded : Icons.play_circle_filled_rounded,
                    color: AppTheme.primary, size: 36)),
                const SizedBox(width: 12),
                // Mute
                GestureDetector(
                  onTap: () {
                    setState(() => _muted = !_muted);
                    if (_useWebView) {
                      _webViewController?.runJavaScript("document.getElementById('video').muted = $_muted;");
                    } else {
                      _videoController?.setVolume(_muted ? 0.0 : _volume);
                    }
                  },
                  child: Icon(
                    _muted ? Icons.volume_off_rounded : Icons.volume_up_rounded,
                    color: Colors.white70, size: 22)),
                const SizedBox(width: 12),
                // Audio-only toggle (Chewie only)
                if (!_useWebView)
                  GestureDetector(
                    onTap: () {
                      setState(() {
                        _audioOnly = !_audioOnly;
                        if (_audioOnly) _videoController?.pause();
                        else _videoController?.play();
                      });
                    },
                    child: Icon(
                      _audioOnly ? Icons.headset_rounded : Icons.headset_off_rounded,
                      color: _audioOnly ? AppTheme.primary : Colors.white70, size: 20)),
                if (!_useWebView) const SizedBox(width: 12),
                // Volume slider
                SizedBox(
                  width: 80,
                  child: SliderTheme(
                    data: SliderTheme.of(context).copyWith(
                      thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 4),
                      trackHeight: 2,
                      activeTrackColor: Colors.white70,
                      inactiveTrackColor: Colors.white24,
                      thumbColor: Colors.white),
                    child: Slider(
                      value: _muted ? 0.0 : _volume,
                      onChanged: (v) {
                        setState(() { _volume = v; _muted = v == 0; });
                        if (_useWebView) {
                          _webViewController?.runJavaScript("document.getElementById('video').volume = $v;");
                        } else {
                          _videoController?.setVolume(_muted ? 0.0 : _volume);
                        }
                      }),
                  ),
                ),
                const Spacer(),
                // Stream selector
                _buildDropdown(
                  value: _stream,
                  items: _streams,
                  icon: Icons.layers_rounded,
                  onChanged: (v) {
                    if (v == null || v == _stream) return;
                    setState(() => _stream = v);
                    final idx = _streams.indexOf(v);
                    if (idx != -1) _initPlayer(idx);
                  },
                ),
                const SizedBox(width: 8),
                // Quality selector
                _buildDropdown(
                  value: _quality,
                  items: _qualities,
                  icon: Icons.high_quality_rounded,
                  onChanged: (v) {
                    if (v == null || v == _quality) return;
                    setState(() => _quality = v);
                    
                    if (v == 'Auto') {
                      _initPlayer(_currentServerIndex);
                    } else {
                      final map = _parsedQualities.firstWhere(
                        (q) => q['label'] == v,
                        orElse: () => <String, String>{},
                      );
                      if (map.isNotEmpty) {
                        final url = map['url']!;
                        final server = _parsedServers[_currentServerIndex];
                        final tempServer = Map<String, dynamic>.from(server);
                        tempServer['url'] = url;
                        _initPlayerWithServer(tempServer);
                      }
                    }
                  },
                ),
                const SizedBox(width: 8),
                // Fullscreen toggle
                GestureDetector(
                  onTap: () => setState(() => _fullscreen = !_fullscreen),
                  child: Icon(
                    _fullscreen ? Icons.fullscreen_exit_rounded : Icons.fullscreen_rounded,
                    color: Colors.white70, size: 22)),
              ]),
            ],
          ),
        ),
      ],
    );
  }

  bool get _live => _matchState['status'] == 'live';

  Widget _buildDropdown({
    required String value,
    required List<String> items,
    required IconData icon,
    required ValueChanged<String?> onChanged,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white12, borderRadius: BorderRadius.circular(6)),
      child: DropdownButton<String>(
        value: value,
        items: items.map((q) => DropdownMenuItem(
          value: q,
          child: Text(q, style: GoogleFonts.outfit(
            color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700)))).toList(),
        onChanged: onChanged,
        icon: Icon(icon, color: Colors.white70, size: 14),
        underline: const SizedBox(),
        dropdownColor: const Color(0xFF0D1B3E),
        isDense: true,
        style: GoogleFonts.outfit(color: Colors.white, fontSize: 10),
      ),
    );
  }

  // ── LIVE CHAT PANEL ────────────────────────────────────────────────────────
  Widget _buildChatPanel() {
    return Container(
      decoration: const BoxDecoration(
        color: Color(0xE60D1B3E),
        border: Border(left: BorderSide(color: AppTheme.border))),
      child: Column(
        children: [
          // Header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: const BoxDecoration(
              border: Border(bottom: BorderSide(color: AppTheme.border))),
            child: Row(children: [
              const Icon(Icons.chat_rounded, color: AppTheme.primary, size: 16),
              const SizedBox(width: 6),
              Text('Live Chat', style: GoogleFonts.outfit(
                fontSize: 12, fontWeight: FontWeight.w800, color: AppTheme.text1)),
              const Spacer(),
              GestureDetector(
                onTap: () => setState(() => _chatOpen = false),
                child: const Icon(Icons.close_rounded, color: AppTheme.text3, size: 16)),
            ]),
          ),
          // Messages
          Expanded(
            child: ListView.builder(
              controller: _chatScroll,
              padding: const EdgeInsets.all(8),
              itemCount: _messages.length,
              itemBuilder: (_, i) {
                final msg = _messages[i];
                final col = msg['col'] as Color;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(msg['user'].toString(), style: GoogleFonts.outfit(
                        fontSize: 9, fontWeight: FontWeight.w900, color: col)),
                      Text(msg['msg'].toString(), style: GoogleFonts.outfit(
                        fontSize: 11, color: AppTheme.text2)),
                    ],
                  ),
                );
              },
            ),
          ),
          // Input
          Container(
            padding: const EdgeInsets.all(8),
            decoration: const BoxDecoration(
              border: Border(top: BorderSide(color: AppTheme.border))),
            child: Row(children: [
              Expanded(
                child: TextField(
                  controller: _chatCtrl,
                  style: GoogleFonts.outfit(color: AppTheme.text1, fontSize: 11),
                  decoration: InputDecoration(
                    hintText: 'Send a message...',
                    hintStyle: GoogleFonts.outfit(color: AppTheme.text3, fontSize: 11),
                    filled: true, fillColor: AppTheme.card,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none)),
                  onSubmitted: (_) => _sendMessage(),
                ),
              ),
              const SizedBox(width: 6),
              GestureDetector(
                onTap: _sendMessage,
                child: Container(
                  width: 32, height: 32,
                  decoration: BoxDecoration(
                    color: AppTheme.primary, borderRadius: BorderRadius.circular(8)),
                  child: const Icon(Icons.send_rounded, color: Colors.black, size: 14))),
            ]),
          ),
        ],
      ),
    );
  }

  // ── Utilities ──────────────────────────────────────────────────────────────
  String _formatViewers(int v) {
    if (v >= 1000) return '${(v / 1000).toStringAsFixed(1)}K';
    return '$v';
  }

  String _formatDuration(double pct) {
    final secs = (pct * 5400).toInt(); // 90 min
    final m = secs ~/ 60;
    final s = secs % 60;
    return "$m:${s.toString().padLeft(2, '0')}";
  }

  void _showCastDialog() {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: AppTheme.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(children: [
          const Icon(Icons.cast_connected_rounded, color: AppTheme.primary, size: 22),
          const SizedBox(width: 10),
          Text('Cast to TV', style: GoogleFonts.outfit(fontWeight: FontWeight.w800, fontSize: 15)),
        ]),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircularProgressIndicator(color: AppTheme.primary, strokeWidth: 2),
            const SizedBox(height: 14),
            Text('Searching for devices on your local network...',
              style: GoogleFonts.outfit(fontSize: 12, color: AppTheme.text2),
              textAlign: TextAlign.center),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('Cancel', style: GoogleFonts.outfit(
              color: AppTheme.primary, fontWeight: FontWeight.w800))),
        ],
      ),
    );
  }
}

// ── PAINTERS ──────────────────────────────────────────────────────────────────
class _StadiumPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.0;
    final W = size.width;
    final H = size.height;
    canvas.drawRect(Rect.fromLTWH(W * 0.05, H * 0.05, W * 0.90, H * 0.90), p);
    canvas.drawLine(Offset(W / 2, H * 0.05), Offset(W / 2, H * 0.95), p);
    canvas.drawCircle(Offset(W / 2, H / 2), H * 0.25, p);
    canvas.drawRect(Rect.fromLTWH(W * 0.05, H * 0.25, W * 0.15, H * 0.50), p);
    canvas.drawRect(Rect.fromLTWH(W * 0.80, H * 0.25, W * 0.15, H * 0.50), p);
  }

  @override
  bool shouldRepaint(_) => false;
}
