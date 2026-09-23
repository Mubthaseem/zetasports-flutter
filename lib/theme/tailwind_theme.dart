import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

// ─────────────────────────────────────────────────────────────────────────────
// TAILWIND CSS v4 DESIGN TOKENS IN DART
// ─────────────────────────────────────────────────────────────────────────────

/// Tailwind CSS v4 Color Palettes
class TwSlate {
  static const Color s50  = Color(0xFFF8FAFC);
  static const Color s100 = Color(0xFFF1F5F9);
  static const Color s200 = Color(0xFFE2E8F0);
  static const Color s300 = Color(0xFFCBD5E1);
  static const Color s400 = Color(0xFF94A3B8);
  static const Color s500 = Color(0xFF64748B);
  static const Color s600 = Color(0xFF475569);
  static const Color s700 = Color(0xFF334155);
  static const Color s800 = Color(0xFF1E293B);
  static const Color s900 = Color(0xFF0F172A);
  static const Color s950 = Color(0xFF020617);
}

class TwZinc {
  static const Color z50  = Color(0xFFFAFAFA);
  static const Color z100 = Color(0xFFF4F4F5);
  static const Color z200 = Color(0xFFE4E4E7);
  static const Color z300 = Color(0xFFD4D4D8);
  static const Color z400 = Color(0xFFA1A1AA);
  static const Color z500 = Color(0xFF71717A);
  static const Color z600 = Color(0xFF52525B);
  static const Color z700 = Color(0xFF3F3F46);
  static const Color z800 = Color(0xFF27272A);
  static const Color z900 = Color(0xFF18181B);
  static const Color z950 = Color(0xFF09090B);
}

class TwIndigo {
  static const Color i50  = Color(0xFFEEF2FF);
  static const Color i100 = Color(0xFFE0E7FF);
  static const Color i200 = Color(0xFFC7D2FE);
  static const Color i300 = Color(0xFFA5B4FC);
  static const Color i400 = Color(0xFF818CF8);
  static const Color i500 = Color(0xFF6366F1);
  static const Color i600 = Color(0xFF4F46E5);
  static const Color i700 = Color(0xFF4338CA);
  static const Color i800 = Color(0xFF3730A3);
  static const Color i900 = Color(0xFF312E81);
}

class TwBlue {
  static const Color b50  = Color(0xFFEFF6FF);
  static const Color b100 = Color(0xFFDBEAFE);
  static const Color b200 = Color(0xFFBFDBFE);
  static const Color b300 = Color(0xFF93C5FD);
  static const Color b400 = Color(0xFF60A5FA);
  static const Color b500 = Color(0xFF3B82F6);
  static const Color b600 = Color(0xFF2563EB);
  static const Color b700 = Color(0xFF1D4ED8);
  static const Color b800 = Color(0xFF1E40AF);
  static const Color b900 = Color(0xFF1E3A8A);
}

class TwEmerald {
  static const Color e50  = Color(0xFFECFDF5);
  static const Color e100 = Color(0xFFD1FAE5);
  static const Color e200 = Color(0xFFA7F3D0);
  static const Color e300 = Color(0xFF6EE7B7);
  static const Color e400 = Color(0xFF34D399);
  static const Color e500 = Color(0xFF10B981);
  static const Color e600 = Color(0xFF059669);
  static const Color e700 = Color(0xFF047857);
  static const Color e800 = Color(0xFF065F46);
  static const Color e900 = Color(0xFF064E3B);
}

class TwRose {
  static const Color r50  = Color(0xFFFFF1F2);
  static const Color r100 = Color(0xFFFFE4E6);
  static const Color r200 = Color(0xFFFECDD3);
  static const Color r300 = Color(0xFFFDA4AF);
  static const Color r400 = Color(0xFFFB7185);
  static const Color r500 = Color(0xFFF43F5E);
  static const Color r600 = Color(0xFFE11D48);
  static const Color r700 = Color(0xFFBE123C);
  static const Color r800 = Color(0xFF9F1239);
  static const Color r900 = Color(0xFF881337);
}

class TwAmber {
  static const Color a50  = Color(0xFFFFFBEB);
  static const Color a100 = Color(0xFFFEF3C7);
  static const Color a200 = Color(0xFFFDE68A);
  static const Color a300 = Color(0xFFFCD34D);
  static const Color a400 = Color(0xFFFBBF24);
  static const Color a500 = Color(0xFFF59E0B);
  static const Color a600 = Color(0xFFD97706);
  static const Color a700 = Color(0xFFB45309);
  static const Color a800 = Color(0xFF92400E);
  static const Color a900 = Color(0xFF78350F);
}

/// Tailwind CSS v4 Spacing Scale (Pixels)
class TwSpace {
  static const double p0_5 = 2.0;
  static const double p1   = 4.0;
  static const double p1_5 = 6.0;
  static const double p2   = 8.0;
  static const double p2_5 = 10.0;
  static const double p3   = 12.0;
  static const double p3_5 = 14.0;
  static const double p4   = 16.0;
  static const double p5   = 20.0;
  static const double p6   = 24.0;
  static const double p7   = 28.0;
  static const double p8   = 32.0;
  static const double p9   = 36.0;
  static const double p10  = 40.0;
  static const double p12  = 48.0;
  static const double p16  = 64.0;
  static const double p20  = 80.0;
  static const double p24  = 96.0;
}

/// Tailwind CSS v4 Border Radii
class TwRadius {
  static const double none = 0.0;
  static const double sm   = 2.0;
  static const double md   = 6.0;
  static const double lg   = 8.0;
  static const double xl   = 12.0;
  static const double xl2  = 16.0;
  static const double xl3  = 24.0;
  static const double full = 9999.0;

  static BorderRadius get rSm   => BorderRadius.circular(sm);
  static BorderRadius get rMd   => BorderRadius.circular(md);
  static BorderRadius get rLg   => BorderRadius.circular(lg);
  static BorderRadius get rXl   => BorderRadius.circular(xl);
  static BorderRadius get rXl2  => BorderRadius.circular(xl2);
  static BorderRadius get rXl3  => BorderRadius.circular(xl3);
  static BorderRadius get rFull => BorderRadius.circular(full);
}

/// Tailwind CSS v4 Box Shadows (Optimized for White Theme Elevation)
class TwShadows {
  static List<BoxShadow> get sm => [
    BoxShadow(
      color: Colors.black.withValues(alpha: 0.04),
      blurRadius: 2,
      offset: const Offset(0, 1),
    ),
  ];

  static List<BoxShadow> get md => [
    BoxShadow(
      color: Colors.black.withValues(alpha: 0.06),
      blurRadius: 6,
      offset: const Offset(0, 2),
    ),
    BoxShadow(
      color: Colors.black.withValues(alpha: 0.02),
      blurRadius: 2,
      offset: const Offset(0, 1),
    ),
  ];

  static List<BoxShadow> get lg => [
    BoxShadow(
      color: Colors.black.withValues(alpha: 0.08),
      blurRadius: 15,
      offset: const Offset(0, 4),
    ),
    BoxShadow(
      color: Colors.black.withValues(alpha: 0.03),
      blurRadius: 4,
      offset: const Offset(0, 2),
    ),
  ];

  static List<BoxShadow> get xl => [
    BoxShadow(
      color: Colors.black.withValues(alpha: 0.10),
      blurRadius: 25,
      offset: const Offset(0, 10),
    ),
    BoxShadow(
      color: Colors.black.withValues(alpha: 0.04),
      blurRadius: 10,
      offset: const Offset(0, 4),
    ),
  ];

  static List<BoxShadow> get cardHover => [
    BoxShadow(
      color: TwBlue.b600.withValues(alpha: 0.12),
      blurRadius: 16,
      offset: const Offset(0, 6),
    ),
  ];
}

/// Tailwind CSS v4 Typography
class TwText {
  static TextStyle get xs => GoogleFonts.outfit(
    fontSize: 12,
    fontWeight: FontWeight.w400,
    color: TwSlate.s600,
  );

  static TextStyle get sm => GoogleFonts.outfit(
    fontSize: 14,
    fontWeight: FontWeight.w400,
    color: TwSlate.s700,
  );

  static TextStyle get base => GoogleFonts.outfit(
    fontSize: 16,
    fontWeight: FontWeight.w400,
    color: TwSlate.s900,
  );

  static TextStyle get lg => GoogleFonts.outfit(
    fontSize: 18,
    fontWeight: FontWeight.w600,
    color: TwSlate.s900,
  );

  static TextStyle get xl => GoogleFonts.outfit(
    fontSize: 20,
    fontWeight: FontWeight.w700,
    color: TwSlate.s900,
  );

  static TextStyle get xl2 => GoogleFonts.outfit(
    fontSize: 24,
    fontWeight: FontWeight.w800,
    color: TwSlate.s900,
  );

  static TextStyle get xl3 => GoogleFonts.outfit(
    fontSize: 30,
    fontWeight: FontWeight.w900,
    color: TwSlate.s900,
  );

  static TextStyle get score => GoogleFonts.rajdhani(
    fontSize: 32,
    fontWeight: FontWeight.w900,
    color: TwSlate.s900,
  );
}
