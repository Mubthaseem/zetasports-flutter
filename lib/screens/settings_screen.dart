import 'package:flutter/material.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:url_launcher/url_launcher.dart';

import '../main.dart'; // For themeNotifier
import '../theme/app_theme.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _notificationsEnabled = true;
  bool _dataSaverEnabled = false;
  late SharedPreferences _prefs;
  bool _isLoading = true;
  Map<String, dynamic>? _config;

  @override
  void initState() {
    super.initState();
    _loadAll();
  }

  Future<void> _loadAll() async {
    _prefs = await SharedPreferences.getInstance();
    final snap = await FirebaseFirestore.instance.collection('settings').doc('app_config').get();
    
    setState(() {
      _notificationsEnabled = _prefs.getBool('notifications') ?? true;
      _dataSaverEnabled = _prefs.getBool('dataSaver') ?? false;
      if (snap.exists) _config = snap.data();
      _isLoading = false;
    });
  }

  Future<void> _toggleTheme(bool isDark) async {
    themeNotifier.value = isDark ? ThemeMode.dark : ThemeMode.light;
    await _prefs.setBool('isDark', isDark);
    setState(() {});
  }

  Future<void> _toggleNotifications(bool value) async {
    setState(() => _notificationsEnabled = value);
    await _prefs.setBool('notifications', value);
    if (value) {
      await FirebaseMessaging.instance.subscribeToTopic('all_users');
    } else {
      await FirebaseMessaging.instance.unsubscribeFromTopic('all_users');
    }
  }

  Future<void> _toggleDataSaver(bool value) async {
    setState(() => _dataSaverEnabled = value);
    await _prefs.setBool('dataSaver', value);
  }

  Future<void> _launchURL(String? url) async {
    if (url == null || url.isEmpty) return;
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  Future<void> _sendEmail(String? email) async {
    if (email == null || email.isEmpty) return;
    final uri = Uri.parse('mailto:$email?subject=Support%20Request%20-%20ZETASPORTS');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        backgroundColor: AppTheme.bg,
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    final isDark = themeNotifier.value == ThemeMode.dark;

    return Scaffold(
      backgroundColor: AppTheme.bg,
      appBar: AppBar(
        title: Text('More Settings', style: GoogleFonts.inter(fontWeight: FontWeight.w700)),
        centerTitle: true,
      ),
      body: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
        children: [
          _buildSectionHeader('APPEARANCE'),
          _buildSwitchTile(
            title: 'Dark Theme',
            icon: Icons.dark_mode_rounded,
            value: isDark,
            onChanged: _toggleTheme,
          ),
          _buildSwitchTile(
            title: 'Data Saver',
            icon: Icons.data_usage_rounded,
            value: _dataSaverEnabled,
            onChanged: _toggleDataSaver,
          ),
          
          const SizedBox(height: 24),
          _buildSectionHeader('NOTIFICATIONS'),
          _buildSwitchTile(
            title: 'Match Alerts',
            icon: Icons.notifications_active_rounded,
            value: _notificationsEnabled,
            onChanged: _toggleNotifications,
          ),

          const SizedBox(height: 24),
          _buildSectionHeader('COMMUNITY & SUPPORT'),
          _buildLinkTile(
            title: 'WhatsApp Group',
            icon: Icons.chat_rounded,
            color: const Color(0xFF25D366),
            onTap: () => _launchURL(_config?['whatsappUrl']),
          ),
          _buildLinkTile(
            title: 'Telegram Channel',
            icon: Icons.send_rounded,
            color: const Color(0xFF0088cc),
            onTap: () => _launchURL(_config?['telegramUrl']),
          ),
          _buildLinkTile(
            title: 'Follow Instagram',
            icon: Icons.camera_alt_rounded,
            color: const Color(0xFFE1306C),
            onTap: () => _launchURL(_config?['instagramUrl']),
          ),
          _buildLinkTile(
            title: 'Twitter / X',
            icon: Icons.close_rounded,
            color: Colors.white,
            onTap: () => _launchURL(_config?['twitterUrl']),
          ),
          _buildLinkTile(
            title: 'Support Email',
            icon: Icons.mail_outline_rounded,
            color: AppTheme.accent,
            onTap: () => _sendEmail(_config?['supportEmail']),
          ),

          const SizedBox(height: 24),
          _buildSectionHeader('INFO & LEGAL'),
          _buildLinkTile(
            title: 'Privacy Policy',
            icon: Icons.privacy_tip_outlined,
            color: Colors.amber,
            onTap: () => _launchURL(_config?['privacyUrl']),
          ),
          _buildLinkTile(
            title: 'Terms of Service',
            icon: Icons.description_outlined,
            color: Colors.grey,
            onTap: () => _launchURL(_config?['termsUrl']),
          ),

          const SizedBox(height: 40),
          Center(
            child: Column(
              children: [
                Text(
                  _config?['copyright'] ?? '© 2026 ZETASPORTS Ecosystem',
                  style: TextStyle(color: AppTheme.text3, fontSize: 11),
                ),
                const SizedBox(height: 4),
                Text(
                  'Version ${AppTheme.appVersion}',
                  style: TextStyle(color: AppTheme.text3, fontSize: 11, fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ),
          const SizedBox(height: 50),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12, left: 4),
      child: Text(
        title,
        style: GoogleFonts.inter(
          color: AppTheme.accent2,
          fontSize: 11,
          fontWeight: FontWeight.w900,
          letterSpacing: 1.2,
        ),
      ),
    );
  }

  Widget _buildSwitchTile({
    required String title,
    required IconData icon,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.border.withOpacity(0.5)),
      ),
      child: SwitchListTile(
        title: Text(title, style: TextStyle(color: AppTheme.text1, fontWeight: FontWeight.w600, fontSize: 14)),
        secondary: Icon(icon, color: AppTheme.accent2, size: 22),
        activeColor: AppTheme.accent,
        value: value,
        onChanged: onChanged,
      ),
    );
  }

  Widget _buildLinkTile({
    required String title,
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.border.withOpacity(0.5)),
      ),
      child: ListTile(
        leading: Icon(icon, color: color, size: 22),
        title: Text(title, style: TextStyle(color: AppTheme.text1, fontWeight: FontWeight.w500, fontSize: 14)),
        trailing: Icon(Icons.chevron_right_rounded, color: AppTheme.text3, size: 20),
        onTap: onTap,
      ),
    );
  }
}
