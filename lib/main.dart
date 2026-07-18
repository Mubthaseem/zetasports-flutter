import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'dart:async';
import 'dart:math' as math;
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';
import 'theme/app_theme.dart';
import 'screens/main_shell.dart';
import 'services/ad_service.dart';
import 'services/app_version_service.dart';
import 'package:onesignal_flutter/onesignal_flutter.dart';

const _supabaseUrl     = 'https://voocdrpetiyspuhyeapi.supabase.co';
const _supabaseAnonKey = 'sb_publishable_luDUt769BBrrApn8z-Cgvw_W9VE0rIV';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Supabase
  try {
    await Supabase.initialize(url: _supabaseUrl, anonKey: _supabaseAnonKey);
  } catch (e) {
    debugPrint('Supabase init error: $e');
  }

  // AdMob
  try {
    await AdService.initialize();
    await AdService.loadInterstitial(); // pre-load for first use
  } catch (e) {
    debugPrint('AdMob init error: $e');
  }

  runApp(const ZetaSportsApp());
}

// ─────────────────────────────────────────────────────────────────────────────
class ZetaSportsApp extends StatelessWidget {
  const ZetaSportsApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ZetaSports',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.theme,
      themeMode: ThemeMode.dark,
      home: const SplashScreen(),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SPLASH SCREEN
// ─────────────────────────────────────────────────────────────────────────────
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});
  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double>   _scale;
  late Animation<double>   _fade;
  String _msg = 'Connecting to Sports Cloud...';

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat(reverse: true);

    _scale = Tween<double>(begin: 0.94, end: 1.04).animate(
        CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut));
    _fade = Tween<double>(begin: 0.7, end: 1.0).animate(
        CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut));

    _boot();
  }

  Future<void> _boot() async {
    await Future.delayed(const Duration(milliseconds: 1400));
    if (!mounted) return;
    setState(() => _msg = 'Checking for updates...');

    // ── Version / Maintenance check ──────────────────────────────────────────
    final config = await AppVersionService.fetchConfig();

    // Initialize OneSignal
    if (config.onesignalAppId.isNotEmpty) {
      try {
        OneSignal.Debug.setLogLevel(OSLogLevel.verbose);
        OneSignal.initialize(config.onesignalAppId);
        OneSignal.Notifications.requestPermission(true);
      } catch (e) {
        debugPrint('OneSignal Init Error: $e');
      }
    }

    if (!mounted) return;

    // Maintenance mode — block everyone
    if (config.maintenanceMode) {
      await _showMaintenanceDialog();
      return; // never navigates away
    }

    // Force update check
    if (config.forceUpdate &&
        AppVersionService.isOutdated(
            AppVersionService.currentVersion, config.minVersion)) {
      await _showUpdateDialog(config);
      return; // never navigates away
    }

    // ── Normal boot ──────────────────────────────────────────────────────────
    setState(() => _msg = 'Synchronizing match fixtures...');
    await Future.delayed(const Duration(milliseconds: 900));
    if (!mounted) return;
    setState(() => _msg = 'Building your feed...');
    await Future.delayed(const Duration(milliseconds: 700));
    if (!mounted) return;

    bool proceeded = false;
    void proceed() {
      if (proceeded) return;
      proceeded = true;
      if (!mounted) return;
      Navigator.of(context).pushReplacement(PageRouteBuilder(
        pageBuilder: (_, __, ___) => const MainShell(), // direct entry — no login gate
        transitionsBuilder: (_, anim, __, child) =>
            FadeTransition(opacity: anim, child: child),
        transitionDuration: const Duration(milliseconds: 600),
      ));
    }

    // Safety timeout of 3.5 seconds to prevent getting stuck if AdMob hangs
    Timer(const Duration(milliseconds: 3500), proceed);

    try {
      AdService.showAppOpenAd(onDismissed: proceed);
    } catch (e) {
      debugPrint('AppOpenAd Error: $e');
      proceed();
    }
  }

  // ── Force Update Dialog (non-dismissable) ──────────────────────────────────
  Future<void> _showUpdateDialog(AppConfig config) async {
    await showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => WillPopScope(
        onWillPop: () async => false, // block back button
        child: AlertDialog(
          backgroundColor: AppTheme.surface,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          contentPadding: const EdgeInsets.all(28),
          content: Column(mainAxisSize: MainAxisSize.min, children: [
            // Update icon with glow
            Container(
              width: 80, height: 80,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: const LinearGradient(
                  colors: [AppTheme.primary, AppTheme.secondary]),
                boxShadow: [BoxShadow(
                  color: AppTheme.primary.withValues(alpha: 0.4),
                  blurRadius: 24, spreadRadius: 4)]),
              child: const Icon(Icons.system_update_rounded,
                color: Colors.black, size: 36)),
            const SizedBox(height: 20),
            Text('Update Required', style: GoogleFonts.outfit(
              fontSize: 20, fontWeight: FontWeight.w900, color: AppTheme.text1)),
            const SizedBox(height: 8),
            Text(
              config.updateMessage.isNotEmpty
                  ? config.updateMessage
                  : 'A new version (v${config.latestVersion}) is available.\nPlease update to continue using ZetaSports.',
              style: GoogleFonts.outfit(
                fontSize: 13, color: AppTheme.text2, height: 1.5),
              textAlign: TextAlign.center),
            const SizedBox(height: 8),
            Text(
              'Current: v${AppVersionService.currentVersion}  •  Required: v${config.minVersion}',
              style: GoogleFonts.outfit(fontSize: 10, color: AppTheme.text3),
              textAlign: TextAlign.center),
            const SizedBox(height: 24),
            // Update button
            GestureDetector(
              onTap: () => _openStore(config),
              child: Container(
                height: 52, width: double.infinity,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AppTheme.primary, AppTheme.secondary]),
                  borderRadius: BorderRadius.circular(14),
                  boxShadow: [BoxShadow(
                    color: AppTheme.primary.withValues(alpha: 0.3),
                    blurRadius: 16, offset: const Offset(0, 6))]),
                child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  const Icon(Icons.download_rounded, color: Colors.black, size: 20),
                  const SizedBox(width: 8),
                  Text('UPDATE NOW', style: GoogleFonts.outfit(
                    fontSize: 14, fontWeight: FontWeight.w900, color: Colors.black)),
                ]),
              ),
            ),
          ]),
        ),
      ),
    );
  }

  // ── Maintenance Dialog (non-dismissable) ───────────────────────────────────
  Future<void> _showMaintenanceDialog() async {
    await showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => WillPopScope(
        onWillPop: () async => false,
        child: AlertDialog(
          backgroundColor: AppTheme.surface,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          contentPadding: const EdgeInsets.all(28),
          content: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(
              width: 80, height: 80,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppTheme.warning.withValues(alpha: 0.15),
                border: Border.all(color: AppTheme.warning, width: 2)),
              child: const Icon(Icons.build_rounded,
                color: AppTheme.warning, size: 36)),
            const SizedBox(height: 20),
            Text('Under Maintenance', style: GoogleFonts.outfit(
              fontSize: 20, fontWeight: FontWeight.w900, color: AppTheme.text1)),
            const SizedBox(height: 8),
            Text(
              'ZetaSports is currently undergoing scheduled maintenance.\nWe\'ll be back shortly. Thank you for your patience! 🙏',
              style: GoogleFonts.outfit(
                fontSize: 13, color: AppTheme.text2, height: 1.5),
              textAlign: TextAlign.center),
            const SizedBox(height: 24),
            // Retry button (re-checks config)
            GestureDetector(
              onTap: () {
                Navigator.pop(context);
                _boot(); // re-check
              },
              child: Container(
                height: 48, width: double.infinity,
                decoration: BoxDecoration(
                  color: AppTheme.warning.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppTheme.warning)),
                child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  const Icon(Icons.refresh_rounded, color: AppTheme.warning, size: 18),
                  const SizedBox(width: 8),
                  Text('CHECK AGAIN', style: GoogleFonts.outfit(
                    fontSize: 13, fontWeight: FontWeight.w900, color: AppTheme.warning)),
                ]),
              ),
            ),
          ]),
        ),
      ),
    );
  }

  void _openStore(AppConfig config) async {
    final storeUrl = defaultTargetPlatform == TargetPlatform.iOS
        ? config.iosStoreUrl
        : config.androidStoreUrl;
    if (storeUrl.isEmpty) return;
    final uri = Uri.tryParse(storeUrl);
    if (uri == null) return;
    try {
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
    } catch (e) {
      debugPrint('_openStore error: $e');
    }
  }


  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bg,
      body: Stack(
        children: [
          // Subtle pitch lines background
          Positioned.fill(
            child: Opacity(
              opacity: 0.04,
              child: CustomPaint(painter: _PitchBg()),
            ),
          ),

          // Radial glow
          Positioned.fill(
            child: Center(
              child: AnimatedBuilder(
                animation: _ctrl,
                builder: (_, __) => Container(
                  width: 280, height: 280,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: [
                        AppTheme.primary.withOpacity(0.12 + 0.06 * math.sin(_ctrl.value * math.pi)),
                        Colors.transparent,
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),

          Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Logo
                AnimatedBuilder(
                  animation: _ctrl,
                  builder: (_, __) => Transform.scale(
                    scale: _scale.value,
                    child: Container(
                      width: 120, height: 120,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: const LinearGradient(
                          colors: [AppTheme.primary, AppTheme.secondary],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: AppTheme.primary.withOpacity(
                                0.3 + 0.2 * math.sin(_ctrl.value * math.pi)),
                            blurRadius: 48,
                            spreadRadius: 8,
                          ),
                        ],
                      ),
                      child: Center(
                        child: Text('Z', style: GoogleFonts.outfit(
                          fontSize: 56, fontWeight: FontWeight.w900, color: Colors.black)),
                      ),
                    ),
                  ),
                ),

                const SizedBox(height: 32),

                // Brand name
                RichText(
                  text: TextSpan(children: [
                    TextSpan(text: 'ZETA', style: GoogleFonts.outfit(
                      fontSize: 30, fontWeight: FontWeight.w900,
                      color: AppTheme.text1, letterSpacing: 2)),
                    TextSpan(text: 'SPORTS', style: GoogleFonts.outfit(
                      fontSize: 30, fontWeight: FontWeight.w900,
                      color: AppTheme.primary, letterSpacing: 2)),
                  ]),
                ),

                const SizedBox(height: 6),

                Text('LIVE THE GAME', style: GoogleFonts.outfit(
                  fontSize: 11, fontWeight: FontWeight.w700,
                  color: AppTheme.text3, letterSpacing: 4)),

                const SizedBox(height: 60),

                // Spinner
                SizedBox(
                  width: 22, height: 22,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.5,
                    valueColor: AlwaysStoppedAnimation<Color>(AppTheme.primary),
                  ),
                ),

                const SizedBox(height: 16),

                Text(_msg, style: GoogleFonts.outfit(
                  fontSize: 12, fontWeight: FontWeight.w500, color: AppTheme.text2)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PitchBg extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = AppTheme.primary
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.0;
    canvas.drawRect(Rect.fromLTWH(0, 0, size.width, size.height), p);
    canvas.drawLine(Offset(0, size.height / 2), Offset(size.width, size.height / 2), p);
    canvas.drawCircle(Offset(size.width / 2, size.height / 2), 90, p);
  }

  @override
  bool shouldRepaint(_) => false;
}
