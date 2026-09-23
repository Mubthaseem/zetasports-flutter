import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/tailwind_theme.dart';

enum TwButtonVariant {
  primary,
  secondary,
  outline,
  ghost,
  danger,
}

enum TwButtonSize {
  sm,
  md,
  lg,
}

class TwButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final TwButtonVariant variant;
  final TwButtonSize size;
  final bool isLoading;
  final bool isFullWidth;

  const TwButton({
    super.key,
    required this.label,
    this.onPressed,
    this.icon,
    this.variant = TwButtonVariant.primary,
    this.size = TwButtonSize.md,
    this.isLoading = false,
    this.isFullWidth = false,
  });

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color fg;
    Border? border;

    switch (variant) {
      case TwButtonVariant.primary:
        bg = TwBlue.b600;
        fg = Colors.white;
        break;
      case TwButtonVariant.secondary:
        bg = TwSlate.s100;
        fg = TwSlate.s800;
        border = Border.all(color: TwSlate.s200, width: 1);
        break;
      case TwButtonVariant.outline:
        bg = Colors.white;
        fg = TwBlue.b600;
        border = Border.all(color: TwBlue.b300, width: 1);
        break;
      case TwButtonVariant.ghost:
        bg = Colors.transparent;
        fg = TwSlate.s700;
        break;
      case TwButtonVariant.danger:
        bg = TwRose.r600;
        fg = Colors.white;
        break;
    }

    double vPad;
    double hPad;
    double fontSize;
    double iconSize;

    switch (size) {
      case TwButtonSize.sm:
        vPad = TwSpace.p1_5;
        hPad = TwSpace.p3;
        fontSize = 12;
        iconSize = 14;
        break;
      case TwButtonSize.lg:
        vPad = TwSpace.p3_5;
        hPad = TwSpace.p6;
        fontSize = 16;
        iconSize = 20;
        break;
      case TwButtonSize.md:
        vPad = TwSpace.p2_5;
        hPad = TwSpace.p4;
        fontSize = 14;
        iconSize = 16;
        break;
    }

    final child = Row(
      mainAxisSize: isFullWidth ? MainAxisSize.max : MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (isLoading) ...[
          SizedBox(
            width: iconSize,
            height: iconSize,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              valueColor: AlwaysStoppedAnimation<Color>(fg),
            ),
          ),
          const SizedBox(width: TwSpace.p2),
        ] else if (icon != null) ...[
          Icon(icon, size: iconSize, color: fg),
          const SizedBox(width: TwSpace.p2),
        ],
        Text(
          label,
          style: GoogleFonts.outfit(
            fontSize: fontSize,
            fontWeight: FontWeight.w700,
            color: fg,
          ),
        ),
      ],
    );

    final borderRadius = BorderRadius.circular(TwRadius.xl);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: isLoading ? null : onPressed,
        borderRadius: borderRadius,
        child: Container(
          width: isFullWidth ? double.infinity : null,
          padding: EdgeInsets.symmetric(horizontal: hPad, vertical: vPad),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: borderRadius,
            border: border,
            boxShadow: variant == TwButtonVariant.primary ? TwShadows.sm : null,
          ),
          child: child,
        ),
      ),
    );
  }
}
