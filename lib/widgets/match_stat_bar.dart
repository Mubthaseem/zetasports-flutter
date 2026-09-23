import 'package:flutter/material.dart';
import '../theme/stitch_theme.dart';

class MatchStatBar extends StatelessWidget {
  final String title;
  final String homeValue;
  final String awayValue;
  final double homeRatio; // 0.0 to 1.0 (portion for home)
  final Color homeColor;
  final Color awayColor;

  const MatchStatBar({
    super.key,
    required this.title,
    required this.homeValue,
    required this.awayValue,
    required this.homeRatio,
    this.homeColor = StitchColors.primaryContainer,
    this.awayColor = StitchColors.outlineVariant,
  });

  @override
  Widget build(BuildContext context) {
    final double safeRatio = homeRatio.clamp(0.05, 0.95);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6.0),
      child: Column(
        children: [
          // Stat values & label
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                homeValue,
                style: StitchTypography.metricMono(color: StitchColors.onSurface),
              ),
              Text(
                title,
                style: StitchTypography.labelMd(color: StitchColors.onSurfaceVariant),
              ),
              Text(
                awayValue,
                style: StitchTypography.metricMono(color: StitchColors.onSurface),
              ),
            ],
          ),
          const SizedBox(height: 5),
          // Dual progress bar
          ClipRRect(
            borderRadius: BorderRadius.circular(StitchRadius.sm),
            child: SizedBox(
              height: 6,
              child: Row(
                children: [
                  Expanded(
                    flex: (safeRatio * 100).toInt(),
                    child: Container(color: homeColor),
                  ),
                  const SizedBox(width: 2),
                  Expanded(
                    flex: ((1.0 - safeRatio) * 100).toInt(),
                    child: Container(color: awayColor),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
