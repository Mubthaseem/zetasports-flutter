import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:async';
import '../services/firestore_service.dart';
import '../theme/app_theme.dart';
import 'login_screen.dart';
import 'player_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  String _username = '';
  String _deviceId = '';
  Timer? _heartbeatTimer;

  final _logoutFocusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    _loadSessionAndStartHeartbeat();
  }

  @override
  void dispose() {
    _heartbeatTimer?.cancel();
    _logoutFocusNode.dispose();
    super.dispose();
  }

  Future<void> _loadSessionAndStartHeartbeat() async {
    final prefs = await SharedPreferences.getInstance();
    _username = prefs.getString('fifa_sess_user') ?? '';
    _deviceId = prefs.getString('fifa_device_id') ?? '';

    if (_username.isEmpty || _deviceId.isEmpty) {
      _forceLogout();
      return;
    }

    // Send initial heartbeat
    await FirestoreService.sendHeartbeat(_username, _deviceId);

    // Set up periodic heartbeat every 60 seconds
    _heartbeatTimer = Timer.periodic(const Duration(seconds: 60), (timer) async {
      await FirestoreService.sendHeartbeat(_username, _deviceId);
    });
    
    if (mounted) setState(() {});
  }

  Future<void> _handleLogout() async {
    _heartbeatTimer?.cancel();
    if (_username.isNotEmpty && _deviceId.isNotEmpty) {
      await FirestoreService.removeSession(_username, _deviceId);
    }

    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('fifa_sess_user');
    await prefs.remove('fifa_sess_pin');

    if (mounted) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
    }
  }

  void _forceLogout() {
    _heartbeatTimer?.cancel();
    if (mounted) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.pureBlack,
      appBar: AppBar(
        backgroundColor: AppTheme.card,
        elevation: 0,
        centerTitle: false,
        title: Row(
          children: [
            Text(
              'FIFA',
              style: GoogleFonts.rajdhani(
                fontSize: 24,
                fontWeight: FontWeight.w900,
                color: Colors.white,
              ),
            ),
            Text(
              'LIVE',
              style: GoogleFonts.rajdhani(
                fontSize: 24,
                fontWeight: FontWeight.w900,
                color: AppTheme.accent,
              ),
            ),
            const SizedBox(width: 8),
            Container(
              width: 6,
              height: 6,
              decoration: const BoxDecoration(
                color: Colors.greenAccent,
                shape: BoxShape.circle,
              ),
            ),
          ],
        ),
        actions: [
          // User display
          if (_username.isNotEmpty)
            Center(
              child: Padding(
                padding: const EdgeInsets.only(right: 16),
                child: Row(
                  children: [
                    Icon(Icons.account_circle_outlined, size: 16, color: AppTheme.text2),
                    const SizedBox(width: 6),
                    Text(
                      _username.toUpperCase(),
                      style: TextStyle(
                        fontSize: 12,
                        color: AppTheme.text2,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ],
                ),
              ),
            ),

          // Logout Button
          Focus(
            focusNode: _logoutFocusNode,
            onKey: (node, event) {
              if (event is RawKeyDownEvent &&
                  (event.logicalKey == LogicalKeyboardKey.enter ||
                   event.logicalKey == LogicalKeyboardKey.select)) {
                _handleLogout();
                return KeyEventResult.handled;
              }
              return KeyEventResult.ignored;
            },
            child: AnimatedBuilder(
              animation: _logoutFocusNode,
              builder: (context, child) {
                final hasFocus = _logoutFocusNode.hasFocus;
                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  child: ElevatedButton.icon(
                    onPressed: _handleLogout,
                    icon: Icon(
                      Icons.power_settings_new,
                      size: 16,
                      color: hasFocus ? AppTheme.pureBlack : AppTheme.red,
                    ),
                    label: Text(
                      'EXIT',
                      style: GoogleFonts.rajdhani(
                        fontSize: 12,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 0.5,
                      ),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: hasFocus ? AppTheme.red : AppTheme.bg3,
                      foregroundColor: hasFocus ? Colors.white : AppTheme.text1,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                        side: BorderSide(
                          color: hasFocus ? Colors.white30 : AppTheme.border,
                          width: 1,
                        ),
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
      body: StreamBuilder<List<Map<String, dynamic>>>(
        stream: FirestoreService.streamsStream(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return Center(
              child: CircularProgressIndicator(color: AppTheme.accent),
            );
          }
          if (snapshot.hasError) {
            return Center(
              child: Text(
                'Failed to load channels: ${snapshot.error}',
                style: TextStyle(color: AppTheme.red),
              ),
            );
          }
          final streams = snapshot.data ?? [];
          if (streams.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.tv_off_outlined, size: 48, color: AppTheme.text3),
                  const SizedBox(height: 16),
                  Text(
                    'No Streams Online Currently',
                    style: TextStyle(color: AppTheme.text2, fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Please check back during match times.',
                    style: TextStyle(color: AppTheme.text3, fontSize: 12),
                  ),
                ],
              ),
            );
          }

          // Render TV Grid of Streams
          return GridView.builder(
            padding: const EdgeInsets.all(24),
            gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
              maxCrossAxisExtent: 280,
              mainAxisSpacing: 20,
              crossAxisSpacing: 20,
              childAspectRatio: 1.4,
            ),
            itemCount: streams.length,
            itemBuilder: (context, index) {
              final stream = streams[index];
              return _TVStreamCard(
                stream: stream,
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => PlayerScreen(
                        stream: stream,
                        username: _username,
                        deviceId: _deviceId,
                      ),
                    ),
                  );
                },
              );
            },
          );
        },
      ),
    );
  }
}

class _TVStreamCard extends StatefulWidget {
  final Map<String, dynamic> stream;
  final VoidCallback onTap;
  const _TVStreamCard({required this.stream, required this.onTap});

  @override
  State<_TVStreamCard> createState() => _TVStreamCardState();
}

class _TVStreamCardState extends State<_TVStreamCard> {
  final _focusNode = FocusNode();

  @override
  void dispose() {
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final title = widget.stream['label'] ?? 'Channel';
    final type = widget.stream['type'] ?? 'm3u8';
    final lowerType = type.toString().toLowerCase();
    final typeText = lowerType == 'm3u8'
        ? 'HLS STREAM'
        : lowerType == 'okru'
            ? 'OK.RU LIVE'
            : 'WEB EMBED';
    final typeColor = lowerType == 'm3u8'
        ? Colors.greenAccent
        : lowerType == 'okru'
            ? const Color(0xFFFF6B00)
            : Colors.blueAccent;

    return Focus(
      focusNode: _focusNode,
      onKey: (node, event) {
        if (event is RawKeyDownEvent &&
            (event.logicalKey == LogicalKeyboardKey.enter ||
             event.logicalKey == LogicalKeyboardKey.select)) {
          widget.onTap();
          return KeyEventResult.handled;
        }
        return KeyEventResult.ignored;
      },
      child: GestureDetector(
        onTap: widget.onTap,
        child: AnimatedBuilder(
          animation: _focusNode,
          builder: (context, _) {
            final hasFocus = _focusNode.hasFocus;
            return AnimatedScale(
              scale: hasFocus ? 1.05 : 1.0,
              duration: const Duration(milliseconds: 150),
              child: Container(
                decoration: BoxDecoration(
                  color: AppTheme.card,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: hasFocus ? AppTheme.accent : AppTheme.border2,
                    width: hasFocus ? 2.5 : 1.0,
                  ),
                  boxShadow: hasFocus
                      ? [
                          BoxShadow(
                            color: AppTheme.accent.withOpacity(0.15),
                            blurRadius: 12,
                            spreadRadius: 2,
                          )
                        ]
                      : [],
                ),
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    // Channel Top Icon & Glow Dot
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: hasFocus 
                                ? AppTheme.accent.withOpacity(0.12)
                                : AppTheme.bg3,
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            Icons.live_tv,
                            color: hasFocus ? AppTheme.accent : AppTheme.text2,
                            size: 20,
                          ),
                        ),
                        Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(
                            color: Colors.greenAccent,
                            shape: BoxShape.circle,
                          ),
                        ),
                      ],
                    ),
                    
                    // Channel Label
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title.toString().toUpperCase(),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: GoogleFonts.rajdhani(
                            fontSize: 16,
                            fontWeight: FontWeight.w900,
                            color: AppTheme.text1,
                            letterSpacing: 0.5,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          typeText,
                          style: TextStyle(
                            fontSize: 9,
                            color: typeColor,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1.0,
                          ),
                        ),
                      ],
                    )
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
