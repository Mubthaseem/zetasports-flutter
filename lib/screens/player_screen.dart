import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'dart:convert';
import 'package:video_player/video_player.dart';
import 'package:chewie/chewie.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../services/firestore_service.dart';
import '../services/ad_service.dart';
import '../theme/stitch_theme.dart';
import '../widgets/live_pulse_badge.dart';
import 'dart:math' as math;

// ─────────────────────────────────────────────────────────────────────────────
// STITCH REDESIGN: LIVE VIDEO PLAYER & FAN HUB (Portrait + Landscape Pro Mode)
// Stitch Screen: 328db769-cf2a-4ee1-b996-26e10884d5f3
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
  bool _isFullscreen = false;
  double _volume = 0.8;
  Timer? _progressTimer;

  // Stream & Quality State
  String _quality = 'Auto';
  List<String> _qualities = ['Auto'];
  List<Map<String, String>> _parsedQualities = [];

  final GlobalKey _playerKey = GlobalKey();
  VideoPlayerController? _videoController;
  ChewieController? _chewieController;
  WebViewController? _webViewController;
  bool _useWebView = false;
  List<Map<String, dynamic>> _parsedServers = [];
  int _currentServerIndex = 0;
  bool _audioOnly = false;

  // Live Chat
  bool _landscapeChatOpen = false;
  final _chatCtrl = TextEditingController();
  final _chatScroll = ScrollController();
  final List<Map<String, dynamic>> _messages = [];

  int _viewers = 14287;
  late Map<String, dynamic> _matchState;
  dynamic _matchSubscription;
  dynamic _chatSubscription;

  final List<String> _quickReactions = ['🔥', '⚽', '👏', '😱', '⚡', '❤️', '🐐'];

  int get _liveViewers =>
      int.tryParse(_matchState['viewers']?.toString() ?? '') ?? 14287;

  bool get _isLive => _matchState['status'] == 'live';

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
      _chatSubscription = SupabaseService.subscribeToChatUpdates(
        mId,
        (newMsg) {
          if (mounted) {
            setState(() {
              if (!_messages.any((m) => m['id'] == newMsg['id'])) {
                _messages.add({
                  'id': newMsg['id'],
                  'user': newMsg['username'] ?? 'Fan',
                  'msg': newMsg['message'] ?? '',
                  'col': _getUserColor(newMsg['color']),
                  'time': 'Just now',
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

    // Default to portrait so user can browse stream info & live chat below
    SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);

    _progressTimer = Timer.periodic(const Duration(seconds: 2), (_) {
      if (!mounted) return;
      setState(() {
        final diff = math.Random().nextInt(21) - 10;
        _viewers = (_liveViewers + diff).clamp(100, 999999);
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
        streamIds = rawStreamIds
            .split(',')
            .map((s) => s.trim())
            .where((s) => s.isNotEmpty)
            .toList();
      }
    }

    List<Map<String, dynamic>> loadedStreams = [];

    if (streamIds.isNotEmpty) {
      final futures =
          streamIds.map((id) => SupabaseService.fetchStreamById(id.toString()));
      final results = await Future.wait(futures);
      for (var s in results) {
        if (s != null && s['url'] != null) {
          loadedStreams.add(Map<String, dynamic>.from(s));
        }
      }
    }

    if (loadedStreams.isEmpty) {
      String streamUrlStr = _matchState['stream_url']?.toString() ?? '';
      if (streamUrlStr.isNotEmpty &&
          !streamUrlStr.startsWith('[') &&
          !streamUrlStr.contains('http')) {
        final s = await SupabaseService.fetchStreamById(streamUrlStr);
        if (s != null && s['url'] != null) {
          loadedStreams.add(Map<String, dynamic>.from(s));
        }
      } else if (streamUrlStr.startsWith('[')) {
        try {
          final list = jsonDecode(streamUrlStr) as List;
          loadedStreams =
              list.map((e) => Map<String, dynamic>.from(e)).toList();
        } catch (_) {
          loadedStreams = [];
        }
      } else if (streamUrlStr.isNotEmpty) {
        String guessedType = 'm3u8';
        if (streamUrlStr.contains('.mpd')) {
          guessedType = 'mpd';
        } else if (!streamUrlStr.contains('.m3u8') &&
            !streamUrlStr.contains('.ts') &&
            !streamUrlStr.contains('.mp4')) {
          guessedType = 'iframe';
        }
        loadedStreams = [
          {
            'label': 'Main Server HD',
            'url': streamUrlStr,
            'type': guessedType,
            'keyId': '',
            'key': '',
          }
        ];
      }
    }

    if (!mounted) return;

    if (loadedStreams.isNotEmpty) {
      setState(() {
        _parsedServers = loadedStreams.map((s) {
          return {
            'serverName': s['label'] ??
                s['serverName'] ??
                'Server ${loadedStreams.indexOf(s) + 1}',
            'url': s['url'].toString(),
            'type': s['type']?.toString().toLowerCase() ?? 'm3u8',
            'keyId': s['keyId']?.toString() ?? s['key_id']?.toString() ?? '',
            'key': s['key']?.toString() ?? '',
            'drmType': 'none'
          };
        }).toList();
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
    final isDrm = (server['keyId']?.toString().isNotEmpty ?? false) ||
        (server['key']?.toString().isNotEmpty ?? false);

    if (type == 'iframe' || type == 'okru' || isDrm) {
      setState(() {
        _useWebView = true;
        _playing = true;
      });
      _initWebView(url,
          type: type,
          keyId: server['keyId']?.toString(),
          key: server['key']?.toString());
    } else {
      setState(() {
        _useWebView = false;
        _playing = true;
      });

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

        _chewieController?.dispose();
        _videoController?.dispose();
        _chewieController = null;
        _videoController = null;

        setState(() {
          _useWebView = true;
          _playing = true;
        });
        _initWebView(url,
            type: type,
            keyId: server['keyId']?.toString(),
            key: server['key']?.toString());
      }

      initTimeout = Timer(const Duration(seconds: 7), () {
        if (!mounted || fallbackTriggered) return;
        final controller = _videoController;
        if (controller == null) {
          triggerFallback();
          return;
        }
        final val = controller.value;
        if (!val.isInitialized || !val.isPlaying || val.isBuffering) {
          triggerFallback();
        }
      });

      _videoController!.initialize().then((_) {
        if (fallbackTriggered || !mounted) return;

        _chewieController = ChewieController(
          videoPlayerController: _videoController!,
          autoPlay: true,
          looping: false,
          isLive: _isLive,
          showControls: false,
          aspectRatio: 16 / 9,
          allowMuting: true,
        );

        _videoController!.addListener(() {
          if (!mounted || fallbackTriggered) return;
          final isPlaying = _videoController!.value.isPlaying;
          if (isPlaying != _playing) {
            setState(() => _playing = isPlaying);
          }
          final val = _videoController!.value;
          if (val.isInitialized && val.isPlaying && !val.isBuffering) {
            initTimeout?.cancel();
          }
        });

        setState(() {});
      }).catchError((_) {
        triggerFallback();
      });
    }
  }

  void _initWebView(String url,
      {required String type, String? keyId, String? key}) {
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
    final drmConfig = (keyId != null &&
            keyId.isNotEmpty &&
            key != null &&
            key.isNotEmpty)
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
        .shaka-play-button-container { transform: scale(1.2); }
        .shaka-seek-bar-container { display: none !important; }
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
          
          const ui = new shaka.ui.Overlay(player, videoContainer, video);
          player.addEventListener('error', (event) => {
            console.error('Shaka Player Error:', event.detail);
          });
          $drmConfig
          try {
            await player.load('$url');
          } catch (e) {
            console.error('Shaka load error:', e);
          }
        }
        document.addEventListener('DOMContentLoaded', () => {
          shaka.polyfill.installAll();
          if (shaka.Player.isBrowserSupported()) {
            initPlayer();
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
          } else if (line.isNotEmpty &&
              !line.startsWith('#') &&
              currentRes != null) {
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
    } catch (_) {}
  }

  void _loadChatMessages() async {
    if (_matchState['id'] == null) return;
    final msgs =
        await SupabaseService.fetchChatMessages(_matchState['id'].toString());
    if (mounted) {
      setState(() {
        _messages.clear();
        for (var m in msgs) {
          _messages.add({
            'id': m['id'],
            'user': m['username'] ?? 'Fan',
            'msg': m['message'] ?? '',
            'col': _getUserColor(m['color']),
            'time': 'Recent',
          });
        }
      });
      _scrollToBottom();
    }
  }

  Color _getUserColor(String? colorStr) {
    if (colorStr == 'primary') return StitchColors.primaryContainer;
    if (colorStr == 'secondary') return StitchColors.secondaryContainer;
    if (colorStr == 'success') return const Color(0xFF10B981);
    if (colorStr == 'warning') return const Color(0xFFF59E0B);
    if (colorStr == 'danger') return StitchColors.tertiary;
    return StitchColors.primaryContainer;
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

  void _toggleFullscreen() {
    setState(() => _isFullscreen = !_isFullscreen);
    if (_isFullscreen) {
      SystemChrome.setPreferredOrientations([
        DeviceOrientation.landscapeLeft,
        DeviceOrientation.landscapeRight,
      ]);
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    } else {
      SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    }
  }

  void _sendMessage([String? quickEmoji]) async {
    final text = (quickEmoji ?? _chatCtrl.text).trim();
    if (text.isEmpty || _matchState['id'] == null) return;

    if (quickEmoji == null) _chatCtrl.clear();
    final user = widget.username.isNotEmpty ? widget.username : 'Fan';
    final matchId = _matchState['id'].toString();

    await SupabaseService.sendChatMessage(matchId, user, text, 'primary');
  }

  void _scrollToBottom() {
    Future.delayed(const Duration(milliseconds: 100), () {
      if (_chatScroll.hasClients) {
        _chatScroll.animateTo(
          _chatScroll.position.maxScrollExtent,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final home = _matchState['home_team']?.toString() ?? 'Home';
    final away = _matchState['away_team']?.toString() ?? 'Away';
    final score = _matchState['score']?.toString() ?? '0 - 0';
    final min = _matchState['time_elapsed']?.toString() ?? 'LIVE';
    final league = _matchState['league']?.toString() ?? 'Live Stream';

    // ── LANDSCAPE IMMERSIVE MODE ─────────────────────────────────────────────
    if (_isFullscreen) {
      return Scaffold(
        backgroundColor: Colors.black,
        body: GestureDetector(
          onTap: _showHudTemporarily,
          child: Stack(
            children: [
              Positioned.fill(
                child: _buildPlayerSurface(home, away, score, min),
              ),
              AnimatedOpacity(
                opacity: _hudVisible ? 1.0 : 0.0,
                duration: const Duration(milliseconds: 250),
                child: _buildLandscapeHUD(home, away, score, min),
              ),
              if (_landscapeChatOpen)
                Positioned(
                  right: 0,
                  top: 0,
                  bottom: 0,
                  width: 280,
                  child: _buildLandscapeChatDrawer(),
                ),
            ],
          ),
        ),
      );
    }

    // ── PORTRAIT PRO MODE (Stitch 1:1 Layout) ────────────────────────────────
    return Scaffold(
      backgroundColor: StitchColors.inverseSurface,
      body: SafeArea(
        child: Column(
          children: [
            // Top Video Surface (16:9 ratio with HUD overlay)
            AspectRatio(
              aspectRatio: 16 / 9,
              child: GestureDetector(
                onTap: _showHudTemporarily,
                child: Stack(
                  children: [
                    Positioned.fill(
                      child: _buildPlayerSurface(home, away, score, min),
                    ),
                    AnimatedOpacity(
                      opacity: _hudVisible ? 1.0 : 0.0,
                      duration: const Duration(milliseconds: 250),
                      child: _buildPortraitHUD(home, away, score, min),
                    ),
                  ],
                ),
              ),
            ),

            // Match Info & Multi-Server Failover Header
            _buildMatchHeaderAndServers(home, away, score, min, league),

            // Live Fan Chat & Interactive Area (Expanded)
            Expanded(
              child: Container(
                color: const Color(0xFF0D1424),
                child: Column(
                  children: [
                    // Chat Banner with Viewer count and online beacon
                    _buildChatBanner(),

                    // Live Messages List
                    Expanded(
                      child: ListView.builder(
                        controller: _chatScroll,
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 8),
                        itemCount: _messages.length,
                        itemBuilder: (context, i) {
                          final msg = _messages[i];
                          final col = msg['col'] as Color? ??
                              StitchColors.primaryContainer;
                          return _buildChatMessageItem(msg, col);
                        },
                      ),
                    ),

                    // Quick Reaction Emojis Row
                    _buildQuickReactionsBar(),

                    // Message Input Field
                    _buildChatInputField(),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── VIDEO SURFACE RENDERER ─────────────────────────────────────────────────
  Widget _buildPlayerSurface(
      String home, String away, String score, String min) {
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
                      const Icon(Icons.headset_rounded,
                          color: StitchColors.primaryContainer, size: 48),
                      const SizedBox(height: 12),
                      Text('Audio-Only Stream',
                          style: StitchTypography.bodyMd(color: Colors.white70)),
                    ],
                  )
                : _chewieController != null &&
                        _videoController != null &&
                        _videoController!.value.isInitialized
                    ? Chewie(
                        key: _playerKey,
                        controller: _chewieController!,
                      )
                    : Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const CircularProgressIndicator(
                                color: StitchColors.primaryContainer,
                                strokeWidth: 2.5),
                            const SizedBox(height: 12),
                            Text('Connecting Stream...',
                                style: StitchTypography.labelSm(
                                    color: Colors.white70)),
                          ],
                        ),
                      ),
          ),
        ),
      );
    }

    // Fallback stadium gradient card when stream is loading
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF0F172A), Color(0xFF1E293B), Color(0xFF0F172A)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('$home  $score  $away',
                style: StitchTypography.titleLg(color: Colors.white)),
            const SizedBox(height: 8),
            const LivePulseBadge(text: 'LIVE BROADCAST'),
          ],
        ),
      ),
    );
  }

  // ── PORTRAIT HUD OVERLAY ───────────────────────────────────────────────────
  Widget _buildPortraitHUD(
      String home, String away, String score, String min) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            Colors.black.withValues(alpha: 0.7),
            Colors.transparent,
            Colors.black.withValues(alpha: 0.8),
          ],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
      ),
      child: Column(
        children: [
          // Top Control Row
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Row(
              children: [
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.arrow_back_ios_new_rounded,
                      color: Colors.white, size: 20),
                ),
                const SizedBox(width: 4),
                const LivePulseBadge(text: 'LIVE'),
                const SizedBox(width: 10),
                Row(
                  children: [
                    const Icon(Icons.visibility_rounded,
                        color: Colors.white70, size: 14),
                    const SizedBox(width: 5),
                    Text('${_formatViewers(_viewers)} watching',
                        style: StitchTypography.labelSm(color: Colors.white70)),
                  ],
                ),
                const Spacer(),
                // Quality Picker Dropdown
                _buildQualityDropdown(),
                const SizedBox(width: 8),
                // Fullscreen button
                IconButton(
                  onPressed: _toggleFullscreen,
                  icon: const Icon(Icons.fullscreen_rounded,
                      color: Colors.white, size: 24),
                ),
              ],
            ),
          ),
          const Spacer(),
          // Bottom Video Control Row
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            child: Row(
              children: [
                // Play / Pause
                GestureDetector(
                  onTap: () {
                    setState(() => _playing = !_playing);
                    if (_useWebView) {
                      if (_playing) {
                        _webViewController?.runJavaScript(
                            "document.getElementById('video').play();");
                      } else {
                        _webViewController?.runJavaScript(
                            "document.getElementById('video').pause();");
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
                    _playing
                        ? Icons.pause_circle_filled_rounded
                        : Icons.play_circle_fill_rounded,
                    color: StitchColors.primaryContainer,
                    size: 38,
                  ),
                ),
                const SizedBox(width: 14),
                // Mute toggle
                GestureDetector(
                  onTap: () {
                    setState(() => _muted = !_muted);
                    if (_useWebView) {
                      _webViewController?.runJavaScript(
                          "document.getElementById('video').muted = $_muted;");
                    } else {
                      _videoController?.setVolume(_muted ? 0.0 : _volume);
                    }
                  },
                  child: Icon(
                    _muted ? Icons.volume_off_rounded : Icons.volume_up_rounded,
                    color: Colors.white70,
                    size: 22,
                  ),
                ),
                const SizedBox(width: 12),
                if (!_useWebView)
                  GestureDetector(
                    onTap: () {
                      setState(() {
                        _audioOnly = !_audioOnly;
                        if (_audioOnly) {
                          _videoController?.pause();
                        } else {
                          _videoController?.play();
                        }
                      });
                    },
                    child: Icon(
                      _audioOnly
                          ? Icons.headset_rounded
                          : Icons.headset_off_rounded,
                      color: _audioOnly
                          ? StitchColors.primaryContainer
                          : Colors.white70,
                      size: 20,
                    ),
                  ),
                const Spacer(),
                Text(
                  _isLive ? 'LIVE' : min,
                  style: StitchTypography.labelSm(
                    color: _isLive ? StitchColors.tertiary : Colors.white70,
                  ).copyWith(fontWeight: FontWeight.w700),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ── LANDSCAPE HUD OVERLAY ──────────────────────────────────────────────────
  Widget _buildLandscapeHUD(
      String home, String away, String score, String min) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            Colors.black.withValues(alpha: 0.75),
            Colors.transparent,
            Colors.black.withValues(alpha: 0.85),
          ],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
      ),
      child: Column(
        children: [
          // Top row
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            child: Row(
              children: [
                IconButton(
                  onPressed: _toggleFullscreen,
                  icon: const Icon(Icons.arrow_back_ios_new_rounded,
                      color: Colors.white, size: 20),
                ),
                const SizedBox(width: 8),
                Text('$home vs $away  ($score)',
                    style: StitchTypography.titleMd(color: Colors.white)),
                const SizedBox(width: 12),
                const LivePulseBadge(text: 'LIVE'),
                const Spacer(),
                Row(
                  children: [
                    const Icon(Icons.visibility_rounded,
                        color: Colors.white70, size: 14),
                    const SizedBox(width: 6),
                    Text('${_formatViewers(_viewers)} watching',
                        style: StitchTypography.labelSm(color: Colors.white70)),
                  ],
                ),
                const SizedBox(width: 16),
                _buildQualityDropdown(),
                const SizedBox(width: 12),
                IconButton(
                  onPressed: () =>
                      setState(() => _landscapeChatOpen = !_landscapeChatOpen),
                  icon: Icon(
                    Icons.chat_bubble_outline_rounded,
                    color: _landscapeChatOpen
                        ? StitchColors.primaryContainer
                        : Colors.white,
                    size: 22,
                  ),
                ),
                IconButton(
                  onPressed: _toggleFullscreen,
                  icon: const Icon(Icons.fullscreen_exit_rounded,
                      color: Colors.white, size: 26),
                ),
              ],
            ),
          ),
          const Spacer(),
          // Bottom row
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
            child: Row(
              children: [
                GestureDetector(
                  onTap: () {
                    setState(() => _playing = !_playing);
                    if (_useWebView) {
                      if (_playing) {
                        _webViewController?.runJavaScript(
                            "document.getElementById('video').play();");
                      } else {
                        _webViewController?.runJavaScript(
                            "document.getElementById('video').pause();");
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
                    _playing
                        ? Icons.pause_circle_filled_rounded
                        : Icons.play_circle_fill_rounded,
                    color: StitchColors.primaryContainer,
                    size: 44,
                  ),
                ),
                const SizedBox(width: 16),
                GestureDetector(
                  onTap: () {
                    setState(() => _muted = !_muted);
                    if (_useWebView) {
                      _webViewController?.runJavaScript(
                          "document.getElementById('video').muted = $_muted;");
                    } else {
                      _videoController?.setVolume(_muted ? 0.0 : _volume);
                    }
                  },
                  child: Icon(
                    _muted ? Icons.volume_off_rounded : Icons.volume_up_rounded,
                    color: Colors.white70,
                    size: 24,
                  ),
                ),
                const SizedBox(width: 16),
                SizedBox(
                  width: 100,
                  child: SliderTheme(
                    data: SliderTheme.of(context).copyWith(
                      trackHeight: 2,
                      thumbShape:
                          const RoundSliderThumbShape(enabledThumbRadius: 4),
                      activeTrackColor: Colors.white70,
                      inactiveTrackColor: Colors.white24,
                      thumbColor: Colors.white,
                    ),
                    child: Slider(
                      value: _muted ? 0.0 : _volume,
                      onChanged: (v) {
                        setState(() {
                          _volume = v;
                          _muted = v == 0;
                        });
                        if (_useWebView) {
                          _webViewController?.runJavaScript(
                              "document.getElementById('video').volume = $v;");
                        } else {
                          _videoController?.setVolume(_muted ? 0.0 : _volume);
                        }
                      },
                    ),
                  ),
                ),
                const Spacer(),
                // Server quick switch pills in landscape
                ..._parsedServers.asMap().entries.map((entry) {
                  final idx = entry.key;
                  final s = entry.value;
                  final isSelected = idx == _currentServerIndex;
                  return Padding(
                    padding: const EdgeInsets.only(left: 8),
                    child: GestureDetector(
                      onTap: () => _initPlayer(idx),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: isSelected
                              ? StitchColors.primaryContainer
                              : Colors.black45,
                          borderRadius:
                              BorderRadius.circular(StitchRadius.full),
                          border: Border.all(
                            color: isSelected
                                ? StitchColors.primaryContainer
                                : Colors.white24,
                          ),
                        ),
                        child: Text(
                          s['serverName'] ?? 'Server ${idx + 1}',
                          style: StitchTypography.labelSm(
                            color: isSelected ? Colors.white : Colors.white70,
                          ),
                        ),
                      ),
                    ),
                  );
                }),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ── MATCH HEADER & SERVERS BAR ─────────────────────────────────────────────
  Widget _buildMatchHeaderAndServers(
      String home, String away, String score, String min, String league) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: const BoxDecoration(
        color: StitchColors.inverseSurface,
        border: Border(
          bottom: BorderSide(color: Color(0xFF1E293B), width: 1),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Match Title & Score Row
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      league.toUpperCase(),
                      style: StitchTypography.labelSm(
                        color: StitchColors.primaryContainer,
                      ).copyWith(letterSpacing: 1.1, fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      '$home vs $away',
                      style: StitchTypography.titleMd(color: Colors.white),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(StitchRadius.md),
                ),
                child: Text(
                  score,
                  style: StitchTypography.titleMd(color: Colors.white)
                      .copyWith(fontWeight: FontWeight.w800),
                ),
              ),
            ],
          ),

          const SizedBox(height: 12),

          // Multi-Server Failover Pills Row
          if (_parsedServers.isNotEmpty) ...[
            Text('STREAM SERVERS',
                style: StitchTypography.labelSm(
                  color: Colors.white54,
                ).copyWith(fontSize: 10, letterSpacing: 0.8)),
            const SizedBox(height: 6),
            SizedBox(
              height: 36,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: _parsedServers.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (context, index) {
                  final s = _parsedServers[index];
                  final isSelected = index == _currentServerIndex;
                  return GestureDetector(
                    onTap: () => _initPlayer(index),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 8),
                      decoration: BoxDecoration(
                        color: isSelected
                            ? StitchColors.primaryContainer
                            : const Color(0xFF1E293B),
                        borderRadius:
                            BorderRadius.circular(StitchRadius.full),
                        border: Border.all(
                          color: isSelected
                              ? StitchColors.primaryContainer
                              : Colors.white12,
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            isSelected
                                ? Icons.play_circle_fill_rounded
                                : Icons.sensors_rounded,
                            color: isSelected ? Colors.white : Colors.white60,
                            size: 14,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            s['serverName'] ?? 'Server ${index + 1}',
                            style: StitchTypography.labelSm(
                              color: isSelected ? Colors.white : Colors.white70,
                            ).copyWith(
                                fontWeight: isSelected
                                    ? FontWeight.w700
                                    : FontWeight.w500),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ],
      ),
    );
  }

  // ── CHAT BANNER ────────────────────────────────────────────────────────────
  Widget _buildChatBanner() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: const BoxDecoration(
        color: Color(0xFF0F172A),
        border: Border(
          bottom: BorderSide(color: Color(0xFF1E293B), width: 1),
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: const BoxDecoration(
              color: Color(0xFF10B981),
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 8),
          Text('LIVE FAN CHAT',
              style: StitchTypography.labelSm(color: Colors.white)
                  .copyWith(fontWeight: FontWeight.w800, letterSpacing: 0.8)),
          const Spacer(),
          Text(
            '${_messages.length} messages',
            style: StitchTypography.labelSm(color: Colors.white54),
          ),
        ],
      ),
    );
  }

  // ── CHAT MESSAGE ITEM ──────────────────────────────────────────────────────
  Widget _buildChatMessageItem(Map<String, dynamic> msg, Color userCol) {
    final user = msg['user']?.toString() ?? 'Fan';
    final text = msg['msg']?.toString() ?? '';

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 30,
            height: 30,
            decoration: BoxDecoration(
              color: userCol.withValues(alpha: 0.18),
              borderRadius: BorderRadius.circular(StitchRadius.full),
              border: Border.all(color: userCol.withValues(alpha: 0.4)),
            ),
            child: Center(
              child: Text(
                user.isNotEmpty ? user[0].toUpperCase() : 'F',
                style: StitchTypography.labelSm(color: userCol)
                    .copyWith(fontWeight: FontWeight.w800),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(user,
                        style: StitchTypography.labelSm(color: userCol)
                            .copyWith(fontWeight: FontWeight.w700)),
                    const SizedBox(width: 8),
                    Text(msg['time'] ?? 'Just now',
                        style: StitchTypography.labelSm(
                            color: Colors.white38).copyWith(fontSize: 10)),
                  ],
                ),
                const SizedBox(height: 3),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E293B),
                    borderRadius: BorderRadius.circular(StitchRadius.md),
                  ),
                  child: Text(
                    text,
                    style: StitchTypography.bodyMd(color: Colors.white),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ── QUICK REACTION EMOJIS BAR ──────────────────────────────────────────────
  Widget _buildQuickReactionsBar() {
    return Container(
      height: 44,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: const BoxDecoration(
        color: Color(0xFF0F172A),
        border: Border(
          top: BorderSide(color: Color(0xFF1E293B), width: 1),
        ),
      ),
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: _quickReactions.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, i) {
          final emoji = _quickReactions[i];
          return Center(
            child: GestureDetector(
              onTap: () => _sendMessage(emoji),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(StitchRadius.full),
                  border: Border.all(color: Colors.white12),
                ),
                child: Text(emoji, style: const TextStyle(fontSize: 16)),
              ),
            ),
          );
        },
      ),
    );
  }

  // ── CHAT INPUT FIELD ───────────────────────────────────────────────────────
  Widget _buildChatInputField() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: const BoxDecoration(
        color: StitchColors.inverseSurface,
        border: Border(
          top: BorderSide(color: Color(0xFF1E293B), width: 1),
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(StitchRadius.full),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: TextField(
                controller: _chatCtrl,
                style: StitchTypography.bodyMd(color: Colors.white),
                decoration: InputDecoration(
                  hintText: 'Share your reaction with fans...',
                  hintStyle:
                      StitchTypography.bodyMd(color: Colors.white38),
                  border: InputBorder.none,
                  isDense: true,
                  contentPadding: const EdgeInsets.symmetric(vertical: 12),
                ),
                onSubmitted: (_) => _sendMessage(),
              ),
            ),
          ),
          const SizedBox(width: 10),
          GestureDetector(
            onTap: () => _sendMessage(),
            child: Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: StitchColors.primaryContainer,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: StitchColors.primaryContainer.withValues(alpha: 0.3),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: const Icon(Icons.send_rounded, color: Colors.white, size: 18),
            ),
          ),
        ],
      ),
    );
  }

  // ── LANDSCAPE CHAT DRAWER ──────────────────────────────────────────────────
  Widget _buildLandscapeChatDrawer() {
    return Container(
      color: const Color(0xE60D1424),
      child: Column(
        children: [
          _buildChatBanner(),
          Expanded(
            child: ListView.builder(
              controller: _chatScroll,
              padding: const EdgeInsets.all(12),
              itemCount: _messages.length,
              itemBuilder: (context, i) {
                final msg = _messages[i];
                final col = msg['col'] as Color? ?? StitchColors.primaryContainer;
                return _buildChatMessageItem(msg, col);
              },
            ),
          ),
          _buildChatInputField(),
        ],
      ),
    );
  }

  // ── QUALITY DROPDOWN ───────────────────────────────────────────────────────
  Widget _buildQualityDropdown() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white12,
        borderRadius: BorderRadius.circular(StitchRadius.sm),
      ),
      child: DropdownButton<String>(
        value: _quality,
        items: _qualities
            .map((q) => DropdownMenuItem(
                  value: q,
                  child: Text(q,
                      style: StitchTypography.labelSm(color: Colors.white)),
                ))
            .toList(),
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
        icon: const Icon(Icons.arrow_drop_down, color: Colors.white70, size: 16),
        underline: const SizedBox(),
        dropdownColor: const Color(0xFF0F172A),
        isDense: true,
      ),
    );
  }

  // ── UTILITIES ──────────────────────────────────────────────────────────────
  String _formatViewers(int v) {
    if (v >= 1000) return '${(v / 1000).toStringAsFixed(1)}K';
    return '$v';
  }
}
