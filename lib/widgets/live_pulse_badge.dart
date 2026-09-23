import 'package:flutter/material.dart';
import '../theme/stitch_theme.dart';

class LivePulseBadge extends StatefulWidget {
  final String text;
  final Color dotColor;
  final Color bgColor;
  final Color textColor;
  final bool animate;

  const LivePulseBadge({
    super.key,
    this.text = 'LIVE',
    this.dotColor = StitchColors.secondary,
    this.bgColor = StitchColors.secondaryFixed,
    this.textColor = StitchColors.onSecondaryFixed,
    this.animate = true,
  });

  @override
  State<LivePulseBadge> createState() => _LivePulseBadgeState();
}

class _LivePulseBadgeState extends State<LivePulseBadge>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _scale;
  late Animation<double> _opacity;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    );

    _scale = Tween<double>(begin: 0.8, end: 1.8).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeOut),
    );

    _opacity = Tween<double>(begin: 0.9, end: 0.0).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeOut),
    );

    if (widget.animate) {
      _ctrl.repeat();
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: widget.bgColor,
        borderRadius: BorderRadius.circular(StitchRadius.full),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Pulsing Dot
          SizedBox(
            width: 8,
            height: 8,
            child: Stack(
              alignment: Alignment.center,
              children: [
                if (widget.animate)
                  AnimatedBuilder(
                    animation: _ctrl,
                    builder: (_, __) => Transform.scale(
                      scale: _scale.value,
                      child: Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: widget.dotColor.withValues(alpha: _opacity.value),
                        ),
                      ),
                    ),
                  ),
                Container(
                  width: 6,
                  height: 6,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: widget.dotColor,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 5),
          Text(
            widget.text,
            style: StitchTypography.labelSm(color: widget.textColor),
          ),
        ],
      ),
    );
  }
}
