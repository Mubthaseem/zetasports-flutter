import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';
import 'player_screen.dart';
import 'package:onesignal_flutter/onesignal_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/firestore_service.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart'; // we might need this if there are ads, or just keep it simple


// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 4+5 — MATCH CENTER  (FotMob / Sofascore style)
// ─────────────────────────────────────────────────────────────────────────────
class MatchDetailScreen extends StatefulWidget {
  final Map<String, dynamic> match;
  const MatchDetailScreen({super.key, required this.match});
  @override
  State<MatchDetailScreen> createState() => _MatchDetailScreenState();
}

class _MatchDetailScreenState extends State<MatchDetailScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tab;
  bool _isSubscribed = false;

  // Supabase match sub-resources
  bool _loadingDetails = true;
  Map<String, dynamic>? _dbMatchInfo;
  Map<String, dynamic>? _dbLineup;
  Map<String, dynamic>? _dbStats;
  List<Map<String, dynamic>> _dbCommentary = [];
  List<Map<String, dynamic>> _dbEvents = [];
  List<Map<String, dynamic>> _dbStandings = [];
  List<Map<String, dynamic>> _dbH2H = [];

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: 6, vsync: this);
    _checkSubscription();
    _loadMatchDetails();
  }

  Future<void> _loadMatchDetails() async {
    final mId = widget.match['id']?.toString() ?? '';
    final leagueId = widget.match['league_id']?.toString() ?? '';
    final homeTeam = widget.match['home_team']?.toString() ?? '';
    final awayTeam = widget.match['away_team']?.toString() ?? '';

    if (mId.isEmpty) {
      if (mounted) setState(() => _loadingDetails = false);
      return;
    }

    if (mounted) setState(() => _loadingDetails = true);

    try {
      final results = await Future.wait([
        SupabaseService.fetchMatchById(mId),
        SupabaseService.fetchLineup(mId),
        SupabaseService.fetchMatchStats(mId),
        SupabaseService.fetchCommentary(mId),
        SupabaseService.fetchMatchEvents(mId),
        leagueId.isNotEmpty ? SupabaseService.fetchLeagueStandings(leagueId) : Future.value(<Map<String, dynamic>>[]),
        SupabaseService.fetchMatches(limit: 50),
      ]);

      if (!mounted) return;

      final matchInfo = results[0] as Map<String, dynamic>?;
      final fetchedLineup = results[1] as Map<String, dynamic>?;
      final fetchedStats = results[2] as Map<String, dynamic>?;
      final fetchedCommentary = List<Map<String, dynamic>>.from(results[3] as List);
      final fetchedEvents = List<Map<String, dynamic>>.from(results[4] as List);
      final fetchedStandings = List<Map<String, dynamic>>.from(results[5] as List);
      final allMatches = List<Map<String, dynamic>>.from(results[6] as List);

      // Filter head-to-head (H2H) meetings between these two teams
      final homeLower = homeTeam.toLowerCase();
      final awayLower = awayTeam.toLowerCase();
      final filteredH2H = allMatches.where((m) {
        final ht = m['home_team']?.toString().toLowerCase() ?? '';
        final at = m['away_team']?.toString().toLowerCase() ?? '';
        final isMatch = (ht == homeLower && at == awayLower) || (ht == awayLower && at == homeLower);
        return isMatch && m['status'] == 'finished';
      }).toList();

      setState(() {
        _dbMatchInfo = matchInfo;
        _dbLineup = fetchedLineup;
        _dbStats = fetchedStats;
        _dbCommentary = fetchedCommentary;
        _dbEvents = fetchedEvents;
        _dbStandings = fetchedStandings;
        _dbH2H = filteredH2H;
        _loadingDetails = false;
      });
    } catch (e) {
      debugPrint('Error loading match details: $e');
      if (mounted) setState(() => _loadingDetails = false);
    }
  }

  Future<void> _checkSubscription() async {
    final prefs = await SharedPreferences.getInstance();
    final matchId = widget.match['id']?.toString() ?? '';
    if (mounted && matchId.isNotEmpty) {
      setState(() {
        _isSubscribed = prefs.getBool('notify_match_$matchId') ?? false;
      });
    }
  }

  Future<void> _toggleNotificationSubscription() async {
    final matchId = widget.match['id']?.toString() ?? '';
    if (matchId.isEmpty) return;

    final prefs = await SharedPreferences.getInstance();
    final nextState = !_isSubscribed;

    try {
      if (nextState) {
        await OneSignal.User.addTagWithKey("match_$matchId", "subscribed");
      } else {
        await OneSignal.User.removeTag("match_$matchId");
      }

      await prefs.setBool('notify_match_$matchId', nextState);

      if (mounted) {
        setState(() {
          _isSubscribed = nextState;
        });

        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(
            nextState ? 'Alert set! You will be notified when this match starts.' : 'Match alerts disabled.',
            style: GoogleFonts.outfit(fontWeight: FontWeight.w600),
          ),
          backgroundColor: nextState ? AppTheme.success : AppTheme.surface,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ));
      }
    } catch (e) {
      debugPrint('OneSignal tag error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Failed to update alerts: $e', style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
          backgroundColor: AppTheme.danger,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ));
      }
    }
  }

  @override
  void dispose() {
    _tab.dispose();
    super.dispose();
  }

  Map<String, dynamic> get m => _dbMatchInfo ?? widget.match;
  bool get _isLive => m['status'] == 'live';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bg,
      body: SafeArea(
        child: Column(
          children: [
            _buildMatchHeader(),
            _buildTabBar(),
            Expanded(
              child: _loadingDetails
                  ? const Center(child: CircularProgressIndicator(color: AppTheme.primary))
                  : TabBarView(
                      controller: _tab,
                      children: [
                        _OverviewTab(
                          match: m,
                          referee: m['referee']?.toString(),
                          venue: m['venue']?.toString(),
                          events: _dbEvents,
                        ),
                        _LineupsTab(
                          match: m,
                          lineup: _dbLineup,
                        ),
                        _StatsTab(
                          match: m,
                          stats: _dbStats,
                        ),
                        _CommentaryTab(
                          match: m,
                          commentary: _dbCommentary,
                        ),
                        _H2HTab(
                          match: m,
                          h2h: _dbH2H,
                        ),
                        _StandingsTabView(
                          match: m,
                          standings: _dbStandings,
                        ),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMatchHeader() {
    return Container(
      color: AppTheme.surface,
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          // Back + title row
          Row(
            children: [
              GestureDetector(
                onTap: () => Navigator.pop(context),
                child: const Icon(Icons.arrow_back_ios_new_rounded, color: AppTheme.text2, size: 18)),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  (m['league_name'] ?? 'Match Center').toString().toUpperCase(),
                  style: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.w800,
                    color: AppTheme.text2, letterSpacing: 0.5),
                  overflow: TextOverflow.ellipsis)),
              IconButton(
                icon: Icon(
                  _isSubscribed ? Icons.star_rounded : Icons.star_outline_rounded,
                  color: _isSubscribed ? AppTheme.warning : AppTheme.text2,
                  size: 20,
                ),
                onPressed: _toggleNotificationSubscription),
            ],
          ),
          const SizedBox(height: 16),
          // Score row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _teamColumn(m['home_team'] ?? 'Brazil', AppTheme.primary),
              // Center score + time
              Column(
                children: [
                  Text('${m['home_score'] ?? 0}  -  ${m['away_score'] ?? 0}',
                    style: GoogleFonts.rajdhani(fontSize: 34, fontWeight: FontWeight.w900, color: AppTheme.text1)),
                  const SizedBox(height: 4),
                  if (_isLive)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                      decoration: BoxDecoration(
                        color: AppTheme.danger.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: AppTheme.danger.withOpacity(0.4))),
                      child: Text(m['time_elapsed'] ?? 'LIVE', style: GoogleFonts.outfit(
                        color: AppTheme.danger, fontSize: 10, fontWeight: FontWeight.w900)))
                  else
                    Text('UPCOMING', style: GoogleFonts.outfit(
                      color: AppTheme.text3, fontSize: 10, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 10),
                  // Watch Now button
                  GestureDetector(
                    onTap: () => Navigator.push(context,
                      MaterialPageRoute(builder: (_) => PlayerScreen(match: m,
                        username: 'GUEST', deviceId: 'DEV'))),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [AppTheme.primary, AppTheme.secondary]),
                        borderRadius: BorderRadius.circular(AppTheme.radiusBtn)),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.play_arrow_rounded, color: Colors.black, size: 14),
                          const SizedBox(width: 4),
                          Text(_isLive ? 'WATCH LIVE' : 'PREVIEW', style: GoogleFonts.outfit(
                            fontSize: 10, fontWeight: FontWeight.w900, color: Colors.black)),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
              _teamColumn(m['away_team'] ?? 'Argentina', AppTheme.secondary),
            ],
          ),
        ],
      ),
    );
  }

  Widget _teamColumn(String name, Color col) {
    final abbr = name.length >= 3 ? name.substring(0, 3).toUpperCase() : name.toUpperCase();
    return Column(
      children: [
        Container(
          width: 54, height: 54,
          decoration: BoxDecoration(
            color: col.withOpacity(0.12),
            shape: BoxShape.circle,
            border: Border.all(color: col.withOpacity(0.4), width: 2)),
          child: Center(child: Text(abbr, style: GoogleFonts.outfit(
            fontSize: 14, fontWeight: FontWeight.w900, color: col)))),
        const SizedBox(height: 8),
        SizedBox(
          width: 80,
          child: Text(name, style: GoogleFonts.outfit(
            fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.text1),
            textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis)),
      ],
    );
  }

  Widget _buildTabBar() {
    return Container(
      color: AppTheme.surface,
      child: TabBar(
        controller: _tab,
        isScrollable: true,
        tabAlignment: TabAlignment.start,
        indicatorColor: AppTheme.primary,
        indicatorSize: TabBarIndicatorSize.tab,
        indicatorWeight: 2,
        labelColor: AppTheme.primary,
        unselectedLabelColor: AppTheme.text3,
        labelStyle: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.w800),
        unselectedLabelStyle: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.w600),
        dividerColor: AppTheme.border,
        tabs: const [
          Tab(text: 'Overview'),
          Tab(text: 'Lineups'),
          Tab(text: 'Stats'),
          Tab(text: 'Commentary'),
          Tab(text: 'H2H'),
          Tab(text: 'Standings'),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 1: OVERVIEW
// ─────────────────────────────────────────────────────────────────────────────
class _OverviewTab extends StatelessWidget {
  final Map<String, dynamic> match;
  final String? referee;
  final String? venue;
  final List<Map<String, dynamic>> events;

  const _OverviewTab({
    required this.match,
    this.referee,
    this.venue,
    required this.events,
  });

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Predictions
        _card(Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('MATCH PREDICTIONS', style: AppTheme.label),
            const SizedBox(height: 14),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _predLabel('${match['home_team'] ?? 'Home'} Win', AppTheme.primary, '63%'),
                _predLabel('Draw', AppTheme.text3, '22%'),
                _predLabel('${match['away_team'] ?? 'Away'} Win', AppTheme.secondary, '15%'),
              ],
            ),
            const SizedBox(height: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: Row(
                children: [
                  Expanded(flex: 63, child: Container(height: 8,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(colors: [AppTheme.primary, AppTheme.secondary])))),
                  Expanded(flex: 22, child: Container(height: 8, color: AppTheme.text3.withOpacity(0.4))),
                  Expanded(flex: 15, child: Container(height: 8, color: AppTheme.secondary.withOpacity(0.6))),
                ],
              ),
            ),
          ],
        )),
        const SizedBox(height: 14),
        // Match Info Details (Referee & Venue)
        _card(Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('MATCH INFO', style: AppTheme.label),
            const SizedBox(height: 12),
            Row(
              children: [
                const Icon(Icons.stadium_rounded, color: AppTheme.text3, size: 16),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Stadium: ${venue ?? match['venue'] ?? 'Not Specified'}',
                    style: GoogleFonts.outfit(fontSize: 12, color: AppTheme.text2, fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                const Icon(Icons.person_outline_rounded, color: AppTheme.text3, size: 16),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Referee: ${referee ?? 'Not Specified'}',
                    style: GoogleFonts.outfit(fontSize: 12, color: AppTheme.text2, fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
          ],
        )),
        const SizedBox(height: 14),
        // Form guide
        _card(Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('RECENT FORM', style: AppTheme.label),
            const SizedBox(height: 12),
            _formRow(match['home_team'] ?? 'Home', ['W','W','D','L','W']),
            const SizedBox(height: 8),
            _formRow(match['away_team'] ?? 'Away', ['W','D','W','W','L']),
          ],
        )),
        const SizedBox(height: 14),
        // Timeline
        _card(Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('MATCH EVENTS', style: AppTheme.label),
            const SizedBox(height: 12),
            if (events.isEmpty) ...[
              _eventRow('12\'', Icons.sports_soccer_rounded, 'GOAL', 'Vinicius Jr. (Assist: Bellingham)', AppTheme.success),
              _eventRow('34\'', Icons.style_rounded, 'YELLOW CARD', 'Rodri (Foul on Valverde)', AppTheme.warning),
              _eventRow('67\'', Icons.sports_soccer_rounded, 'GOAL', 'Haaland (Penalty)', AppTheme.success),
              _eventRow('78\'', Icons.swap_horiz_rounded, 'SUBSTITUTION', 'Benzema ↔ Joselu', AppTheme.primary),
            ] else
              ...events.map((e) {
                final type = e['type']?.toString().toUpperCase() ?? 'INFO';
                IconData icon = Icons.info_outline;
                Color col = AppTheme.primary;
                if (type.contains('GOAL')) {
                  icon = Icons.sports_soccer_rounded;
                  col = AppTheme.success;
                } else if (type.contains('CARD') || type.contains('YELLOW') || type.contains('RED')) {
                  icon = Icons.style_rounded;
                  col = type.contains('RED') ? AppTheme.danger : AppTheme.warning;
                } else if (type.contains('SUB') || type.contains('CHANGE') || type.contains('SWAP')) {
                  icon = Icons.swap_horiz_rounded;
                  col = AppTheme.primary;
                }
                return _eventRow(e['min'] ?? '—', icon, type, e['text'] ?? '', col);
              }),
          ],
        )),
      ],
    );
  }

  Widget _predLabel(String label, Color col, String pct) {
    return Column(
      children: [
        Text(pct, style: GoogleFonts.rajdhani(fontSize: 20, fontWeight: FontWeight.w900, color: col)),
        Text(label, style: GoogleFonts.outfit(fontSize: 9, fontWeight: FontWeight.w700, color: AppTheme.text2)),
      ],
    );
  }

  Widget _formRow(String team, List<String> results) {
    return Row(
      children: [
        SizedBox(width: 80, child: Text(team, style: GoogleFonts.outfit(
          fontSize: 11, fontWeight: FontWeight.w700, color: AppTheme.text2),
          overflow: TextOverflow.ellipsis)),
        ...results.map((r) {
          final col = r == 'W' ? AppTheme.success : r == 'L' ? AppTheme.danger : AppTheme.text3;
          return Container(
            margin: const EdgeInsets.only(left: 6),
            width: 24, height: 24,
            decoration: BoxDecoration(color: col.withOpacity(0.15),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: col.withOpacity(0.4))),
            child: Center(child: Text(r, style: GoogleFonts.outfit(
              fontSize: 9, fontWeight: FontWeight.w900, color: col))));
        }),
      ],
    );
  }

  Widget _eventRow(String time, IconData icon, String type, String desc, Color col) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 32, child: Text(time, style: GoogleFonts.rajdhani(
            color: AppTheme.success, fontSize: 12, fontWeight: FontWeight.w900))),
          Container(
            width: 28, height: 28,
            decoration: BoxDecoration(color: col.withOpacity(0.12),
              shape: BoxShape.circle),
            child: Icon(icon, color: col, size: 14)),
          const SizedBox(width: 10),
          Expanded(child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(type, style: GoogleFonts.outfit(fontSize: 10, fontWeight: FontWeight.w900, color: col)),
              Text(desc, style: GoogleFonts.outfit(fontSize: 11, color: AppTheme.text2)),
            ],
          )),
        ],
      ),
    );
  }

  Widget _card(Widget child) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.border)),
      child: child,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 2: LINEUPS (Screen 5)
// ─────────────────────────────────────────────────────────────────────────────
class _LineupsTab extends StatelessWidget {
  final Map<String, dynamic> match;
  final Map<String, dynamic>? lineup;

  const _LineupsTab({required this.match, this.lineup});

  // Mock 4-3-3 home team
  static const _homeXI = [
    {'name': 'Courtois',   'num': '1',  'pos': 'GK', 'x': 0.50, 'y': 0.88, 'rating': 7.4},
    {'name': 'Carvajal',   'num': '2',  'pos': 'RB', 'x': 0.82, 'y': 0.72, 'rating': 7.1},
    {'name': 'Militão',    'num': '3',  'pos': 'CB', 'x': 0.62, 'y': 0.72, 'rating': 7.5},
    {'name': 'Alaba',      'num': '4',  'pos': 'CB', 'x': 0.38, 'y': 0.72, 'rating': 7.3},
    {'name': 'Mendy',      'num': '23', 'pos': 'LB', 'x': 0.18, 'y': 0.72, 'rating': 7.0},
    {'name': 'Kroos',      'num': '8',  'pos': 'CM', 'x': 0.65, 'y': 0.56, 'rating': 8.1},
    {'name': 'Camavinga',  'num': '12', 'pos': 'CM', 'x': 0.50, 'y': 0.60, 'rating': 7.8},
    {'name': 'Valverde',   'num': '15', 'pos': 'CM', 'x': 0.35, 'y': 0.56, 'rating': 7.6},
    {'name': 'Rodrygo',    'num': '11', 'pos': 'RW', 'x': 0.78, 'y': 0.42, 'rating': 7.9},
    {'name': 'Bellingham', 'num': '5',  'pos': 'AM', 'x': 0.50, 'y': 0.42, 'rating': 8.7},
    {'name': 'Vini Jr.',   'num': '7',  'pos': 'LW', 'x': 0.22, 'y': 0.42, 'rating': 8.4},
  ];

  static const _awayXI = [
    {'name': 'Ederson',   'num': '31', 'pos': 'GK', 'rating': 7.2},
    {'name': 'Walker',    'num': '2',  'pos': 'RB', 'rating': 7.0},
    {'name': 'Ruben Dias','num': '3',  'pos': 'CB', 'rating': 7.6},
    {'name': 'Akanji',    'num': '25', 'pos': 'CB', 'rating': 7.3},
    {'name': 'Gvardiol',  'num': '24', 'pos': 'LB', 'rating': 7.1},
    {'name': 'Rodri',     'num': '16', 'pos': 'DM', 'rating': 7.8},
    {'name': 'Kovacic',   'num': '8',  'pos': 'CM', 'rating': 7.5},
    {'name': 'B. Silva',  'num': '20', 'pos': 'CM', 'rating': 7.7},
    {'name': 'Doku',      'num': '11', 'pos': 'RW', 'rating': 7.9},
    {'name': 'Haaland',   'num': '9',  'pos': 'ST', 'rating': 9.1},
    {'name': 'Grealish',  'num': '10', 'pos': 'LW', 'rating': 7.4},
  ];

  List<Map<String, dynamic>> _parseLineupList(dynamic raw) {
    if (raw == null) return [];
    if (raw is List) {
      return raw.map((e) => Map<String, dynamic>.from(e)).toList();
    }
    return [];
  }

  @override
  Widget build(BuildContext context) {
    final homeList = _parseLineupList(lineup?['home_players']);
    final awayList = _parseLineupList(lineup?['away_players']);

    final homePlayers = homeList.isNotEmpty ? homeList : _homeXI;
    final awayPlayers = awayList.isNotEmpty ? awayList : _awayXI;

    final homeForm = lineup?['home_formation']?.toString() ?? '4-3-3';
    final awayForm = lineup?['away_formation']?.toString() ?? '4-3-3';

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Formation selector row
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppTheme.card,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppTheme.border)),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _formChip(match['home_team'] ?? 'Home', homeForm, AppTheme.primary, true),
              Container(width: 1, height: 30, color: AppTheme.border),
              _formChip(match['away_team'] ?? 'Away', awayForm, AppTheme.secondary, false),
            ],
          ),
        ),
        const SizedBox(height: 14),
        // Pitch visual
        Container(
          height: 340,
          decoration: BoxDecoration(
            color: const Color(0xFF0A2E15),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppTheme.border)),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: CustomPaint(
              painter: _PitchPainter(),
              child: Stack(
                children: homePlayers.map((p) => _playerDot(p)).toList(),
              ),
            ),
          ),
        ),
        const SizedBox(height: 20),
        // Player ratings side by side
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: _ratingsList(match['home_team'] ?? 'Home', homePlayers, AppTheme.primary)),
            const SizedBox(width: 12),
            Expanded(child: _ratingsList(match['away_team'] ?? 'Away', awayPlayers, AppTheme.secondary)),
          ],
        ),
      ],
    );
  }

  Widget _formChip(String team, String formation, Color col, bool active) {
    return Column(
      children: [
        Text(team, style: GoogleFonts.outfit(
          fontSize: 11, fontWeight: FontWeight.w700,
          color: active ? AppTheme.text1 : AppTheme.text2),
          overflow: TextOverflow.ellipsis),
        const SizedBox(height: 4),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: col.withOpacity(0.12),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: col.withOpacity(0.3))),
          child: Text(formation, style: GoogleFonts.rajdhani(
            fontSize: 14, fontWeight: FontWeight.w900, color: col))),
      ],
    );
  }

  Widget _playerDot(Map<String, dynamic> p) {
    final x = (p['x'] as double);
    final y = (p['y'] as double);
    final rating = (p['rating'] as double);
    final col = rating >= 8.5 ? AppTheme.success : rating >= 8.0 ? AppTheme.warning : AppTheme.primary;

    return Positioned(
      left: x * 340 - 20, // 340 = approx rendered width
      top: y * 340 - 20,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 30, height: 30,
            decoration: BoxDecoration(
              color: col, shape: BoxShape.circle,
              boxShadow: [BoxShadow(color: col.withOpacity(0.4), blurRadius: 6)]),
            child: Center(child: Text(p['num'].toString(), style: GoogleFonts.outfit(
              fontSize: 9, fontWeight: FontWeight.w900, color: Colors.black)))),
          Container(
            margin: const EdgeInsets.only(top: 2),
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
            color: Colors.black54,
            child: Text(p['name'].toString().split(' ').last, style: GoogleFonts.outfit(
              color: Colors.white, fontSize: 7, fontWeight: FontWeight.w700))),
        ],
      ),
    );
  }

  Widget _ratingsList(String team, List<Map<String, dynamic>> players, Color col) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppTheme.border)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(team, style: GoogleFonts.outfit(
            fontSize: 11, fontWeight: FontWeight.w900, color: col),
            overflow: TextOverflow.ellipsis),
          const SizedBox(height: 10),
          ...players.map((p) => _playerRatingRow(p, col)),
        ],
      ),
    );
  }

  Widget _playerRatingRow(Map<String, dynamic> p, Color col) {
    final r = p['rating'] as double;
    final rCol = r >= 8.0 ? AppTheme.success : AppTheme.text3;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(child: Text(p['name'].toString(), style: GoogleFonts.outfit(
            fontSize: 10, fontWeight: FontWeight.w600, color: AppTheme.text2),
            overflow: TextOverflow.ellipsis)),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
            decoration: BoxDecoration(
              color: rCol.withOpacity(0.12),
              borderRadius: BorderRadius.circular(5)),
            child: Text(r.toStringAsFixed(1), style: GoogleFonts.rajdhani(
              fontSize: 11, fontWeight: FontWeight.w900, color: rCol))),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 3: STATS
// ─────────────────────────────────────────────────────────────────────────────
class _StatsTab extends StatelessWidget {
  final Map<String, dynamic> match;
  final Map<String, dynamic>? stats;

  const _StatsTab({required this.match, this.stats});

  static const _mockStats = [
    {'label': 'Possession',         'home': 56, 'away': 44},
    {'label': 'Shots',              'home': 12, 'away': 9},
    {'label': 'Shots on Target',    'home': 5,  'away': 3},
    {'label': 'Pass Accuracy',      'home': 88, 'away': 82},
    {'label': 'Corners',            'home': 4,  'away': 2},
    {'label': 'Expected Goals',     'home': 2.4,'away': 1.2},
    {'label': 'Fouls',              'home': 8,  'away': 11},
    {'label': 'Yellow Cards',       'home': 1,  'away': 2},
  ];

  // Mock momentum data: positive = home, negative = away
  static const _momentum = [0.4, 0.7, 0.3, -0.5, -0.8, 0.2, 0.9, 1.0, -0.3,
    -0.6, -0.9, 0.1, 0.5, 0.4, -0.2, 0.1, 0.8, 1.1, -0.1, -0.5,
    -1.0, 0.2, 0.4, 0.7, -0.3, 0.3, 0.2, -0.2, 0.5, 0.1];

  @override
  Widget build(BuildContext context) {
    final List<Map<String, dynamic>> displayStats = stats != null
        ? [
            {'label': 'Possession', 'home': stats!['possession_home'] ?? 50, 'away': stats!['possession_away'] ?? 50},
            {'label': 'Shots', 'home': stats!['shots_home'] ?? 0, 'away': stats!['shots_away'] ?? 0},
            {'label': 'Shots on Target', 'home': stats!['shots_on_target_home'] ?? 0, 'away': stats!['shots_on_target_away'] ?? 0},
            {'label': 'Pass Accuracy', 'home': stats!['pass_accuracy_home'] ?? 0, 'away': stats!['pass_accuracy_away'] ?? 0},
            {'label': 'Corners', 'home': stats!['corners_home'] ?? 0, 'away': stats!['corners_away'] ?? 0},
            {'label': 'Expected Goals', 'home': stats!['xg_home'] ?? 0.0, 'away': stats!['xg_away'] ?? 0.0},
            {'label': 'Fouls', 'home': stats!['fouls_home'] ?? 0, 'away': stats!['fouls_away'] ?? 0},
            {'label': 'Yellow Cards', 'home': stats!['yellow_cards_home'] ?? 0, 'away': stats!['yellow_cards_away'] ?? 0},
          ]
        : _mockStats;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Momentum graph
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppTheme.card, borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppTheme.border)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('MATCH MOMENTUM', style: AppTheme.label),
              const SizedBox(height: 4),
              Row(
                children: [
                  _dot(AppTheme.primary),
                  const SizedBox(width: 4),
                  Text(match['home_team'] ?? 'Home', style: GoogleFonts.outfit(fontSize: 10, color: AppTheme.text2)),
                  const SizedBox(width: 12),
                  _dot(AppTheme.secondary),
                  const SizedBox(width: 4),
                  Text(match['away_team'] ?? 'Away', style: GoogleFonts.outfit(fontSize: 10, color: AppTheme.text2)),
                ],
              ),
              const SizedBox(height: 14),
              SizedBox(
                height: 100,
                child: CustomPaint(
                  painter: _MomentumPainter(_momentum),
                  size: const Size.fromHeight(100))),
              const SizedBox(height: 6),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text("0'", style: AppTheme.caption),
                  Text("45'", style: AppTheme.caption),
                  Text("90'", style: AppTheme.caption),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        // Stats bars
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppTheme.card, borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppTheme.border)),
          child: Column(
            children: displayStats.map((s) => _statRow(s)).toList(),
          ),
        ),
      ],
    );
  }

  Widget _dot(Color col) => Container(
    width: 8, height: 8, decoration: BoxDecoration(color: col, shape: BoxShape.circle));

  Widget _statRow(Map<String, dynamic> s) {
    final h = (s['home'] as num).toDouble();
    final a = (s['away'] as num).toDouble();
    final total = h + a;
    final pct = total > 0 ? h / total : 0.5;
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(s['home'].toString(), style: GoogleFonts.rajdhani(
                fontSize: 14, fontWeight: FontWeight.w900, color: AppTheme.text1)),
              Text(s['label'].toString(), style: GoogleFonts.outfit(
                fontSize: 11, fontWeight: FontWeight.w600, color: AppTheme.text2)),
              Text(s['away'].toString(), style: GoogleFonts.rajdhani(
                fontSize: 14, fontWeight: FontWeight.w900, color: AppTheme.text1)),
            ],
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: Stack(
              children: [
                Container(height: 6, color: AppTheme.secondary.withOpacity(0.3)),
                FractionallySizedBox(
                  widthFactor: pct,
                  child: Container(
                    height: 6,
                    decoration: const BoxDecoration(
                      gradient: LinearGradient(colors: [AppTheme.primary, AppTheme.secondary])))),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 4: COMMENTARY
// ─────────────────────────────────────────────────────────────────────────────
class _CommentaryTab extends StatelessWidget {
  final Map<String, dynamic> match;
  final List<Map<String, dynamic>> commentary;

  const _CommentaryTab({required this.match, required this.commentary});

  static const _mockComments = [
    {'min': "90'+3'", 'text': 'Full time whistle! What a spectacular encounter!', 'type': 'ft'},
    {'min': "88'",    'text': 'Bellingham goes for goal but it\'s deflected wide for a corner.', 'type': 'normal'},
    {'min': "78'",    'text': 'GOAL! Vinicius Jr. dances past three defenders and fires into the bottom corner! 2-1!', 'type': 'goal'},
    {'min': "67'",    'text': 'GOAL! Haaland converts the penalty calmly. 1-1.', 'type': 'goal'},
    {'min': "65'",    'text': 'Penalty awarded to Man City! Rodri fouled in the box.', 'type': 'var'},
    {'min': "56'",    'text': 'VAR check complete — penalty stands.', 'type': 'var'},
    {'min': "34'",    'text': 'YELLOW CARD! Rodri is booked for a cynical foul on Valverde.', 'type': 'card'},
    {'min': "12'",    'text': 'GOAL! Real Madrid open the scoring through Bellingham who heads in from a Kroos corner. 1-0!', 'type': 'goal'},
    {'min': "1'",     'text': 'KICK OFF! Real Madrid get us underway in Madrid!', 'type': 'ko'},
  ];

  @override
  Widget build(BuildContext context) {
    final displayComments = commentary.isNotEmpty ? commentary : _mockComments;

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: displayComments.length,
      itemBuilder: (_, i) {
        final c = displayComments[i];
        final type = c['type']?.toString().toLowerCase() ?? 'normal';
        final isGoal = type == 'goal';
        final isCard = type == 'card' || type.contains('yellow') || type.contains('red');
        final isVar  = type == 'var';
        Color col = AppTheme.text3;
        IconData icon = Icons.fiber_manual_record;
        if (isGoal) { col = AppTheme.success; icon = Icons.sports_soccer_rounded; }
        if (isCard) { col = AppTheme.warning; icon = Icons.style_rounded; }
        if (isVar)  { col = AppTheme.primary; icon = Icons.videocam_rounded; }

        return Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: isGoal ? AppTheme.success.withOpacity(0.05) : AppTheme.card,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: isGoal ? AppTheme.success.withOpacity(0.2) : AppTheme.border)),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(width: 36, child: Text(c['min']?.toString() ?? '—', style: GoogleFonts.rajdhani(
                color: AppTheme.success, fontSize: 12, fontWeight: FontWeight.w900))),
              Container(width: 26, height: 26,
                decoration: BoxDecoration(color: col.withOpacity(0.12), shape: BoxShape.circle),
                child: Icon(icon, color: col, size: 13)),
              const SizedBox(width: 10),
              Expanded(child: Text(c['text']!, style: GoogleFonts.outfit(
                fontSize: 12, color: AppTheme.text2,
                fontWeight: isGoal ? FontWeight.w700 : FontWeight.w500))),
            ],
          ),
        );
      },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 5: H2H
// ─────────────────────────────────────────────────────────────────────────────
class _H2HTab extends StatelessWidget {
  final Map<String, dynamic> match;
  final List<Map<String, dynamic>> h2h;

  const _H2HTab({required this.match, required this.h2h});

  static const _mockH2h = [
    {'date': '2025-11-23', 'comp': 'Champions League', 'home': 'Real Madrid', 'score': '3 - 1', 'away': 'Man City', 'winner': 'home'},
    {'date': '2025-04-12', 'comp': 'Champions League', 'home': 'Man City', 'score': '2 - 2', 'away': 'Real Madrid', 'winner': 'draw'},
    {'date': '2024-10-05', 'comp': 'UCL QF',           'home': 'Real Madrid', 'score': '1 - 1', 'away': 'Man City', 'winner': 'draw'},
    {'date': '2024-05-17', 'comp': 'UCL Final',        'home': 'Real Madrid', 'score': '2 - 0', 'away': 'Man City', 'winner': 'home'},
    {'date': '2023-11-02', 'comp': 'Champions League', 'home': 'Man City', 'score': '3 - 2', 'away': 'Real Madrid', 'winner': 'home'},
  ];

  @override
  Widget build(BuildContext context) {
    final homeTeam = match['home_team']?.toString() ?? 'Home';
    final awayTeam = match['away_team']?.toString() ?? 'Away';

    int homeWins = 0;
    int awayWins = 0;
    int draws = 0;

    final List<Map<String, dynamic>> displayH2H = h2h.isNotEmpty
        ? h2h.map((m) {
            final hs = m['home_score'] ?? 0;
            final as = m['away_score'] ?? 0;
            final ht = m['home_team']?.toString() ?? '';
            final at = m['away_team']?.toString() ?? '';

            String winner = 'draw';
            if (hs > as) {
              winner = ht.toLowerCase() == homeTeam.toLowerCase() ? 'home' : 'away';
            } else if (as > hs) {
              winner = at.toLowerCase() == homeTeam.toLowerCase() ? 'home' : 'away';
            }

            if (winner == 'home') homeWins++;
            if (winner == 'away') awayWins++;
            if (winner == 'draw') draws++;

            return {
              'date': m['date'] != null ? m['date'].toString().split('T')[0] : '—',
              'comp': m['league']?['name'] ?? m['league_name'] ?? 'Match fixture',
              'home': ht,
              'score': '$hs - $as',
              'away': at,
              'winner': winner,
            };
          }).toList()
        : _mockH2h.map((e) {
            if (e['winner'] == 'home') homeWins++;
            if (e['winner'] == 'away') awayWins++;
            if (e['winner'] == 'draw') draws++;
            return e;
          }).toList();

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Summary row
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: AppTheme.card,
            borderRadius: BorderRadius.circular(16), border: Border.all(color: AppTheme.border)),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _h2hStat(homeWins.toString(), homeTeam, AppTheme.primary),
              _h2hStat(draws.toString(), 'Draws', AppTheme.text3),
              _h2hStat(awayWins.toString(), awayTeam, AppTheme.secondary),
            ],
          ),
        ),
        const SizedBox(height: 14),
        ...displayH2H.map((h) {
          final winHome = h['winner'] == 'home';
          final draw = h['winner'] == 'draw';
          return Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: AppTheme.card,
              borderRadius: BorderRadius.circular(12), border: Border.all(color: AppTheme.border)),
            child: Column(
              children: [
                Row(children: [
                  Text(h['comp']!.toString(), style: GoogleFonts.outfit(fontSize: 9, color: AppTheme.text3, fontWeight: FontWeight.w700)),
                  const Spacer(),
                  Text(h['date']!.toString(), style: GoogleFonts.outfit(fontSize: 9, color: AppTheme.text3)),
                ]),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(child: Text(h['home']!.toString(), style: GoogleFonts.outfit(
                      fontSize: 12, fontWeight: winHome && !draw ? FontWeight.w800 : FontWeight.w500,
                      color: winHome && !draw ? AppTheme.text1 : AppTheme.text2),
                      textAlign: TextAlign.start)),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
                      decoration: BoxDecoration(color: AppTheme.surface, borderRadius: BorderRadius.circular(8)),
                      child: Text(h['score']!.toString(), style: GoogleFonts.rajdhani(
                        fontSize: 16, fontWeight: FontWeight.w900, color: AppTheme.text1))),
                    Expanded(child: Text(h['away']!.toString(), style: GoogleFonts.outfit(
                      fontSize: 12, fontWeight: !winHome && !draw ? FontWeight.w800 : FontWeight.w500,
                      color: !winHome && !draw ? AppTheme.text1 : AppTheme.text2),
                      textAlign: TextAlign.end)),
                  ],
                ),
              ],
            ),
          );
        }),
      ],
    );
  }

  Widget _h2hStat(String count, String label, Color col) {
    return Column(
      children: [
        Text(count, style: GoogleFonts.rajdhani(fontSize: 28, fontWeight: FontWeight.w900, color: col)),
        Text(label, style: GoogleFonts.outfit(fontSize: 10, fontWeight: FontWeight.w600, color: AppTheme.text2),
          overflow: TextOverflow.ellipsis),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 6: STANDINGS (mini)
// ─────────────────────────────────────────────────────────────────────────────
class _StandingsTabView extends StatelessWidget {
  final Map<String, dynamic> match;
  final List<Map<String, dynamic>> standings;

  const _StandingsTabView({required this.match, required this.standings});

  static const _mockRows = [
    {'pos': 1, 'team': 'Liverpool',    'p': 32, 'pts': 74, 'zone': 'cl'},
    {'pos': 2, 'team': 'Arsenal',      'p': 32, 'pts': 71, 'zone': 'cl'},
    {'pos': 3, 'team': 'Man City',     'p': 32, 'pts': 70, 'zone': 'cl'},
    {'pos': 4, 'team': 'Chelsea',      'p': 32, 'pts': 58, 'zone': 'el'},
    {'pos': 5, 'team': 'Tottenham',    'p': 32, 'pts': 57, 'zone': 'none'},
    {'pos': 6, 'team': 'Man United',   'p': 32, 'pts': 54, 'zone': 'none'},
    {'pos': 7, 'team': 'West Ham',     'p': 32, 'pts': 50, 'zone': 'none'},
    {'pos': 8, 'team': 'Newcastle',    'p': 32, 'pts': 49, 'zone': 'none'},
    {'pos': 17,'team': 'Burnley',      'p': 32, 'pts': 26, 'zone': 'rel'},
    {'pos': 18,'team': 'Sheffield Utd','p': 32, 'pts': 21, 'zone': 'rel'},
  ];

  @override
  Widget build(BuildContext context) {
    final List<Map<String, dynamic>> displayRows = standings.isNotEmpty
        ? standings.map((s) => {
            'pos': s['position'] ?? 0,
            'team': s['team_name'] ?? 'Team',
            'p': s['played'] ?? 0,
            'pts': s['points'] ?? 0,
            'zone': s['zone']?.toString() ?? 'none'
          }).toList()
        : _mockRows;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Zone legend
        Row(children: [
          _zoneDot(AppTheme.success), const SizedBox(width: 6),
          Text('Champions League', style: AppTheme.caption),
          const SizedBox(width: 14),
          _zoneDot(AppTheme.warning), const SizedBox(width: 6),
          Text('Europa League', style: AppTheme.caption),
          const SizedBox(width: 14),
          _zoneDot(AppTheme.danger), const SizedBox(width: 6),
          Text('Relegation', style: AppTheme.caption),
        ]),
        const SizedBox(height: 12),
        Container(
          decoration: BoxDecoration(
            color: AppTheme.card, borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppTheme.border)),
          child: Column(
            children: [
              // Header
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                child: Row(children: [
                  SizedBox(width: 28, child: Text('#', style: AppTheme.label)),
                  Expanded(child: Text('CLUB', style: AppTheme.label)),
                  SizedBox(width: 28, child: Text('P', style: AppTheme.label, textAlign: TextAlign.center)),
                  SizedBox(width: 36, child: Text('PTS', style: AppTheme.label, textAlign: TextAlign.center)),
                ])),
              Divider(color: AppTheme.border, height: 1),
              ...displayRows.asMap().entries.map((e) {
                final i = e.key;
                final row = e.value;
                final zone = row['zone'].toString();
                Color zoneCol = Colors.transparent;
                if (zone == 'cl') zoneCol = AppTheme.success;
                if (zone == 'el') zoneCol = AppTheme.warning;
                if (zone == 'rel') zoneCol = AppTheme.danger;
                final ptsCol = zone == 'cl' ? AppTheme.success : zone == 'rel' ? AppTheme.danger : AppTheme.text1;

                return Container(
                  decoration: BoxDecoration(
                    color: i.isEven ? Colors.transparent : AppTheme.surface.withOpacity(0.3),
                    borderRadius: i == displayRows.length - 1
                      ? const BorderRadius.only(bottomLeft: Radius.circular(16), bottomRight: Radius.circular(16))
                      : null),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    child: Row(children: [
                      // Zone color bar
                      Container(
                        width: 3, height: 18,
                        margin: const EdgeInsets.only(right: 8),
                        decoration: BoxDecoration(
                          color: zoneCol, borderRadius: BorderRadius.circular(2))),
                      SizedBox(width: 20, child: Text('${row['pos']}', style: GoogleFonts.rajdhani(
                        fontSize: 12, fontWeight: FontWeight.w700,
                        color: ptsCol))),
                      Expanded(child: Text(row['team'].toString(), style: GoogleFonts.outfit(
                        fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.text1))),
                      SizedBox(width: 28, child: Text('${row['p']}', style: GoogleFonts.rajdhani(
                        fontSize: 13, color: AppTheme.text2), textAlign: TextAlign.center)),
                      SizedBox(width: 36, child: Text('${row['pts']}', style: GoogleFonts.rajdhani(
                        fontSize: 15, fontWeight: FontWeight.w900, color: ptsCol), textAlign: TextAlign.center)),
                    ]),
                  ),
                );
              }),
            ],
          ),
        ),
      ],
    );
  }

  Widget _zoneDot(Color col) => Container(
    width: 8, height: 8,
    decoration: BoxDecoration(color: col, shape: BoxShape.circle));
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM PAINTERS
// ─────────────────────────────────────────────────────────────────────────────
class _PitchPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = Colors.white.withOpacity(0.15)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.0;
    final W = size.width;
    final H = size.height;
    // Outline
    canvas.drawRect(Rect.fromLTWH(0, 0, W, H), p);
    // Halfway line
    canvas.drawLine(Offset(0, H / 2), Offset(W, H / 2), p);
    // Centre circle
    canvas.drawCircle(Offset(W / 2, H / 2), 40, p);
    // Centre dot
    canvas.drawCircle(Offset(W / 2, H / 2), 2, p..style = PaintingStyle.fill);
    p.style = PaintingStyle.stroke;
    // Top penalty
    canvas.drawRect(Rect.fromLTWH(W * 0.22, 0, W * 0.56, H * 0.18), p);
    // Bottom penalty
    canvas.drawRect(Rect.fromLTWH(W * 0.22, H * 0.82, W * 0.56, H * 0.18), p);
    // Top 6-yard
    canvas.drawRect(Rect.fromLTWH(W * 0.35, 0, W * 0.30, H * 0.08), p);
    // Bottom 6-yard
    canvas.drawRect(Rect.fromLTWH(W * 0.35, H * 0.92, W * 0.30, H * 0.08), p);
  }

  @override
  bool shouldRepaint(_) => false;
}

class _MomentumPainter extends CustomPainter {
  final List<double> data;
  const _MomentumPainter(this.data);

  @override
  void paint(Canvas canvas, Size size) {
    final midY = size.height / 2;
    final barW = (size.width - 8) / data.length;
    final maxVal = 1.2;

    for (int i = 0; i < data.length; i++) {
      final val = data[i];
      final x = i * barW + 4;
      final barH = (val.abs() / maxVal) * midY;

      final paint = Paint()
        ..color = val >= 0
          ? AppTheme.primary.withOpacity(0.85)
          : AppTheme.secondary.withOpacity(0.85);

      final top    = val >= 0 ? midY - barH : midY;
      final bottom = val >= 0 ? midY : midY + barH;

      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTRB(x, top, x + barW - 2, bottom),
          const Radius.circular(2)),
        paint);
    }

    // Midline
    canvas.drawLine(
      Offset(0, midY), Offset(size.width, midY),
      Paint()..color = Colors.white.withOpacity(0.12)..strokeWidth = 1);
  }

  @override
  bool shouldRepaint(_) => false;
}
