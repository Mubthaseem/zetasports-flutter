import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';
import '../services/firestore_service.dart';
import '../services/ad_service.dart';
import 'match_detail_screen.dart';

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 2 — LIVE SCORES
// ─────────────────────────────────────────────────────────────────────────────
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
  String _statusFilter = 'Live';
  bool _searchActive = false;
  final _searchCtrl = TextEditingController();
  String _searchQuery = '';

  final _sports = ['All', 'Football', 'Cricket', 'Basketball', 'Tennis'];
  final _statusFilters = ['Today', 'Live', 'Finished', 'Upcoming'];

  @override
  void initState() {
    super.initState();
    _sportTab = TabController(length: _sports.length, vsync: this);
    _sportTab.addListener(() {
      if (!_sportTab.indexIsChanging) _loadMatches();
    });
    _loadMatches();
  }

  @override
  void dispose() {
    _sportTab.dispose();
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadMatches() async {
    setState(() { _loading = true; _error = null; });
    try {
      final sport = _sports[_sportTab.index] == 'All'
          ? null
          : _sports[_sportTab.index];
      final list = await SupabaseService.fetchMatches(
        sport: sport,
        searchQuery: _searchQuery.isNotEmpty ? _searchQuery : null,
        limit: 150,
      );
      if (mounted) setState(() { _matches = list; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _loading = false; _error = e.toString(); });
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
        result = _matches.where((m) => m['status'] == 'finished').toList();
        break;
      case 'Upcoming':
        result = _matches.where((m) =>
          m['status'] == 'scheduled' || m['status'] == 'upcoming').toList();
        break;
      case 'Today':
      default:
        result = _matches.where((m) {
          final d = m['date'] as String?;
          if (d == null) return false;
          final dt = DateTime.tryParse(d);
          return dt != null &&
              dt.year == now.year &&
              dt.month == now.month &&
              dt.day == now.day;
        }).toList();
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
      final key = m['league_name'] ?? 'Other';
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
            const SizedBox(height: 10),
            _buildSportTabs(),
            const SizedBox(height: 10),
            _buildStatusFilters(),
            const SizedBox(height: 10),
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
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      child: Row(children: [
        Text('Live Scores', style: GoogleFonts.outfit(
          fontSize: 20, fontWeight: FontWeight.w900, color: AppTheme.text1)),
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
        const SizedBox(width: 8),
        _iconBtn(Icons.refresh_rounded, _loadMatches),
      ]),
    );
  }

  Widget _buildSearchBar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: TextField(
        controller: _searchCtrl,
        autofocus: true,
        onChanged: (v) {
          setState(() => _searchQuery = v);
          _loadMatches();
        },
        style: GoogleFonts.outfit(color: AppTheme.text1, fontSize: 13),
        decoration: InputDecoration(
          hintText: 'Search teams, leagues...',
          hintStyle: GoogleFonts.outfit(color: AppTheme.text3, fontSize: 13),
          filled: true,
          fillColor: AppTheme.card,
          prefixIcon: const Icon(Icons.search_rounded, color: AppTheme.text3, size: 18),
          suffixIcon: _searchQuery.isNotEmpty
              ? GestureDetector(
                  onTap: () {
                    _searchCtrl.clear();
                    setState(() => _searchQuery = '');
                    _loadMatches();
                  },
                  child: const Icon(Icons.close_rounded, color: AppTheme.text3, size: 18))
              : null,
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide.none),
        ),
      ),
    );
  }

  Widget _buildSportTabs() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      height: 40,
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.circular(20)),
      child: TabBar(
        controller: _sportTab,
        isScrollable: true,
        indicator: BoxDecoration(
          gradient: const LinearGradient(colors: [AppTheme.primary, AppTheme.secondary]),
          borderRadius: BorderRadius.circular(20)),
        indicatorSize: TabBarIndicatorSize.tab,
        labelStyle: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.w800),
        unselectedLabelStyle: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.w600),
        labelColor: Colors.black,
        unselectedLabelColor: AppTheme.text2,
        dividerColor: Colors.transparent,
        tabs: _sports.map((s) => Tab(text: s)).toList(),
      ),
    );
  }

  Widget _buildStatusFilters() {
    return SizedBox(
      height: 34,
      child: ListView.builder(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        scrollDirection: Axis.horizontal,
        itemCount: _statusFilters.length,
        itemBuilder: (_, i) {
          final f = _statusFilters[i];
          final sel = f == _statusFilter;
          return GestureDetector(
            onTap: () => setState(() => _statusFilter = f),
            child: Container(
              margin: const EdgeInsets.only(right: 8),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
              decoration: BoxDecoration(
                color: sel ? AppTheme.primary.withValues(alpha: 0.15) : AppTheme.card,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: sel ? AppTheme.primary : AppTheme.border)),
              child: Text(f, style: GoogleFonts.outfit(
                fontSize: 11, fontWeight: FontWeight.w700,
                color: sel ? AppTheme.primary : AppTheme.text2)),
            ),
          );
        },
      ),
    );
  }

  Widget _buildMatchList() {
    return RefreshIndicator(
      color: AppTheme.primary,
      backgroundColor: AppTheme.surface,
      onRefresh: _loadMatches,
      child: _loading
          ? _buildShimmer()
          : _error != null
              ? _buildError()
              : _filtered.isEmpty
                  ? _buildEmpty()
                  : ListView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      itemCount: _grouped.length + 1, // +1 for banner ad
                      itemBuilder: (_, i) {
                        // Insert banner ad after 3rd group
                        if (i == 3) {
                          return const Padding(
                            padding: EdgeInsets.symmetric(vertical: 8),
                            child: Center(child: BannerAdWidget()),
                          );
                        }
                        final adjustedIdx = i > 3 ? i - 1 : i;
                        if (adjustedIdx >= _grouped.length) return const SizedBox.shrink();
                        final entry = _grouped.entries.elementAt(adjustedIdx);
                        return _buildLeagueGroup(entry.key, entry.value);
                      },
                    ),
    );
  }

  Widget _buildLeagueGroup(String league, List<Map<String, dynamic>> matches) {
    final hasLive = matches.any((m) => m['status'] == 'live');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: Row(children: [
            Container(
              width: 3, height: 16,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppTheme.primary, AppTheme.secondary],
                  begin: Alignment.topCenter, end: Alignment.bottomCenter),
                borderRadius: BorderRadius.circular(2))),
            const SizedBox(width: 8),
            Expanded(child: Text(league, style: GoogleFonts.outfit(
              fontSize: 12, fontWeight: FontWeight.w800, color: AppTheme.text2))),
            if (hasLive)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: AppTheme.danger.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(4)),
                child: Text('LIVE', style: GoogleFonts.outfit(
                  fontSize: 9, fontWeight: FontWeight.w900, color: AppTheme.danger))),
          ]),
        ),
        ...matches.map((m) => _buildMatchRow(m)),
        Divider(color: AppTheme.border, height: 16),
      ],
    );
  }

  Widget _buildMatchRow(Map<String, dynamic> m) {
    final isLive = m['status'] == 'live';
    final isUpcoming = m['status'] == 'scheduled' || m['status'] == 'upcoming';
    final homeTeam = m['home_team'] ?? 'TBD';
    final awayTeam = m['away_team'] ?? 'TBD';

    return GestureDetector(
      onTap: () {
        AdService.showInterstitial(onDismissed: () {
          if (mounted) {
            Navigator.push(context,
              MaterialPageRoute(builder: (_) => MatchDetailScreen(match: m)));
          }
        });
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: AppTheme.card,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isLive ? AppTheme.danger.withValues(alpha: 0.3) : AppTheme.border,
            width: isLive ? 1.5 : 1)),
        child: Row(children: [
          SizedBox(
            width: 40,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (isLive) ...[
                  Container(
                    width: 6, height: 6,
                    decoration: const BoxDecoration(
                      color: AppTheme.danger, shape: BoxShape.circle)),
                  const SizedBox(height: 3),
                  Text(m['time_elapsed']?.toString() ?? 'LIVE',
                    style: GoogleFonts.outfit(
                      color: AppTheme.danger, fontSize: 9, fontWeight: FontWeight.w900)),
                ] else if (isUpcoming)
                  Text(m['date'] != null
                    ? _formatTime(m['date'] as String)
                    : 'TBD',
                    style: GoogleFonts.outfit(
                      color: AppTheme.text3, fontSize: 9, fontWeight: FontWeight.w700),
                    textAlign: TextAlign.center)
                else
                  Text('FT', style: GoogleFonts.outfit(
                    color: AppTheme.text3, fontSize: 9, fontWeight: FontWeight.w700)),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _teamRow(homeTeam, m['home_score'], isLive),
                const SizedBox(height: 5),
                _teamRow(awayTeam, m['away_score'], isLive),
              ],
            ),
          ),
          const Icon(Icons.chevron_right_rounded, color: AppTheme.text3, size: 18),
        ]),
      ),
    );
  }

  Widget _teamRow(String name, dynamic score, bool isLive) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Expanded(child: Text(name, style: GoogleFonts.outfit(
          fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.text1),
          overflow: TextOverflow.ellipsis)),
        if (score != null)
          Text('$score', style: GoogleFonts.rajdhani(
            fontSize: 16, fontWeight: FontWeight.w900,
            color: isLive ? AppTheme.text1 : AppTheme.text2)),
      ],
    );
  }

  String _formatTime(String dateStr) {
    try {
      final dt = DateTime.parse(dateStr).toLocal();
      final h = dt.hour.toString().padLeft(2, '0');
      final m = dt.minute.toString().padLeft(2, '0');
      return '$h:$m';
    } catch (_) {
      return 'TBD';
    }
  }

  Widget _iconBtn(IconData icon, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 36, height: 36,
        decoration: BoxDecoration(
          color: AppTheme.surface, borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppTheme.border)),
        child: Icon(icon, color: AppTheme.text2, size: 18)),
    );
  }

  Widget _buildShimmer() {
    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      children: List.generate(4, (_) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: Container(height: 14, width: 140,
              decoration: BoxDecoration(
                color: AppTheme.card, borderRadius: BorderRadius.circular(4)))),
          ...List.generate(2, (_) => Container(
            margin: const EdgeInsets.only(bottom: 8), height: 64,
            decoration: BoxDecoration(
              color: AppTheme.card, borderRadius: BorderRadius.circular(14)))),
          Divider(color: AppTheme.border, height: 16),
        ],
      )),
    );
  }

  Widget _buildError() {
    return Center(child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Icon(Icons.error_outline_rounded, color: AppTheme.danger, size: 48),
        const SizedBox(height: 12),
        Text('Failed to load scores', style: GoogleFonts.outfit(
          fontSize: 14, fontWeight: FontWeight.w700, color: AppTheme.text1)),
        const SizedBox(height: 8),
        Text(_error!, style: GoogleFonts.outfit(fontSize: 11, color: AppTheme.text2),
          textAlign: TextAlign.center),
        const SizedBox(height: 16),
        ElevatedButton.icon(
          onPressed: _loadMatches,
          icon: const Icon(Icons.refresh_rounded),
          label: const Text('Retry'),
          style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primary)),
      ]),
    ));
  }

  Widget _buildEmpty() {
    return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
      const Icon(Icons.sports_soccer_rounded, color: AppTheme.text3, size: 52),
      const SizedBox(height: 16),
      Text('No $_statusFilter matches found', style: GoogleFonts.outfit(
        fontSize: 14, fontWeight: FontWeight.w700, color: AppTheme.text1)),
      const SizedBox(height: 6),
      Text('Pull to refresh or try a different filter',
        style: GoogleFonts.outfit(fontSize: 12, color: AppTheme.text2)),
    ]));
  }
}