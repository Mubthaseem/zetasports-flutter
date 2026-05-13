import 'package:flutter/material.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../services/firestore_service.dart';
import '../services/ad_service.dart';
import '../models/match_model.dart';
import '../theme/app_theme.dart';
import 'home_screen.dart';
import 'matches_screen.dart';
import 'news_screen.dart';
import 'leagues_screen.dart';
import 'standings_screen.dart';
import 'settings_screen.dart';

class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _tab = 0;

  final List<Widget> _screens = [
    HomeScreen(),
    MatchesScreen(),
    NewsScreen(),
    LeaguesScreen(),
    StandingsScreen(),
  ];

  @override
  void initState() {
    super.initState();
    AdService.init();
    _setupFCM();
    WidgetsBinding.instance.addObserver(AppLifecycleObserver());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(AppLifecycleObserver());
    super.dispose();
  }

  Future<void> _setupFCM() async {
    try {
      final messaging = FirebaseMessaging.instance;
      final settings = await messaging.requestPermission(
        alert: true, badge: true, sound: true,
      );
      if (settings.authorizationStatus == AuthorizationStatus.authorized) {
        final token = await messaging.getToken(vapidKey: 'YOUR_VAPID_PUBLIC_KEY'); // Replace if needed for web
        if (token != null) await FirestoreService.saveToken(token);
      }
      // Subscribe to broadcast topic (Not supported on web, so this will throw if web, hence try-catch)
      await messaging.subscribeToTopic('zetasports_all');

      FirebaseMessaging.onMessage.listen((msg) {
        final notif = msg.notification;
        if (notif != null && mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('${notif.title ?? ''}: ${notif.body ?? ''}'),
              backgroundColor: AppTheme.card,
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      });
    } catch (e) {
      debugPrint('FCM Setup Error: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<Map<String, dynamic>?>(
      stream: FirestoreService.configStream(),
      builder: (context, configSnap) {
        final config = configSnap.data;
        final logoUrl = config?['logoUrl'] as String?;
        final appName = config?['appName'] as String? ?? 'ZETASPORTS';

        return StreamBuilder<List<MatchModel>>(
          stream: FirestoreService.matchesStream(),
          builder: (context, snapshot) {
            final matches = snapshot.data ?? [];
            final liveCount = matches.where((m) => m.isLive).length;

            return Scaffold(
              backgroundColor: AppTheme.bg,
              appBar: AppBar(
                backgroundColor: AppTheme.bg,
                elevation: 0,
                centerTitle: false,
                title: Row(
                  children: [
                    if (logoUrl != null && logoUrl.isNotEmpty)
                      CachedNetworkImage(
                        imageUrl: logoUrl,
                        height: 32,
                        fit: BoxFit.contain,
                        placeholder: (_, __) => Container(width: 32, height: 32, color: Colors.transparent),
                        errorWidget: (_, __, ___) => const _DefaultLogo(),
                      )
                    else
                      const _DefaultLogo(),
                    const SizedBox(width: 10),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          appName.toUpperCase(),
                          style: TextStyle(
                            fontSize: 16, fontWeight: FontWeight.w900,
                            letterSpacing: 1.5, color: AppTheme.text1,
                          ),
                        ),
                        if (liveCount > 0)
                          Row(
                            children: [
                              Container(
                                width: 6, height: 6,
                                decoration: BoxDecoration(color: AppTheme.red, shape: BoxShape.circle),
                              ),
                              const SizedBox(width: 4),
                              Text(
                                '$liveCount MATCHES LIVE NOW',
                                style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: AppTheme.red),
                              ),
                            ],
                          ),
                      ],
                    ),
                  ],
                ),
                actions: [
                  IconButton(
                    icon: Icon(Icons.settings_outlined, color: AppTheme.accent2, size: 20),
                    onPressed: () {
                      Navigator.push(context, MaterialPageRoute(builder: (_) => const SettingsScreen()));
                    },
                  ),
                  const SizedBox(width: 8),
                ],
              ),
              body: IndexedStack(index: _tab, children: _screens),
              bottomNavigationBar: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  AdService.getBannerWidget(context),
                  Container(
                    decoration: BoxDecoration(
                      border: Border(top: BorderSide(color: AppTheme.border, width: 1)),
                    ),
                    child: BottomNavigationBar(
                      currentIndex: _tab,
                      onTap: (i) => setState(() => _tab = i),
                      backgroundColor: AppTheme.bg2,
                      selectedItemColor: AppTheme.accent2,
                      unselectedItemColor: AppTheme.text3,
                      type: BottomNavigationBarType.fixed,
                      items: const [
                        BottomNavigationBarItem(icon: Icon(Icons.home_outlined), activeIcon: Icon(Icons.home), label: 'Home'),
                        BottomNavigationBarItem(icon: Icon(Icons.sports_soccer_outlined), activeIcon: Icon(Icons.sports_soccer), label: 'Matches'),
                        BottomNavigationBarItem(icon: Icon(Icons.article_outlined), activeIcon: Icon(Icons.article), label: 'News'),
                        BottomNavigationBarItem(icon: Icon(Icons.emoji_events_outlined), activeIcon: Icon(Icons.emoji_events), label: 'Leagues'),
                        BottomNavigationBarItem(icon: Icon(Icons.table_chart_outlined), activeIcon: Icon(Icons.table_chart), label: 'Tables'),
                      ],
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}

class _DefaultLogo extends StatelessWidget {
  const _DefaultLogo();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 32, height: 32,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          colors: [AppTheme.accent, Color(0xFF0052CC)],
        ),
      ),
      child: const Center(child: Text('⚡', style: TextStyle(fontSize: 14))),
    );
  }
}

class AppLifecycleObserver extends WidgetsBindingObserver {
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      AdService.showAppOpenAdIfAvailable();
    }
  }
}
