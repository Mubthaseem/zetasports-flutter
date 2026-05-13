import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/firestore_service.dart';
import '../theme/app_theme.dart';
import 'main_shell.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with TickerProviderStateMixin {
  late AnimationController _scaleCtrl;
  late AnimationController _fadeCtrl;
  late Animation<double> _scale;
  late Animation<double> _fade;
  late Animation<double> _glow;

  @override
  void initState() {
    super.initState();
    _scaleCtrl = AnimationController(
      vsync: this, duration: const Duration(milliseconds: 900));
    _fadeCtrl = AnimationController(
      vsync: this, duration: const Duration(milliseconds: 600));

    _scale = CurvedAnimation(parent: _scaleCtrl, curve: Curves.elasticOut);
    _fade = CurvedAnimation(parent: _fadeCtrl, curve: Curves.easeIn);
    _glow = Tween(begin: 0.0, end: 1.0).animate(
        CurvedAnimation(parent: _scaleCtrl, curve: Curves.easeOut));

    _scaleCtrl.forward();
    Future.delayed(const Duration(milliseconds: 400), () => _fadeCtrl.forward());
    Future.delayed(const Duration(milliseconds: 2800), () {
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        PageRouteBuilder(
          pageBuilder: (_, __, ___) => const MainShell(),
          transitionDuration: const Duration(milliseconds: 600),
          transitionsBuilder: (_, anim, __, child) =>
              FadeTransition(opacity: anim, child: child),
        ),
      );
    });
  }

  @override
  void dispose() {
    _scaleCtrl.dispose();
    _fadeCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final String currentVersion = AppTheme.appVersion;

    return StreamBuilder<Map<String, dynamic>?>(
      stream: FirestoreService.configStream(),
      builder: (context, configSnap) {
        final config = configSnap.data;
        
        // If we have config, check for Maintenance/Updates
        if (config != null) {
          final isMaintenance = config['maintenanceMode'] as bool? ?? false;
          final minVersion = config['minVersion'] as String? ?? '1.0.0';
          final updateUrl = config['updateUrl'] as String?;
          final loadingLogo = config['loadingLogo'] as String?;
          final appName = config['appName'] as String? ?? 'ZETASPORTS';

          if (isMaintenance) {
            return _FullScreenOverlay(
              title: 'UNDER MAINTENANCE',
              subtitle: 'We are performing some scheduled updates to improve your experience. We will be back shortly!',
              icon: Icons.construction,
              logoUrl: loadingLogo,
            );
          }

          if (updateUrl != null && updateUrl.isNotEmpty && currentVersion != minVersion) {
             if (minVersion.contains('+') && currentVersion.contains('+')) {
                int minBuild = int.tryParse(minVersion.split('+').last) ?? 0;
                int curBuild = int.tryParse(currentVersion.split('+').last) ?? 0;
                if (curBuild < minBuild) {
                  return _FullScreenOverlay(
                    title: 'UPDATE REQUIRED',
                    subtitle: 'A new version of $appName is available! Please update to continue using the app.',
                    icon: Icons.system_update,
                    logoUrl: loadingLogo,
                    actionLabel: 'DOWNLOAD UPDATE',
                    actionUrl: updateUrl,
                  );
                }
             }
          }
        }

        // Default Splash View (Shown during loading or as fallback)
        final loadingLogo = config?['loadingLogo'] as String?;
        final appName = config?['appName'] as String? ?? 'ZETASPORTS';

        return Scaffold(
          backgroundColor: AppTheme.bg,
          body: Container(
            width: double.infinity,
            height: double.infinity,
            decoration: BoxDecoration(
              color: AppTheme.bg,
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [AppTheme.bg, AppTheme.bg2],
              ),
            ),
            child: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Glow ring
                  AnimatedBuilder(
                    animation: _glow,
                    builder: (_, child) => Container(
                      width: 120 + (_glow.value * 20),
                      height: 120 + (_glow.value * 20),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: AppTheme.accent.withOpacity(0.15 * _glow.value),
                            blurRadius: 40,
                            spreadRadius: 10,
                          ),
                        ],
                      ),
                      child: child,
                    ),
                    child: ScaleTransition(
                      scale: _scale,
                      child: Container(
                        width: 120,
                        height: 120,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: AppTheme.card,
                          border: Border.all(color: AppTheme.accent.withOpacity(0.2), width: 2),
                          boxShadow: [
                            BoxShadow(
                              color: AppTheme.accent.withOpacity(0.2),
                              blurRadius: 20,
                              spreadRadius: 2,
                            ),
                          ],
                        ),
                        child: Center(
                          child: loadingLogo != null && loadingLogo.isNotEmpty
                              ? Padding(
                                  padding: const EdgeInsets.all(25),
                                  child: CachedNetworkImage(
                                    imageUrl: loadingLogo,
                                    fit: BoxFit.contain,
                                    placeholder: (_, __) => const CircularProgressIndicator(strokeWidth: 2),
                                    errorWidget: (_, __, ___) => Text('⚡', style: TextStyle(fontSize: 42, color: AppTheme.accent)),
                                  ),
                                )
                              : Text('⚡', style: TextStyle(fontSize: 42, color: AppTheme.accent)),
                        ),
                      ),
                    ),
                  ),

                  const SizedBox(height: 40),

                  FadeTransition(
                    opacity: _fade,
                    child: Column(
                      children: [
                        Text(
                          appName.toUpperCase(),
                          style: GoogleFonts.rajdhani(
                            fontSize: 32,
                            fontWeight: FontWeight.w900,
                            color: AppTheme.text1,
                            letterSpacing: 8,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'PREMIUM SPORTS ECOSYSTEM',
                          style: GoogleFonts.inter(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: AppTheme.accent.withOpacity(0.8),
                            letterSpacing: 4,
                          ),
                        ),
                        const SizedBox(height: 48),
                        SizedBox(
                          width: 140,
                          child: LinearProgressIndicator(
                            backgroundColor: AppTheme.bg3,
                            valueColor: AlwaysStoppedAnimation<Color>(AppTheme.accent),
                            minHeight: 1.5,
                          ),
                        ),
                        const SizedBox(height: 20),
                        Text(
                          'VERSION $currentVersion',
                          style: TextStyle(color: AppTheme.text3, fontSize: 9, fontWeight: FontWeight.bold, letterSpacing: 1),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _FullScreenOverlay extends StatelessWidget {
  final String title;
  final String subtitle;
  final IconData icon;
  final String? logoUrl;
  final String? actionLabel;
  final String? actionUrl;

  const _FullScreenOverlay({
    required this.title,
    required this.subtitle,
    required this.icon,
    this.logoUrl,
    this.actionLabel,
    this.actionUrl,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bg,
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(40),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (logoUrl != null)
                CachedNetworkImage(imageUrl: logoUrl!, height: 60)
              else
                Icon(icon, size: 80, color: AppTheme.accent),
              const SizedBox(height: 32),
              Text(title,
                textAlign: TextAlign.center,
                style: GoogleFonts.rajdhani(fontSize: 28, fontWeight: FontWeight.w900, color: AppTheme.text1, letterSpacing: 2)),
              const SizedBox(height: 16),
              Text(subtitle,
                textAlign: TextAlign.center,
                style: TextStyle(color: AppTheme.text3, fontSize: 14, height: 1.5)),
              if (actionLabel != null) ...[
                const SizedBox(height: 40),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.accent,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    onPressed: () {
                      // Note: url_launcher would be used here in a real app
                    },
                    child: Text(actionLabel!, style: const TextStyle(fontWeight: FontWeight.w800, letterSpacing: 1)),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
