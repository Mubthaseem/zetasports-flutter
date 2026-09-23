import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:onesignal_flutter/onesignal_flutter.dart';
import '../theme/tailwind_theme.dart';
import '../theme/app_theme.dart';
import '../widgets/tw_card.dart';
import '../widgets/tw_badge.dart';
import '../widgets/tw_button.dart';
import '../services/app_version_service.dart';
import '../services/firestore_service.dart';
import 'favorites_screen.dart';
import 'notification_center_screen.dart';
import 'standings_screen.dart';
import 'main_shell.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  String _username = 'ZetaFan_001';
  bool _matchAlerts = true;
  bool _goalAlerts = true;
  bool _transferNews = false;
  bool _highlights = true;
  bool _liveReminders = true;
  bool _dataSaver = false;
  String _quality = 'Auto';
  String _speed = '1.0x';
  String _language = 'English';
  final String _appVersion = AppVersionService.currentVersion;

  @override
  void initState() {
    super.initState();
    _loadPrefs();
  }

  Future<void> _loadPrefs() async {
    final p = await SharedPreferences.getInstance();

    final user = Supabase.instance.client.auth.currentUser;
    String name = 'ZetaFan_001';
    if (user != null) {
      final profile = await SupabaseService.fetchUserProfileAuth();
      if (profile != null && profile['username'] != null) {
        name = profile['username'].toString();
      } else if (user.email != null) {
        name = user.email!.split('@')[0];
      }
    }

    if (mounted) {
      setState(() {
        _username = name;
        _matchAlerts = p.getBool('matchAlerts') ?? true;
        _goalAlerts = p.getBool('goalAlerts') ?? true;
        _transferNews = p.getBool('transferNews') ?? false;
        _highlights = p.getBool('zeta_highlights') ?? true;
        _liveReminders = p.getBool('liveReminders') ?? true;
        _dataSaver = p.getBool('dataSaver') ?? false;
        _quality = p.getString('quality') ?? 'Auto';
        _speed = p.getString('speed') ?? '1.0x';
        _language = p.getString('language') ?? 'English';
      });
    }
  }

  Future<void> _savePrefs() async {
    final p = await SharedPreferences.getInstance();
    await p.setString('username', _username);
    await p.setBool('matchAlerts', _matchAlerts);
    await p.setBool('goalAlerts', _goalAlerts);
    await p.setBool('transferNews', _transferNews);
    await p.setBool('zeta_highlights', _highlights);
    await p.setBool('liveReminders', _liveReminders);
    await p.setBool('dataSaver', _dataSaver);
    await p.setString('quality', _quality);
    await p.setString('speed', _speed);
    await p.setString('language', _language);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Preferences updated successfully!',
            style: GoogleFonts.outfit(fontWeight: FontWeight.w700),
          ),
          backgroundColor: TwEmerald.e600,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(TwRadius.xl)),
        ),
      );
    }
  }

  Future<void> _saveToggle(String key, bool val) async {
    final p = await SharedPreferences.getInstance();
    await p.setBool(key, val);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bg,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(TwSpace.p4),
          children: [
            // Header
            Row(
              children: [
                Text(
                  'My Account',
                  style: GoogleFonts.outfit(
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                    color: TwSlate.s900,
                    letterSpacing: -0.5,
                  ),
                ),
                const Spacer(),
                TwBadge(label: 'PRO VIP', variant: TwBadgeVariant.primary),
              ],
            ),
            const SizedBox(height: TwSpace.p4),

            // User avatar card
            _buildAvatarCard(),
            const SizedBox(height: TwSpace.p5),

            // Quick links
            _sectionLabel('QUICK ACCESS'),
            const SizedBox(height: TwSpace.p2),
            Row(
              children: [
                Expanded(
                  child: _quickCard(
                    Icons.star_rounded,
                    'Favorites',
                    TwAmber.a500,
                    () => Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const FavoritesScreen()),
                    ),
                  ),
                ),
                const SizedBox(width: TwSpace.p2_5),
                Expanded(
                  child: _quickCard(
                    Icons.notifications_rounded,
                    'Alerts',
                    TwBlue.b600,
                    () => Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const NotificationCenterScreen()),
                    ),
                  ),
                ),
                const SizedBox(width: TwSpace.p2_5),
                Expanded(
                  child: _quickCard(
                    Icons.emoji_events_rounded,
                    'Standings',
                    TwEmerald.e600,
                    () => Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const StandingsScreen()),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: TwSpace.p5),

            // Notification switches
            _sectionLabel('NOTIFICATION SETTINGS'),
            const SizedBox(height: TwSpace.p2),
            TwCard(
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  _switchRow(
                    'Match Alerts',
                    'Live updates & kick-off reminders',
                    Icons.sports_rounded,
                    TwBlue.b600,
                    _matchAlerts,
                    (v) {
                      setState(() => _matchAlerts = v);
                      _saveToggle('matchAlerts', v);
                    },
                  ),
                  _divider(),
                  _switchRow(
                    'Goal Alerts',
                    'Instant push notification on every goal',
                    Icons.sports_soccer_rounded,
                    TwEmerald.e600,
                    _goalAlerts,
                    (v) {
                      setState(() => _goalAlerts = v);
                      _saveToggle('goalAlerts', v);
                    },
                  ),
                  _divider(),
                  _switchRow(
                    'Transfer Rumors',
                    'Signings, rumours & confirmed transfer news',
                    Icons.swap_horizontal_circle_rounded,
                    TwAmber.a600,
                    _transferNews,
                    (v) {
                      setState(() => _transferNews = v);
                      _saveToggle('transferNews', v);
                    },
                  ),
                  _divider(),
                  _switchRow(
                    'Match Highlights',
                    'Get notified when replay video is ready',
                    Icons.video_library_rounded,
                    TwIndigo.i600,
                    _highlights,
                    (v) {
                      setState(() => _highlights = v);
                      _saveToggle('zeta_highlights', v);
                    },
                  ),
                  _divider(),
                  _switchRow(
                    'Kick-off Countdown',
                    'Reminders 10 mins before match starts',
                    Icons.alarm_rounded,
                    TwRose.r600,
                    _liveReminders,
                    (v) {
                      setState(() => _liveReminders = v);
                      _saveToggle('liveReminders', v);
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(height: TwSpace.p5),

            // App settings
            _sectionLabel('STREAMING & PLAYBACK'),
            const SizedBox(height: TwSpace.p2),
            TwCard(
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  _arrowRow(
                    Icons.language_rounded,
                    TwBlue.b600,
                    'Language',
                    _language,
                    () => _showPickerSheet(
                      'Language',
                      ['English', 'Arabic', 'French', 'Spanish', 'Tamil', 'Hindi'],
                      _language,
                      (v) async {
                        setState(() => _language = v);
                        final p = await SharedPreferences.getInstance();
                        await p.setString('language', v);
                      },
                    ),
                  ),
                  _divider(),
                  _arrowRow(
                    Icons.high_quality_rounded,
                    TwEmerald.e600,
                    'Stream Quality',
                    _quality,
                    () => _showPickerSheet(
                      'Stream Quality',
                      ['Auto', '1080p', '720p', '480p', '360p'],
                      _quality,
                      (v) async {
                        setState(() => _quality = v);
                        final p = await SharedPreferences.getInstance();
                        await p.setString('quality', v);
                      },
                    ),
                  ),
                  _divider(),
                  _arrowRow(
                    Icons.speed_rounded,
                    TwAmber.a600,
                    'Playback Speed',
                    _speed,
                    () => _showPickerSheet(
                      'Playback Speed',
                      ['0.75x', '1.0x', '1.25x', '1.5x'],
                      _speed,
                      (v) async {
                        setState(() => _speed = v);
                        final p = await SharedPreferences.getInstance();
                        await p.setString('speed', v);
                      },
                    ),
                  ),
                  _divider(),
                  _switchRow(
                    'Data Saver Mode',
                    'Reduces resolution to save mobile bandwidth',
                    Icons.data_usage_rounded,
                    TwSlate.s600,
                    _dataSaver,
                    (v) {
                      setState(() => _dataSaver = v);
                      _saveToggle('dataSaver', v);
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(height: TwSpace.p5),

            // About & Legal
            _sectionLabel('ABOUT & LEGAL'),
            const SizedBox(height: TwSpace.p2),
            TwCard(
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  _infoRow(Icons.info_outline_rounded, TwBlue.b600, 'App Version', 'v$_appVersion'),
                  _divider(),
                  _infoRow(Icons.shield_outlined, TwEmerald.e600, 'Privacy Policy', ''),
                  _divider(),
                  _infoRow(Icons.description_outlined, TwSlate.s600, 'Terms of Service', ''),
                ],
              ),
            ),
            const SizedBox(height: TwSpace.p6),

            // Save preferences button
            TwButton(
              label: 'SAVE PREFERENCES',
              icon: Icons.check_circle_outline_rounded,
              isFullWidth: true,
              size: TwButtonSize.lg,
              onPressed: _savePrefs,
            ),
            const SizedBox(height: TwSpace.p3),

            // Sign out button
            TwButton(
              label: 'SIGN OUT',
              icon: Icons.logout_rounded,
              variant: TwButtonVariant.secondary,
              isFullWidth: true,
              size: TwButtonSize.lg,
              onPressed: _confirmSignOut,
            ),
            const SizedBox(height: TwSpace.p8),
          ],
        ),
      ),
    );
  }

  Widget _sectionLabel(String text) {
    return Text(
      text,
      style: GoogleFonts.outfit(
        fontSize: 11,
        fontWeight: FontWeight.w800,
        color: TwSlate.s500,
        letterSpacing: 0.8,
      ),
    );
  }

  Widget _buildAvatarCard() {
    return TwCard(
      padding: const EdgeInsets.all(TwSpace.p4),
      child: Row(
        children: [
          Container(
            width: 60,
            height: 60,
            decoration: BoxDecoration(
              gradient: AppTheme.primaryGrad,
              shape: BoxShape.circle,
              boxShadow: TwShadows.sm,
            ),
            child: Center(
              child: Text(
                _username.isNotEmpty ? _username[0].toUpperCase() : 'Z',
                style: GoogleFonts.outfit(
                  fontSize: 26,
                  fontWeight: FontWeight.w900,
                  color: Colors.white,
                ),
              ),
            ),
          ),
          const SizedBox(width: TwSpace.p4),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _username,
                  style: GoogleFonts.outfit(
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                    color: TwSlate.s900,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Connected to Zeta Cloud',
                  style: GoogleFonts.outfit(fontSize: 12, color: TwSlate.s500),
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.edit_outlined, color: TwSlate.s600, size: 20),
            onPressed: () {},
          ),
        ],
      ),
    );
  }

  Widget _quickCard(IconData icon, String label, Color col, VoidCallback onTap) {
    return TwCard(
      padding: const EdgeInsets.symmetric(vertical: TwSpace.p3),
      onTap: onTap,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: col.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: col, size: 18),
          ),
          const SizedBox(height: TwSpace.p1_5),
          Text(
            label,
            style: GoogleFonts.outfit(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: TwSlate.s800,
            ),
          ),
        ],
      ),
    );
  }

  Widget _switchRow(
    String title,
    String subtitle,
    IconData icon,
    Color col,
    bool value,
    ValueChanged<bool> onChanged,
  ) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: TwSpace.p4, vertical: TwSpace.p2_5),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: col.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(TwRadius.lg),
            ),
            child: Icon(icon, color: col, size: 18),
          ),
          const SizedBox(width: TwSpace.p3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w700, color: TwSlate.s900),
                ),
                Text(
                  subtitle,
                  style: GoogleFonts.outfit(fontSize: 11, color: TwSlate.s500),
                ),
              ],
            ),
          ),
          Switch(
            value: value,
            onChanged: onChanged,
            activeThumbColor: TwBlue.b600,
            activeTrackColor: TwBlue.b100,
            inactiveThumbColor: TwSlate.s400,
            inactiveTrackColor: TwSlate.s200,
          ),
        ],
      ),
    );
  }

  Widget _arrowRow(IconData icon, Color col, String title, String value, VoidCallback onTap) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: TwSpace.p4, vertical: TwSpace.p3_5),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: col.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(TwRadius.lg),
                ),
                child: Icon(icon, color: col, size: 18),
              ),
              const SizedBox(width: TwSpace.p3),
              Expanded(
                child: Text(
                  title,
                  style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w700, color: TwSlate.s900),
                ),
              ),
              Text(value, style: GoogleFonts.outfit(fontSize: 12, color: TwSlate.s500)),
              const SizedBox(width: 4),
              const Icon(Icons.chevron_right_rounded, color: TwSlate.s400, size: 20),
            ],
          ),
        ),
      ),
    );
  }

  Widget _infoRow(IconData icon, Color col, String title, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: TwSpace.p4, vertical: TwSpace.p3_5),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: col.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(TwRadius.lg),
            ),
            child: Icon(icon, color: col, size: 18),
          ),
          const SizedBox(width: TwSpace.p3),
          Expanded(
            child: Text(
              title,
              style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w700, color: TwSlate.s900),
            ),
          ),
          if (value.isNotEmpty)
            Text(value, style: GoogleFonts.outfit(fontSize: 12, color: TwSlate.s500)),
          const SizedBox(width: 4),
          const Icon(Icons.chevron_right_rounded, color: TwSlate.s400, size: 20),
        ],
      ),
    );
  }

  Widget _divider() => const Divider(
        indent: TwSpace.p4,
        endIndent: TwSpace.p4,
        color: TwSlate.s200,
        height: 1,
      );

  void _showPickerSheet(
    String title,
    List<String> options,
    String current,
    Future<void> Function(String) onSelect,
  ) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(TwRadius.xl2)),
      ),
      builder: (_) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.all(TwSpace.p4),
              child: Text(
                title,
                style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w800, color: TwSlate.s900),
              ),
            ),
            ...options.map((opt) => ListTile(
                  title: Text(opt, style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600)),
                  trailing: opt == current ? const Icon(Icons.check_rounded, color: TwBlue.b600) : null,
                  onTap: () async {
                    Navigator.pop(context);
                    await onSelect(opt);
                  },
                )),
            const SizedBox(height: TwSpace.p2),
          ],
        ),
      ),
    );
  }

  void _confirmSignOut() {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(TwRadius.xl2)),
        title: Text('Sign Out?', style: GoogleFonts.outfit(fontWeight: FontWeight.w800, color: TwSlate.s900)),
        content: Text(
          'You will need to log in again to access ZetaSports.',
          style: GoogleFonts.outfit(fontSize: 13, color: TwSlate.s600),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('Cancel', style: GoogleFonts.outfit(color: TwSlate.s500)),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(context);
              try {
                await OneSignal.logout();
              } catch (_) {}
              await Supabase.instance.client.auth.signOut();
              if (mounted) {
                Navigator.of(context).pushAndRemoveUntil(
                  MaterialPageRoute(builder: (_) => const MainShell()),
                  (route) => false,
                );
              }
            },
            child: Text(
              'Sign Out',
              style: GoogleFonts.outfit(color: TwRose.r600, fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
    );
  }
}
