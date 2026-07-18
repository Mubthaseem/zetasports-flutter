import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../theme/app_theme.dart';
import 'main_shell.dart';
import 'package:onesignal_flutter/onesignal_flutter.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _usernameCtrl = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  bool _isSignUp = false;
  bool _loading = false;
  bool _obscure = true;
  String? _errorMsg;

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    _usernameCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _errorMsg = null;
    });

    final client = Supabase.instance.client;
    try {
      if (_isSignUp) {
        // Sign Up
        final res = await client.auth.signUp(
          email: _emailCtrl.text.trim(),
          password: _passwordCtrl.text.trim(),
        );
        
        // If email confirmation is enabled, notify. If disabled, log in directly.
        if (res.session == null) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('Registration successful! Please check your email for a verification link.',
                  style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
                backgroundColor: AppTheme.success,
              ),
            );
            setState(() => _isSignUp = false);
          }
        } else {
          _navigateHome();
        }
      } else {
        // Sign In
        await client.auth.signInWithPassword(
          email: _emailCtrl.text.trim(),
          password: _passwordCtrl.text.trim(),
        );
        _navigateHome();
      }
    } on AuthException catch (e) {
      setState(() => _errorMsg = e.message);
    } catch (e) {
      setState(() => _errorMsg = 'An unexpected error occurred: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _navigateHome() {
    final user = Supabase.instance.client.auth.currentUser;
    if (user != null) {
      try {
        OneSignal.login(user.id);
      } catch (e) {
        debugPrint('OneSignal login error: $e');
      }
    }
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const MainShell()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bg,
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFF0F172A), Color(0xFF020617)],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
              child: Form(
                key: _formKey,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Brand Logo
                    Center(
                      child: Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: AppTheme.primary.withValues(alpha: 0.1),
                          border: Border.all(color: AppTheme.primary.withValues(alpha: 0.2)),
                        ),
                        child: const Icon(
                          Icons.sports_soccer_rounded,
                          color: AppTheme.primary,
                          size: 48,
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'ZETASPORTS',
                      textAlign: TextAlign.center,
                      style: GoogleFonts.outfit(
                        fontSize: 28,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 2,
                        color: Colors.white,
                      ),
                    ),
                    Text(
                      _isSignUp ? 'Create your premium account' : 'Welcome back, champion!',
                      textAlign: TextAlign.center,
                      style: GoogleFonts.outfit(
                        fontSize: 14,
                        color: AppTheme.text3,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 32),

                    // Error Message Banner
                    if (_errorMsg != null) ...[
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppTheme.danger.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppTheme.danger.withValues(alpha: 0.3)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.error_outline_rounded, color: AppTheme.danger, size: 20),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                _errorMsg!,
                                style: GoogleFonts.outfit(color: AppTheme.danger, fontSize: 13, fontWeight: FontWeight.w600),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],

                    // Glassmorphic Input Card
                    Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: AppTheme.surface.withValues(alpha: 0.7),
                        borderRadius: BorderRadius.circular(24),
                        border: Border.all(color: AppTheme.border),
                      ),
                      child: Column(
                        children: [
                          if (_isSignUp) ...[
                            TextFormField(
                              controller: _usernameCtrl,
                              style: GoogleFonts.outfit(color: Colors.white, fontSize: 14),
                              decoration: InputDecoration(
                                labelText: 'Username',
                                labelStyle: GoogleFonts.outfit(color: AppTheme.text3),
                                prefixIcon: const Icon(Icons.person_outline_rounded, color: AppTheme.text3),
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
                              ),
                              validator: (v) => v == null || v.trim().isEmpty ? 'Username required' : null,
                            ),
                            const SizedBox(height: 16),
                          ],
                          TextFormField(
                            controller: _emailCtrl,
                            keyboardType: TextInputType.emailAddress,
                            style: GoogleFonts.outfit(color: Colors.white, fontSize: 14),
                            decoration: InputDecoration(
                              labelText: 'Email Address',
                              labelStyle: GoogleFonts.outfit(color: AppTheme.text3),
                              prefixIcon: const Icon(Icons.email_outlined, color: AppTheme.text3),
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
                            ),
                            validator: (v) {
                              if (v == null || v.trim().isEmpty) return 'Email required';
                              if (!v.contains('@') || !v.contains('.')) return 'Invalid email format';
                              return null;
                            },
                          ),
                          const SizedBox(height: 16),
                          TextFormField(
                            controller: _passwordCtrl,
                            obscureText: _obscure,
                            style: GoogleFonts.outfit(color: Colors.white, fontSize: 14),
                            decoration: InputDecoration(
                              labelText: 'Password',
                              labelStyle: GoogleFonts.outfit(color: AppTheme.text3),
                              prefixIcon: const Icon(Icons.lock_outline_rounded, color: AppTheme.text3),
                              suffixIcon: IconButton(
                                icon: Icon(_obscure ? Icons.visibility_off : Icons.visibility, color: AppTheme.text3),
                                onPressed: () => setState(() => _obscure = !_obscure),
                              ),
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
                            ),
                            validator: (v) => v == null || v.length < 6 ? 'Password must be at least 6 characters' : null,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Submit Button
                    ElevatedButton(
                      onPressed: _loading ? null : _submit,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.primary,
                        foregroundColor: Colors.black,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                      child: _loading
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(color: Colors.black, strokeWidth: 2),
                            )
                          : Text(
                              _isSignUp ? 'SIGN UP' : 'SIGN IN',
                              style: GoogleFonts.outfit(fontWeight: FontWeight.w900, fontSize: 14, letterSpacing: 1),
                            ),
                    ),
                    const SizedBox(height: 16),

                    // Switch Mode Toggle
                    TextButton(
                      onPressed: () {
                        setState(() {
                          _isSignUp = !_isSignUp;
                          _errorMsg = null;
                        });
                      },
                      child: RichText(
                        text: TextSpan(
                          style: GoogleFonts.outfit(fontSize: 13, color: AppTheme.text3),
                          children: [
                            TextSpan(text: _isSignUp ? 'Already have an account? ' : "Don't have an account? "),
                            TextSpan(
                              text: _isSignUp ? 'Sign In' : 'Sign Up',
                              style: const TextStyle(color: AppTheme.primary, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
