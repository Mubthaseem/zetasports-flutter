import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'dart:math';
import 'firebase_options.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';
import 'services/firestore_service.dart';
import 'theme/app_theme.dart';

final ValueNotifier<ThemeMode> themeNotifier = ValueNotifier(ThemeMode.dark);

void main() async {
  try {
    WidgetsFlutterBinding.ensureInitialized();
    
    // Initialize Supabase
    try {
      await Supabase.initialize(
        url: 'https://voocdrpetiyspuhyeapi.supabase.co',
        anonKey: 'sb_publishable_1rE1_AHPxoOv2AUpJtehJw_Gg0tj1xU',
      );
    } catch (e) {
      debugPrint("Supabase Init Error: $e");
    }
    
    // Initialize Firebase (keep for push notifications)
    try {
      await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform).timeout(
        const Duration(seconds: 8),
      );
    } catch (e) {
      debugPrint("Firebase Init Timeout or Error: $e");
    }

  } catch (e) {
    debugPrint("Startup Critical Error: $e");
  }

  runApp(const FIFAStreamApp());
}

class FIFAStreamApp extends StatelessWidget {
  const FIFAStreamApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<ThemeMode>(
      valueListenable: themeNotifier,
      builder: (_, ThemeMode currentMode, __) {
        return MaterialApp(
          title: 'FIFA LIVE TV',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.lightTheme,
          darkTheme: AppTheme.darkTheme,
          themeMode: ThemeMode.dark, // Enforce dark mode for TV app
          home: const InitScreen(),
        );
      },
    );
  }
}

class InitScreen extends StatefulWidget {
  const InitScreen({super.key});

  @override
  State<InitScreen> createState() => _InitScreenState();
}

class _InitScreenState extends State<InitScreen> {
  @override
  void initState() {
    super.initState();
    _checkSession();
  }

  Future<void> _checkSession() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final user = prefs.getString('fifa_sess_user') ?? '';
      final pin = prefs.getString('fifa_sess_pin') ?? '';

      if (user.isEmpty || pin.isEmpty) {
        _navTo(const LoginScreen());
        return;
      }

      // Validate session credentials
      final userData = await FirestoreService.checkLogin(user, pin);
      if (userData == null) {
        _navTo(const LoginScreen());
        return;
      }

      // Check device registration
      String? devId = prefs.getString('fifa_device_id');
      if (devId == null) {
        final random = Random.secure();
        final values = List<int>.generate(16, (i) => random.nextInt(256));
        devId = values.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
        await prefs.setString('fifa_device_id', devId);
      }

      final registered = await FirestoreService.registerSession(user, devId);
      if (!registered) {
        // Device limit exceeded or session expired, navigate to Login to show error
        _navTo(const LoginScreen());
        return;
      }

      _navTo(const HomeScreen());
    } catch (e) {
      debugPrint("Session check failed: $e");
      _navTo(const LoginScreen());
    }
  }

  void _navTo(Widget screen) {
    if (mounted) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => screen),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.pureBlack,
      body: Center(
        child: CircularProgressIndicator(color: AppTheme.accent),
      ),
    );
  }
}
