import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/tailwind_theme.dart';
import '../theme/app_theme.dart';
import '../widgets/tw_card.dart';
import '../services/firestore_service.dart';

class StandingsScreen extends StatefulWidget {
  const StandingsScreen({super.key});
  @override
  State<StandingsScreen> createState() => _StandingsScreenState();
}

class _StandingsScreenState extends State<StandingsScreen>
    with SingleTickerProviderStateMixin {
  TabController? _tab;
  List<Map<String, dynamic>> _leagues = [];
  final Map<String, List<Map<String, dynamic>>> _standings = {};
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final leagues = await SupabaseService.fetchLeagues();
      if (mounted) {
        setState(() {
          _leagues = leagues;
          _tab?.dispose();
          _tab = TabController(length: leagues.isNotEmpty ? leagues.length : 1, vsync: this);
          _loading = false;
        });
        if (leagues.isNotEmpty) {
          _loadStandings(leagues.first['id']);
        }
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

  Future<void> _loadStandings(String leagueId) async {
    try {
      final data = await SupabaseService.fetchLeagueStandings(leagueId);
      if (mounted) {
        setState(() {
          _standings[leagueId] = data;
        });
      }
    } catch (e) {
      debugPrint('Standings error: $e');
    }
  }

  @override
  void dispose() {
    _tab?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bg,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(TwSpace.p4, TwSpace.p3, TwSpace.p4, TwSpace.p2),
              child: Row(
                children: [
                  Text(
                    'League Tables & Standings',
                    style: GoogleFonts.outfit(
                      fontSize: 22,
                      fontWeight: FontWeight.w900,
                      color: TwSlate.s900,
                      letterSpacing: -0.5,
                    ),
                  ),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.refresh_rounded, color: TwSlate.s700),
                    onPressed: _loadData,
                  ),
                ],
              ),
            ),
            if (_leagues.isNotEmpty && _tab != null)
              Container(
                margin: const EdgeInsets.symmetric(horizontal: TwSpace.p4),
                height: 42,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(TwRadius.full),
                  border: Border.all(color: TwSlate.s200, width: 1),
                ),
                child: TabBar(
                  controller: _tab,
                  isScrollable: true,
                  tabAlignment: TabAlignment.start,
                  indicator: BoxDecoration(
                    color: TwBlue.b600,
                    borderRadius: BorderRadius.circular(TwRadius.full),
                  ),
                  indicatorSize: TabBarIndicatorSize.tab,
                  labelStyle: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w700),
                  unselectedLabelStyle: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w500),
                  labelColor: Colors.white,
                  unselectedLabelColor: TwSlate.s600,
                  dividerColor: Colors.transparent,
                  padding: const EdgeInsets.all(3),
                  tabs: _leagues.map((l) => Tab(text: l['name'] ?? 'League')).toList(),
                  onTap: (i) => _loadStandings(_leagues[i]['id']),
                ),
              ),
            const SizedBox(height: TwSpace.p3),
            if (_leagues.isNotEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: TwSpace.p4),
                child: Row(
                  children: [
                    _zoneLegend(TwBlue.b600, 'Champions League'),
                    const SizedBox(width: TwSpace.p3),
                    _zoneLegend(TwEmerald.e500, 'Europa League'),
                    const SizedBox(width: TwSpace.p3),
                    _zoneLegend(TwRose.r500, 'Relegation'),
                  ],
                ),
              ),
            const SizedBox(height: TwSpace.p2_5),
            Expanded(
              child: _loading
                  ? _shimmerTable()
                  : _error != null
                      ? _buildErrorState()
                      : _leagues.isEmpty
                          ? _buildEmptyState()
                          : TabBarView(
                              controller: _tab,
                              children: List.generate(
                                _leagues.length,
                                (i) => _buildTable(_leagues[i]['id']),
                              ),
                            ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTable(String leagueId) {
    final table = _standings[leagueId] ?? [];
    if (table.isEmpty) {
      return _buildEmptyState(message: 'No standings data for this league yet');
    }

    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: TwSpace.p4),
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: TwSlate.s100,
            borderRadius: BorderRadius.circular(TwRadius.lg),
          ),
          child: Row(
            children: [
              const SizedBox(
                width: 28,
                child: Text('#', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: TwSlate.s500)),
              ),
              const Expanded(
                child: Text('CLUB', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: TwSlate.s500)),
              ),
              _colHeader('MP'),
              _colHeader('W'),
              _colHeader('D'),
              _colHeader('L'),
              _colHeader('GD'),
              _colHeader('PTS'),
            ],
          ),
        ),
        const SizedBox(height: TwSpace.p1_5),
        ...table.asMap().entries.map((e) => _buildRow(e.value, e.key)),
        const SizedBox(height: TwSpace.p6),
      ],
    );
  }

  Widget _buildRow(Map<String, dynamic> row, int idx) {
    final zone = row['zone']?.toString() ?? 'none';
    Color zoneCol = Colors.transparent;
    Color ptsTxt = TwSlate.s900;
    if (zone == 'cl' || idx < 4) {
      zoneCol = TwBlue.b600;
      ptsTxt = TwBlue.b600;
    } else if (zone == 'el' || idx < 6) {
      zoneCol = TwEmerald.e500;
      ptsTxt = TwEmerald.e600;
    } else if (zone == 'rel') {
      zoneCol = TwRose.r500;
      ptsTxt = TwRose.r600;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: TwSpace.p1_5),
      child: TwCard(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 11),
        child: Row(
          children: [
            Container(
              width: 3.5,
              height: 22,
              margin: const EdgeInsets.only(right: 8),
              decoration: BoxDecoration(
                color: zoneCol,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            SizedBox(
              width: 22,
              child: Text(
                '${row['position'] ?? row['pos'] ?? idx + 1}',
                style: GoogleFonts.rajdhani(fontSize: 14, fontWeight: FontWeight.w800, color: TwSlate.s700),
              ),
            ),
            Expanded(
              child: Text(
                row['team']?.toString() ?? row['team_name'] ?? '',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w700, color: TwSlate.s900),
              ),
            ),
            _colCell('${row['played'] ?? row['p'] ?? 0}'),
            _colCell('${row['won'] ?? row['w'] ?? 0}'),
            _colCell('${row['drawn'] ?? row['d'] ?? 0}'),
            _colCell('${row['lost'] ?? row['l'] ?? 0}'),
            _colCell(
              '${row['goal_diff'] ?? row['gd'] ?? 0}',
              col: (row['goal_diff'] ?? row['gd'] ?? 0).toString().startsWith('+')
                  ? TwEmerald.e600
                  : TwSlate.s600,
            ),
            SizedBox(
              width: 36,
              child: Text(
                '${row['points'] ?? row['pts'] ?? 0}',
                style: GoogleFonts.rajdhani(
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                  color: ptsTxt,
                ),
                textAlign: TextAlign.center,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _colHeader(String t) => SizedBox(
        width: 28,
        child: Text(
          t,
          style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: TwSlate.s500),
          textAlign: TextAlign.center,
        ),
      );

  Widget _colCell(String t, {Color col = TwSlate.s700}) => SizedBox(
        width: 28,
        child: Text(
          t,
          style: GoogleFonts.rajdhani(fontSize: 13, fontWeight: FontWeight.w600, color: col),
          textAlign: TextAlign.center,
        ),
      );

  Widget _zoneLegend(Color col, String label) => Row(
        children: [
          Container(width: 8, height: 8, decoration: BoxDecoration(color: col, shape: BoxShape.circle)),
          const SizedBox(width: 4),
          Text(
            label,
            style: GoogleFonts.outfit(fontSize: 10, fontWeight: FontWeight.w700, color: TwSlate.s600),
          ),
        ],
      );

  Widget _shimmerTable() {
    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: TwSpace.p4),
      children: List.generate(
        8,
        (_) => Container(
          height: 48,
          margin: const EdgeInsets.only(bottom: TwSpace.p2),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(TwRadius.lg),
            border: Border.all(color: TwSlate.s200),
          ),
        ),
      ),
    );
  }

  Widget _buildErrorState() => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline_rounded, color: TwRose.r500, size: 48),
            const SizedBox(height: 12),
            Text(_error ?? 'Error loading standings', style: GoogleFonts.outfit(color: TwSlate.s600, fontSize: 13)),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _loadData,
              style: ElevatedButton.styleFrom(
                backgroundColor: TwBlue.b600,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(TwRadius.xl)),
              ),
              child: const Text('Retry', style: TextStyle(color: Colors.white)),
            ),
          ],
        ),
      );

  Widget _buildEmptyState({String message = 'No leagues configured'}) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.emoji_events_outlined, color: TwSlate.s300, size: 48),
              const SizedBox(height: 12),
              Text(
                message,
                style: GoogleFonts.outfit(color: TwSlate.s500, fontSize: 13),
              ),
            ],
          ),
        ),
      );
}