import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../theme/app_theme.dart';
import '../services/app_version_service.dart';
import '../services/firestore_service.dart';
import 'favorites_screen.dart';
import 'notification_center_screen.dart';
import 'standings_screen.dart';
import 'main_shell.dart';
import 'package:onesignal_flutter/onesignal_flutter.dart';

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 12 — PROFILE
// ─────────────────────────────────────────────────────────────────────────────
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  String _username      = 'ZetaFan_001';
  bool _matchAlerts     = true;
  bool _goalAlerts      = true;
  bool _transferNews    = false;
  bool _highlights      = true;
  bool _liveReminders   = true;
  bool _dataSaver       = false;
  String _quality       = 'Auto';
  String _speed         = '1.0x';
  String _language      = 'English';
  String _appVersion    = AppVersionService.currentVersion;

  @override
  void initState() {
    super.initState();
    _loadPrefs();
  }

  Future<void> _loadPrefs() async {
    final p = await SharedPreferences.getInstance();
    
    // Auth username check
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
        _username      = name;
        _matchAlerts   = p.getBool('matchAlerts')     ?? true;
        _goalAlerts    = p.getBool('goalAlerts')      ?? true;
        _transferNews  = p.getBool('transferNews')    ?? false;
        _highlights    = p.getBool('zeta_highlights')      ?? true;
        _liveReminders = p.getBool('liveReminders')   ?? true;
        _dataSaver     = p.getBool('dataSaver')       ?? false;
        _quality       = p.getString('quality')       ?? 'Auto';
        _speed         = p.getString('speed')         ?? '1.0x';
        _language      = p.getString('language')      ?? 'English';
      });
    }
  }

  Future<void> _savePrefs() async {
    final p = await SharedPreferences.getInstance();
    await p.setString('username',      _username);
    await p.setBool('matchAlerts',     _matchAlerts);
    await p.setBool('goalAlerts',      _goalAlerts);
    await p.setBool('transferNews',    _transferNews);
    await p.setBool('zeta_highlights',      _highlights);
    await p.setBool('liveReminders',   _liveReminders);
    await p.setBool('dataSaver',       _dataSaver);
    await p.setString('quality',       _quality);
    await p.setString('speed',         _speed);
    await p.setString('language',      _language);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('Preferences saved!',
          style: GoogleFonts.outfit(fontWeight: FontWeight.w700)),
        backgroundColor: AppTheme.success,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))));
    }
  }

  // ── Save a single bool toggle immediately ──────────────────────────────────
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
          padding: const EdgeInsets.all(20),
          children: [
            // ── Header
            Text('Profile', style: GoogleFonts.outfit(
              fontSize: 20, fontWeight: FontWeight.w900, color: AppTheme.text1)),
            const SizedBox(height: 24),

            // ── User avatar card
            _buildAvatarCard(),
            const SizedBox(height: 20),

            // ── Quick links
            Text('QUICK ACCESS', style: GoogleFonts.outfit(
              fontSize: 10, fontWeight: FontWeight.w800,
              color: AppTheme.text3, letterSpacing: 0.8)),
            const SizedBox(height: 10),
            Row(children: [
              Expanded(child: _quickCard(Icons.star_rounded, 'Favorites',
                AppTheme.warning, () => Navigator.push(context,
                  MaterialPageRoute(builder: (_) => const FavoritesScreen())))),
              const SizedBox(width: 10),
              Expanded(child: _quickCard(Icons.notifications_rounded, 'Alerts',
                AppTheme.primary, () => Navigator.push(context,
                  MaterialPageRoute(builder: (_) => const NotificationCenterScreen())))),
              const SizedBox(width: 10),
              Expanded(child: _quickCard(Icons.emoji_events_rounded, 'Standings',
                AppTheme.success, () => Navigator.push(context,
                  MaterialPageRoute(builder: (_) => const StandingsScreen())))),
            ]),
            const SizedBox(height: 20),

            // ── Notification switches
            Text('NOTIFICATION SETTINGS', style: GoogleFonts.outfit(
              fontSize: 10, fontWeight: FontWeight.w800,
              color: AppTheme.text3, letterSpacing: 0.8)),
            const SizedBox(height: 10),
            _settingsCard([
              _switchRow(
                'Match Alerts', 'Live updates & kick-off reminders',
                Icons.sports_rounded, AppTheme.primary, _matchAlerts,
                (v) { setState(() => _matchAlerts = v); _saveToggle('matchAlerts', v); }),
              _divider(),
              _switchRow(
                'Goal Alerts', 'Instant push for every goal scored',
                Icons.sports_soccer_rounded, AppTheme.success, _goalAlerts,
                (v) { setState(() => _goalAlerts = v); _saveToggle('goalAlerts', v); }),
              _divider(),
              _switchRow(
                'Transfer News', 'Signings, rumours & confirmed deals',
                Icons.swap_horizontal_circle_rounded, AppTheme.warning, _transferNews,
                (v) { setState(() => _transferNews = v); _saveToggle('transferNews', v); }),
              _divider(),
              _switchRow(
                'Highlights Ready', 'Notified when match clips are uploaded',
                Icons.video_library_rounded, AppTheme.secondary, _highlights,
                (v) { setState(() => _highlights = v); _saveToggle('zeta_highlights', v); }),
              _divider(),
              _switchRow(
                'Live Reminders', 'Reminder 10 mins before kick-off',
                Icons.alarm_rounded, AppTheme.danger, _liveReminders,
                (v) { setState(() => _liveReminders = v); _saveToggle('liveReminders', v); }),
            ]),
            const SizedBox(height: 20),

            // ── App settings
            Text('APP SETTINGS', style: GoogleFonts.outfit(
              fontSize: 10, fontWeight: FontWeight.w800,
              color: AppTheme.text3, letterSpacing: 0.8)),
            const SizedBox(height: 10),
            _settingsCard([
              _arrowRow(Icons.language_rounded, AppTheme.primary, 'Language', _language,
                () => _showPickerSheet('Language',
                  ['English', 'Arabic', 'French', 'Spanish', 'Tamil', 'Hindi'],
                  _language, (v) async {
                    setState(() => _language = v);
                    final p = await SharedPreferences.getInstance();
                    await p.setString('language', v);
                  })),
              _divider(),
              _arrowRow(Icons.high_quality_rounded, AppTheme.success, 'Stream Quality', _quality,
                () => _showPickerSheet('Stream Quality',
                  ['Auto', '1080p', '720p', '480p', '360p', '240p'],
                  _quality, (v) async {
                    setState(() => _quality = v);
                    final p = await SharedPreferences.getInstance();
                    await p.setString('quality', v);
                  })),
              _divider(),
              _arrowRow(Icons.speed_rounded, AppTheme.warning, 'Playback Speed', _speed,
                () => _showPickerSheet('Playback Speed',
                  ['0.5x', '0.75x', '1.0x', '1.25x', '1.5x', '2.0x'],
                  _speed, (v) async {
                    setState(() => _speed = v);
                    final p = await SharedPreferences.getInstance();
                    await p.setString('speed', v);
                  })),
              _divider(),
              _switchRow(
                'Data Saver', 'Reduces stream quality to save mobile data',
                Icons.data_usage_rounded, AppTheme.text3, _dataSaver,
                (v) { setState(() => _dataSaver = v); _saveToggle('dataSaver', v); }),
            ]),
            const SizedBox(height: 20),

            // ── App info
            Text('ABOUT', style: GoogleFonts.outfit(
              fontSize: 10, fontWeight: FontWeight.w800,
              color: AppTheme.text3, letterSpacing: 0.8)),
            const SizedBox(height: 10),
            _settingsCard([
              _infoRow(Icons.info_outline_rounded, AppTheme.primary,
                'App Version', 'v$_appVersion'),
              _divider(),
              _infoRow(Icons.shield_outlined, AppTheme.success,
                'Privacy Policy', ''),
              _divider(),
              _infoRow(Icons.description_outlined, AppTheme.text3,
                'Terms of Service', ''),
            ]),
            const SizedBox(height: 20),

            // ── Save button
            GestureDetector(
              onTap: _savePrefs,
              child: Container(
                height: 52,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AppTheme.primary, AppTheme.secondary]),
                  borderRadius: BorderRadius.circular(AppTheme.radiusBtn),
                  boxShadow: [BoxShadow(
                    color: AppTheme.primary.withValues(alpha: 0.3),
                    blurRadius: 20, offset: const Offset(0, 8))]),
                child: Center(child: Text('SAVE PREFERENCES', style: GoogleFonts.outfit(
                  fontSize: 13, fontWeight: FontWeight.w900, color: Colors.black))),
              ),
            ),
            const SizedBox(height: 12),

            // ── Sign out (only shown when signed in)
            if (Supabase.instance.client.auth.currentUser != null)
              Center(
                child: GestureDetector(
                  onTap: _confirmSignOut,
                  child: Text(
                    'Sign Out',
                    style: GoogleFonts.outfit(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.danger,
                    ),
                  ),
                ),
              ),
            const SizedBox(height: 8),
            Center(
              child: Text('ZetaSports v$_appVersion • Built with ❤️ by Zeta Team',
                style: GoogleFonts.outfit(fontSize: 10, color: AppTheme.text3)),
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  // ── Avatar card ─────────────────────────────────────────────────────────────
  Widget _buildAvatarCard() {
    final user = Supabase.instance.client.auth.currentUser;
    final isGuest = user == null;
    
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            isGuest ? AppTheme.text3.withValues(alpha: 0.1) : AppTheme.primary.withValues(alpha: 0.12),
            isGuest ? AppTheme.text3.withValues(alpha: 0.05) : AppTheme.secondary.withValues(alpha: 0.08)],
          begin: Alignment.topLeft, end: Alignment.bottomRight),
        borderRadius: BorderRadius.circular(AppTheme.radiusCard),
        border: Border.all(color: isGuest ? AppTheme.border : AppTheme.primary.withValues(alpha: 0.2))),
      child: Row(children: [
        Container(
          width: 60, height: 60,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: isGuest 
                ? [AppTheme.surface, AppTheme.card] 
                : [AppTheme.primary, AppTheme.secondary]),
            shape: BoxShape.circle,
            boxShadow: isGuest ? null : [BoxShadow(
              color: AppTheme.primary.withValues(alpha: 0.3),
              blurRadius: 16, offset: const Offset(0, 6))]),
          child: Center(child: Text(
            isGuest ? 'G' : (_username.isNotEmpty ? _username[0].toUpperCase() : 'Z'),
            style: GoogleFonts.outfit(
              fontSize: 26, 
              fontWeight: FontWeight.w900, 
              color: isGuest ? AppTheme.text2 : Colors.black)))),
        const SizedBox(width: 16),
        Expanded(child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(isGuest ? 'Guest User' : _username, style: GoogleFonts.outfit(
              fontSize: 18, fontWeight: FontWeight.w900, color: AppTheme.text1)),
            Text(isGuest ? 'Sign in to sync your favorites & settings' : 'ZetaSports Member', style: GoogleFonts.outfit(
              fontSize: 11, color: AppTheme.text2)),
            const SizedBox(height: 6),
            Row(children: [
              if (!isGuest) ...[
                _tagChip('⭐ Premium', AppTheme.warning),
                const SizedBox(width: 6),
              ],
              _tagChip(isGuest ? 'Guest Mode' : 'Football Fan', isGuest ? AppTheme.text3 : AppTheme.primary),
            ]),
          ],
        )),
        if (!isGuest)
          GestureDetector(
            onTap: _editUsername,
            child: Container(
              width: 32, height: 32,
              decoration: BoxDecoration(
                color: AppTheme.surface, borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppTheme.border)),
              child: const Icon(Icons.edit_rounded, color: AppTheme.text2, size: 14))),
      ]),
    );
  }

  // ── Dialogs / Pickers ───────────────────────────────────────────────────────
  void _editUsername() {
    final ctrl = TextEditingController(text: _username);
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: AppTheme.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text('Edit Username', style: GoogleFonts.outfit(fontWeight: FontWeight.w800)),
        content: TextField(
          controller: ctrl,
          style: GoogleFonts.outfit(color: AppTheme.text1),
          decoration: InputDecoration(
            hintText: 'Enter username',
            hintStyle: GoogleFonts.outfit(color: AppTheme.text3),
            filled: true, fillColor: AppTheme.card,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide.none))),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context),
            child: Text('Cancel', style: GoogleFonts.outfit(color: AppTheme.text3))),
          TextButton(
            onPressed: () async {
              final newName = ctrl.text.trim();
              if (newName.isNotEmpty) {
                setState(() => _username = newName);
                final p = await SharedPreferences.getInstance();
                await p.setString('username', newName);
              }
              if (mounted) Navigator.pop(context);
            },
            child: Text('Save', style: GoogleFonts.outfit(
              color: AppTheme.primary, fontWeight: FontWeight.w800))),
        ],
      ),
    );
  }

  void _showPickerSheet(String title, List<String> options, String current,
      Future<void> Function(String) onSelect) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (_) => Column(mainAxisSize: MainAxisSize.min, children: [
        Container(
          margin: const EdgeInsets.symmetric(vertical: 10),
          width: 36, height: 4,
          decoration: BoxDecoration(
            color: AppTheme.border, borderRadius: BorderRadius.circular(2))),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
          child: Text(title, style: GoogleFonts.outfit(
            fontSize: 15, fontWeight: FontWeight.w900, color: AppTheme.text1))),
        ...options.map((opt) => ListTile(
          title: Text(opt, style: GoogleFonts.outfit(
            fontSize: 13, fontWeight: FontWeight.w700, color: AppTheme.text1)),
          trailing: opt == current
            ? const Icon(Icons.check_circle_rounded, color: AppTheme.primary, size: 20)
            : null,
          onTap: () async {
            Navigator.pop(context);
            await onSelect(opt);
          },
        )),
        const SizedBox(height: 16),
      ]),
    );
  }

  void _confirmSignOut() {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: AppTheme.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text('Sign Out?', style: GoogleFonts.outfit(fontWeight: FontWeight.w800)),
        content: Text('You will need to log in again to access ZetaSports.',
          style: GoogleFonts.outfit(fontSize: 12, color: AppTheme.text2)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context),
            child: Text('Cancel', style: GoogleFonts.outfit(color: AppTheme.text3))),
          TextButton(
            onPressed: () async {
              Navigator.pop(context);
              try {
                await OneSignal.logout();
              } catch (e) {
                debugPrint('OneSignal logout error: $e');
              }
              await Supabase.instance.client.auth.signOut();
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                  content: Text('Signed out successfully',
                    style: GoogleFonts.outfit(fontWeight: FontWeight.w700)),
                  backgroundColor: AppTheme.success,
                  behavior: SnackBarBehavior.floating,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))));
                
                Navigator.of(context).pushAndRemoveUntil(
                  MaterialPageRoute(builder: (_) => const MainShell()),
                  (route) => false,
                );
              }
            },
            child: Text('Sign Out', style: GoogleFonts.outfit(
              color: AppTheme.danger, fontWeight: FontWeight.w800))),
        ],
      ),
    );
  }

  // ── Widget builders ─────────────────────────────────────────────────────────
  Widget _tagChip(String label, Color col) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: col.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(6),
        border: Border.all(color: col.withValues(alpha: 0.3))),
      child: Text(label, style: GoogleFonts.outfit(
        fontSize: 9, fontWeight: FontWeight.w800, color: col)));
  }

  Widget _quickCard(IconData icon, String label, Color col, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 72,
        decoration: BoxDecoration(
          color: AppTheme.card, borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppTheme.border)),
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          Container(
            width: 32, height: 32,
            decoration: BoxDecoration(
              color: col.withValues(alpha: 0.12), shape: BoxShape.circle),
            child: Icon(icon, color: col, size: 16)),
          const SizedBox(height: 4),
          Text(label, style: GoogleFonts.outfit(
            fontSize: 10, fontWeight: FontWeight.w700, color: AppTheme.text2)),
        ]),
      ),
    );
  }

  Widget _settingsCard(List<Widget> children) {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.card, borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.border)),
      child: Column(children: children),
    );
  }

  Widget _switchRow(String title, String subtitle, IconData icon, Color col,
      bool value, ValueChanged<bool> onChanged) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      child: Row(children: [
        Container(
          width: 34, height: 34,
          decoration: BoxDecoration(
            color: col.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(10)),
          child: Icon(icon, color: col, size: 16)),
        const SizedBox(width: 12),
        Expanded(child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: GoogleFonts.outfit(
              fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.text1)),
            Text(subtitle, style: GoogleFonts.outfit(
              fontSize: 10, color: AppTheme.text3)),
          ],
        )),
        Switch(
          value: value, onChanged: onChanged,
          activeColor: Colors.black,
          activeTrackColor: AppTheme.primary,
          inactiveTrackColor: AppTheme.surface,
          inactiveThumbColor: AppTheme.text3),
      ]),
    );
  }

  Widget _arrowRow(IconData icon, Color col, String title, String value,
      VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(children: [
          Container(
            width: 34, height: 34,
            decoration: BoxDecoration(
              color: col.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, color: col, size: 16)),
          const SizedBox(width: 12),
          Expanded(child: Text(title, style: GoogleFonts.outfit(
            fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.text1))),
          Text(value, style: GoogleFonts.outfit(fontSize: 11, color: AppTheme.text3)),
          const SizedBox(width: 4),
          const Icon(Icons.chevron_right_rounded, color: AppTheme.text3, size: 18),
        ]),
      ),
    );
  }

  Widget _infoRow(IconData icon, Color col, String title, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(children: [
        Container(
          width: 34, height: 34,
          decoration: BoxDecoration(
            color: col.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(10)),
          child: Icon(icon, color: col, size: 16)),
        const SizedBox(width: 12),
        Expanded(child: Text(title, style: GoogleFonts.outfit(
          fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.text1))),
        if (value.isNotEmpty)
          Text(value, style: GoogleFonts.outfit(fontSize: 11, color: AppTheme.text3)),
        const SizedBox(width: 4),
        const Icon(Icons.chevron_right_rounded, color: AppTheme.text3, size: 18),
      ]),
    );
  }

  Widget _divider() => Divider(indent: 14, endIndent: 14,
    color: AppTheme.border, height: 1);
}
