import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../main.dart'; // import themeNotifier

class AppTheme {
  static bool get isDark => themeNotifier.value == ThemeMode.dark;

  // ── Colors ────────────────────────────────────────────────────
  static const Color pureBlack = Color(0xFF000000);
  static const Color darkGray  = Color(0xFF121212);
  static const Color gold      = Color(0xFFFFD700);
  static const Color goldDim   = Color(0xFFFFE082);
  static const Color goldDeep  = Color(0xFFFFA000);

  static Color get bg       => isDark ? pureBlack : const Color(0xFFF8F8F8);
  static Color get bg2      => isDark ? darkGray : const Color(0xFFFFFFFF);
  static Color get bg3      => isDark ? const Color(0xFF1E1E1E) : const Color(0xFFEEEEEE);
  static Color get card     => isDark ? const Color(0xFF181818) : const Color(0xFFFFFFFF);
  static Color get accent   => gold;
  static Color get accent2  => isDark ? goldDim : goldDeep;
  static Color get accentDim=> gold.withOpacity(0.12);
  static Color get red      => const Color(0xFFFF3D00);
  static Color get liveGreen=> const Color(0xFF00E676);
  static Color get border   => isDark ? Colors.white10 : Colors.black12;
  static Color get border2  => isDark ? Colors.white24 : Colors.black26;
  static Color get text1    => isDark ? Colors.white : const Color(0xFF1A1A1A);
  static Color get text2    => isDark ? Colors.white70 : const Color(0xFF424242);
  static Color get text3    => isDark ? Colors.white38 : const Color(0xFF757575);

  static const String appVersion = "1.1.1+7";

  static ThemeData get darkTheme => ThemeData(
    brightness: Brightness.dark,
    scaffoldBackgroundColor: pureBlack,
    primaryColor: gold,
    colorScheme: const ColorScheme.dark(
      primary: gold,
      secondary: goldDim,
      surface: darkGray,
      onPrimary: Colors.black,
      onSurface: Colors.white,
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: pureBlack,
      elevation: 0,
      centerTitle: true,
      titleTextStyle: GoogleFonts.inter(
        color: Colors.white, fontSize: 17, fontWeight: FontWeight.w800,
        letterSpacing: 1.0,
      ),
      iconTheme: const IconThemeData(color: gold),
    ),
    textTheme: GoogleFonts.interTextTheme(ThemeData.dark().textTheme).copyWith(
      bodyLarge: GoogleFonts.inter(color: Colors.white),
      bodyMedium: GoogleFonts.inter(color: Colors.white70),
      bodySmall: GoogleFonts.inter(color: Colors.white38),
    ),
    cardColor: const Color(0xFF181818),
    dividerColor: Colors.white10,
    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      backgroundColor: pureBlack,
      selectedItemColor: gold,
      unselectedItemColor: Colors.white38,
      type: BottomNavigationBarType.fixed,
      elevation: 0,
    ),
  );

  static ThemeData get lightTheme => ThemeData(
    brightness: Brightness.light,
    scaffoldBackgroundColor: const Color(0xFFF8F8F8),
    primaryColor: goldDeep,
    colorScheme: const ColorScheme.light(
      primary: goldDeep,
      secondary: gold,
      surface: Colors.white,
      onPrimary: Colors.white,
      onSurface: Color(0xFF1A1A1A),
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: Colors.white,
      foregroundColor: const Color(0xFF1A1A1A),
      elevation: 0,
      centerTitle: true,
      titleTextStyle: GoogleFonts.inter(
        color: const Color(0xFF1A1A1A), fontSize: 17, fontWeight: FontWeight.w800,
      ),
      iconTheme: const IconThemeData(color: goldDeep),
    ),
    textTheme: GoogleFonts.interTextTheme(ThemeData.light().textTheme).copyWith(
      bodyLarge: GoogleFonts.inter(color: const Color(0xFF1A1A1A)),
      bodyMedium: GoogleFonts.inter(color: const Color(0xFF424242)),
      bodySmall: GoogleFonts.inter(color: const Color(0xFF757575)),
    ),
    cardColor: Colors.white,
    dividerColor: Colors.black12,
    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      backgroundColor: Colors.white,
      selectedItemColor: goldDeep,
      unselectedItemColor: Color(0xFF757575),
      type: BottomNavigationBarType.fixed,
      elevation: 0,
    ),
  );
}
