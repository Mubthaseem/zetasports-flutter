import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';
import 'package:cached_network_image/cached_network_image.dart';

// ─────────────────────────────────────────────────────────────────────────────
// ZETASPORTS UNIVERSAL SHIMMER & SKELETON LAZY LOADING SUITE
// ─────────────────────────────────────────────────────────────────────────────

/// Core Shimmer wrapper applying unified broadcast branding tones.
class ZetaShimmer extends StatelessWidget {
  final Widget child;
  final Color? baseColor;
  final Color? highlightColor;

  const ZetaShimmer({
    super.key,
    required this.child,
    this.baseColor,
    this.highlightColor,
  });

  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: baseColor ?? const Color(0xFFE2E8F0), // Slate 200
      highlightColor: highlightColor ?? const Color(0xFFF8FAFC), // Slate 50
      period: const Duration(milliseconds: 1400),
      child: child,
    );
  }
}

/// Primitive Skeleton Box with configurable dimensions and shape.
class ZetaSkeletonBox extends StatelessWidget {
  final double? width;
  final double height;
  final double borderRadius;
  final BoxShape shape;
  final Color? color;

  const ZetaSkeletonBox({
    super.key,
    this.width,
    required this.height,
    this.borderRadius = 8.0,
    this.shape = BoxShape.rectangle,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: color ?? Colors.white,
        shape: shape,
        borderRadius: shape == BoxShape.circle ? null : BorderRadius.circular(borderRadius),
      ),
    );
  }
}

/// Premium lazy-loaded image component with skeleton shimmer placeholder & error fallback.
class ZetaCachedImage extends StatelessWidget {
  final String imageUrl;
  final double? width;
  final double? height;
  final BoxFit fit;
  final double borderRadius;
  final BoxShape shape;
  final Widget? errorWidget;

  const ZetaCachedImage({
    super.key,
    required this.imageUrl,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
    this.borderRadius = 8.0,
    this.shape = BoxShape.rectangle,
    this.errorWidget,
  });

  @override
  Widget build(BuildContext context) {
    if (imageUrl.trim().isEmpty) {
      return _buildFallback();
    }

    return ClipRRect(
      borderRadius: shape == BoxShape.circle
          ? BorderRadius.circular(999)
          : BorderRadius.circular(borderRadius),
      child: CachedNetworkImage(
        imageUrl: imageUrl,
        width: width,
        height: height,
        fit: fit,
        placeholder: (context, url) => ZetaShimmer(
          child: ZetaSkeletonBox(
            width: width,
            height: height ?? 40,
            borderRadius: borderRadius,
            shape: shape,
          ),
        ),
        errorWidget: (context, url, error) => errorWidget ?? _buildFallback(),
      ),
    );
  }

  Widget _buildFallback() {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9),
        shape: shape,
        borderRadius: shape == BoxShape.circle ? null : BorderRadius.circular(borderRadius),
        border: Border.all(color: const Color(0xFFE2E8F0), width: 0.8),
      ),
      child: Center(
        child: Icon(
          Icons.sports_soccer_rounded,
          size: (height != null && height! > 0) ? (height! * 0.45).clamp(12.0, 28.0) : 18.0,
          color: const Color(0xFF94A3B8),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. HERO SPOTLIGHT CARD SKELETON
// ─────────────────────────────────────────────────────────────────────────────
class HeroCardSkeleton extends StatelessWidget {
  const HeroCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 14.0, vertical: 8.0),
      padding: const EdgeInsets.all(18.0),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24.0),
        border: Border.all(color: const Color(0xFFE2E8F0), width: 1.2),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: ZetaShimmer(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Top badge & tournament row
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: const [
                ZetaSkeletonBox(width: 80, height: 22, borderRadius: 12),
                ZetaSkeletonBox(width: 120, height: 18, borderRadius: 10),
              ],
            ),
            const SizedBox(height: 20),

            // Teams & Score row
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                // Home Team
                Column(
                  children: const [
                    ZetaSkeletonBox(width: 58, height: 58, shape: BoxShape.circle),
                    SizedBox(height: 10),
                    ZetaSkeletonBox(width: 75, height: 14, borderRadius: 6),
                  ],
                ),

                // Center Score Column
                Column(
                  children: const [
                    ZetaSkeletonBox(width: 70, height: 28, borderRadius: 8),
                    SizedBox(height: 8),
                    ZetaSkeletonBox(width: 48, height: 16, borderRadius: 10),
                  ],
                ),

                // Away Team
                Column(
                  children: const [
                    ZetaSkeletonBox(width: 58, height: 58, shape: BoxShape.circle),
                    SizedBox(height: 10),
                    ZetaSkeletonBox(width: 75, height: 14, borderRadius: 6),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 22),

            // Momentum split bar skeleton
            const ZetaSkeletonBox(width: double.infinity, height: 6, borderRadius: 3),
            const SizedBox(height: 16),

            // Bottom row (venue & viewer info)
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: const [
                ZetaSkeletonBox(width: 110, height: 14, borderRadius: 6),
                ZetaSkeletonBox(width: 85, height: 14, borderRadius: 6),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. MATCH CARD SKELETON (Used in Home & Scores List)
// ─────────────────────────────────────────────────────────────────────────────
class MatchCardSkeleton extends StatelessWidget {
  const MatchCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 14.0, vertical: 5.0),
      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 14.0),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18.0),
        border: Border.all(color: const Color(0xFFE2E8F0), width: 1.0),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: ZetaShimmer(
        child: Row(
          children: [
            // Left kickoff status pill
            const ZetaSkeletonBox(width: 50, height: 24, borderRadius: 12),
            const SizedBox(width: 14),

            // Middle: 2 Team rows
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: const [
                      ZetaSkeletonBox(width: 22, height: 22, shape: BoxShape.circle),
                      SizedBox(width: 10),
                      ZetaSkeletonBox(width: 110, height: 13, borderRadius: 6),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: const [
                      ZetaSkeletonBox(width: 22, height: 22, shape: BoxShape.circle),
                      SizedBox(width: 10),
                      ZetaSkeletonBox(width: 95, height: 13, borderRadius: 6),
                    ],
                  ),
                ],
              ),
            ),

            // Right CTA pill
            const ZetaSkeletonBox(width: 65, height: 32, borderRadius: 16),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. HIGHLIGHT REPLAY CARD SKELETON
// ─────────────────────────────────────────────────────────────────────────────
class HighlightCardSkeleton extends StatelessWidget {
  const HighlightCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 240,
      margin: const EdgeInsets.only(right: 14.0),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18.0),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: ZetaShimmer(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 16:9 Thumbnail
            ClipRRect(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(18.0)),
              child: Stack(
                alignment: Alignment.center,
                children: const [
                  ZetaSkeletonBox(width: double.infinity, height: 120, borderRadius: 0),
                  ZetaSkeletonBox(width: 36, height: 36, shape: BoxShape.circle),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(12.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  ZetaSkeletonBox(width: 170, height: 14, borderRadius: 6),
                  SizedBox(height: 6),
                  ZetaSkeletonBox(width: 100, height: 12, borderRadius: 6),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. STANDINGS TABLE SKELETON
// ─────────────────────────────────────────────────────────────────────────────
class StandingsTableSkeleton extends StatelessWidget {
  final int rows;
  const StandingsTableSkeleton({super.key, this.rows = 8});

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 14.0, vertical: 8.0),
      itemCount: rows,
      itemBuilder: (context, index) {
        return Container(
          height: 48,
          margin: const EdgeInsets.only(bottom: 8.0),
          padding: const EdgeInsets.symmetric(horizontal: 12.0),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14.0),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: ZetaShimmer(
            child: Row(
              children: const [
                ZetaSkeletonBox(width: 18, height: 18, borderRadius: 4),
                SizedBox(width: 12),
                ZetaSkeletonBox(width: 24, height: 24, shape: BoxShape.circle),
                SizedBox(width: 12),
                Expanded(child: ZetaSkeletonBox(height: 13, borderRadius: 6)),
                SizedBox(width: 20),
                ZetaSkeletonBox(width: 22, height: 14, borderRadius: 4),
                SizedBox(width: 12),
                ZetaSkeletonBox(width: 22, height: 14, borderRadius: 4),
                SizedBox(width: 12),
                ZetaSkeletonBox(width: 26, height: 14, borderRadius: 4),
              ],
            ),
          ),
        );
      },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. STREAM CARD SKELETON (Used in Watch Screen)
// ─────────────────────────────────────────────────────────────────────────────
class StreamCardSkeleton extends StatelessWidget {
  const StreamCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 6.0),
      padding: const EdgeInsets.all(14.0),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16.0),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: ZetaShimmer(
        child: Row(
          children: [
            const ZetaSkeletonBox(width: 44, height: 44, borderRadius: 12),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  ZetaSkeletonBox(width: 130, height: 14, borderRadius: 6),
                  SizedBox(height: 6),
                  ZetaSkeletonBox(width: 80, height: 12, borderRadius: 6),
                ],
              ),
            ),
            const ZetaSkeletonBox(width: 48, height: 22, borderRadius: 11),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. COMMENTARY & STATS SKELETON (Match Detail Tabs)
// ─────────────────────────────────────────────────────────────────────────────
class CommentarySkeleton extends StatelessWidget {
  const CommentarySkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      padding: const EdgeInsets.all(16.0),
      itemCount: 6,
      itemBuilder: (context, index) {
        return Padding(
          padding: const EdgeInsets.only(bottom: 18.0),
          child: ZetaShimmer(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const ZetaSkeletonBox(width: 38, height: 22, borderRadius: 6),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: const [
                      ZetaSkeletonBox(width: double.infinity, height: 14, borderRadius: 6),
                      SizedBox(height: 6),
                      ZetaSkeletonBox(width: 180, height: 12, borderRadius: 6),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class StatsSkeleton extends StatelessWidget {
  const StatsSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      padding: const EdgeInsets.all(16.0),
      itemCount: 7,
      itemBuilder: (context, index) {
        return Container(
          margin: const EdgeInsets.only(bottom: 12.0),
          padding: const EdgeInsets.all(14.0),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14.0),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: ZetaShimmer(
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: const [
                    ZetaSkeletonBox(width: 32, height: 16, borderRadius: 4),
                    ZetaSkeletonBox(width: 90, height: 14, borderRadius: 4),
                    ZetaSkeletonBox(width: 32, height: 16, borderRadius: 4),
                  ],
                ),
                const SizedBox(height: 10),
                const ZetaSkeletonBox(width: double.infinity, height: 6, borderRadius: 3),
              ],
            ),
          ),
        );
      },
    );
  }
}

class TacticalPitchSkeleton extends StatelessWidget {
  const TacticalPitchSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: ZetaShimmer(
        child: Container(
          height: 380,
          decoration: BoxDecoration(
            color: const Color(0xFF10B981).withOpacity(0.12),
            borderRadius: BorderRadius.circular(20.0),
            border: Border.all(color: const Color(0xFF10B981).withOpacity(0.3), width: 2),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: const [
                  ZetaSkeletonBox(width: 36, height: 36, shape: BoxShape.circle),
                  ZetaSkeletonBox(width: 36, height: 36, shape: BoxShape.circle),
                  ZetaSkeletonBox(width: 36, height: 36, shape: BoxShape.circle),
                ],
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: const [
                  ZetaSkeletonBox(width: 36, height: 36, shape: BoxShape.circle),
                  ZetaSkeletonBox(width: 36, height: 36, shape: BoxShape.circle),
                  ZetaSkeletonBox(width: 36, height: 36, shape: BoxShape.circle),
                ],
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: const [
                  ZetaSkeletonBox(width: 36, height: 36, shape: BoxShape.circle),
                  ZetaSkeletonBox(width: 36, height: 36, shape: BoxShape.circle),
                  ZetaSkeletonBox(width: 36, height: 36, shape: BoxShape.circle),
                  ZetaSkeletonBox(width: 36, height: 36, shape: BoxShape.circle),
                ],
              ),
              const Center(
                child: ZetaSkeletonBox(width: 36, height: 36, shape: BoxShape.circle),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
