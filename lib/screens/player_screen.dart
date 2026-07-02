import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:video_player/video_player.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:google_fonts/google_fonts.dart';
import 'dart:async';
import '../services/firestore_service.dart';
import '../theme/app_theme.dart';

class PlayerScreen extends StatefulWidget {
  final Map<String, dynamic> stream;
  final String username;
  final String deviceId;

  const PlayerScreen({
    super.key,
    required this.stream,
    required this.username,
    required this.deviceId,
  });

  @override
  State<PlayerScreen> createState() => _PlayerScreenState();
}

class _PlayerScreenState extends State<PlayerScreen> {
  // Native Video Player
  VideoPlayerController? _videoCtrl;
  bool _isInitialized = false;
  bool _hasError = false;

  // Web View Fallback
  WebViewController? _webCtrl;

  // Controls HUD overlay
  bool _showHud = true;
  Timer? _hudTimer;
  Timer? _heartbeatTimer;

  final _focusNode = FocusNode();
  final _backBtnFocusNode = FocusNode();
  final _playBtnFocusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    // 1. Force landscape orientation and hide system status bars
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
    ]);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);

    // 2. Initialize Player
    final type = widget.stream['type']?.toString().toLowerCase() ?? 'm3u8';
    final url = widget.stream['url']?.toString() ?? '';

    if (type == 'm3u8') {
      _initNativePlayer(url);
    } else if (type == 'okru') {
      _initOkRuPlayer(url);
    } else {
      _initWebPlayer(type, url);
    }

    // 3. Start HUD timer
    _resetHudTimer();

    // 4. Start Heartbeats while streaming (every 60s)
    _startPlayerHeartbeat();

    // Focus main node
    _focusNode.requestFocus();
  }

  @override
  void dispose() {
    // Restore orientation and system bars
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.portraitUp,
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
    ]);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);

    _videoCtrl?.dispose();
    _hudTimer?.cancel();
    _heartbeatTimer?.cancel();

    _focusNode.dispose();
    _backBtnFocusNode.dispose();
    _playBtnFocusNode.dispose();
    super.dispose();
  }

  void _initNativePlayer(String url) {
    try {
      _videoCtrl = VideoPlayerController.networkUrl(Uri.parse(url))
        ..initialize().then((_) {
          if (mounted) {
            setState(() {
              _isInitialized = true;
              _hasError = false;
            });
            _videoCtrl!.play();
          }
        }).catchError((err) {
          debugPrint("Video initialization failed: $err");
          if (mounted) {
            setState(() {
              _hasError = true;
              _isInitialized = false;
            });
          }
        });
    } catch (e) {
      debugPrint("Native Player exception: $e");
      setState(() => _hasError = true);
    }
  }

  void _initWebPlayer(String type, String code) {
    String html = '';
    if (type == 'iframe') {
      html = '''
        <!DOCTYPE html><html><head>
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <style>*{margin:0;padding:0;background:#000}body,html{height:100%}iframe{width:100vw;height:100vh;border:none}</style>
        </head><body>
        <iframe src="$code" allowfullscreen allow="autoplay;encrypted-media"></iframe>
        </body></html>
      ''';
    } else {
      // HTML Code
      html = '''
        <!DOCTYPE html><html><head>
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <style>*{margin:0;padding:0;background:#000}body,html{height:100%;display:flex;align-items:center;justify-content:center}</style>
        </head><body>$code</body></html>
      ''';
    }

    _webCtrl = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.black)
      ..loadHtmlString(html);
    
    setState(() {
      _isInitialized = true;
    });
  }

  /// Dedicated OK.ru live stream embed player.
  /// [videoId] can be either the full URL (https://ok.ru/video/15174081388058)
  /// or just the numeric ID (15174081388058) or the embed URL.
  void _initOkRuPlayer(String videoId) {
    // Normalise: extract the numeric ID if a full URL was passed
    String embedUrl;
    final idMatch = RegExp(r'(\d{10,})').firstMatch(videoId);
    if (idMatch != null) {
      embedUrl = 'https://ok.ru/videoembed/${idMatch.group(1)}';
    } else {
      embedUrl = videoId; // fallback: use as-is
    }

    final html = '''
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; background: #000; overflow: hidden; }
    iframe {
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      border: none;
    }
  </style>
</head>
<body>
  <iframe
    src="$embedUrl"
    frameborder="0"
    allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
    allowfullscreen
    webkitallowfullscreen
    mozallowfullscreen
    scrolling="no">
  </iframe>
</body>
</html>
''';

    _webCtrl = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.black)
      ..setUserAgent(
        'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 '
        '(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
      )
      ..loadHtmlString(html);

    setState(() {
      _isInitialized = true;
    });
  }

  void _startPlayerHeartbeat() {
    _heartbeatTimer = Timer.periodic(const Duration(seconds: 60), (timer) async {
      await FirestoreService.sendHeartbeat(widget.username, widget.deviceId);
    });
  }

  void _resetHudTimer() {
    _hudTimer?.cancel();
    if (mounted && !_showHud) {
      setState(() => _showHud = true);
    }
    _hudTimer = Timer(const Duration(seconds: 4), () {
      if (mounted && _showHud) {
        setState(() => _showHud = false);
      }
    });
  }

  void _togglePlayPause() {
    if (_videoCtrl != null && _isInitialized) {
      setState(() {
        if (_videoCtrl!.value.isPlaying) {
          _videoCtrl!.pause();
        } else {
          _videoCtrl!.play();
        }
      });
      _resetHudTimer();
    }
  }

  KeyEventResult _handleKeyEvent(RawKeyEvent event) {
    if (event is RawKeyDownEvent) {
      _resetHudTimer();

      // Back Button
      if (event.logicalKey == LogicalKeyboardKey.goBack ||
          event.logicalKey == LogicalKeyboardKey.escape) {
        if (_showHud) {
          setState(() => _showHud = false);
          return KeyEventResult.handled;
        }
        Navigator.pop(context);
        return KeyEventResult.handled;
      }

      // Enter / Select to Toggle Play/Pause
      if (event.logicalKey == LogicalKeyboardKey.enter ||
          event.logicalKey == LogicalKeyboardKey.select ||
          event.logicalKey == LogicalKeyboardKey.space) {
        // Toggle play/pause if native
        if (_videoCtrl != null) {
          _togglePlayPause();
          return KeyEventResult.handled;
        }
      }
    }
    return KeyEventResult.ignored;
  }

  @override
  Widget build(BuildContext context) {
    final title = widget.stream['label'] ?? 'Live Stream';
    final isNative = _videoCtrl != null;

    return Focus(
      focusNode: _focusNode,
      onKey: (node, event) => _handleKeyEvent(event),
      child: PopScope(
        canPop: false,
        onPopInvokedWithResult: (didPop, result) {
          if (didPop) return;
          if (_showHud) {
            setState(() => _showHud = false);
          } else {
            Navigator.pop(context);
          }
        },
        child: Scaffold(
          backgroundColor: Colors.black,
        body: Stack(
          children: [
            // ── VIDEO VIEWPORT ──────────────────────────────────────────
            Center(
              child: isNative
                  ? (_isInitialized
                      ? AspectRatio(
                          aspectRatio: _videoCtrl!.value.aspectRatio,
                          child: VideoPlayer(_videoCtrl!),
                        )
                      : (_hasError
                          ? _buildErrorPlaceholder()
                          : _buildLoadingPlaceholder()))
                  : (_webCtrl != null
                      ? WebViewWidget(controller: _webCtrl!)
                      : _buildLoadingPlaceholder()),
            ),

            // GestureDetector for click events on touch TV screens
            GestureDetector(
              onTap: () {
                _resetHudTimer();
                if (!_showHud) {
                  setState(() => _showHud = true);
                }
              },
              behavior: HitTestBehavior.translucent,
              child: Container(),
            ),

            // ── WATERMARK OVERLAY ──────────────────────────────────────
            StreamBuilder<Map<String, dynamic>?>(
              stream: FirestoreService.configStream(),
              builder: (context, snap) {
                final settings = snap.data;
                final text = settings?['watermark']?.toString() ?? 'FIFA LIVE';
                return Positioned(
                  top: 24,
                  right: 24,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.4),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      text.toUpperCase(),
                      style: GoogleFonts.rajdhani(
                        color: Colors.white70,
                        fontSize: 12,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 1,
                      ),
                    ),
                  ),
                );
              },
            ),

            // ── CONTROLS HUD ───────────────────────────────────────────
            if (_showHud)
              AnimatedOpacity(
                opacity: _showHud ? 1.0 : 0.0,
                duration: const Duration(milliseconds: 200),
                child: Container(
                  color: Colors.black.withOpacity(0.55),
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      // HUD Top Bar
                      Row(
                        children: [
                          Focus(
                            focusNode: _backBtnFocusNode,
                            onKey: (node, event) {
                              if (event is RawKeyDownEvent &&
                                  (event.logicalKey == LogicalKeyboardKey.enter ||
                                   event.logicalKey == LogicalKeyboardKey.select)) {
                                Navigator.pop(context);
                                return KeyEventResult.handled;
                              }
                              return KeyEventResult.ignored;
                            },
                            child: AnimatedBuilder(
                              animation: _backBtnFocusNode,
                              builder: (context, child) {
                                final hasFocus = _backBtnFocusNode.hasFocus;
                                return IconButton(
                                  focusNode: _backBtnFocusNode,
                                  icon: const Icon(Icons.arrow_back),
                                  color: hasFocus ? AppTheme.accent : Colors.white,
                                  onPressed: () => Navigator.pop(context),
                                );
                              },
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            title.toUpperCase(),
                            style: GoogleFonts.rajdhani(
                              color: Colors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 0.5,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Builder(builder: (context) {
                            final streamType = widget.stream['type']?.toString().toLowerCase() ?? '';
                            final isOkRu = streamType == 'okru';
                            Color badgeColor = isNative
                                ? Colors.green
                                : isOkRu
                                    ? const Color(0xFFFF6B00)
                                    : Colors.blue;
                            String badgeText = isNative
                                ? 'NATIVE HLS'
                                : isOkRu
                                    ? 'OK.RU LIVE'
                                    : 'WEB EMBED';
                            return Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: badgeColor.withOpacity(0.2),
                                borderRadius: BorderRadius.circular(4),
                                border: Border.all(color: badgeColor, width: 0.5),
                              ),
                              child: Text(
                                badgeText,
                                style: const TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.w800),
                              ),
                            );
                          }),
                        ],
                      ),

                      // HUD Center Play/Pause (For Native Player)
                      if (isNative && _isInitialized)
                        Center(
                          child: Focus(
                            focusNode: _playBtnFocusNode,
                            onKey: (node, event) {
                              if (event is RawKeyDownEvent &&
                                  (event.logicalKey == LogicalKeyboardKey.enter ||
                                   event.logicalKey == LogicalKeyboardKey.select)) {
                                _togglePlayPause();
                                return KeyEventResult.handled;
                              }
                              return KeyEventResult.ignored;
                            },
                            child: AnimatedBuilder(
                              animation: _playBtnFocusNode,
                              builder: (context, child) {
                                final hasFocus = _playBtnFocusNode.hasFocus;
                                return GestureDetector(
                                  onTap: _togglePlayPause,
                                  child: Container(
                                    padding: const EdgeInsets.all(16),
                                    decoration: BoxDecoration(
                                      color: hasFocus 
                                          ? AppTheme.accent.withOpacity(0.25)
                                          : Colors.black.withOpacity(0.4),
                                      shape: BoxShape.circle,
                                      border: Border.all(
                                        color: hasFocus ? AppTheme.accent : Colors.white24,
                                        width: 2,
                                      ),
                                    ),
                                    child: Icon(
                                      _videoCtrl!.value.isPlaying
                                          ? Icons.pause
                                          : Icons.play_arrow,
                                      color: hasFocus ? AppTheme.accent : Colors.white,
                                      size: 38,
                                    ),
                                  ),
                                );
                              },
                            ),
                          ),
                        ),

                      // HUD Bottom Live Indicator / Progress Bar
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              Container(
                                width: 8,
                                height: 8,
                                decoration: const BoxDecoration(
                                  color: Colors.redAccent,
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                'LIVE STREAMING',
                                style: GoogleFonts.rajdhani(
                                  color: Colors.white70,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 1.0,
                                ),
                              ),
                            ],
                          ),
                          Text(
                            'PRESS [BACK] TO RETURN TO CHANNELS',
                            style: TextStyle(
                              color: AppTheme.text3,
                              fontSize: 9,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),),
    );
  }

  Widget _buildLoadingPlaceholder() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        CircularProgressIndicator(color: AppTheme.accent),
        const SizedBox(height: 16),
        Text(
          'Connecting to server...',
          style: TextStyle(color: AppTheme.text2, fontSize: 13, fontWeight: FontWeight.w600),
        ),
      ],
    );
  }

  Widget _buildErrorPlaceholder() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(Icons.error_outline, color: AppTheme.red, size: 48),
        const SizedBox(height: 16),
        Text(
          'Stream failed to initialize.',
          style: TextStyle(color: AppTheme.text1, fontSize: 14, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 6),
        Text(
          'This channel is offline or the source link is broken.',
          style: TextStyle(color: AppTheme.text3, fontSize: 11),
        ),
        const SizedBox(height: 20),
        ElevatedButton(
          onPressed: () {
            setState(() {
              _hasError = false;
              _isInitialized = false;
            });
            _initNativePlayer(widget.stream['url']?.toString() ?? '');
          },
          style: ElevatedButton.styleFrom(
            backgroundColor: AppTheme.bg3,
            foregroundColor: AppTheme.text1,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
          child: const Text('RETRY'),
        ),
      ],
    );
  }
}
