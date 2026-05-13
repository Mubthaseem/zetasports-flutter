import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/match_model.dart';
import '../services/firestore_service.dart';
import '../theme/app_theme.dart';
import '../widgets/team_crest.dart';
import 'player_screen.dart';
import '../services/ad_service.dart';

class MatchDetailScreen extends StatefulWidget {
  final String matchId;
  const MatchDetailScreen({super.key, required this.matchId});

  @override
  State<MatchDetailScreen> createState() => _MatchDetailScreenState();
}

class _MatchDetailScreenState extends State<MatchDetailScreen> {
  final ValueNotifier<String> _countdown = ValueNotifier('');
  Timer? _countdownTimer;

  @override
  void dispose() {
    _countdownTimer?.cancel();
    super.dispose();
  }

  void _startCountdown(DateTime kickoff) {
    _countdownTimer?.cancel();
    _tick(kickoff);
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) => _tick(kickoff));
  }

  void _tick(DateTime kickoff) {
    final diff = kickoff.difference(DateTime.now());
    if (!mounted) return;
    if (diff.isNegative) {
      _countdown.value = '🟢 Starting!';
      _countdownTimer?.cancel();
      return;
    }
    final h = diff.inHours;
    final m = diff.inMinutes % 60;
    final s = diff.inSeconds % 60;
    _countdown.value =
        '${h.toString().padLeft(2,'0')}:${m.toString().padLeft(2,'0')}:${s.toString().padLeft(2,'0')}';
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'live': return AppTheme.red;
      case 'ht': return AppTheme.gold;
      case 'finished': return AppTheme.text3;
      default: return AppTheme.accent2;
    }
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<MatchModel?>(
      stream: FirestoreService.matchStream(widget.matchId),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return Scaffold(
            backgroundColor: AppTheme.bg,
            appBar: AppBar(backgroundColor: AppTheme.bg),
            body: Center(child: CircularProgressIndicator(color: AppTheme.accent)),
          );
        }
        final m = snapshot.data;
        if (m == null) {
          return Scaffold(
            backgroundColor: AppTheme.bg,
            appBar: AppBar(backgroundColor: AppTheme.bg),
            body: Center(child: Text('Match not found', style: TextStyle(color: AppTheme.text3))),
          );
        }

        // Start countdown for upcoming matches
        if (m.isUpcoming && m.kickoffDateTime != null && _countdown.value.isEmpty) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            _startCountdown(m.kickoffDateTime!);
          });
        }

        final scoreColor = _statusColor(m.status);

        return Scaffold(
          backgroundColor: AppTheme.bg,
          appBar: AppBar(
            backgroundColor: AppTheme.bg,
            title: Text('${m.homeTeam} vs ${m.awayTeam}',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppTheme.text1)),
            leading: IconButton(
              icon: Icon(Icons.arrow_back_ios, color: AppTheme.accent2),
              onPressed: () => Navigator.pop(context),
            ),
          ),
          body: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Hero score section
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [Color(0xFF0D1F4A), AppTheme.bg2],
                    ),
                  ),
                  child: Column(
                    children: [
                      Text('${m.leagueName.isEmpty ? m.leagueId : m.leagueName}',
                        style: TextStyle(color: AppTheme.text3, fontSize: 12, fontWeight: FontWeight.w600)),
                      const SizedBox(height: 16),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                        children: [
                          Expanded(child: Column(children: [
                            TeamCrest(logoUrl: m.homeLogo, code: m.home, size: 64),
                            const SizedBox(height: 8),
                            Text(m.homeTeam, textAlign: TextAlign.center,
                              style: TextStyle(color: AppTheme.text1, fontSize: 13, fontWeight: FontWeight.w700)),
                          ])),
                          Column(children: [
                            Text(
                              m.scoreDisplay,
                              style: GoogleFonts.rajdhani(
                                fontSize: 42, fontWeight: FontWeight.w800,
                                color: AppTheme.text1, letterSpacing: 6,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(m.statusDisplay, style: TextStyle(color: scoreColor, fontSize: 12, fontWeight: FontWeight.w700)),
                          ]),
                          Expanded(child: Column(children: [
                            TeamCrest(logoUrl: m.awayLogo, code: m.away, size: 64),
                            const SizedBox(height: 8),
                            Text(m.awayTeam, textAlign: TextAlign.center,
                              style: TextStyle(color: AppTheme.text1, fontSize: 13, fontWeight: FontWeight.w700)),
                          ])),
                        ],
                      ),
                    ],
                  ),
                ),

                // Countdown for upcoming
                ValueListenableBuilder<String>(
                  valueListenable: _countdown,
                  builder: (context, value, child) {
                    if (value.isEmpty || !m.isUpcoming) return const SizedBox.shrink();
                    return Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(colors: [
                          AppTheme.accent.withOpacity(0.1),
                          AppTheme.accent.withOpacity(0.05),
                        ]),
                        border: Border(
                          bottom: BorderSide(color: AppTheme.border),
                        ),
                      ),
                      child: Column(children: [
                        Text('⏱  KICKS OFF IN',
                          style: TextStyle(fontSize: 10, color: AppTheme.text3, fontWeight: FontWeight.w700, letterSpacing: 2)),
                        const SizedBox(height: 4),
                        Text(value,
                          style: GoogleFonts.rajdhani(
                            fontSize: 28, fontWeight: FontWeight.w800,
                            color: AppTheme.accent2, letterSpacing: 4,
                          )),
                      ]),
                    );
                  },
                ),

                // Info grid
                Container(
                  margin: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppTheme.card,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppTheme.border),
                  ),
                  child: GridView.count(
                    crossAxisCount: 2,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    childAspectRatio: 2.8,
                    children: [
                      _InfoItem(label: 'Date', value: m.kickoffDate.isEmpty ? '—' : m.kickoffDate),
                      _InfoItem(label: 'Kick-off IST', value: m.kickoffIST.isEmpty ? 'TBD' : m.kickoffIST),
                      _InfoItem(label: 'League', value: m.leagueName.isEmpty ? m.leagueId : m.leagueName),
                      _InfoItem(label: 'Status', value: m.status.toUpperCase()),
                    ],
                  ),
                ),

                // Match Preview
                if (m.preview != null && m.preview!.isNotEmpty) ...[
                  const _SectionTitle(title: '📋 Match Preview'),
                  Container(
                    margin: const EdgeInsets.symmetric(horizontal: 16),
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppTheme.card,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppTheme.border),
                    ),
                    child: Text(m.preview!,
                      style: TextStyle(color: AppTheme.text1, fontSize: 13, height: 1.9)),
                  ),
                  const SizedBox(height: 16),
                ],

                // Stream Servers
                if (m.servers.isNotEmpty) ...[
                  const _SectionTitle(title: '📡 Watch Streams'),
                  ...m.servers.map((s) => _ServerTile(server: s, match: m)),
                ],

                const SizedBox(height: 24),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _InfoItem extends StatelessWidget {
  final String label;
  final String value;
  const _InfoItem({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(label, style: TextStyle(fontSize: 10, color: AppTheme.text3, fontWeight: FontWeight.w600, letterSpacing: .5)),
          const SizedBox(height: 3),
          Text(value, style: TextStyle(fontSize: 13, color: AppTheme.text1, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  final String title;
  const _SectionTitle({required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 10),
      child: Text(title, style: TextStyle(
        fontSize: 13, fontWeight: FontWeight.w800, color: AppTheme.text2, letterSpacing: .5)),
    );
  }
}

class _ServerTile extends StatelessWidget {
  final ServerModel server;
  final MatchModel match;
  const _ServerTile({required this.server, required this.match});

  String get _icon {
    switch (server.type) {
      case 'm3u8': return '📺';
      case 'iframe': return '🖥️';
      case 'html': return '💻';
      default: return '🔗';
    }
  }

  String get _typeLabel {
    switch (server.type) {
      case 'm3u8': return 'M3U8';
      case 'iframe': return 'iFrame';
      case 'html': return 'HTML';
      default: return 'Link';
    }
  }

  @override
  Widget build(BuildContext context) {
    final isVIP = server.label.toUpperCase().contains('VIP') || server.label.toUpperCase().contains('PREMIUM');

    return GestureDetector(
      onTap: () {
        if (isVIP) {
          // Show Rewarded Ad for VIP servers
          AdService.showRewardedAd(
            context,
            onRewardEarned: () {
              Navigator.push(context, MaterialPageRoute(
                builder: (_) => PlayerScreen(server: server, match: match),
              ));
            },
            onClosed: () {
              // Optionally show a message if they closed early
            },
          );
        } else {
          // Show Interstitial for regular servers
          AdService.showInterstitial(context, () {
            Navigator.push(context, MaterialPageRoute(
              builder: (_) => PlayerScreen(server: server, match: match),
            ));
          });
        }
      },
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 5),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: AppTheme.card,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: isVIP ? AppTheme.gold.withOpacity(0.5) : AppTheme.border2, width: isVIP ? 2 : 1),
          boxShadow: isVIP ? [BoxShadow(color: AppTheme.gold.withOpacity(0.1), blurRadius: 8)] : null,
        ),
        child: Row(
          children: [
            Text(isVIP ? '💎' : _icon, style: const TextStyle(fontSize: 22)),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(server.label, style: TextStyle(
                        color: AppTheme.text1, fontSize: 14, fontWeight: FontWeight.w700)),
                      if (isVIP) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(color: AppTheme.gold, borderRadius: BorderRadius.circular(4)),
                          child: const Text('VIP', style: TextStyle(color: Colors.black, fontSize: 8, fontWeight: FontWeight.w900)),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(isVIP ? 'Watch a short ad to unlock' : _typeLabel, style: TextStyle(color: isVIP ? AppTheme.gold : AppTheme.text3, fontSize: 11)),
                ],
              ),
            ),
            Icon(isVIP ? Icons.lock_open_rounded : Icons.play_circle_outline, color: isVIP ? AppTheme.gold : AppTheme.accent, size: 28),
          ],
        ),
      ),
    );
  }
}
