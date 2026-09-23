import 'dart:async';
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../theme/stitch_theme.dart';
import '../widgets/live_pulse_badge.dart';
import '../widgets/zeta_skeleton.dart';
import '../services/firestore_service.dart' show SupabaseService;
import 'match_detail_screen.dart';
import 'player_screen.dart';
import 'notification_center_screen.dart';
import 'profile_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  List<Map<String, dynamic>> _matches = [];
  List<Map<String, dynamic>> _highlights = [];
  bool _loading = true;
  String _selectedLeague = 'All Matches';
  Timer? _autoRefreshTimer;
  RealtimeChannel? _matchChannel;

  final List<Map<String, dynamic>> _leagues = [
    {'name': 'All Matches', 'icon': '🔥', 'isLive': true},
    {'name': 'Algeria - Ligue 1', 'icon': '🇩🇿'},
    {'name': 'Premier League', 'icon': '🏴󠁧󠁢󠁥󠁮󠁧󠁿'},
    {'name': 'La Liga', 'icon': '🇪🇸'},
    {'name': 'Champions League', 'icon': '🏆'},
    {'name': 'Serie A', 'icon': '🇮🇹'},
    {'name': 'Bundesliga', 'icon': '🇩🇪'},
  ];

  @override
  void initState() {
    super.initState();
    _loadData();
    // Auto-refresh silently every 15 seconds so scores & minutes update live
    _autoRefreshTimer = Timer.periodic(const Duration(seconds: 15), (_) {
      _silentRefresh();
    });
    _subscribeToMatchUpdates();
  }

  @override
  void dispose() {
    _autoRefreshTimer?.cancel();
    _matchChannel?.unsubscribe();
    super.dispose();
  }

  void _subscribeToMatchUpdates() {
    try {
      _matchChannel = Supabase.instance.client
          .channel('public:zeta_matches_feed')
          .onPostgresChanges(
            event: PostgresChangeEvent.all,
            schema: 'public',
            table: 'zeta_matches',
            callback: (_) {
              _silentRefresh();
            },
          )
          .subscribe();
    } catch (_) {}
  }

  Future<void> _silentRefresh() async {
    try {
      final matches = await SupabaseService.fetchMatches(limit: 50);
      if (mounted && matches.isNotEmpty) {
        setState(() {
          _matches = matches;
        });
      }
    } catch (_) {}
  }

  Future<void> _loadData() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        SupabaseService.fetchMatches(limit: 50),
        SupabaseService.fetchHighlights(publishedOnly: true, limit: 10),
        Future.delayed(const Duration(milliseconds: 650)), // Smooth skeleton fake loading
      ]);
      if (mounted) {
        setState(() {
          _matches = results[0] as List<Map<String, dynamic>>;
          _highlights = results[1] as List<Map<String, dynamic>>;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  String? _formatScorers(dynamic scorers) {
    if (scorers == null) return null;
    if (scorers is List) {
      if (scorers.isEmpty) return null;
      final joined = scorers.map((s) => s.toString()).where((s) => s.isNotEmpty && s != 'null').join(', ');
      return joined.isEmpty ? null : joined;
    }
    final s = scorers.toString().trim();
    if (s.isEmpty || s == '[]' || s == 'null') return null;
    return s;
  }

  List<Map<String, dynamic>> get _liveMatches {
    return _matches.where((m) {
      final status = m['status']?.toString().toLowerCase();
      if (status == 'finished' || status == 'ft' || status == 'cancelled' || status == 'postponed') {
        return false;
      }
      return status == 'live' || m['is_live'] == true;
    }).toList();
  }

  List<Map<String, dynamic>> get _filteredMatches {
    if (_selectedLeague == 'All Matches' || _selectedLeague == 'All Live') {
      final list = List<Map<String, dynamic>>.from(_matches);
      list.sort((a, b) {
        final aLive = a['status']?.toString().toLowerCase() == 'live' ? 1 : 0;
        final bLive = b['status']?.toString().toLowerCase() == 'live' ? 1 : 0;
        return bLive.compareTo(aLive);
      });
      return list;
    }
    return _matches.where((m) {
      final lg = (m['league_name'] ?? m['league'] ?? '').toString().toLowerCase();
      final query = _selectedLeague.toLowerCase().replaceAll('algeria - ', '').trim();
      return lg.contains(_selectedLeague.toLowerCase()) || lg.contains(query);
    }).toList();
  }

  Map<String, dynamic>? get _heroMatch {
    if (_liveMatches.isNotEmpty) return _liveMatches.first;
    // When no match is live, highlight the most recent finished match or next upcoming fixture
    final finishedMatches = _matches.where((m) {
      final s = (m['status'] ?? '').toString().toLowerCase();
      return s == 'finished' || s == 'ft';
    }).toList();
    if (finishedMatches.isNotEmpty) return finishedMatches.first;
    if (_matches.isNotEmpty) return _matches.first;
    return null;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: StitchColors.background,
      body: SafeArea(
        child: RefreshIndicator(
          color: StitchColors.primaryContainer,
          onRefresh: _loadData,
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
            slivers: [
              // 1. Stitch Top Header Bar
              SliverToBoxAdapter(
                child: _buildTopHeader(),
              ),

              // 2. Horizontal League Quick Selector
              SliverToBoxAdapter(
                child: _buildLeagueSelector(),
              ),

              // 3. Featured LIVE NOW Showcase Card
              SliverToBoxAdapter(
                child: _loading
                    ? const HeroCardSkeleton()
                    : Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 14.0, vertical: 8.0),
                        child: _heroMatch != null
                            ? _buildHeroCard(_heroMatch!)
                            : _buildFallbackHeroCard(),
                      ),
              ),

              // 4. Matchday Fixtures Section Header
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 8,
                            height: 8,
                            decoration: const BoxDecoration(
                              shape: BoxShape.circle,
                              color: StitchColors.primaryContainer,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            _selectedLeague == 'All Matches' || _selectedLeague == 'All Live' ? "Fixtures & Results" : _selectedLeague,
                            style: StitchTypography.headlineSm(color: StitchColors.onSurface),
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: StitchColors.surfaceContainer,
                          borderRadius: BorderRadius.circular(StitchRadius.full),
                        ),
                        child: Text(
                          _loading ? 'Loading...' : '${_filteredMatches.length} Matches',
                          style: StitchTypography.labelSm(color: StitchColors.onSurfaceVariant),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              // 5. Matchday Cards List
              _loading
                  ? SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (context, index) => const MatchCardSkeleton(),
                        childCount: 4,
                      ),
                    )
                  : _filteredMatches.isEmpty
                      ? SliverToBoxAdapter(child: _buildEmptyState())
                      : SliverList(
                          delegate: SliverChildBuilderDelegate(
                            (context, index) {
                              final match = _filteredMatches[index];
                              return Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 14.0, vertical: 5.0),
                                child: _buildMatchCard(match),
                              );
                            },
                            childCount: _filteredMatches.length,
                          ),
                        ),

              // 6. Trending Replays & Highlights Section
              SliverToBoxAdapter(
                child: _loading
                    ? _buildReplaysSkeleton()
                    : _buildReplaysSection(),
              ),

              const SliverToBoxAdapter(
                child: SizedBox(height: 24),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── Top App Bar ─────────────────────────────────────────────────────────────
  Widget _buildTopHeader() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: StitchColors.surfaceContainerLowest.withValues(alpha: 0.95),
        border: const Border(bottom: BorderSide(color: StitchColors.outlineVariant, width: 1)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Brand Logo & Title
          Row(
            children: [
              Image.asset(
                'assets/images/zetasports_logo.png',
                height: 32,
                width: 32,
                errorBuilder: (_, __, ___) => Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: StitchColors.primaryContainer,
                    borderRadius: BorderRadius.circular(StitchRadius.defaultR),
                  ),
                  child: const Center(
                    child: Text('Z', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900)),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Text(
                'ZetaSports',
                style: StitchTypography.headlineSm(color: StitchColors.onSurface).copyWith(
                  fontWeight: FontWeight.w800,
                  fontSize: 18,
                ),
              ),
              const SizedBox(width: 8),
              const LivePulseBadge(text: 'LIVE', animate: true),
            ],
          ),

          // Icons (Search, Notifications, Profile)
          Row(
            children: [
              IconButton(
                onPressed: () {},
                icon: const Icon(Icons.search_rounded, size: 22, color: StitchColors.onSurfaceVariant),
                visualDensity: VisualDensity.compact,
              ),
              Stack(
                children: [
                  IconButton(
                    onPressed: () {
                      Navigator.push(context, MaterialPageRoute(builder: (_) => const NotificationCenterScreen()));
                    },
                    icon: const Icon(Icons.notifications_none_rounded, size: 22, color: StitchColors.onSurfaceVariant),
                    visualDensity: VisualDensity.compact,
                  ),
                  Positioned(
                    top: 8,
                    right: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                      decoration: BoxDecoration(
                        color: StitchColors.tertiary,
                        borderRadius: BorderRadius.circular(StitchRadius.full),
                      ),
                      child: const Text('3', style: TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.bold)),
                    ),
                  ),
                ],
              ),
              const SizedBox(width: 4),
              GestureDetector(
                onTap: () {
                  Navigator.push(context, MaterialPageRoute(builder: (_) => const ProfileScreen()));
                },
                child: const CircleAvatar(
                  radius: 15,
                  backgroundColor: StitchColors.surfaceContainerHigh,
                  child: Icon(Icons.person_outline_rounded, size: 18, color: StitchColors.primaryContainer),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ── Horizontal League Selector ──────────────────────────────────────────────
  Widget _buildLeagueSelector() {
    return SizedBox(
      height: 48,
      child: ListView.separated(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        scrollDirection: Axis.horizontal,
        physics: const BouncingScrollPhysics(),
        itemCount: _leagues.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, i) {
          final lg = _leagues[i];
          final bool selected = _selectedLeague == lg['name'];

          return InkWell(
            onTap: () {
              setState(() => _selectedLeague = lg['name']);
            },
            borderRadius: BorderRadius.circular(StitchRadius.full),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: selected ? StitchColors.primaryContainer : StitchColors.surfaceContainer,
                borderRadius: BorderRadius.circular(StitchRadius.full),
                border: Border.all(
                  color: selected ? StitchColors.primaryContainer : StitchColors.outlineVariant,
                ),
              ),
              child: Row(
                children: [
                  if (lg['icon'] != null) ...[
                    Text(lg['icon'].toString(), style: const TextStyle(fontSize: 12)),
                    const SizedBox(width: 4),
                  ] else if (lg['color'] != null) ...[
                    Container(
                      width: 6,
                      height: 6,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: lg['color'] as Color,
                      ),
                    ),
                    const SizedBox(width: 6),
                  ],
                  Text(
                    lg['name'].toString(),
                    style: StitchTypography.labelMd(
                      color: selected ? Colors.white : StitchColors.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  // ── Featured LIVE NOW Hero Card (Madrid vs City / Real Live match) ──────────
  Widget _buildHeroCard(Map<String, dynamic> match) {
    final home = match['home_team']?.toString() ?? 'Home Team';
    final away = match['away_team']?.toString() ?? 'Away Team';
    final homeScore = match['home_score']?.toString() ?? '0';
    final awayScore = match['away_score']?.toString() ?? '0';
    final status = match['status']?.toString().toLowerCase() ?? 'scheduled';
    final isLive = status == 'live' || match['is_live'] == true;
    final isFinished = status == 'finished' || status == 'ft';
    final minute = isFinished ? 'FT' : (match['time_elapsed']?.toString() ?? (isLive ? 'LIVE' : ''));
    final league = match['league_name']?.toString() ?? 'Match';
    final homeScorers = _formatScorers(match['home_scorers']);
    final awayScorers = _formatScorers(match['away_scorers']);
    final int viewers = int.tryParse(match['viewers']?.toString() ?? '0') ?? 0;

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: StitchColors.inverseSurface, // Deep Navy Slate #131B2E
        borderRadius: BorderRadius.circular(StitchRadius.lg),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.18),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(StitchRadius.lg),
        child: Stack(
          children: [
            // Ambient stadium light gradient
            Positioned(
              right: -30,
              top: -30,
              child: Container(
                width: 140,
                height: 140,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: StitchColors.primaryContainer.withValues(alpha: 0.25),
                ),
              ),
            ),

            Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                children: [
                  // Tournament & Live minute
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.military_tech_rounded, size: 18, color: StitchColors.secondaryFixed),
                          const SizedBox(width: 6),
                          Text(
                            league,
                            style: StitchTypography.labelSm(color: StitchColors.inverseOnSurface.withValues(alpha: 0.8)),
                          ),
                        ],
                      ),
                      if (isLive)
                        LivePulseBadge(
                          text: minute,
                          dotColor: Colors.white,
                          bgColor: StitchColors.tertiaryContainer,
                          textColor: Colors.white,
                        )
                      else if (isFinished)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.18),
                            borderRadius: BorderRadius.circular(StitchRadius.full),
                          ),
                          child: Text(
                            'FULL TIME',
                            style: StitchTypography.labelSm(color: Colors.white).copyWith(fontWeight: FontWeight.w700),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Tactical Scoreboard
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      // Home Team
                      Expanded(
                        child: Column(
                          children: [
                            _teamCrest(match['home_team_logo']?.toString(), home),
                            const SizedBox(height: 6),
                            Text(
                              home,
                              textAlign: TextAlign.center,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: StitchTypography.headlineSm(color: Colors.white),
                            ),
                            if (homeScorers != null)
                              Text(
                                homeScorers,
                                style: StitchTypography.bodySm(color: StitchColors.secondaryFixed),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                          ],
                        ),
                      ),

                      // Center Scoreboard
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 8.0),
                        child: Column(
                          children: [
                            Text(
                              '$homeScore : $awayScore',
                              style: StitchTypography.displayScoreMobile(color: Colors.white).copyWith(fontSize: 32),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(StitchRadius.full),
                              ),
                              child: Text(
                                isFinished ? 'FT' : (match['status'] ?? 'LIVE').toString().toUpperCase(),
                                style: StitchTypography.labelSm(color: Colors.white),
                              ),
                            ),
                          ],
                        ),
                      ),

                      // Away Team
                      Expanded(
                        child: Column(
                          children: [
                            _teamCrest(match['away_team_logo']?.toString(), away),
                            const SizedBox(height: 6),
                            Text(
                              away,
                              textAlign: TextAlign.center,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: StitchTypography.headlineSm(color: Colors.white),
                            ),
                            if (awayScorers != null)
                              Text(
                                awayScorers,
                                style: StitchTypography.bodySm(color: StitchColors.secondaryFixed),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),

                  // Match Info Pill
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(StitchRadius.md),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.stadium_rounded, size: 14, color: Colors.white70),
                            const SizedBox(width: 5),
                            Text(
                              match['venue']?.toString() ?? 'Stadium',
                              style: StitchTypography.labelSm(color: Colors.white70),
                            ),
                          ],
                        ),
                        if (viewers > 0)
                          Row(
                            children: [
                              const Icon(Icons.visibility_rounded, size: 14, color: StitchColors.secondaryFixed),
                              const SizedBox(width: 4),
                              Text(
                                '$viewers watching',
                                style: StitchTypography.labelSm(color: StitchColors.secondaryFixed),
                              ),
                            ],
                          )
                        else if (match['round'] != null && match['round'].toString().isNotEmpty)
                          Text(
                            match['round'].toString(),
                            style: StitchTypography.labelSm(color: Colors.white70),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),

                  // Action Button Center
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () {
                            if (isLive || match['has_live_stream'] == true || match['stream_url'] != null) {
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => PlayerScreen(
                                    match: match,
                                    username: 'SportsFan',
                                    deviceId: 'device-1',
                                  ),
                                ),
                              );
                            } else {
                              Navigator.push(
                                context,
                                MaterialPageRoute(builder: (_) => MatchDetailScreen(match: match)),
                              );
                            }
                          },
                          icon: Icon(
                            isLive ? Icons.play_arrow_rounded : Icons.insights_rounded,
                            color: Colors.white,
                            size: 20,
                          ),
                          label: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                isLive ? 'Watch HD Feed' : 'Match Recap & Stats',
                                style: StitchTypography.labelMd(color: Colors.white),
                              ),
                              if (isLive) ...[
                                const SizedBox(width: 6),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                                  decoration: BoxDecoration(
                                    color: StitchColors.secondaryFixed,
                                    borderRadius: BorderRadius.circular(StitchRadius.full),
                                  ),
                                  child: Text('LIVE HD', style: StitchTypography.labelSm(color: StitchColors.onSecondaryFixed)),
                                ),
                              ],
                            ],
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: StitchColors.primaryContainer,
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            elevation: 0,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(StitchRadius.md)),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      IconButton(
                        onPressed: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => MatchDetailScreen(match: match)),
                          );
                        },
                        icon: const Icon(Icons.show_chart_rounded, color: Colors.white70),
                        style: IconButton.styleFrom(
                          backgroundColor: Colors.white.withValues(alpha: 0.1),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(StitchRadius.md)),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFallbackHeroCard() {
    return const SizedBox.shrink();
  }

  String _formatMatchSchedule(Map<String, dynamic> match) {
    final status = (match['status'] ?? '').toString().toLowerCase();
    final isLive = status == 'live' || match['is_live'] == true;
    final isFinished = status == 'finished' || status == 'ft';
    final isCancelled = status == 'cancelled' || status == 'postponed' || status == 'pp';

    if (isLive) {
      return match['time_elapsed']?.toString() ?? 'LIVE';
    }
    if (isFinished) {
      final el = match['time_elapsed']?.toString();
      return (el != null && el.isNotEmpty && el != 'null') ? el : 'FT';
    }
    if (isCancelled) {
      return 'Postponed';
    }

    final dateStr = match['date']?.toString().trim() ?? '';
    final timeStr = match['time']?.toString().trim() ?? match['kickoff_ist']?.toString().trim() ?? '';

    if (dateStr.isNotEmpty && dateStr != 'null') {
      final dt = DateTime.tryParse(dateStr);
      if (dt != null) {
        final now = DateTime.now();
        final isToday = dt.year == now.year && dt.month == now.month && dt.day == now.day;
        final isTomorrow = dt.year == now.year && dt.month == now.month && dt.day == now.day + 1;
        final isYesterday = dt.year == now.year && dt.month == now.month && dt.day == now.day - 1;

        final months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        final weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

        String timePart = '';
        if (timeStr.isNotEmpty && timeStr != 'null' && timeStr.contains(':') && !timeStr.startsWith('202')) {
          timePart = timeStr.length >= 5 ? timeStr.substring(0, 5) : timeStr;
        } else if (dateStr.contains('T')) {
          final t = dateStr.split('T').last;
          if (t.contains(':') && !t.startsWith('202')) {
            timePart = t.length >= 5 ? t.substring(0, 5) : t;
          }
        } else if (dt.hour != 0 || dt.minute != 0) {
          timePart = '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
        }

        if (isToday) {
          return timePart.isNotEmpty && timePart != '00:00' ? 'Today • $timePart' : 'Today';
        } else if (isTomorrow) {
          return timePart.isNotEmpty && timePart != '00:00' ? 'Tomorrow • $timePart' : 'Tomorrow';
        } else if (isYesterday) {
          return 'Yesterday';
        } else {
          final dateFormatted = '${weekdays[dt.weekday - 1]}, ${months[dt.month - 1]} ${dt.day}';
          return (timePart.isNotEmpty && timePart != '00:00') ? '$dateFormatted • $timePart' : dateFormatted;
        }
      }
    }

    if (timeStr.isNotEmpty && timeStr != 'null' && timeStr.contains(':') && !timeStr.startsWith('202')) {
      return timeStr.length >= 5 ? timeStr.substring(0, 5) : timeStr;
    }
    return 'Upcoming';
  }

  // ── Match List Card ─────────────────────────────────────────────────────────
  Widget _buildMatchCard(Map<String, dynamic> match) {
    final home = match['home_team']?.toString() ?? 'Home Team';
    final away = match['away_team']?.toString() ?? 'Away Team';
    final homeScore = match['home_score']?.toString() ?? '-';
    final awayScore = match['away_score']?.toString() ?? '-';
    final status = match['status']?.toString().toLowerCase() ?? 'scheduled';
    final isLive = status == 'live' || match['is_live'] == true;
    final isFinished = status == 'finished' || status == 'ft';
    final statusText = _formatMatchSchedule(match);
    final leagueText = (match['league_name'] ?? match['league'] ?? '').toString();
    final hasStream = match['has_live_stream'] == true || match['stream_url'] != null;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: StitchColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(StitchRadius.lg),
        border: Border.all(color: StitchColors.outlineVariant),
        boxShadow: [
          BoxShadow(
            color: StitchColors.onSurface.withValues(alpha: 0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: InkWell(
        onTap: () {
          Navigator.push(context, MaterialPageRoute(builder: (_) => MatchDetailScreen(match: match)));
        },
        child: Column(
          children: [
            // Status Header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                if (isLive)
                  LivePulseBadge(
                    text: statusText,
                    dotColor: StitchColors.tertiary,
                    bgColor: StitchColors.tertiary.withValues(alpha: 0.1),
                    textColor: StitchColors.tertiary,
                  )
                else if (isFinished)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: StitchColors.surfaceContainerHigh,
                      borderRadius: BorderRadius.circular(StitchRadius.full),
                    ),
                    child: Text(
                      statusText,
                      style: StitchTypography.labelSm(color: StitchColors.onSurfaceVariant).copyWith(fontWeight: FontWeight.w700),
                    ),
                  )
                else
                  Row(
                    children: [
                      const Icon(Icons.schedule_rounded, size: 14, color: StitchColors.outline),
                      const SizedBox(width: 4),
                      Text(statusText, style: StitchTypography.labelSm(color: StitchColors.onSurfaceVariant)),
                    ],
                  ),
                if (leagueText.isNotEmpty)
                  Text(
                    leagueText,
                    style: StitchTypography.labelSm(color: StitchColors.outline),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
              ],
            ),
            const SizedBox(height: 10),

            // Teams and Action Button
            Row(
              children: [
                // Team names & scores
                Expanded(
                  child: Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              _smallCrest(match['home_team_logo']?.toString(), home),
                              const SizedBox(width: 8),
                              Text(home, style: StitchTypography.bodyMd(color: StitchColors.onSurface).copyWith(fontWeight: FontWeight.w700)),
                            ],
                          ),
                          Text(homeScore, style: StitchTypography.metricMono(color: StitchColors.onSurface)),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              _smallCrest(match['away_team_logo']?.toString(), away),
                              const SizedBox(width: 8),
                              Text(away, style: StitchTypography.bodyMd(color: StitchColors.onSurface).copyWith(fontWeight: FontWeight.w700)),
                            ],
                          ),
                          Text(awayScore, style: StitchTypography.metricMono(color: StitchColors.onSurface)),
                        ],
                      ),
                    ],
                  ),
                ),

                const SizedBox(width: 14),

                // Action Button: Watch if live/stream available, Details otherwise
                ElevatedButton.icon(
                  onPressed: () {
                    if (isLive || hasStream) {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => PlayerScreen(match: match, username: 'Fan', deviceId: 'dev-1'),
                        ),
                      );
                    } else {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => MatchDetailScreen(match: match)),
                      );
                    }
                  },
                  icon: Icon(
                    isLive || hasStream ? Icons.play_circle_outline_rounded : Icons.sports_score_rounded,
                    size: 16,
                    color: StitchColors.primaryContainer,
                  ),
                  label: Text(
                    isLive || hasStream ? 'Watch' : 'Details',
                    style: StitchTypography.labelSm(color: StitchColors.primaryContainer),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: StitchColors.surfaceContainerHigh,
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(StitchRadius.defaultR)),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildReplaysSection() {
    if (_highlights.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 10),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  const Icon(Icons.video_collection_rounded, size: 18, color: StitchColors.primaryContainer),
                  const SizedBox(width: 6),
                  Text('Trending Replays', style: StitchTypography.headlineSm(color: StitchColors.onSurface)),
                ],
              ),
              Text('View All', style: StitchTypography.labelMd(color: StitchColors.primaryContainer)),
            ],
          ),
        ),
        SizedBox(
          height: 160,
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            itemCount: _highlights.length,
            separatorBuilder: (_, __) => const SizedBox(width: 12),
            itemBuilder: (context, index) {
              final h = _highlights[index];
              final title = h['title']?.toString() ?? 'Highlight';
              final duration = h['duration']?.toString() ?? '';
              final thumb = h['thumbnail']?.toString() ?? '';

              return Container(
                width: 220,
                decoration: BoxDecoration(
                  color: StitchColors.surfaceContainerLowest,
                  borderRadius: BorderRadius.circular(StitchRadius.md),
                  border: Border.all(color: StitchColors.outlineVariant),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Stack(
                      children: [
                        Container(
                          height: 105,
                          decoration: const BoxDecoration(
                            color: StitchColors.inverseSurface,
                            borderRadius: BorderRadius.vertical(top: Radius.circular(12)),
                          ),
                          child: thumb.isNotEmpty && thumb.startsWith('http')
                              ? ZetaCachedImage(
                                  imageUrl: thumb,
                                  width: double.infinity,
                                  height: 105,
                                  fit: BoxFit.cover,
                                  borderRadius: 12,
                                  errorWidget: const Center(
                                    child: Icon(Icons.play_circle_fill_rounded, color: Colors.white, size: 36),
                                  ),
                                )
                              : const Center(
                                  child: Icon(Icons.play_circle_fill_rounded, color: Colors.white, size: 36),
                                ),
                        ),
                        if (duration.isNotEmpty)
                          Positioned(
                            bottom: 6,
                            left: 6,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                              decoration: BoxDecoration(
                                color: Colors.black.withValues(alpha: 0.7),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(duration, style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold)),
                            ),
                          ),
                      ],
                    ),
                    Padding(
                      padding: const EdgeInsets.all(8.0),
                      child: Text(
                        title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: StitchTypography.labelMd(color: StitchColors.onSurface),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildReplaysSkeleton() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 12),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: const [
              ZetaSkeletonBox(width: 140, height: 18, borderRadius: 6),
              ZetaSkeletonBox(width: 60, height: 14, borderRadius: 6),
            ],
          ),
        ),
        SizedBox(
          height: 175,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            physics: const NeverScrollableScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 14.0),
            itemCount: 3,
            itemBuilder: (context, index) => const HighlightCardSkeleton(),
          ),
        ),
      ],
    );
  }

  Widget _teamCrest(String? url, String name) {
    if (url != null && url.startsWith('http')) {
      return ZetaCachedImage(
        imageUrl: url,
        width: 44,
        height: 44,
        shape: BoxShape.circle,
        errorWidget: _fallbackCrest(name),
      );
    }
    return _fallbackCrest(name);
  }

  Widget _smallCrest(String? url, String name) {
    if (url != null && url.startsWith('http')) {
      return ZetaCachedImage(
        imageUrl: url,
        width: 20,
        height: 20,
        shape: BoxShape.circle,
        errorWidget: _fallbackSmallCrest(name),
      );
    }
    return _fallbackSmallCrest(name);
  }

  Widget _fallbackCrest(String name) {
    return Container(
      width: 44,
      height: 44,
      decoration: const BoxDecoration(shape: BoxShape.circle, color: StitchColors.surfaceContainerLowest),
      child: Center(
        child: Text(
          name.isNotEmpty ? name.substring(0, 1).toUpperCase() : 'T',
          style: const TextStyle(fontWeight: FontWeight.w900, color: StitchColors.primaryContainer, fontSize: 18),
        ),
      ),
    );
  }

  Widget _fallbackSmallCrest(String name) {
    return Container(
      width: 20,
      height: 20,
      decoration: const BoxDecoration(shape: BoxShape.circle, color: StitchColors.surfaceContainerHigh),
      child: Center(
        child: Text(
          name.isNotEmpty ? name.substring(0, 1).toUpperCase() : 'T',
          style: const TextStyle(fontWeight: FontWeight.bold, color: StitchColors.onSurface, fontSize: 10),
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(40.0),
        child: Column(
          children: [
            const Icon(Icons.sports_soccer_rounded, size: 48, color: StitchColors.outline),
            const SizedBox(height: 12),
            Text('No matches scheduled in this category', style: StitchTypography.bodyMd()),
          ],
        ),
      ),
    );
  }
}