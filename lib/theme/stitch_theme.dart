import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Exact design tokens exported from Stitch project:
/// ZetaSports Live Stream App (projects/15519838910571202897)
class StitchColors {
  // Surfaces & Backgrounds
  static const Color surface                 = Color(0xFFFAF8FF);
  static const Color surfaceDim              = Color(0xFFD2D9F4);
  static const Color surfaceBright           = Color(0xFFFAF8FF);
  static const Color surfaceContainerLowest  = Color(0xFFFFFFFF);
  static const Color surfaceContainerLow     = Color(0xFFF2F3FF);
  static const Color surfaceContainer        = Color(0xFFEAEDFF);
  static const Color surfaceContainerHigh    = Color(0xFFE2E7FF);
  static const Color surfaceContainerHighest = Color(0xFFDAE2FD);

  // Content & Typography
  static const Color onSurface               = Color(0xFF131B2E);
  static const Color onSurfaceVariant        = Color(0xFF434655);
  static const Color background              = Color(0xFFFAF8FF);
  static const Color onBackground            = Color(0xFF131B2E);

  // Inverted (Video Player & Dark Hero Elements)
  static const Color inverseSurface          = Color(0xFF131B2E); // Deep Slate
  static const Color inverseSurfaceElevated  = Color(0xFF1E293B);
  static const Color inverseOnSurface        = Color(0xFFEEF0FF);

  // Primary (Electric Blue)
  static const Color primary                 = Color(0xFF004AC6);
  static const Color primaryContainer        = Color(0xFF2563EB);
  static const Color onPrimary               = Color(0xFFFFFFFF);
  static const Color onPrimaryContainer      = Color(0xFFEEEFFF);
  static const Color primaryFixed            = Color(0xFFDBE1FF);

  // Secondary (Pitch Emerald Green)
  static const Color secondary               = Color(0xFF006C49);
  static const Color secondaryContainer      = Color(0xFF10B981);
  static const Color secondaryFixed          = Color(0xFF6FFBBE);
  static const Color onSecondary             = Color(0xFFFFFFFF);
  static const Color onSecondaryFixed        = Color(0xFF002113);

  // Tertiary (Live Broadcast Pulse Crimson)
  static const Color tertiary                = Color(0xFFEF4444);
  static const Color tertiaryDark            = Color(0xFFAB0B1C);
  static const Color tertiaryContainer       = Color(0xFFCF2C30);
  static const Color onTertiary              = Color(0xFFFFFFFF);
  static const Color onTertiaryContainer     = Color(0xFFFFECEA);

  // Outline & Dividers
  static const Color outline                 = Color(0xFF737686);
  static const Color outlineVariant          = Color(0xFFE2E8F0);
  static const Color borderSubtle            = Color(0xFFE2E8F0);

  // Semantic
  static const Color error                   = Color(0xFFBA1A1A);
  static const Color errorContainer          = Color(0xFFFFDAD6);
}

class StitchRadius {
  static const double sm      = 4.0;
  static const double defaultR = 8.0;
  static const double md      = 12.0;
  static const double lg      = 16.0;
  static const double xl      = 24.0;
  static const double full    = 999.0;
}

class StitchTypography {
  static TextStyle displayScore({Color color = StitchColors.onSurface}) =>
      GoogleFonts.plusJakartaSans(
        fontSize: 48,
        fontWeight: FontWeight.w800,
        height: 52 / 48,
        letterSpacing: -0.04 * 48,
        color: color,
        fontFeatures: const [FontFeature.tabularFigures()],
      );

  static TextStyle displayScoreMobile({Color color = StitchColors.onSurface}) =>
      GoogleFonts.plusJakartaSans(
        fontSize: 36,
        fontWeight: FontWeight.w800,
        height: 40 / 36,
        letterSpacing: -0.03 * 36,
        color: color,
        fontFeatures: const [FontFeature.tabularFigures()],
      );

  static TextStyle headlineLg({Color color = StitchColors.onSurface}) =>
      GoogleFonts.plusJakartaSans(
        fontSize: 28,
        fontWeight: FontWeight.w700,
        height: 36 / 28,
        letterSpacing: -0.02 * 28,
        color: color,
      );

  static TextStyle headlineMd({Color color = StitchColors.onSurface}) =>
      GoogleFonts.plusJakartaSans(
        fontSize: 20,
        fontWeight: FontWeight.w700,
        height: 28 / 20,
        letterSpacing: -0.01 * 20,
        color: color,
      );

  static TextStyle headlineSm({Color color = StitchColors.onSurface}) =>
      GoogleFonts.plusJakartaSans(
        fontSize: 16,
        fontWeight: FontWeight.w600,
        height: 24 / 16,
        color: color,
      );

  static TextStyle bodyLg({Color color = StitchColors.onSurface}) =>
      GoogleFonts.inter(
        fontSize: 16,
        fontWeight: FontWeight.w400,
        height: 24 / 16,
        color: color,
      );

  static TextStyle bodyMd({Color color = StitchColors.onSurfaceVariant}) =>
      GoogleFonts.inter(
        fontSize: 14,
        fontWeight: FontWeight.w400,
        height: 20 / 14,
        color: color,
      );

  static TextStyle bodySm({Color color = StitchColors.onSurfaceVariant}) =>
      GoogleFonts.inter(
        fontSize: 12,
        fontWeight: FontWeight.w400,
        height: 16 / 12,
        color: color,
      );

  static TextStyle metricMono({Color color = StitchColors.onSurface}) =>
      GoogleFonts.inter(
        fontSize: 14,
        fontWeight: FontWeight.w600,
        height: 20 / 14,
        letterSpacing: 0.02 * 14,
        color: color,
        fontFeatures: const [FontFeature.tabularFigures()],
      );

  static TextStyle labelMd({Color color = StitchColors.onSurface}) =>
      GoogleFonts.inter(
        fontSize: 12,
        fontWeight: FontWeight.w600,
        height: 16 / 12,
        letterSpacing: 0.04 * 12,
        color: color,
      );

  static TextStyle labelSm({Color color = StitchColors.onSurface}) =>
      GoogleFonts.inter(
        fontSize: 10,
        fontWeight: FontWeight.w700,
        height: 14 / 10,
        letterSpacing: 0.06 * 10,
        color: color,
      );

  static TextStyle titleLg({Color color = StitchColors.onSurface}) => headlineLg(color: color);
  static TextStyle titleMd({Color color = StitchColors.onSurface}) => headlineMd(color: color);
  static TextStyle titleSm({Color color = StitchColors.onSurface}) => headlineSm(color: color);
  static TextStyle caption({Color color = StitchColors.onSurfaceVariant}) => bodySm(color: color);
}
