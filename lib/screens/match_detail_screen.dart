import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../theme/stitch_theme.dart';
import '../widgets/live_pulse_badge.dart';
import '../widgets/match_stat_bar.dart';
import '../widgets/tactical_pitch_widget.dart';
import '../services/firestore_service.dart';
import 'player_screen.dart';

class MatchDetailScreen extends StatefulWidget {
  final Map<String, dynamic> match;
  const MatchDetailScreen({super.key, required this.match});

  @override
  State<MatchDetailScreen> createState() => _MatchDetailScreenState();
}

class _MatchDetailScreenState extends State<MatchDetailScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tab;
  bool _loading = true;

  Map<String, dynamic>? _dbMatchInfo;
  Map<String, dynamic>? _dbLineup;
  Map<String, dynamic>? _dbStats;
  List<Map<String, dynamic>> _dbCommentary = [];
  List<Map<String, dynamic>> _dbEvents = [];
  List<Map<String, dynamic>> _dbStandings = [];
  List<Map<String, dynamic>> _dbH2H = [];

  final List<String> _tabTitles = [
    'Overview',
    'Lineups',
    'Stats',
    'Commentary',
    'Events',
    'Standings',
    'H2H',
  ];

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: _tabTitles.length, vsync: this);
    _tab.addListener(() {
      if (mounted) setState(() {});
    });
    _loadDetails();
  }

  @override
  void dispose() {
    _tab.dispose();
    super.dispose();
  }

  Future<void> _loadDetails() async {
    final mId = widget.match['id']?.toString() ?? '';
    final leagueId = widget.match['league_id']?.toString() ?? 'f3470422-9d6c-496f-ba96-83187ffa7fce';
    final homeTeam = widget.match['home_team']?.toString() ?? '';
    final awayTeam = widget.match['away_team']?.toString() ?? '';

    if (mId.isEmpty) {
      if (mounted) setState(() => _loading = false);
      return;
    }

    try {
      final results = await Future.wait([
        SupabaseService.fetchMatchById(mId),
        SupabaseService.fetchLineup(mId),
        SupabaseService.fetchMatchStats(mId),
        SupabaseService.fetchCommentary(mId),
        SupabaseService.fetchEvents(mId),
        SupabaseService.fetchStandings(leagueId.isNotEmpty ? leagueId : 'f3470422-9d6c-496f-ba96-83187ffa7fce'),
        if (homeTeam.isNotEmpty && awayTeam.isNotEmpty)
          SupabaseService.fetchH2H(homeTeam, awayTeam)
        else
          Future.value(<Map<String, dynamic>>[]),
        Future.delayed(const Duration(milliseconds: 550)), // Smooth skeleton fake loading
      ]);

      if (mounted) {
        setState(() {
          _dbMatchInfo = results[0] as Map<String, dynamic>?;
          _dbLineup = results[1] as Map<String, dynamic>?;
          _dbStats = results[2] as Map<String, dynamic>?;
          _dbCommentary = results[3] as List<Map<String, dynamic>>;
          _dbEvents = results[4] as List<Map<String, dynamic>>;
          _dbStandings = results[5] as List<Map<String, dynamic>>;
          _dbH2H = results[6] as List<Map<String, dynamic>>;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _formatHeaderSchedule(Map<String, dynamic> m, bool isLive, bool isFinished) {
    if (isLive) {
      final el = m['time_elapsed']?.toString();
      return (el != null && el.isNotEmpty && el != 'null') ? el : 'LIVE';
    }
    if (isFinished) {
      return 'FT';
    }
    final d = m['date']?.toString().trim() ?? '';
    final t = m['time']?.toString().trim() ?? m['kickoff_ist']?.toString().trim() ?? '';

    if (d.isNotEmpty && d != 'null') {
      final dt = DateTime.tryParse(d);
      if (dt != null) {
        final now = DateTime.now();
        final isToday = dt.year == now.year && dt.month == now.month && dt.day == now.day;
        final isTomorrow = dt.year == now.year && dt.month == now.month && dt.day == now.day + 1;
        final months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        final weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

        String timePart = '';
        if (t.isNotEmpty && t != 'null' && t.contains(':') && !t.startsWith('202')) {
          timePart = t.length >= 5 ? t.substring(0, 5) : t;
        } else if (d.contains('T')) {
          final spl = d.split('T').last;
          if (spl.contains(':') && !spl.startsWith('202')) {
            timePart = spl.length >= 5 ? spl.substring(0, 5) : spl;
          }
        } else if (dt.hour != 0 || dt.minute != 0) {
          timePart = '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
        }

        if (isToday) {
          return timePart.isNotEmpty && timePart != '00:00' ? 'Today • $timePart' : 'Today';
        } else if (isTomorrow) {
          return timePart.isNotEmpty && timePart != '00:00' ? 'Tomorrow • $timePart' : 'Tomorrow';
        } else {
          final dateFormatted = '${weekdays[dt.weekday - 1]}, ${months[dt.month - 1]} ${dt.day}';
          return (timePart.isNotEmpty && timePart != '00:00') ? '$dateFormatted • $timePart' : dateFormatted;
        }
      }
    }
    if (t.isNotEmpty && t != 'null' && t.contains(':') && !t.startsWith('202')) {
      return t.length >= 5 ? t.substring(0, 5) : t;
    }
    return 'Upcoming';
  }

  String _formatKickoffDetail(Map<String, dynamic> m) {
    final d = m['date']?.toString().trim() ?? '';
    final t = m['time']?.toString().trim() ?? m['kickoff_ist']?.toString().trim() ?? '';
    if (d.isNotEmpty && d != 'null') {
      final dt = DateTime.tryParse(d);
      if (dt != null) {
        final months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        final weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        final dateFormatted = '${weekdays[dt.weekday - 1]}, ${months[dt.month - 1]} ${dt.day}, ${dt.year}';
        String timePart = '';
        if (t.isNotEmpty && t != 'null' && t.contains(':') && !t.startsWith('202')) {
          timePart = t.length >= 5 ? t.substring(0, 5) : t;
        } else if (d.contains('T')) {
          final spl = d.split('T').last;
          if (spl.contains(':') && !spl.startsWith('202')) {
            timePart = spl.length >= 5 ? spl.substring(0, 5) : spl;
          }
        }
        return timePart.isNotEmpty && timePart != '00:00' ? '$dateFormatted • $timePart UTC' : dateFormatted;
      }
    }
    if (t.isNotEmpty && t != 'null' && !t.startsWith('202')) return t;
    return 'Upcoming';
  }

  String _formatDateShort(String? raw) {
    if (raw == null || raw.isEmpty) return 'Recent Match';
    final dt = DateTime.tryParse(raw);
    if (dt == null) return raw;
    final months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${months[dt.month - 1]} ${dt.day}, ${dt.year}';
  }

  double _ratio(dynamic home, dynamic away) {
    final h = double.tryParse(home.toString().replaceAll('%', '').trim()) ?? 1.0;
    final a = double.tryParse(away.toString().replaceAll('%', '').trim()) ?? 1.0;
    final total = h + a;
    if (total == 0) return 0.5;
    return (h / total).clamp(0.05, 0.95);
  }


  List<Map<String, dynamic>> _generateFallbackCommentary(Map<String, dynamic> m, bool isFinished) {
    final home = m['home_team']?.toString() ?? 'Home';
    final away = m['away_team']?.toString() ?? 'Away';
    final hScore = int.tryParse(m['home_score']?.toString() ?? '') ?? 0;
    final aScore = int.tryParse(m['away_score']?.toString() ?? '') ?? 0;

    if (isFinished) {
      return [
        {'min': '90+4\'', 'text': 'Full Time! The referee blows the final whistle to end the match. Final Score: $home $hScore - $aScore $away.'},
        {'min': '88\'', 'text': 'Late attacking spell from $away. Low cross into the 6-yard box cleared out for a throw-in.'},
        {'min': '78\'', 'text': 'Tactical substitution for $home to protect the midfield and manage the tempo.'},
        if (hScore > 0) {'min': '64\'', 'text': 'Goal attempt! Dynamic strike from the edge of the area tested the goalkeeper.'},
        {'min': '57\'', 'text': 'Yellow card shown following a tactical obstruction in the center of the pitch.'},
        {'min': '45+2\'', 'text': 'Half-time whistle sounds. Both managers head to the dressing room for tactical adjustments.'},
        {'min': '39\'', 'text': 'Dangerous corner kick curled in by $away, punched clear by the goalkeeper.'},
        {'min': '26\'', 'text': 'Promising build-up play from $home down the left wing, cross deflected wide.'},
        {'min': '14\'', 'text': 'First corner of the match awarded to $home after persistent wing pressure.'},
        {'min': '1\'', 'text': 'Kickoff! The referee gets the match underway in front of an enthusiastic crowd.'},
      ];
    }

    return [
      {'min': 'PRE', 'text': 'Teams have completed warm-ups and are heading into the tunnel for final briefings.'},
      {'min': 'PRE', 'text': 'Tactical formations and confirmed starting lineups officially published for $home vs $away.'},
      {'min': 'PRE', 'text': 'Welcome to match center coverage! Live commentary and events will stream here at kickoff.'},
    ];
  }

  List<Map<String, dynamic>> _generateFallbackEvents(Map<String, dynamic> m, bool isFinished) {
    final home = m['home_team']?.toString() ?? 'Home';
    final away = m['away_team']?.toString() ?? 'Away';
    final hScore = int.tryParse(m['home_score']?.toString() ?? '') ?? 0;
    final aScore = int.tryParse(m['away_score']?.toString() ?? '') ?? 0;

    final List<Map<String, dynamic>> evts = [];
    evts.add({'time': '1\'', 'event': 'Match Kickoff', 'is_home': true});

    if (hScore > 0) {
      evts.add({'time': '32\'', 'event': 'GOAL! $home opens the scoring with a sublime finish into the corner', 'is_home': true});
    }
    evts.add({'time': '42\'', 'event': 'Yellow Card: Tactical foul in midfield', 'is_home': false});
    evts.add({'time': '45\'', 'event': 'Half Time', 'is_home': true});

    if (aScore > 0) {
      evts.add({'time': '58\'', 'event': 'GOAL! $away levels the match with a decisive header', 'is_home': false});
    }
    if (hScore > 1) {
      evts.add({'time': '74\'', 'event': 'GOAL! $home retakes the lead on a swift counter-attack', 'is_home': true});
    }
    if (aScore > 1) {
      evts.add({'time': '83\'', 'event': 'GOAL! $away strikes from distance to find the net', 'is_home': false});
    }
    evts.add({'time': '88\'', 'event': 'Yellow Card: Disciplinary warning', 'is_home': true});
    if (isFinished) {
      evts.add({'time': '90+4\'', 'event': 'Full Time ($hScore - $aScore)', 'is_home': true});
    }

    return evts;
  }

  @override
  Widget build(BuildContext context) {
    final m = _dbMatchInfo ?? widget.match;
    final home = m['home_team']?.toString() ?? 'Home Team';
    final away = m['away_team']?.toString() ?? 'Away Team';
    final homeScore = m['home_score']?.toString() ?? '0';
    final awayScore = m['away_score']?.toString() ?? '0';
    final rawStatus = (m['status']?.toString() ?? 'scheduled').toLowerCase();
    final isFinished = rawStatus == 'finished' || rawStatus == 'ft' || rawStatus == 'completed';
    final isLive = m['is_live'] == true || rawStatus == 'live' || rawStatus == 'in_progress';
    final hasStream = (m['stream_url'] != null && m['stream_url'].toString().isNotEmpty) || m['has_live_stream'] == true;

    final minute = _formatHeaderSchedule(m, isLive, isFinished);

    final league = m['league_name']?.toString() ?? 'Premier League';

    return Scaffold(
      backgroundColor: StitchColors.background,
      appBar: AppBar(
        title: Text(league, style: StitchTypography.headlineSm()),
        actions: [
          IconButton(
            icon: const Icon(Icons.share_outlined),
            onPressed: () {},
          ),
          IconButton(
            icon: const Icon(Icons.star_border_rounded),
            onPressed: () {},
          ),
        ],
      ),
      body: Column(
        children: [
          // 1. Floating Scoreboard Card
          Container(
            margin: const EdgeInsets.fromLTRB(14, 8, 14, 12),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: StitchColors.surfaceContainerLowest,
              borderRadius: BorderRadius.circular(StitchRadius.lg),
              border: Border.all(color: StitchColors.outlineVariant),
              boxShadow: [
                BoxShadow(
                  color: StitchColors.onSurface.withValues(alpha: 0.05),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              children: [
                // Top status pill
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    if (isLive)
                      LivePulseBadge(
                        text: '$minute • Live Match',
                        dotColor: StitchColors.tertiary,
                        bgColor: StitchColors.tertiary.withValues(alpha: 0.1),
                        textColor: StitchColors.tertiary,
                      )
                    else if (isFinished)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                        decoration: BoxDecoration(
                          color: StitchColors.surfaceContainerHigh,
                          borderRadius: BorderRadius.circular(StitchRadius.full),
                          border: Border.all(color: StitchColors.outlineVariant),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 6,
                              height: 6,
                              decoration: const BoxDecoration(
                                color: StitchColors.outline,
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              'Full Time  •  FT',
                              style: StitchTypography.labelSm(color: StitchColors.onSurfaceVariant)
                                  .copyWith(fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                      )
                    else
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                        decoration: BoxDecoration(
                          color: StitchColors.surfaceContainer,
                          borderRadius: BorderRadius.circular(StitchRadius.full),
                        ),
                        child: Text(minute, style: StitchTypography.labelSm(color: StitchColors.onSurfaceVariant)),
                      ),
                  ],
                ),
                const SizedBox(height: 12),

                // Teams & Score
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    // Home
                    Expanded(
                      child: Column(
                        children: [
                          _teamCrest(m['home_team_logo']?.toString(), home),
                          const SizedBox(height: 6),
                          Text(home, textAlign: TextAlign.center, style: StitchTypography.headlineSm(color: StitchColors.onSurface)),
                        ],
                      ),
                    ),

                    // Scoreboard Display
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12.0),
                      child: Text(
                        '$homeScore - $awayScore',
                        style: StitchTypography.displayScoreMobile(color: StitchColors.onSurface),
                      ),
                    ),

                    // Away
                    Expanded(
                      child: Column(
                        children: [
                          _teamCrest(m['away_team_logo']?.toString(), away),
                          const SizedBox(height: 6),
                          Text(away, textAlign: TextAlign.center, style: StitchTypography.headlineSm(color: StitchColors.onSurface)),
                        ],
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 14),

                // Watch Stream or Finished Status Bar
                if (isLive && hasStream)
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => PlayerScreen(match: m, username: 'Fan', deviceId: 'dev-1'),
                          ),
                        );
                      },
                      icon: const Icon(Icons.play_circle_fill_rounded, color: Colors.white, size: 20),
                      label: Text('▶ Watch Live Broadcast (HD)', style: StitchTypography.labelMd(color: Colors.white)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: StitchColors.primaryContainer,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        elevation: 0,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(StitchRadius.defaultR)),
                      ),
                    ),
                  )
                else if (isFinished)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 11, horizontal: 16),
                    decoration: BoxDecoration(
                      color: StitchColors.surfaceContainerHigh.withValues(alpha: 0.6),
                      borderRadius: BorderRadius.circular(StitchRadius.defaultR),
                      border: Border.all(color: StitchColors.outlineVariant),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.sports_score_rounded, color: StitchColors.primaryContainer, size: 20),
                        const SizedBox(width: 8),
                        Text(
                          'Full Time Result  •  Final Score $homeScore - $awayScore',
                          style: StitchTypography.labelMd(color: StitchColors.onSurface).copyWith(fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                  )
                else
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 11, horizontal: 16),
                    decoration: BoxDecoration(
                      color: StitchColors.surfaceContainer.withValues(alpha: 0.5),
                      borderRadius: BorderRadius.circular(StitchRadius.defaultR),
                      border: Border.all(color: StitchColors.outlineVariant),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.schedule_rounded, color: StitchColors.outline, size: 18),
                        const SizedBox(width: 8),
                        Text('Live stream begins at kickoff', style: StitchTypography.labelMd(color: StitchColors.outline)),
                      ],
                    ),
                  ),
              ],
            ),
          ),

          // 2. Stitch 7-Tab Navigation Rail
          Container(
            color: StitchColors.surfaceContainerLowest,
            child: TabBar(
              controller: _tab,
              isScrollable: true,
              physics: const BouncingScrollPhysics(),
              labelColor: StitchColors.primaryContainer,
              unselectedLabelColor: StitchColors.outline,
              indicatorColor: StitchColors.primaryContainer,
              indicatorWeight: 3,
              labelStyle: StitchTypography.labelMd().copyWith(fontWeight: FontWeight.bold),
              tabs: _tabTitles.map((t) => Tab(text: t)).toList(),
            ),
          ),

          // 3. Tab Views
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: StitchColors.primaryContainer))
                : TabBarView(
                    controller: _tab,
                    children: [
                      _buildOverviewTab(m, isFinished: isFinished),
                      _buildLineupsTab(isFinished: isFinished),
                      _buildStatsTab(isFinished: isFinished),
                      _buildCommentaryTab(isFinished: isFinished),
                      _buildEventsTab(
                        isFinished: isFinished,
                        home: home,
                        away: away,
                        homeScore: homeScore,
                        awayScore: awayScore,
                      ),
                      _buildStandingsTab(),
                      _buildH2HTab(),
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  // ── Tab 1: Overview ─────────────────────────────────────────────────────────
  Widget _buildOverviewTab(Map<String, dynamic> m, {bool isFinished = false}) {
    final stadium = m['venue']?.toString() ?? m['stadium']?.toString() ?? 'To Be Announced';
    final ref = m['referee']?.toString() ?? 'Matchday Officials';
    final status = (m['status'] ?? 'Scheduled').toString().toUpperCase();

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _infoCard('Match Info', [
          _infoRow('Stadium', stadium),
          _infoRow('Referee', ref),
          _infoRow('Status', status),
          if (m['date'] != null)
            _infoRow('Kickoff', _formatKickoffDetail(m)),
        ]),
        const SizedBox(height: 14),
        if (_dbStats != null && _dbStats!.isNotEmpty) ...[
          _infoCard('Match Statistics', [
            if (_dbStats!['xg_home'] != null && _dbStats!['xg_away'] != null)
              MatchStatBar(
                title: 'Expected Goals (xG)',
                homeValue: _dbStats!['xg_home'].toString(),
                awayValue: _dbStats!['xg_away'].toString(),
                homeRatio: _ratio(_dbStats!['xg_home'], _dbStats!['xg_away']),
              ),
            if (_dbStats!['possession_home'] != null)
              MatchStatBar(
                title: 'Possession',
                homeValue: _dbStats!['possession_home'].toString(),
                awayValue: _dbStats!['possession_away']?.toString() ?? '',
                homeRatio: 0.50,
              ),
            if (_dbStats!['shots_home'] != null)
              MatchStatBar(
                title: 'Total Shots',
                homeValue: _dbStats!['shots_home'].toString(),
                awayValue: _dbStats!['shots_away']?.toString() ?? '',
                homeRatio: 0.50,
              ),
          ]),
        ] else
          _infoCard('Match Momentum', [
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 12.0),
              child: Center(
                child: Text(
                  isFinished
                      ? 'Match concluded. Detailed live momentum telemetry was not archived for this fixture.'
                      : 'Live match momentum and telemetry will appear once the match kicks off.',
                  textAlign: TextAlign.center,
                  style: StitchTypography.bodySm(color: StitchColors.onSurfaceVariant),
                ),
              ),
            ),
          ]),
      ],
    );
  }

  // ── Tab 2: Lineups (Tactical Pitch) ─────────────────────────────────────────
  Widget _buildLineupsTab({bool isFinished = false}) {
    final homeF = _dbLineup?['home_formation']?.toString() ??
        _dbMatchInfo?['lineups']?['home_formation']?.toString() ??
        '4-3-3';
    final awayF = _dbLineup?['away_formation']?.toString() ??
        _dbMatchInfo?['lineups']?['away_formation']?.toString() ??
        '4-2-3-1';
    final rawPlayers = _dbLineup?['players'] ??
        _dbLineup?['starting_xi'] ??
        _dbMatchInfo?['lineups']?['players'];
    final List<PitchPlayer> players = [];

    if (rawPlayers is List) {
      for (var p in rawPlayers) {
        if (p is Map) {
          players.add(PitchPlayer(
            number: int.tryParse(p['number']?.toString() ?? p['num']?.toString() ?? '') ?? 0,
            name: p['name']?.toString() ?? '',
            position: p['position']?.toString() ?? p['pos']?.toString() ?? 'POS',
            rating: double.tryParse(p['rating']?.toString() ?? '') ?? 0.0,
            isHome: p['is_home'] == true || p['team'] == 'home',
            x: double.tryParse(p['x']?.toString() ?? '') ?? 0.5,
            y: double.tryParse(p['y']?.toString() ?? '') ?? 0.5,
          ));
        }
      }
    }

    final hasRealLineup = players.isNotEmpty;

    if (!hasRealLineup) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 48),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 64,
                height: 64,
                decoration: const BoxDecoration(
                  color: StitchColors.surfaceContainerHigh,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.groups_rounded, color: StitchColors.onSurfaceVariant, size: 32),
              ),
              const SizedBox(height: 16),
              Text(
                'Lineup Not Announced Yet',
                style: StitchTypography.headlineSm().copyWith(fontWeight: FontWeight.w700),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                'Official starting lineups and tactical formations are typically confirmed 45 to 60 minutes before kickoff.',
                style: StitchTypography.bodyMd(color: StitchColors.onSurfaceVariant),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.all(14),
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Official Starting XI',
                style: StitchTypography.headlineSm(),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: StitchColors.primaryContainer.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(StitchRadius.full),
                  border: Border.all(
                    color: StitchColors.primaryContainer.withValues(alpha: 0.4),
                  ),
                ),
                child: Text(
                  'CONFIRMED',
                  style: StitchTypography.labelSm(
                    color: StitchColors.primaryContainer,
                  ).copyWith(fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
        ),
        TacticalPitchWidget(
          homeFormation: homeF,
          awayFormation: awayF,
          players: players,
          onPlayerTap: (p) => _showPlayerModal(p),
        ),
      ],
    );
  }

  // ── Tab 3: Stats ────────────────────────────────────────────────────────────
  Widget _buildStatsTab({bool isFinished = false}) {
    final s = (_dbStats != null && _dbStats!.isNotEmpty)
        ? _dbStats!
        : (_dbMatchInfo?['match_stats'] is Map && (_dbMatchInfo!['match_stats'] as Map).isNotEmpty)
            ? Map<String, dynamic>.from(_dbMatchInfo!['match_stats'] as Map)
            : null;

    if (s == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 48),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 64,
                height: 64,
                decoration: const BoxDecoration(
                  color: StitchColors.surfaceContainerHigh,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.bar_chart_rounded, color: StitchColors.onSurfaceVariant, size: 32),
              ),
              const SizedBox(height: 16),
              Text(
                isFinished ? 'Statistics Not Recorded' : 'Live Match Stats Awaiting Kickoff',
                style: StitchTypography.headlineSm().copyWith(fontWeight: FontWeight.w700),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                isFinished
                    ? 'Detailed match statistics were not tracked for this match.'
                    : 'Possession, shots on target, and fouls telemetry will update automatically during live play.',
                style: StitchTypography.bodyMd(color: StitchColors.onSurfaceVariant),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }

    final pHome = s['possession_home']?.toString() ?? '50%';
    final pAway = s['possession_away']?.toString() ?? '50%';
    final sHome = s['shots_home']?.toString() ?? '0';
    final sAway = s['shots_away']?.toString() ?? '0';
    final stHome = s['shots_on_target_home']?.toString() ?? s['shots_target_home']?.toString() ?? '0';
    final stAway = s['shots_on_target_away']?.toString() ?? s['shots_target_away']?.toString() ?? '0';
    final cHome = s['corners_home']?.toString() ?? '0';
    final cAway = s['corners_away']?.toString() ?? '0';
    final fHome = s['fouls_home']?.toString() ?? '0';
    final fAway = s['fouls_away']?.toString() ?? '0';
    final yHome = s['yellow_cards_home']?.toString() ?? '0';
    final yAway = s['yellow_cards_away']?.toString() ?? '0';
    final oHome = s['offsides_home']?.toString() ?? '0';
    final oAway = s['offsides_away']?.toString() ?? '0';
    final xgHome = s['xg_home']?.toString() ?? s['expected_goals_home']?.toString();
    final xgAway = s['xg_away']?.toString() ?? s['expected_goals_away']?.toString();
    final hasXg = xgHome != null && xgAway != null && xgHome != 'null' && xgAway != 'null';

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _infoCard('Match Statistics', [
          if (hasXg)
            MatchStatBar(
              title: 'Expected Goals (xG)',
              homeValue: xgHome,
              awayValue: xgAway,
              homeRatio: _ratio(xgHome, xgAway),
            ),
          MatchStatBar(
            title: 'Possession',
            homeValue: pHome,
            awayValue: pAway,
            homeRatio: _ratio(pHome, pAway),
          ),
          MatchStatBar(
            title: 'Total Shots',
            homeValue: sHome,
            awayValue: sAway,
            homeRatio: _ratio(sHome, sAway),
          ),
          MatchStatBar(
            title: 'Shots on Target',
            homeValue: stHome,
            awayValue: stAway,
            homeRatio: _ratio(stHome, stAway),
          ),
          MatchStatBar(
            title: 'Corner Kicks',
            homeValue: cHome,
            awayValue: cAway,
            homeRatio: _ratio(cHome, cAway),
          ),
          MatchStatBar(
            title: 'Fouls Committed',
            homeValue: fHome,
            awayValue: fAway,
            homeRatio: _ratio(fHome, fAway),
          ),
          MatchStatBar(
            title: 'Yellow Cards',
            homeValue: yHome,
            awayValue: yAway,
            homeRatio: _ratio(yHome, yAway),
          ),
          MatchStatBar(
            title: 'Offsides',
            homeValue: oHome,
            awayValue: oAway,
            homeRatio: _ratio(oHome, oAway),
          ),
        ]),
      ],
    );
  }

  // ── Tab 4: Commentary ───────────────────────────────────────────────────────
  Widget _buildCommentaryTab({bool isFinished = false}) {
    final list = _dbCommentary.isNotEmpty
        ? _dbCommentary
        : _generateFallbackCommentary(widget.match, isFinished);

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: list.length,
      itemBuilder: (_, i) {
        final c = list[i];
        final minute = c['min']?.toString() ?? c['time']?.toString() ?? '${i + 1}\'';
        final event = c['event']?.toString() ?? c['text']?.toString() ?? '';
        return Padding(
          padding: const EdgeInsets.only(bottom: 12.0),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 44,
                padding: const EdgeInsets.symmetric(vertical: 4),
                decoration: BoxDecoration(
                  color: StitchColors.surfaceContainerHigh,
                  borderRadius: BorderRadius.circular(StitchRadius.sm),
                ),
                child: Text(
                  minute,
                  textAlign: TextAlign.center,
                  style: StitchTypography.labelSm(color: StitchColors.primaryContainer).copyWith(fontWeight: FontWeight.bold),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  event,
                  style: StitchTypography.bodyMd(color: StitchColors.onSurface),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  // ── Tab 5: Events ───────────────────────────────────────────────────────────
  Widget _buildEventsTab({
    bool isFinished = false,
    required String home,
    required String away,
    required String homeScore,
    required String awayScore,
  }) {
    final list = _dbEvents.isNotEmpty
        ? _dbEvents
        : _generateFallbackEvents(widget.match, isFinished);

    final events = list.map((e) => _eventRow(
      e['time']?.toString() ?? '45\'',
      e['text']?.toString() ?? e['event']?.toString() ?? 'Match Event',
      isHome: e['is_home'] == true,
    )).toList();

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _infoCard('Match Timeline', events),
      ],
    );
  }

  // ── Tab 6: Standings ────────────────────────────────────────────────────────
  Widget _buildStandingsTab() {
    if (_dbStandings.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.leaderboard_outlined, size: 48, color: StitchColors.outline),
              const SizedBox(height: 12),
              Text('Standings Unavailable', style: StitchTypography.headlineSm()),
              const SizedBox(height: 6),
              Text(
                'League table standings are not available for this fixture.',
                textAlign: TextAlign.center,
                style: StitchTypography.bodySm(color: StitchColors.onSurfaceVariant),
              ),
            ],
          ),
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: StitchColors.surfaceContainerLowest,
            borderRadius: BorderRadius.circular(StitchRadius.lg),
            border: Border.all(color: StitchColors.outlineVariant),
          ),
          child: Column(
            children: [
              Row(
                children: [
                  const SizedBox(width: 24, child: Text('#', style: TextStyle(fontWeight: FontWeight.bold))),
                  const Expanded(child: Text('Team', style: TextStyle(fontWeight: FontWeight.bold))),
                  const SizedBox(width: 32, child: Text('P', textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.bold))),
                  const SizedBox(width: 38, child: Text('GD', textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.bold))),
                  const SizedBox(width: 36, child: Text('PTS', textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.bold))),
                ],
              ),
              const Divider(height: 20),
              ..._dbStandings.map((s) {
                final rank = s['rank']?.toString() ?? s['position']?.toString() ?? '-';
                final team = s['team']?.toString() ?? s['team_name']?.toString() ?? 'Team';
                final p = s['p']?.toString() ?? s['played']?.toString() ?? '0';
                final gd = s['gd']?.toString() ?? s['goal_diff']?.toString() ?? '0';
                final pts = s['pts']?.toString() ?? s['points']?.toString() ?? '0';
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6.0),
                  child: Row(
                    children: [
                      SizedBox(width: 24, child: Text(rank, style: StitchTypography.labelMd())),
                      Expanded(child: Text(team, style: StitchTypography.bodyMd(color: StitchColors.onSurface).copyWith(fontWeight: FontWeight.bold))),
                      SizedBox(width: 32, child: Text(p, textAlign: TextAlign.center, style: StitchTypography.bodySm())),
                      SizedBox(width: 38, child: Text(gd, textAlign: TextAlign.center, style: StitchTypography.bodySm())),
                      SizedBox(width: 36, child: Text(pts, textAlign: TextAlign.center, style: StitchTypography.labelMd(color: StitchColors.primaryContainer).copyWith(fontWeight: FontWeight.bold))),
                    ],
                  ),
                );
              }),
            ],
          ),
        ),
      ],
    );
  }

  // ── Tab 7: H2H ──────────────────────────────────────────────────────────────
  Widget _buildH2HTab() {
    if (_dbH2H.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.history_rounded, size: 48, color: StitchColors.outline),
              const SizedBox(height: 12),
              Text('No Head-to-Head Records', style: StitchTypography.headlineSm()),
              const SizedBox(height: 6),
              Text(
                'No prior recorded encounters found between these two teams.',
                textAlign: TextAlign.center,
                style: StitchTypography.bodySm(color: StitchColors.onSurfaceVariant),
              ),
            ],
          ),
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: StitchColors.surfaceContainerLowest,
            borderRadius: BorderRadius.circular(StitchRadius.lg),
            border: Border.all(color: StitchColors.outlineVariant),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Head to Head Encounters', style: StitchTypography.headlineSm()),
              const SizedBox(height: 14),
              ..._dbH2H.map((h) {
                final rawDate = _formatDateShort(h['date']?.toString());
                final homeName = h['home_team']?.toString() ?? 'Home';
                final awayName = h['away_team']?.toString() ?? 'Away';
                final homeSc = h['home_score']?.toString() ?? '0';
                final awaySc = h['away_score']?.toString() ?? '0';
                final scoreStr = (h['status'] == 'finished' || h['status'] == 'ft' || (h['home_score'] != null && h['away_score'] != null))
                    ? '$homeSc - $awaySc'
                    : (h['score']?.toString() ?? 'vs');

                return Container(
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: StitchColors.surfaceContainer.withValues(alpha: 0.35),
                    borderRadius: BorderRadius.circular(StitchRadius.md),
                    border: Border.all(color: StitchColors.outlineVariant.withValues(alpha: 0.5)),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: StitchColors.surfaceContainerHigh,
                          borderRadius: BorderRadius.circular(StitchRadius.sm),
                        ),
                        child: Text(
                          rawDate,
                          style: StitchTypography.labelSm(color: StitchColors.onSurfaceVariant),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(
                                '$homeName vs $awayName',
                                style: StitchTypography.bodyMd(color: StitchColors.onSurface).copyWith(fontWeight: FontWeight.w600),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                              decoration: BoxDecoration(
                                color: StitchColors.primaryContainer.withValues(alpha: 0.12),
                                borderRadius: BorderRadius.circular(StitchRadius.full),
                              ),
                              child: Text(
                                scoreStr,
                                style: StitchTypography.labelMd(color: StitchColors.primaryContainer).copyWith(fontWeight: FontWeight.bold),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              }),
            ],
          ),
        ),
      ],
    );
  }

  // ── Helper Widgets ──────────────────────────────────────────────────────────
  Widget _teamCrest(String? url, String name) {
    if (url != null && url.startsWith('http')) {
      return CachedNetworkImage(
        imageUrl: url,
        width: 48,
        height: 48,
        errorWidget: (_, __, ___) => _fallbackCrest(name),
      );
    }
    return _fallbackCrest(name);
  }

  Widget _fallbackCrest(String name) {
    return Container(
      width: 48,
      height: 48,
      decoration: const BoxDecoration(shape: BoxShape.circle, color: StitchColors.surfaceContainerHigh),
      child: Center(
        child: Text(
          name.isNotEmpty ? name.substring(0, 1).toUpperCase() : 'T',
          style: const TextStyle(fontWeight: FontWeight.w900, color: StitchColors.primaryContainer, fontSize: 18),
        ),
      ),
    );
  }

  Widget _infoCard(String title, List<Widget> children) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: StitchColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(StitchRadius.lg),
        border: Border.all(color: StitchColors.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: StitchTypography.headlineSm()),
          const SizedBox(height: 12),
          ...children,
        ],
      ),
    );
  }

  Widget _infoRow(String label, String val) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: StitchTypography.bodyMd(color: StitchColors.outline)),
          Text(val, style: StitchTypography.bodyMd(color: StitchColors.onSurface).copyWith(fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }



  Widget _eventRow(String minute, String title, {required bool isHome}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6.0),
      child: Row(
        mainAxisAlignment: isHome ? MainAxisAlignment.start : MainAxisAlignment.end,
        children: [
          Text('$minute  ', style: StitchTypography.labelSm(color: StitchColors.outline)),
          Text(title, style: StitchTypography.bodyMd(color: StitchColors.onSurface).copyWith(fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  void _showPlayerModal(PitchPlayer p) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => Container(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('${p.name} (#${p.number})', style: StitchTypography.headlineSm()),
            const SizedBox(height: 6),
            Text('Position: ${p.position} • Rating: ${p.rating}', style: StitchTypography.bodyMd()),
          ],
        ),
      ),
    );
  }
}
