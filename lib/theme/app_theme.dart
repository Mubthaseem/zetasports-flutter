import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'stitch_theme.dart';

class AppTheme {
  // ── Stitch Brand Colors (ZetaSports Design System) ──────────────────────────
  static const Color bg         = StitchColors.background;       // #FAF8FF
  static const Color surface    = StitchColors.surfaceContainerLowest; // #FFFFFF
  static const Color card       = StitchColors.surfaceContainerLowest; // #FFFFFF
  static const Color primary    = StitchColors.primaryContainer; // #2563EB (Electric Blue)
  static const Color secondary  = StitchColors.secondary;        // #006C49
  static const Color success    = StitchColors.secondaryContainer; // #10B981 (Pitch Emerald)
  static const Color warning    = Color(0xFFF59E0B);
  static const Color danger     = StitchColors.tertiary;          // #EF4444 (Crimson)
  static const Color text1      = StitchColors.onSurface;        // #131B2E (Deep Slate)
  static const Color text2      = StitchColors.onSurfaceVariant; // #434655
  static const Color text3      = StitchColors.outline;          // #737686
  static const Color border     = StitchColors.outlineVariant;   // #E2E8F0

  // Stitch elevated & inverted containers
  static const Color inverseSurface = StitchColors.inverseSurface; // #131B2E
  static const Color surfaceContainer = StitchColors.surfaceContainer; // #EAEDFF
  static const Color surfaceContainerHigh = StitchColors.surfaceContainerHigh; // #E2E7FF
  static const Color secondaryFixed = StitchColors.secondaryFixed; // #6FFBBE

  // Backwards compatibility aliases
  static const Color spaceBlack   = StitchColors.inverseSurface;
  static const Color midnightNavy = StitchColors.background;
  static const Color cardBlue     = Colors.white;
  static const Color electricBlue = StitchColors.primaryContainer;
  static const Color iceBlue      = StitchColors.primary;
  static const Color neonGreen    = StitchColors.secondaryContainer;
  static const Color liveRed      = StitchColors.tertiary;
  static const Color warningGold  = Color(0xFFF59E0B);
  static const Color accentGlow   = StitchColors.primaryContainer;
  static const Color borderActive = StitchColors.primaryContainer;

  // ── Gradients ───────────────────────────────────────────────────────────────
  static const LinearGradient primaryGrad = LinearGradient(
    colors: [StitchColors.primaryContainer, StitchColors.primary],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient liveGrad = LinearGradient(
    colors: [StitchColors.tertiary, StitchColors.tertiaryDark],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient heroGrad = LinearGradient(
    colors: [Color(0xEE131B2E), Color(0x66131B2E), Colors.transparent],
    begin: Alignment.bottomCenter,
    end: Alignment.topCenter,
  );

  // ── Radius Scale ────────────────────────────────────────────────────────────
  static const double radiusCard   = StitchRadius.lg;       // 16.0
  static const double radiusCorner = StitchRadius.md;       // 12.0
  static const double radiusBtn    = StitchRadius.defaultR; // 8.0
  static const double radiusSm     = StitchRadius.sm;       // 4.0

  // ── Typography (Plus Jakarta Sans & Inter) ───────────────────────────────────
  static TextStyle get h1 => StitchTypography.headlineLg(color: text1);
  static TextStyle get h2 => StitchTypography.headlineMd(color: text1);
  static TextStyle get h3 => StitchTypography.headlineSm(color: text1);
  static TextStyle get h4 => StitchTypography.bodyLg(color: text1).copyWith(fontWeight: FontWeight.w600);
  static TextStyle get body => StitchTypography.bodyMd(color: text2);
  static TextStyle get caption => StitchTypography.bodySm(color: text3);
  static TextStyle get label => StitchTypography.labelSm(color: text3);
  static TextStyle get score => StitchTypography.displayScoreMobile(color: text1);
  static TextStyle get metric => StitchTypography.metricMono(color: text1);

  // ── ThemeData ───────────────────────────────────────────────────────────────
  static ThemeData get theme => ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    scaffoldBackgroundColor: bg,
    primaryColor: primary,
    colorScheme: const ColorScheme.light(
      primary: primary,
      secondary: success,
      surface: surface,
      onPrimary: Colors.white,
      onSurface: text1,
      error: danger,
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: surface.withValues(alpha: 0.85),
      elevation: 0,
      scrolledUnderElevation: 1,
      shadowColor: Colors.black.withValues(alpha: 0.04),
      centerTitle: false,
      titleTextStyle: GoogleFonts.plusJakartaSans(
        color: text1,
        fontSize: 18,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.2,
      ),
      iconTheme: const IconThemeData(color: text1),
    ),
    textTheme: GoogleFonts.interTextTheme(ThemeData.light().textTheme),
    cardColor: card,
    cardTheme: CardThemeData(
      color: card,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(radiusCard),
        side: const BorderSide(color: border, width: 1),
      ),
    ),
    dividerColor: border,
    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      backgroundColor: surface,
      selectedItemColor: primary,
      unselectedItemColor: text3,
      type: BottomNavigationBarType.fixed,
      elevation: 0,
    ),
  );
}
