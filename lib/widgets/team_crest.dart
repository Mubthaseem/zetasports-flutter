import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../theme/app_theme.dart';

class TeamCrest extends StatelessWidget {
  final String? logoUrl;
  final String code;
  final double size;

  const TeamCrest({super.key, this.logoUrl, required this.code, required this.size});

  @override
  Widget build(BuildContext context) {
    if (logoUrl != null && logoUrl!.isNotEmpty) {
      return CachedNetworkImage(
        imageUrl: logoUrl!,
        width: size, height: size,
        fit: BoxFit.contain,
        errorWidget: (_, __, ___) => _Initials(code: code, size: size),
      );
    }
    return _Initials(code: code, size: size);
  }
}

class _Initials extends StatelessWidget {
  final String code;
  final double size;
  const _Initials({required this.code, required this.size});

  @override
  Widget build(BuildContext context) {
    final display = code.length > 3 ? code.substring(0, 3) : code;
    return Container(
      width: size, height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          colors: [AppTheme.accentDim, Color(0xFF0A1A3A)],
        ),
        border: Border.all(color: AppTheme.border2, width: 1.5),
      ),
      child: Center(
        child: Text(
          display,
          style: TextStyle(
            color: AppTheme.accent2,
            fontSize: size * 0.28,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
    );
  }
}
