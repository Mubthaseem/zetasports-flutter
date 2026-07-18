import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 10 — NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────
class NotificationCenterScreen extends StatefulWidget {
  const NotificationCenterScreen({super.key});
  @override
  State<NotificationCenterScreen> createState() => _NotificationCenterScreenState();
}

class _NotificationCenterScreenState extends State<NotificationCenterScreen> {
  String _filter = 'All';
  final _filters = ['All', 'Matches', 'News', 'Transfers', 'Reminders'];

  final _notifications = [
    {
      'title': '⚽ GOAL ALERT',
      'body': 'Real Madrid 2-1 Man City — Vinicius Jr. 78\'',
      'time': '2m ago',
      'cat': 'Matches',
      'icon': Icons.sports_soccer_rounded,
      'col': AppTheme.success,
      'read': false,
    },
    {
      'title': '🔔 KICK OFF',
      'body': 'Arsenal vs Chelsea kicks off in 15 minutes. Set up your stream.',
      'time': '10m ago',
      'cat': 'Reminders',
      'icon': Icons.alarm_rounded,
      'col': AppTheme.warning,
      'read': false,
    },
    {
      'title': '🔁 TRANSFER NEWS',
      'body': 'Kylian Mbappé transfer to Real Madrid officially completed — 5-year deal.',
      'time': '1h ago',
      'cat': 'Transfers',
      'icon': Icons.swap_horizontal_circle_rounded,
      'col': AppTheme.primary,
      'read': true,
    },
    {
      'title': '🏁 MATCH ENDED',
      'body': 'Full Time: Barcelona 3-0 Sevilla. Highlights now available in Watch.',
      'time': '2h ago',
      'cat': 'Matches',
      'icon': Icons.flag_rounded,
      'col': AppTheme.danger,
      'read': true,
    },
    {
      'title': '📰 TRANSFER NEWS',
      'body': 'PSG confirm signing of João Neves from Benfica for €70M.',
      'time': '3h ago',
      'cat': 'Transfers',
      'icon': Icons.swap_horizontal_circle_rounded,
      'col': AppTheme.primary,
      'read': true,
    },
    {
      'title': '🏥 INJURY UPDATE',
      'body': 'Vinicius Jr. expected to return next week after ankle fitness tests.',
      'time': '5h ago',
      'cat': 'News',
      'icon': Icons.health_and_safety_rounded,
      'col': AppTheme.text3,
      'read': true,
    },
    {
      'title': '⚽ GOAL ALERT',
      'body': 'India vs Australia — Rohit Sharma hits century! 100* (68)',
      'time': '6h ago',
      'cat': 'Matches',
      'icon': Icons.sports_cricket_rounded,
      'col': AppTheme.success,
      'read': true,
    },
    {
      'title': '🗓 REMINDER',
      'body': 'Real Madrid vs Bayern Munich starts in 1 hour. Don\'t miss it!',
      'time': '7h ago',
      'cat': 'Reminders',
      'icon': Icons.notifications_active_rounded,
      'col': AppTheme.warning,
      'read': true,
    },
  ];

  List<Map<String, dynamic>> get _filtered {
    if (_filter == 'All') return _notifications;
    return _notifications.where((n) => n['cat'] == _filter).toList();
  }

  int get _unreadCount => _notifications.where((n) => !(n['read'] as bool)).length;

  @override
  Widget build(BuildContext context) {
    final items = _filtered;

    return Scaffold(
      backgroundColor: AppTheme.bg,
      body: SafeArea(
        child: Column(
          children: [
            // ── Header
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
              child: Row(children: [
                GestureDetector(
                  onTap: () => Navigator.canPop(context) ? Navigator.pop(context) : null,
                  child: Container(
                    width: 36, height: 36,
                    decoration: BoxDecoration(
                      color: AppTheme.surface, borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppTheme.border)),
                    child: const Icon(Icons.arrow_back_ios_new_rounded,
                      color: AppTheme.text2, size: 16))),
                const SizedBox(width: 14),
                Text('Notifications', style: GoogleFonts.outfit(
                  fontSize: 20, fontWeight: FontWeight.w900, color: AppTheme.text1)),
                const SizedBox(width: 8),
                if (_unreadCount > 0)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                    decoration: BoxDecoration(
                      color: AppTheme.danger, borderRadius: BorderRadius.circular(10)),
                    child: Text('$_unreadCount', style: GoogleFonts.outfit(
                      fontSize: 10, fontWeight: FontWeight.w900, color: Colors.white))),
                const Spacer(),
                GestureDetector(
                  onTap: () => setState(() {
                    for (final n in _notifications) { n['read'] = true; }
                  }),
                  child: Text('Mark all read', style: GoogleFonts.outfit(
                    fontSize: 11, fontWeight: FontWeight.w700, color: AppTheme.primary))),
              ]),
            ),

            // ── Filter chips
            SizedBox(
              height: 38,
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                scrollDirection: Axis.horizontal,
                itemCount: _filters.length,
                itemBuilder: (_, i) {
                  final f = _filters[i];
                  final sel = f == _filter;
                  return GestureDetector(
                    onTap: () => setState(() => _filter = f),
                    child: Container(
                      margin: const EdgeInsets.only(right: 8),
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      decoration: BoxDecoration(
                        color: sel ? AppTheme.primary.withOpacity(0.15) : AppTheme.card,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: sel ? AppTheme.primary : AppTheme.border)),
                      child: Text(f, style: GoogleFonts.outfit(
                        fontSize: 11, fontWeight: FontWeight.w700,
                        color: sel ? AppTheme.primary : AppTheme.text2)),
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 12),

            // ── List
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: items.length,
                itemBuilder: (_, i) {
                  final n = items[i];
                  final unread = !(n['read'] as bool);
                  final col = n['col'] as Color;
                  return GestureDetector(
                    onTap: () => setState(() { n['read'] = true; }),
                    child: Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: unread
                          ? AppTheme.primary.withOpacity(0.04)
                          : AppTheme.card,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: unread ? AppTheme.primary.withOpacity(0.2) : AppTheme.border,
                          width: unread ? 1.5 : 1)),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Icon bubble
                          Container(
                            width: 42, height: 42,
                            decoration: BoxDecoration(
                              color: col.withOpacity(0.12),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: col.withOpacity(0.2))),
                            child: Icon(n['icon'] as IconData, color: col, size: 20)),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Expanded(child: Text(n['title'].toString(),
                                      style: GoogleFonts.outfit(
                                        fontSize: 12, fontWeight: FontWeight.w900,
                                        color: unread ? AppTheme.text1 : AppTheme.text2))),
                                    Text(n['time'].toString(), style: GoogleFonts.outfit(
                                      fontSize: 9, color: AppTheme.text3)),
                                  ],
                                ),
                                const SizedBox(height: 4),
                                Text(n['body'].toString(), style: GoogleFonts.outfit(
                                  fontSize: 11, color: AppTheme.text2, height: 1.4),
                                  maxLines: 2, overflow: TextOverflow.ellipsis),
                              ],
                            ),
                          ),
                          // Unread dot
                          if (unread)
                            Padding(
                              padding: const EdgeInsets.only(left: 8, top: 4),
                              child: Container(
                                width: 8, height: 8,
                                decoration: const BoxDecoration(
                                  color: AppTheme.primary, shape: BoxShape.circle))),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
