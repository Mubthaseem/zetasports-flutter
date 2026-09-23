import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/tailwind_theme.dart';

enum TwBadgeVariant {
  primary,
  live,
  success,
  warning,
  danger,
  neutral,
  outline,
}

class TwBadge extends StatefulWidget {
  final String label;
  final TwBadgeVariant variant;
  final IconData? icon;
  final bool pulse;
  final VoidCallback? onTap;

  const TwBadge({
    super.key,
    required this.label,
    this.variant = TwBadgeVariant.neutral,
    this.icon,
    this.pulse = false,
    this.onTap,
  });

  @override
  State<TwBadge> createState() => _TwBadgeState();
}

class _TwBadgeState extends State<TwBadge> with SingleTickerProviderStateMixin {
  AnimationController? _controller;
  Animation<double>? _opacityAnim;

  @override
  void initState() {
    super.initState();
    if (widget.pulse || widget.variant == TwBadgeVariant.live) {
      _controller = AnimationController(
        vsync: this,
        duration: const Duration(milliseconds: 900),
      )..repeat(reverse: true);
      _opacityAnim = Tween<double>(begin: 0.3, end: 1.0).animate(_controller!);
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color fg;
    Color border;

    switch (widget.variant) {
      case TwBadgeVariant.primary:
        bg = TwBlue.b50;
        fg = TwBlue.b600;
        border = TwBlue.b200;
        break;
      case TwBadgeVariant.live:
      case TwBadgeVariant.danger:
        bg = TwRose.r50;
        fg = TwRose.r600;
        border = TwRose.r200;
        break;
      case TwBadgeVariant.success:
        bg = TwEmerald.e50;
        fg = TwEmerald.e600;
        border = TwEmerald.e200;
        break;
      case TwBadgeVariant.warning:
        bg = TwAmber.a50;
        fg = TwAmber.a700;
        border = TwAmber.a200;
        break;
      case TwBadgeVariant.outline:
        bg = Colors.transparent;
        fg = TwSlate.s700;
        border = TwSlate.s300;
        break;
      case TwBadgeVariant.neutral:
        bg = TwSlate.s100;
        fg = TwSlate.s700;
        border = TwSlate.s200;
        break;
    }

    Widget content = Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        if (widget.pulse || widget.variant == TwBadgeVariant.live) ...[
          AnimatedBuilder(
            animation: _opacityAnim ?? const AlwaysStoppedAnimation(1.0),
            builder: (context, child) {
              return Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(
                  color: fg.withValues(alpha: _opacityAnim?.value ?? 1.0),
                  shape: BoxShape.circle,
                ),
              );
            },
          ),
          const SizedBox(width: TwSpace.p1_5),
        ] else if (widget.icon != null) ...[
          Icon(widget.icon, size: 12, color: fg),
          const SizedBox(width: TwSpace.p1),
        ],
        Text(
          widget.label,
          style: GoogleFonts.outfit(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: fg,
            letterSpacing: 0.3,
          ),
        ),
      ],
    );

    final badgeContainer = Container(
      padding: const EdgeInsets.symmetric(
        horizontal: TwSpace.p2_5,
        vertical: TwSpace.p1,
      ),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(TwRadius.full),
        border: Border.all(color: border, width: 1),
      ),
      child: content,
    );

    if (widget.onTap != null) {
      return GestureDetector(
        onTap: widget.onTap,
        child: badgeContainer,
      );
    }

    return badgeContainer;
  }
}
