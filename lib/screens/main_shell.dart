import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import '../theme/stitch_theme.dart';
import '../services/firestore_service.dart';
import 'home_screen.dart';
import 'scores_screen.dart';
import 'watch_screen.dart';
import 'live_tv_screen.dart';
import 'profile_screen.dart';

class MainShell extends StatefulWidget {
  const MainShell({super.key});
  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _idx = 0;
  Timer? _tgTimer;
  Map<String, dynamic>? _tgConfig;
  bool _dialogShowing = false;

  final List<Widget> _pages = const [
    HomeScreen(),
    ScoresScreen(),
    WatchScreen(),
    LiveTvScreen(),
    ProfileScreen(),
  ];

  @override
  void initState() {
    super.initState();
    _initTelegramPrompt();
  }

  @override
  void dispose() {
    _tgTimer?.cancel();
    super.dispose();
  }

  Future<void> _initTelegramPrompt() async {
    final cfg = await SupabaseService.fetchGlobalConfig();
    if (!mounted) return;
    _tgConfig = cfg;

    final enabled = cfg?['telegram_enabled'] != false;
    if (!enabled) return;

    final intervalMins = (cfg?['telegram_interval_mins'] as num?)?.toInt() ?? 5;

    // Initial prompt after 5 seconds
    Future.delayed(const Duration(seconds: 5), () {
      if (mounted) _showTelegramPrompt();
    });

    // Periodic check every interval
    _tgTimer = Timer.periodic(Duration(minutes: intervalMins > 0 ? intervalMins : 5), (_) {
      if (mounted) _showTelegramPrompt();
    });
  }

  void _showTelegramPrompt() {
    if (_dialogShowing || !mounted) return;
    _dialogShowing = true;

    final title = _tgConfig?['telegram_title']?.toString() ?? 'Join Official Telegram';
    final msg = _tgConfig?['telegram_message']?.toString() ?? 
        'Get instant live match streams, backup links, and real-time goal alerts directly on Telegram!';
    final urlStr = _tgConfig?['telegram_url']?.toString() ?? 'https://t.me/zetasports_official';

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(24),
        decoration: const BoxDecoration(
          color: StitchColors.surfaceContainerLowest,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          boxShadow: [
            BoxShadow(color: Color(0x33000000), blurRadius: 20, offset: Offset(0, -4)),
          ],
        ),
        child: SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: StitchColors.outlineVariant,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 18),
              Container(
                width: 64,
                height: 64,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(
                    colors: [Color(0xFF2AABEE), Color(0xFF229ED9)],
                  ),
                ),
                child: const Center(
                  child: Icon(Icons.send_rounded, color: Colors.white, size: 30),
                ),
              ),
              const SizedBox(height: 14),
              Text(
                title,
                textAlign: TextAlign.center,
                style: StitchTypography.headlineSm(color: StitchColors.onSurface),
              ),
              const SizedBox(height: 8),
              Text(
                msg,
                textAlign: TextAlign.center,
                style: StitchTypography.bodyMd(color: StitchColors.onSurfaceVariant),
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: TextButton(
                      onPressed: () {
                        Navigator.pop(ctx);
                      },
                      style: TextButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(StitchRadius.md)),
                      ),
                      child: Text('Later', style: StitchTypography.labelMd(color: StitchColors.outline)),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: ElevatedButton.icon(
                      onPressed: () async {
                        Navigator.pop(ctx);
                        final uri = Uri.parse(urlStr);
                        if (await canLaunchUrl(uri)) {
                          await launchUrl(uri, mode: LaunchMode.externalApplication);
                        }
                      },
                      icon: const Icon(Icons.telegram, color: Colors.white, size: 20),
                      label: Text('Join Channel', style: StitchTypography.labelMd(color: Colors.white)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF229ED9),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        elevation: 0,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(StitchRadius.md)),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    ).then((_) {
      _dialogShowing = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.dark,
        systemNavigationBarColor: StitchColors.surfaceContainerLowest,
        systemNavigationBarIconBrightness: Brightness.dark,
      ),
      child: Scaffold(
        backgroundColor: StitchColors.background,
        body: IndexedStack(
          index: _idx,
          children: _pages,
        ),
        bottomNavigationBar: _buildStitchBottomNav(),
      ),
    );
  }

  Widget _buildStitchBottomNav() {
    return Container(
      decoration: BoxDecoration(
        color: StitchColors.surfaceContainerLowest.withValues(alpha: 0.92),
        border: const Border(
          top: BorderSide(color: StitchColors.outlineVariant, width: 1),
        ),
        boxShadow: [
          BoxShadow(
            color: StitchColors.onSurface.withValues(alpha: 0.04),
            blurRadius: 16,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 64,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _navItem(0, Icons.home_rounded, 'Home'),
              _navItem(1, Icons.emoji_events_rounded, 'Scores'),
              _watchCenterButton(2),
              _navItem(3, Icons.cell_tower_rounded, 'Live TV'),
              _navItem(4, Icons.account_circle_rounded, 'Profile'),
            ],
          ),
        ),
      ),
    );
  }

  Widget _navItem(int index, IconData icon, String label) {
    final bool active = _idx == index;
    final Color color = active ? StitchColors.primaryContainer : StitchColors.outline;

    return InkWell(
      onTap: () {
        HapticFeedback.lightImpact();
        setState(() => _idx = index);
      },
      borderRadius: BorderRadius.circular(StitchRadius.md),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: color, size: 22),
            const SizedBox(height: 3),
            Text(
              label,
              style: StitchTypography.labelSm(color: color).copyWith(
                fontWeight: active ? FontWeight.w800 : FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }


  Widget _watchCenterButton(int index) {
    final bool active = _idx == index;

    return GestureDetector(
      onTap: () {
        HapticFeedback.mediumImpact();
        setState(() => _idx = index);
      },
      child: Transform.translate(
        offset: const Offset(0, -10),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: const LinearGradient(
                  colors: [StitchColors.primaryContainer, Color(0xFF1D4ED8)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                boxShadow: [
                  BoxShadow(
                    color: StitchColors.primaryContainer.withValues(alpha: 0.35),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: const Center(
                child: Icon(Icons.play_arrow_rounded, color: Colors.white, size: 28),
              ),
            ),
            const SizedBox(height: 2),
            Text(
              'Watch',
              style: StitchTypography.labelSm(
                color: active ? StitchColors.primaryContainer : StitchColors.onSurface,
              ).copyWith(fontWeight: FontWeight.w700),
            ),
          ],
        ),
      ),
    );
  }
}
