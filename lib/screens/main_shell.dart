import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';
import 'home_screen.dart';
import 'scores_screen.dart';
import 'watch_screen.dart';
import 'live_tv_screen.dart';
import 'news_screen.dart';
import 'profile_screen.dart';

class MainShell extends StatefulWidget {
  const MainShell({super.key});
  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _idx = 0;

  static const _screens = [
    HomeScreen(),
    ScoresScreen(),
    WatchScreen(),
    LiveTvScreen(),
    NewsScreen(),
    ProfileScreen(),
  ];

  static const _items = [
    _NavItem(Icons.home_rounded,         Icons.home_outlined,           'Home'),
    _NavItem(Icons.bar_chart_rounded,    Icons.bar_chart_outlined,      'Scores'),
    _NavItem(Icons.play_circle_filled,   Icons.play_circle_outline,     'Matches'),
    _NavItem(Icons.live_tv_rounded,      Icons.live_tv_outlined,        'Live TV'),
    _NavItem(Icons.article_rounded,      Icons.article_outlined,        'News'),
    _NavItem(Icons.person_rounded,       Icons.person_outline_rounded,  'Profile'),
  ];

  void _onTap(int i) {
    HapticFeedback.selectionClick();
    setState(() => _idx = i);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bg,
      body: IndexedStack(index: _idx, children: _screens),
      bottomNavigationBar: _buildNav(),
    );
  }

  Widget _buildNav() {
    return Container(
      height: 72 + MediaQuery.of(context).padding.bottom,
      decoration: BoxDecoration(
        color: AppTheme.surface.withOpacity(0.97),
        border: Border(top: BorderSide(color: AppTheme.border, width: 1)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.4),
            blurRadius: 24,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: List.generate(_items.length, (i) {
            final item = _items[i];
            final selected = _idx == i;
            return GestureDetector(
              onTap: () => _onTap(i),
              behavior: HitTestBehavior.opaque,
              child: SizedBox(
                width: 64,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                      decoration: BoxDecoration(
                        color: selected ? AppTheme.primary.withOpacity(0.15) : Colors.transparent,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Icon(
                        selected ? item.activeIcon : item.icon,
                        color: selected ? AppTheme.primary : AppTheme.text3,
                        size: 22,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      item.label,
                      style: GoogleFonts.outfit(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: selected ? AppTheme.primary : AppTheme.text3,
                      ),
                    ),
                  ],
                ),
              ),
            );
          }),
        ),
      ),
    );
  }
}

class _NavItem {
  final IconData activeIcon;
  final IconData icon;
  final String label;
  const _NavItem(this.activeIcon, this.icon, this.label);
}
