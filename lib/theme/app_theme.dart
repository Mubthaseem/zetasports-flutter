import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  // ── Brand Colors ────────────────────────────────────────────────────────────
  static const Color bg         = Color(0xFF07132B); // Background
  static const Color surface    = Color(0xFF0D1B3E); // Surface
  static const Color card       = Color(0xFF132347); // Card
  static const Color primary    = Color(0xFF00D4FF); // Primary Cyan
  static const Color secondary  = Color(0xFF008CFF); // Secondary Blue
  static const Color success    = Color(0xFF00FF84); // Success Green
  static const Color warning    = Color(0xFFFFC83D); // Warning Gold
  static const Color danger     = Color(0xFFFF4D6D); // Danger/Live Red
  static const Color text1      = Color(0xFFFFFFFF); // Text Primary
  static const Color text2      = Color(0xFFA9B4C8); // Text Secondary
  static const Color text3      = Color(0xFF4A5568); // Text Muted
  static const Color border     = Color(0x0FFFFFFF); // rgba(255,255,255,0.06)

  // Aliases used across existing screens
  static const Color spaceBlack   = bg;
  static const Color midnightNavy = surface;
  static const Color cardBlue     = card;
  static const Color electricBlue = primary;
  static const Color iceBlue      = secondary;
  static const Color neonGreen    = success;
  static const Color liveRed      = danger;
  static const Color warningGold  = warning;
  static const Color accentGlow   = secondary;
  static const Color borderActive = primary;

  // ── Gradients ───────────────────────────────────────────────────────────────
  static const LinearGradient primaryGrad = LinearGradient(
    colors: [primary, secondary],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient heroGrad = LinearGradient(
    colors: [Color(0xFF000000), Color(0x00000000)],
    begin: Alignment.bottomCenter,
    end: Alignment.topCenter,
  );

  // ── Radius ──────────────────────────────────────────────────────────────────
  static const double radiusCard   = 24;
  static const double radiusCorner = 20;
  static const double radiusBtn    = 16;
  static const double radiusSm     = 10;

  // ── Typography ──────────────────────────────────────────────────────────────
  static TextStyle get h1 => GoogleFonts.outfit(
    fontSize: 28, fontWeight: FontWeight.w900, color: text1, height: 1.1);
  static TextStyle get h2 => GoogleFonts.outfit(
    fontSize: 22, fontWeight: FontWeight.w800, color: text1);
  static TextStyle get h3 => GoogleFonts.outfit(
    fontSize: 18, fontWeight: FontWeight.w700, color: text1);
  static TextStyle get h4 => GoogleFonts.outfit(
    fontSize: 15, fontWeight: FontWeight.w700, color: text1);
  static TextStyle get body => GoogleFonts.outfit(
    fontSize: 13, fontWeight: FontWeight.w500, color: text2);
  static TextStyle get caption => GoogleFonts.outfit(
    fontSize: 11, fontWeight: FontWeight.w600, color: text2);
  static TextStyle get label => GoogleFonts.outfit(
    fontSize: 10, fontWeight: FontWeight.w700, color: text3,
    letterSpacing: 0.8);
  static TextStyle get score => GoogleFonts.rajdhani(
    fontSize: 32, fontWeight: FontWeight.w900, color: text1);

  // ── Theme ───────────────────────────────────────────────────────────────────
  static ThemeData get theme => ThemeData(
    brightness: Brightness.dark,
    scaffoldBackgroundColor: bg,
    primaryColor: primary,
    colorScheme: const ColorScheme.dark(
      primary: primary,
      secondary: secondary,
      surface: surface,
      onPrimary: Colors.white,
      onSurface: Colors.white,
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: bg,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: GoogleFonts.outfit(
        color: Colors.white, fontSize: 16,
        fontWeight: FontWeight.w900, letterSpacing: 0.5),
      iconTheme: const IconThemeData(color: text2),
    ),
    textTheme: GoogleFonts.outfitTextTheme(ThemeData.dark().textTheme),
    cardColor: card,
    dividerColor: border,
    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      backgroundColor: surface,
      selectedItemColor: primary,
      unselectedItemColor: text3,
      type: BottomNavigationBarType.fixed,
      elevation: 0,
    ),
    chipTheme: ChipThemeData(
      backgroundColor: card,
      selectedColor: primary,
      labelStyle: GoogleFonts.outfit(
        fontSize: 11, fontWeight: FontWeight.w700, color: text2),
      side: const BorderSide(color: border),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
    ),
  );
}
