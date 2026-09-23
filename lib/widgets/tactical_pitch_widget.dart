import 'package:flutter/material.dart';
import '../theme/stitch_theme.dart';

class PitchPlayer {
  final int number;
  final String name;
  final String position;
  final double rating;
  final bool isHome;
  final double x; // 0.0 (left) to 1.0 (right)
  final double y; // 0.0 (top away) to 1.0 (bottom home)

  const PitchPlayer({
    required this.number,
    required this.name,
    required this.position,
    required this.rating,
    required this.isHome,
    required this.x,
    required this.y,
  });
}

class TacticalPitchWidget extends StatelessWidget {
  final String homeFormation;
  final String awayFormation;
  final List<PitchPlayer> players;
  final Function(PitchPlayer)? onPlayerTap;

  const TacticalPitchWidget({
    super.key,
    this.homeFormation = '4-3-3',
    this.awayFormation = '4-2-3-1',
    required this.players,
    this.onPlayerTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      height: 480,
      decoration: BoxDecoration(
        color: const Color(0xFF064E3B), // Deep tactical emerald green
        borderRadius: BorderRadius.circular(StitchRadius.lg),
        border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.15),
            blurRadius: 12,
            offset: const Offset(0, 4),
          )
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(StitchRadius.lg),
        child: Stack(
          children: [
            // 1. Pitch Lines Custom Painter
            CustomPaint(
              size: const Size(double.infinity, 480),
              painter: _PitchPainter(),
            ),

            // 2. Formation Badges
            Positioned(
              top: 12,
              left: 14,
              child: _formationBadge(awayFormation, isHome: false),
            ),
            Positioned(
              bottom: 12,
              left: 14,
              child: _formationBadge(homeFormation, isHome: true),
            ),

            // 3. Player Nodes on Pitch
            ...players.map((p) => _buildPlayerNode(context, p)),
          ],
        ),
      ),
    );
  }

  Widget _formationBadge(String formation, {required bool isHome}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(StitchRadius.full),
        border: Border.all(
          color: (isHome ? StitchColors.primaryContainer : StitchColors.secondaryFixed)
              .withValues(alpha: 0.6),
        ),
      ),
      child: Text(
        '${isHome ? "HOME" : "AWAY"} • $formation',
        style: StitchTypography.labelSm(color: Colors.white),
      ),
    );
  }

  Widget _buildPlayerNode(BuildContext context, PitchPlayer p) {
    final Color nodeBg = p.isHome ? StitchColors.primaryContainer : const Color(0xFF1E293B);
    final Color borderCol = p.isHome ? Colors.white : StitchColors.secondaryFixed;

    return Positioned(
      left: (p.x * 320).clamp(10.0, 310.0),
      top: (p.y * 420).clamp(20.0, 420.0),
      child: GestureDetector(
        onTap: () => onPlayerTap?.call(p),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Circular Node
            Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: nodeBg,
                border: Border.all(color: borderCol, width: 2),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.3),
                    blurRadius: 4,
                  )
                ],
              ),
              child: Center(
                child: Text(
                  p.number.toString(),
                  style: StitchTypography.labelSm(color: Colors.white).copyWith(
                    fontWeight: FontWeight.w900,
                    fontSize: 11,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 2),
            // Player Name Pill
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.65),
                borderRadius: BorderRadius.circular(StitchRadius.sm),
              ),
              child: Text(
                p.name,
                style: StitchTypography.labelSm(color: Colors.white).copyWith(fontSize: 9),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            // Rating pill
            if (p.rating > 0)
              Container(
                margin: const EdgeInsets.only(top: 1),
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 0.5),
                decoration: BoxDecoration(
                  color: p.rating >= 7.5 ? const Color(0xFF10B981) : const Color(0xFFF59E0B),
                  borderRadius: BorderRadius.circular(StitchRadius.full),
                ),
                child: Text(
                  p.rating.toStringAsFixed(1),
                  style: StitchTypography.labelSm(color: Colors.black).copyWith(
                    fontSize: 8,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _PitchPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final linePaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.25)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;

    // Grass Stripes background
    final stripePaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.03)
      ..style = PaintingStyle.fill;

    const int numStripes = 8;
    final stripeH = size.height / numStripes;
    for (int i = 0; i < numStripes; i += 2) {
      canvas.drawRect(Rect.fromLTWH(0, i * stripeH, size.width, stripeH), stripePaint);
    }

    // Outer boundary
    final pad = 12.0;
    final rect = Rect.fromLTWH(pad, pad, size.width - pad * 2, size.height - pad * 2);
    canvas.drawRect(rect, linePaint);

    // Halfway line
    final midY = size.height / 2;
    canvas.drawLine(Offset(pad, midY), Offset(size.width - pad, midY), linePaint);

    // Center circle
    final center = Offset(size.width / 2, midY);
    canvas.drawCircle(center, 40, linePaint);
    final dotPaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.4)
      ..style = PaintingStyle.fill;
    canvas.drawCircle(center, 3, dotPaint);

    // Penalty Areas (Top & Bottom)
    final boxW = size.width * 0.52;
    final boxH = 65.0;
    final boxX = (size.width - boxW) / 2;

    // Top penalty box
    canvas.drawRect(Rect.fromLTWH(boxX, pad, boxW, boxH), linePaint);
    // Top goal box
    final goalW = boxW * 0.5;
    final goalH = 26.0;
    canvas.drawRect(Rect.fromLTWH((size.width - goalW) / 2, pad, goalW, goalH), linePaint);

    // Bottom penalty box
    canvas.drawRect(Rect.fromLTWH(boxX, size.height - pad - boxH, boxW, boxH), linePaint);
    // Bottom goal box
    canvas.drawRect(Rect.fromLTWH((size.width - goalW) / 2, size.height - pad - goalH, goalW, goalH), linePaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
