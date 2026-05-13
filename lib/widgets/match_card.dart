import 'dart:async';
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/match_model.dart';
import '../theme/app_theme.dart';
import '../screens/match_detail_screen.dart';
import '../services/ad_service.dart';

class MatchCard extends StatelessWidget {
  final MatchModel match;
  final bool compact;
  const MatchCard({super.key, required this.match, this.compact = false});

  Color get _statusColor {
    switch (match.status) {
      case 'live': return AppTheme.red;
      case 'ht': return AppTheme.gold;
      case 'finished': return AppTheme.text3;
      default: return AppTheme.accent2;
    }
  }

  String _getDisplayName(String fullName, String shortName) {
    if (fullName.length > 11) return shortName;
    return fullName;
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        AdService.showInterstitial(context, () {
          Navigator.push(context,
            MaterialPageRoute(builder: (_) => MatchDetailScreen(matchId: match.id)));
        });
      },
      child: Container(
        margin: EdgeInsets.symmetric(horizontal: 16, vertical: compact ? 2 : 6),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: AppTheme.card,
          borderRadius: BorderRadius.circular(compact ? 0 : 14),
          border: compact ? null : Border.all(color: AppTheme.border),
        ),
        child: Row(
          children: [
            // Home team
            Expanded(
              child: Row(
                children: [
                  TeamCrestSmall(logoUrl: match.homeLogo, code: match.home),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      compact ? match.home : _getDisplayName(match.homeTeam, match.home),
                      style: TextStyle(
                        color: AppTheme.text1, fontSize: 13, fontWeight: FontWeight.w700),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),

            // Score/status
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              child: Column(
                children: [
                  Text(
                    match.scoreDisplay,
                    style: GoogleFonts.rajdhani(
                      fontSize: 18, fontWeight: FontWeight.w800,
                      color: AppTheme.text1, letterSpacing: 2,
                    ),
                  ),
                  CountdownTimer(match: match),
                ],
              ),
            ),

            // Away team
            Expanded(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Expanded(
                    child: Text(
                      compact ? match.away : _getDisplayName(match.awayTeam, match.away),
                      textAlign: TextAlign.right,
                      style: TextStyle(
                        color: AppTheme.text1, fontSize: 13, fontWeight: FontWeight.w700),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 8),
                  TeamCrestSmall(logoUrl: match.awayLogo, code: match.away),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class TeamCrestSmall extends StatelessWidget {
  final String? logoUrl;
  final String code;
  const TeamCrestSmall({super.key, this.logoUrl, required this.code});

  @override
  Widget build(BuildContext context) {
    if (logoUrl != null && logoUrl!.isNotEmpty) {
      return CachedNetworkImage(
        imageUrl: logoUrl!,
        width: 28, height: 28,
        fit: BoxFit.contain,
        errorWidget: (_, __, ___) => _InitialsCircle(code: code, size: 28),
      );
    }
    return _InitialsCircle(code: code, size: 28);
  }
}

class _InitialsCircle extends StatelessWidget {
  final String code;
  final double size;
  const _InitialsCircle({required this.code, required this.size});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size, height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: AppTheme.accentDim,
        border: Border.all(color: AppTheme.border2),
      ),
      child: Center(
        child: Text(
          code.length > 3 ? code.substring(0, 3) : code,
          style: TextStyle(
            color: AppTheme.accent2,
            fontSize: size * 0.3,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
    );
  }
}

class CountdownTimer extends StatefulWidget {
  final MatchModel match;
  const CountdownTimer({super.key, required this.match});

  @override
  State<CountdownTimer> createState() => _CountdownTimerState();
}

class _CountdownTimerState extends State<CountdownTimer> {
  Timer? _timer;
  String _timeText = '';

  @override
  void initState() {
    super.initState();
    _updateTime();
    if (widget.match.isUpcoming && widget.match.kickoffDateTime != null) {
      _timer = Timer.periodic(const Duration(seconds: 1), (_) => _updateTime());
    }
  }

  @override
  void didUpdateWidget(covariant CountdownTimer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.match.id != oldWidget.match.id || widget.match.status != oldWidget.match.status) {
      _timer?.cancel();
      _updateTime();
      if (widget.match.isUpcoming && widget.match.kickoffDateTime != null) {
        _timer = Timer.periodic(const Duration(seconds: 1), (_) => _updateTime());
      }
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _updateTime() {
    if (!mounted) return;
    
    if (widget.match.isLive) {
      setState(() => _timeText = '● LIVE ${widget.match.minute != null ? "· " + widget.match.minute! : ""}');
      return;
    }
    
    if (!widget.match.isUpcoming || widget.match.kickoffDateTime == null) {
      setState(() => _timeText = widget.match.statusDisplay);
      return;
    }

    final now = DateTime.now();
    final diff = widget.match.kickoffDateTime!.difference(now);

    if (diff.isNegative) {
      setState(() => _timeText = '● STARTING SOON');
    } else if (diff.inHours > 24) {
      setState(() => _timeText = widget.match.statusDisplay);
    } else {
      final h = diff.inHours;
      final m = diff.inMinutes % 60;
      final s = diff.inSeconds % 60;
      setState(() {
        _timeText = 'Starts in ${h.toString().padLeft(2, '0')}:${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
      });
    }
  }

  Color get _statusColor {
    if (_timeText.contains('Starts in') || _timeText == '● STARTING SOON') return AppTheme.accent;
    switch (widget.match.status) {
      case 'live': return AppTheme.red;
      case 'ht': return AppTheme.gold;
      case 'finished': return AppTheme.text3;
      default: return AppTheme.accent2;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Text(
      _timeText,
      style: TextStyle(
        color: _statusColor,
        fontSize: 9, 
        fontWeight: FontWeight.w700, 
        letterSpacing: .5,
      ),
    );
  }
}
