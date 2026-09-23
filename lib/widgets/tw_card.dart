import 'package:flutter/material.dart';
import '../theme/tailwind_theme.dart';

class TwCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final VoidCallback? onTap;
  final Color? color;
  final Color? borderColor;
  final double? borderRadius;
  final List<BoxShadow>? boxShadow;
  final bool border;

  const TwCard({
    super.key,
    required this.child,
    this.padding,
    this.margin,
    this.onTap,
    this.color,
    this.borderColor,
    this.borderRadius,
    this.boxShadow,
    this.border = true,
  });

  @override
  Widget build(BuildContext context) {
    final cardBorderRadius = BorderRadius.circular(borderRadius ?? TwRadius.xl2);
    final cardColor = color ?? Colors.white;
    final cardBorder = border
        ? Border.all(
            color: borderColor ?? TwSlate.s200,
            width: 1,
          )
        : null;

    final container = Container(
      margin: margin,
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: cardBorderRadius,
        border: cardBorder,
        boxShadow: boxShadow ?? TwShadows.sm,
      ),
      child: ClipRRect(
        borderRadius: cardBorderRadius,
        child: Padding(
          padding: padding ?? const EdgeInsets.all(TwSpace.p4),
          child: child,
        ),
      ),
    );

    if (onTap != null) {
      return Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: cardBorderRadius,
          child: container,
        ),
      );
    }

    return container;
  }
}
