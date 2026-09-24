import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../theme/tailwind_theme.dart';
import '../theme/app_theme.dart';
import '../widgets/tw_card.dart';
import '../widgets/tw_badge.dart';
import '../widgets/zeta_skeleton.dart';
import '../services/firestore_service.dart';
import 'match_detail_screen.dart';

class ScoresScreen extends StatefulWidget {
  const ScoresScreen({super.key});
  @override
  State<ScoresScreen> createState() => _ScoresScreenState();
}

class _ScoresScreenState extends State<ScoresScreen>
    with SingleTickerProviderStateMixin {
  late TabController _sportTab;
  List<Map<String, dynamic>> _matches = [];
  bool _loading = true;
  String? _error;
  String _statusFilter = 'Today';
  bool _searchActive = false;
  final _searchCtrl = TextEditingController();
  String _searchQuery = '';
  Timer? _autoRefreshTimer;
  RealtimeChannel? _matchChannel;

  final List<String> _sports = ['All', 'Football', 'Cricket', 'Basketball', 'Tennis', 'Baseball'];
  final _statusFilters = ['Today', 'Live', 'Finished', 'Upcoming'];

  @override
  void initState() {
    super.initState();
    _sportTab = TabController(length: _sports.length, vsync: this);
    _sportTab.addListener(() {
      if (!_sportTab.indexIsChanging) _loadMatches();
    });
    _loadMatches();
    _autoRefreshTimer = Timer.periodic(const Duration(seconds: 15), (_) {
      _silentRefresh();
    });
    _subscribeToMatchUpdates();
  }

  void _subscribeToMatchUpdates() {
    try {
      _matchChannel = Supabase.instance.client
          .channel('public:zeta_matches_scores')
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
      final sport = _sports[_sportTab.index] == 'All'
          ? null
          : _sports[_sportTab.index];
      final list = await SupabaseService.fetchMatches(
        sport: sport,
        searchQuery: _searchQuery.isNotEmpty ? _searchQuery : null,
        limit: 150,
      );
      if (mounted && list.isNotEmpty) {
        setState(() {
          _matches = list;
        });
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    _autoRefreshTimer?.cancel();
    _matchChannel?.unsubscribe();
    _sportTab.dispose();
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadMatches() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final sport = _sports[_sportTab.index] == 'All'
          ? null
          : _sports[_sportTab.index];
      final results = await Future.wait([
        SupabaseService.fetchMatches(
          sport: sport,
          searchQuery: _searchQuery.isNotEmpty ? _searchQuery : null,
          limit: 150,
        ),
        Future.delayed(const Duration(milliseconds: 550)), // Smooth skeleton fake loading
      ]);
      final list = results[0] as List<Map<String, dynamic>>;
      if (mounted) {
        setState(() {
          _matches = list;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = e.toString();
        });
      }
    }
  }

  List<Map<String, dynamic>> get _filtered {
    final now = DateTime.now();
    List<Map<String, dynamic>> result;
    switch (_statusFilter) {
      case 'Live':
        result = _matches.where((m) => m['status'] == 'live').toList();
        break;
      case 'Finished':
        result = _matches.where((m) => m['status'] == 'finished' || m['status'] == 'ft').toList();
        break;
      case 'Upcoming':
        result = _matches.where((m) =>
            m['status'] == 'scheduled' || m['status'] == 'upcoming').toList();
        break;
      case 'Today':
      default:
        final todayMatches = _matches.where((m) {
          final d = m['date'] as String?;
          if (d == null) return false;
          final dt = DateTime.tryParse(d);
          if (dt == null) return false;
          final localDt = dt.toLocal();
          final isSameDayUtc = (dt.year == now.year && dt.month == now.month && dt.day == now.day);
          final isSameDayLocal = (localDt.year == now.year && localDt.month == now.month && localDt.day == now.day);
          final isStartsAfterMidnight = localDt.isAfter(now) && localDt.difference(now).inHours <= 14;
          return isSameDayUtc || isSameDayLocal || isStartsAfterMidnight || m['status'] == 'live';
        }).toList();

        if (todayMatches.isNotEmpty) {
          result = todayMatches;
        } else {
          // If no fixtures on exact calendar day, fallback to the latest active matchday fixtures (within 3 days)
          final recentMatches = _matches.where((m) {
            final d = m['date'] as String?;
            if (d == null) return false;
            final dt = DateTime.tryParse(d);
            if (dt == null) return false;
            final diff = now.difference(dt).inDays.abs();
            return diff <= 3 || m['status'] == 'live';
          }).toList();
          result = recentMatches.isNotEmpty ? recentMatches : _matches.take(20).toList();
        }
        result.sort((a, b) {
          final aLive = a['status'] == 'live' ? 1 : 0;
          final bLive = b['status'] == 'live' ? 1 : 0;
          return bLive.compareTo(aLive);
        });
    }
    if (_searchQuery.isNotEmpty) {
      final q = _searchQuery.toLowerCase();
      result = result.where((m) =>
          (m['home_team'] ?? '').toString().toLowerCase().contains(q) ||
          (m['away_team'] ?? '').toString().toLowerCase().contains(q) ||
          (m['league_name'] ?? '').toString().toLowerCase().contains(q)).toList();
    }
    return result;
  }

  Map<String, List<Map<String, dynamic>>> get _grouped {
    final groups = <String, List<Map<String, dynamic>>>{};
    for (final m in _filtered) {
      final key = m['league_name'] ?? 'International';
      groups.putIfAbsent(key, () => []).add(m);
    }
    return groups;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bg,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            if (_searchActive) _buildSearchBar(),
            const SizedBox(height: TwSpace.p2),
            _buildSportTabs(),
            const SizedBox(height: TwSpace.p2),
            _buildStatusFilters(),
            const SizedBox(height: TwSpace.p2),
            Expanded(
              child: TabBarView(
                controller: _sportTab,
                children: _sports.map((_) => _buildMatchList()).toList(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(TwSpace.p4, TwSpace.p3, TwSpace.p4, 0),
      child: Row(
        children: [
          Text(
            'Live Scores',
            style: GoogleFonts.outfit(
              fontSize: 22,
              fontWeight: FontWeight.w900,
              color: TwSlate.s900,
              letterSpacing: -0.5,
            ),
          ),
          const Spacer(),
          _iconBtn(Icons.search_rounded, () {
            setState(() {
              _searchActive = !_searchActive;
              if (!_searchActive) {
                _searchCtrl.clear();
                _searchQuery = '';
                _loadMatches();
              }
            });
          }),
          const SizedBox(width: TwSpace.p2),
          _iconBtn(Icons.refresh_rounded, _loadMatches),
        ],
      ),
    );
  }

  Widget _iconBtn(IconData icon, VoidCallback onTap) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(TwRadius.xl),
        child: Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(TwRadius.xl),
            border: Border.all(color: TwSlate.s200, width: 1),
            boxShadow: TwShadows.sm,
          ),
          child: Icon(icon, color: TwSlate.s700, size: 18),
        ),
      ),
    );
  }

  Widget _buildSearchBar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(TwSpace.p4, TwSpace.p2, TwSpace.p4, 0),
      child: TextField(
        controller: _searchCtrl,
        autofocus: true,
        onChanged: (v) {
          setState(() => _searchQuery = v);
          _loadMatches();
        },
        style: GoogleFonts.outfit(color: TwSlate.s900, fontSize: 13),
        decoration: InputDecoration(
          hintText: 'Search teams, leagues, tournaments...',
          hintStyle: GoogleFonts.outfit(color: TwSlate.s400, fontSize: 13),
          filled: true,
          fillColor: Colors.white,
          prefixIcon: const Icon(Icons.search_rounded, color: TwSlate.s400, size: 18),
          suffixIcon: _searchQuery.isNotEmpty
              ? GestureDetector(
                  onTap: () {
                    _searchCtrl.clear();
                    setState(() => _searchQuery = '');
                    _loadMatches();
                  },
                  child: const Icon(Icons.close_rounded, color: TwSlate.s400, size: 18),
                )
              : null,
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(TwRadius.xl),
            borderSide: const BorderSide(color: TwSlate.s200, width: 1),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(TwRadius.xl),
            borderSide: const BorderSide(color: TwBlue.b600, width: 1.5),
          ),
        ),
      ),
    );
  }

  Widget _buildSportTabs() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: TwSpace.p4),
      height: 42,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(TwRadius.full),
        border: Border.all(color: TwSlate.s200, width: 1),
      ),
      child: TabBar(
        controller: _sportTab,
        indicator: BoxDecoration(
          color: TwBlue.b600,
          borderRadius: BorderRadius.circular(TwRadius.full),
        ),
        indicatorSize: TabBarIndicatorSize.tab,
        labelColor: Colors.white,
        unselectedLabelColor: TwSlate.s600,
        labelStyle: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w700),
        unselectedLabelStyle: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w500),
        dividerColor: Colors.transparent,
        padding: const EdgeInsets.all(3),
        tabs: _sports.map((s) => Tab(text: s)).toList(),
      ),
    );
  }

  Widget _buildStatusFilters() {
    return SizedBox(
      height: 36,
      child: ListView.separated(
        padding: const EdgeInsets.symmetric(horizontal: TwSpace.p4),
        scrollDirection: Axis.horizontal,
        itemCount: _statusFilters.length,
        separatorBuilder: (_, __) => const SizedBox(width: TwSpace.p2),
        itemBuilder: (context, i) {
          final f = _statusFilters[i];
          final selected = _statusFilter == f;
          return GestureDetector(
            onTap: () => setState(() => _statusFilter = f),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              decoration: BoxDecoration(
                color: selected ? TwSlate.s900 : Colors.white,
                borderRadius: BorderRadius.circular(TwRadius.full),
                border: Border.all(
                  color: selected ? TwSlate.s900 : TwSlate.s200,
                  width: 1,
                ),
                boxShadow: selected ? TwShadows.sm : null,
              ),
              child: Center(
                child: Text(
                  f,
                  style: GoogleFonts.outfit(
                    fontSize: 12,
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
                    color: selected ? Colors.white : TwSlate.s700,
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildMatchList() {
    if (_loading) {
      return ListView.builder(
        padding: const EdgeInsets.only(top: 8),
        itemCount: 6,
        itemBuilder: (context, index) => const MatchCardSkeleton(),
      );
    }
    if (_error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline_rounded, size: 42, color: TwRose.r500),
            const SizedBox(height: TwSpace.p2),
            Text(
              'Failed to load match scores',
              style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w700, color: TwSlate.s800),
            ),
            const SizedBox(height: TwSpace.p3),
            ElevatedButton(
              onPressed: _loadMatches,
              style: ElevatedButton.styleFrom(
                backgroundColor: TwBlue.b600,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(TwRadius.xl)),
              ),
              child: Text('Try Again', style: GoogleFonts.outfit(color: Colors.white)),
            ),
          ],
        ),
      );
    }

    final groups = _grouped;
    if (groups.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.sports_soccer_rounded, size: 48, color: TwSlate.s300),
            const SizedBox(height: TwSpace.p3),
            Text(
              'No $_statusFilter matches found',
              style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w700, color: TwSlate.s800),
            ),
            const SizedBox(height: TwSpace.p1),
            Text(
              'Check other categories or sport tabs',
              style: GoogleFonts.outfit(fontSize: 12, color: TwSlate.s500),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      color: TwBlue.b600,
      backgroundColor: Colors.white,
      onRefresh: _loadMatches,
      child: ListView.builder(
        padding: const EdgeInsets.symmetric(horizontal: TwSpace.p4, vertical: TwSpace.p2),
        itemCount: groups.keys.length,
        itemBuilder: (context, idx) {
          final league = groups.keys.elementAt(idx);
          final matches = groups[league]!;
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // League title header
              Padding(
                padding: const EdgeInsets.symmetric(vertical: TwSpace.p2),
                child: Row(
                  children: [
                    Container(
                      width: 4,
                      height: 16,
                      decoration: BoxDecoration(
                        color: TwBlue.b600,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                    const SizedBox(width: TwSpace.p2),
                    Expanded(
                      child: Text(
                        league,
                        style: GoogleFonts.outfit(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                          color: TwSlate.s800,
                        ),
                      ),
                    ),
                    Text(
                      '${matches.length}',
                      style: GoogleFonts.outfit(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: TwSlate.s400,
                      ),
                    ),
                  ],
                ),
              ),
              ...matches.map((m) => _buildMatchCard(m)),
              const SizedBox(height: TwSpace.p2),
            ],
          );
        },
      ),
    );
  }

  Widget _buildMatchCard(Map<String, dynamic> m) {
    final isLive = m['status'] == 'live';
    final isFinished = m['status'] == 'finished';
    final homeScore = m['home_score']?.toString() ?? '-';
    final awayScore = m['away_score']?.toString() ?? '-';
    String elapsed;
    if (isLive) {
      elapsed = m['time_elapsed']?.toString() ?? 'LIVE';
    } else if (isFinished) {
      elapsed = m['time_elapsed']?.toString() ?? 'FT';
    } else {
      if (m['kickoff_ist'] != null && m['kickoff_ist'].toString().isNotEmpty) {
        elapsed = m['kickoff_ist'].toString();
      } else {
        final t = m['time']?.toString() ?? '';
        final d = m['date']?.toString() ?? '';
        if (t.isNotEmpty && t.contains(':') && !t.startsWith('202')) {
          elapsed = t.length >= 5 ? t.substring(0, 5) : t;
        } else if (d.isNotEmpty) {
          final dt = DateTime.tryParse(d)?.toLocal();
          if (dt != null) {
            final hour = dt.hour;
            final minute = dt.minute.toString().padLeft(2, '0');
            final period = hour >= 12 ? 'PM' : 'AM';
            final h12 = hour == 0 ? 12 : (hour > 12 ? hour - 12 : hour);
            elapsed = '$h12:$minute $period';
          } else {
            elapsed = 'SCH';
          }
        } else {
          elapsed = 'SCH';
        }
      }
    }

    return Container(
      margin: const EdgeInsets.only(bottom: TwSpace.p2),
      child: TwCard(
        padding: const EdgeInsets.symmetric(horizontal: TwSpace.p4, vertical: TwSpace.p3),
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => MatchDetailScreen(match: m)),
          );
        },
        child: Row(
          children: [
            // Status column
            SizedBox(
              width: 58,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (isLive)
                    TwBadge(label: elapsed, variant: TwBadgeVariant.live, pulse: true)
                  else
                    Text(
                      elapsed,
                      style: GoogleFonts.outfit(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: isFinished ? TwSlate.s500 : TwBlue.b600,
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(width: TwSpace.p2),
            // Teams column
            Expanded(
              child: Column(
                children: [
                  Row(
                    children: [
                      _buildLogo(m['home_team_logo']),
                      const SizedBox(width: TwSpace.p2_5),
                      Expanded(
                        child: Text(
                          m['home_team'] ?? 'Home',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: GoogleFonts.outfit(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: TwSlate.s900,
                          ),
                        ),
                      ),
                      Text(
                        homeScore,
                        style: GoogleFonts.rajdhani(
                          fontSize: 17,
                          fontWeight: FontWeight.w900,
                          color: isLive ? TwRose.r600 : TwSlate.s900,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: TwSpace.p1_5),
                  Row(
                    children: [
                      _buildLogo(m['away_team_logo']),
                      const SizedBox(width: TwSpace.p2_5),
                      Expanded(
                        child: Text(
                          m['away_team'] ?? 'Away',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: GoogleFonts.outfit(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: TwSlate.s900,
                          ),
                        ),
                      ),
                      Text(
                        awayScore,
                        style: GoogleFonts.rajdhani(
                          fontSize: 17,
                          fontWeight: FontWeight.w900,
                          color: isLive ? TwRose.r600 : TwSlate.s900,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: TwSpace.p3),
            Icon(Icons.chevron_right_rounded, color: TwSlate.s300, size: 20),
          ],
        ),
      ),
    );
  }

  Widget _buildLogo(dynamic url) {
    if (url != null && url.toString().isNotEmpty) {
      return ZetaCachedImage(
        imageUrl: url.toString(),
        width: 22,
        height: 22,
        shape: BoxShape.circle,
        errorWidget: Icon(Icons.shield_outlined, size: 20, color: TwSlate.s400),
      );
    }
    return Icon(Icons.shield_outlined, size: 20, color: TwSlate.s400);
  }
}