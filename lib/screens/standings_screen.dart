import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';
import '../services/firestore_service.dart';

class StandingsScreen extends StatefulWidget {
  const StandingsScreen({super.key});
  @override
  State<StandingsScreen> createState() => _StandingsScreenState();
}

class _StandingsScreenState extends State<StandingsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tab;
  List<Map<String, dynamic>> _leagues = [];
  Map<String, List<Map<String, dynamic>>> _standings = {};
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() { _loading = true; _error = null; });
    try {
      final leagues = await SupabaseService.fetchLeagues();
      if (mounted) {
        setState(() { _leagues = leagues; _loading = false; });
        // Load standings for first league
        if (leagues.isNotEmpty) {
          _loadStandings(leagues.first['id']);
        }
      }
    } catch (e) {
      if (mounted) setState(() { _loading = false; _error = e.toString(); });
    }
  }

  Future<void> _loadStandings(String leagueId) async {
    try {
      final data = await SupabaseService.fetchLeagueStandings(leagueId);
      if (mounted) setState(() { _standings[leagueId] = data; });
    } catch (e) {
      debugPrint('Standings error: $e');
    }
  }

  @override
  void dispose() {
    _tab.dispose();
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
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 14),
              child: Row(
                children: [
                  Text('Standings', style: GoogleFonts.outfit(
                    fontSize: 20, fontWeight: FontWeight.w900, color: AppTheme.text1)),
                  const Spacer(),
                  Container(
                    width: 36, height: 36,
                    decoration: BoxDecoration(
                      color: AppTheme.surface, borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppTheme.border)),
                    child: const Icon(Icons.tune_rounded, color: AppTheme.text2, size: 18)),
                ],
              ),
            ),
            if (_leagues.isNotEmpty)
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 16),
                height: 40,
                decoration: BoxDecoration(
                  color: AppTheme.surface, borderRadius: BorderRadius.circular(20)),
                child: TabBar(
                  controller: _tab,
                  isScrollable: true,
                  tabAlignment: TabAlignment.start,
                  indicator: BoxDecoration(
                    gradient: const LinearGradient(colors: [AppTheme.primary, AppTheme.secondary]),
                    borderRadius: BorderRadius.circular(20)),
                  indicatorSize: TabBarIndicatorSize.tab,
                  labelStyle: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.w800),
                  unselectedLabelStyle: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.w600),
                  labelColor: Colors.black,
                  unselectedLabelColor: AppTheme.text2,
                  dividerColor: Colors.transparent,
                  tabs: _leagues.map((l) => Tab(text: l['name'])).toList(),
                  onTap: (i) => _loadStandings(_leagues[i]['id']),
                ),
              ),
            const SizedBox(height: 14),
            if (_leagues.isNotEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Row(children: [
                  _zoneLegend(AppTheme.success, 'Champions League'),
                  const SizedBox(width: 14),
                  _zoneLegend(AppTheme.warning, 'Europa League'),
                  const SizedBox(width: 14),
                  _zoneLegend(AppTheme.danger, 'Relegation'),
                ]),
              ),
            const SizedBox(height: 12),
            Expanded(
              child: _loading
                  ? _shimmerTable()
                  : _error != null
                      ? _buildErrorState()
                      : _leagues.isEmpty
                          ? _buildEmptyState()
                          : TabBarView(
                              controller: _tab,
                              children: List.generate(_leagues.length, (i) => _buildTable(_leagues[i]['id'])),
                            ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTable(String leagueId) {
    final table = _standings[leagueId] ?? [];
    if (table.isEmpty) return _buildEmptyState(message: 'No standings data for this league');

    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            color: AppTheme.surface, borderRadius: BorderRadius.circular(10)),
          child: Row(children: [
            const SizedBox(width: 28, child: Text('#', style: TextStyle(
              fontSize: 10, fontWeight: FontWeight.w700, color: AppTheme.text3))),
            const Expanded(child: Text('CLUB', style: TextStyle(
              fontSize: 10, fontWeight: FontWeight.w700, color: AppTheme.text3))),
            _colHeader('MP'),
            _colHeader('W'),
            _colHeader('D'),
            _colHeader('L'),
            _colHeader('GD'),
            _colHeader('PTS'),
          ]),
        ),
        const SizedBox(height: 6),
        ...table.asMap().entries.map((e) => _buildRow(e.value, e.key)),
      ],
    );
  }

  Widget _buildRow(Map<String, dynamic> row, int idx) {
    final zone = row['zone']?.toString() ?? 'none';
    Color zoneCol = Colors.transparent;
    Color ptsTxt = AppTheme.text1;
    if (zone == 'cl') { zoneCol = AppTheme.success; ptsTxt = AppTheme.success; }
    if (zone == 'el') { zoneCol = AppTheme.warning; ptsTxt = AppTheme.warning; }
    if (zone == 'rel') { zoneCol = AppTheme.danger; ptsTxt = AppTheme.danger; }

    return Container(
      margin: const EdgeInsets.only(bottom: 4),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 10),
      decoration: BoxDecoration(
        color: idx.isEven ? AppTheme.card : AppTheme.card.withOpacity(0.7),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppTheme.border)),
      child: Row(children: [
        Container(
          width: 3, height: 22, margin: const EdgeInsets.only(right: 6),
          decoration: BoxDecoration(
            color: zoneCol.withOpacity(0.8), borderRadius: BorderRadius.circular(2))),
        SizedBox(width: 22, child: Text('${row['position'] ?? row['pos'] ?? idx + 1}', style: GoogleFonts.rajdhani(
          fontSize: 13, fontWeight: FontWeight.w700, color: AppTheme.text2))),
        Expanded(child: Text(row['team']?.toString() ?? row['team_name'] ?? '', style: GoogleFonts.outfit(
          fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.text1))),
        _colCell('${row['played'] ?? row['p'] ?? 0}'),
        _colCell('${row['won'] ?? row['w'] ?? 0}'),
        _colCell('${row['drawn'] ?? row['d'] ?? 0}'),
        _colCell('${row['lost'] ?? row['l'] ?? 0}'),
        _colCell('${row['goal_diff'] ?? row['gd'] ?? 0}', col: (row['goal_diff'] ?? row['gd'] ?? 0).toString().startsWith('+') ? AppTheme.success : AppTheme.danger),
        SizedBox(
          width: 36,
          child: Text('${row['points'] ?? row['pts'] ?? 0}', style: GoogleFonts.rajdhani(
            fontSize: 15, fontWeight: FontWeight.w900, color: ptsTxt),
            textAlign: TextAlign.center)),
      ]),
    );
  }

  Widget _colHeader(String t) => SizedBox(
    width: 28,
    child: Text(t, style: const TextStyle(
      fontSize: 10, fontWeight: FontWeight.w700, color: AppTheme.text3),
      textAlign: TextAlign.center));

  Widget _colCell(String t, {Color col = AppTheme.text2}) => SizedBox(
    width: 28,
    child: Text(t, style: GoogleFonts.rajdhani(
      fontSize: 12, color: col), textAlign: TextAlign.center));

  Widget _zoneLegend(Color col, String label) => Row(children: [
    Container(width: 8, height: 8, decoration: BoxDecoration(color: col, shape: BoxShape.circle)),
    const SizedBox(width: 4),
    Text(label, style: GoogleFonts.outfit(fontSize: 9, fontWeight: FontWeight.w600, color: AppTheme.text3)),
  ]);

  Widget _shimmerTable() {
    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(color: AppTheme.surface, borderRadius: BorderRadius.circular(10)),
          child: Row(children: [
            const SizedBox(width: 28),
            const Expanded(child: SizedBox()),
            _colHeader('MP'),
            _colHeader('W'),
            _colHeader('D'),
            _colHeader('L'),
            _colHeader('GD'),
            _colHeader('PTS'),
          ]),
        ),
        const SizedBox(height: 6),
        ...List.generate(8, (i) => Container(
          margin: const EdgeInsets.only(bottom: 4),
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 10),
          decoration: BoxDecoration(
            color: AppTheme.card, borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AppTheme.border)),
          child: Row(children: [
            const SizedBox(width: 31),
            Expanded(child: Container(height: 12, width: 80, color: AppTheme.surface)),
            _colCell(''),
            _colCell(''),
            _colCell(''),
            _colCell(''),
            _colCell(''),
            _colCell(''),
          ]),
        )),
      ],
    );
  }

  Widget _buildErrorState() => Center(
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Icon(Icons.error_outline_rounded, color: AppTheme.danger, size: 48),
      const SizedBox(height: 12),
      Text(_error!, style: GoogleFonts.outfit(color: AppTheme.text2, fontSize: 13)),
      const SizedBox(height: 16),
      ElevatedButton(onPressed: _loadData, child: const Text('Retry')),
    ]));

  Widget _buildEmptyState({String message = 'No leagues configured'}) => Center(
    child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(children: [
        Icon(Icons.emoji_events_rounded, color: AppTheme.text3, size: 48),
        const SizedBox(height: 12),
        Text(message, style: GoogleFonts.outfit(color: AppTheme.text2, fontSize: 13)),
      ]),
    ));
}