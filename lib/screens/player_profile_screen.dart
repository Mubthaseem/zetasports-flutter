import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 8 — PLAYER PROFILE
// ─────────────────────────────────────────────────────────────────────────────
class PlayerProfileScreen extends StatefulWidget {
  final String playerName;
  final double rating;
  final Map<String, dynamic>? player;
  const PlayerProfileScreen({
    super.key,
    required this.playerName,
    required this.rating,
    this.player,
  });
  @override
  State<PlayerProfileScreen> createState() => _PlayerProfileScreenState();
}

class _PlayerProfileScreenState extends State<PlayerProfileScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tab;

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: 4, vsync: this);
  }

  @override
  void dispose() {
    _tab.dispose();
    super.dispose();
  }

  Map<String, String> get _bio => {
    'Nationality': widget.player?['nationality']?.toString() ?? 'International',
    'Position': widget.player?['position']?.toString() ?? 'Player',
    'Current Club': widget.player?['team_name']?.toString() ?? widget.player?['club']?.toString() ?? 'Club',
    'Jersey Number': widget.player?['number']?.toString() ?? widget.player?['jersey_number']?.toString() ?? '-',
    'Age': widget.player?['age']?.toString() ?? '-',
    'Height': widget.player?['height']?.toString() ?? '-',
  };

  List<Map<String, dynamic>> get _seasonStats {
    final g = int.tryParse(widget.player?['goals']?.toString() ?? '') ?? 0;
    final a = int.tryParse(widget.player?['assists']?.toString() ?? '') ?? 0;
    final r = widget.rating;
    return [
      {'label': 'Goals', 'value': g, 'max': 30},
      {'label': 'Assists', 'value': a, 'max': 20},
      {'label': 'Rating', 'value': r.toInt(), 'max': 10},
    ];
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bg,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeroHeader(context),
            _buildTabBar(),
            Expanded(
              child: TabBarView(
                controller: _tab,
                children: [
                  _buildOverview(),
                  _buildStats(),
                  _buildMatches(),
                  _buildCareer(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeroHeader(BuildContext context) {
    return Container(
      color: AppTheme.surface,
      child: Column(
        children: [
          // Back button + title row
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: Row(
              children: [
                GestureDetector(
                  onTap: () => Navigator.pop(context),
                  child: const Icon(Icons.arrow_back_ios_new_rounded,
                    color: AppTheme.text2, size: 18)),
                const SizedBox(width: 12),
                Text('Player Profile', style: GoogleFonts.outfit(
                  fontSize: 14, fontWeight: FontWeight.w800, color: AppTheme.text2)),
                const Spacer(),
                const Icon(Icons.share_outlined, color: AppTheme.text2, size: 20),
                const SizedBox(width: 12),
                const Icon(Icons.star_outline_rounded, color: AppTheme.text2, size: 20),
              ],
            ),
          ),
          const SizedBox(height: 20),
          // Player image + name + rating
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                // Avatar
                Stack(
                  children: [
                    Container(
                      width: 90, height: 90,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: const LinearGradient(
                          colors: [AppTheme.primary, AppTheme.secondary],
                          begin: Alignment.topLeft, end: Alignment.bottomRight),
                        boxShadow: [
                          BoxShadow(color: AppTheme.primary.withOpacity(0.3),
                            blurRadius: 20, offset: const Offset(0, 8))]),
                      child: ClipOval(
                        child: Image.network(
                          'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop',
                          fit: BoxFit.cover))),
                    // Rating badge
                    Positioned(
                      bottom: 0, right: 0,
                      child: Container(
                        width: 28, height: 28,
                        decoration: BoxDecoration(
                          color: AppTheme.bg,
                          shape: BoxShape.circle,
                          border: Border.all(color: AppTheme.primary, width: 2)),
                        child: Center(child: Text(widget.rating.toStringAsFixed(1),
                          style: GoogleFonts.rajdhani(
                            fontSize: 9, fontWeight: FontWeight.w900, color: AppTheme.primary))))),
                  ],
                ),
                const SizedBox(width: 20),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(widget.playerName, style: GoogleFonts.outfit(
                        fontSize: 20, fontWeight: FontWeight.w900, color: AppTheme.text1)),
                      const SizedBox(height: 4),
                      Text('${widget.player?['position'] ?? 'Player'} • ${widget.player?['team_name'] ?? widget.player?['club'] ?? 'Squad'}', style: GoogleFonts.outfit(
                        fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.text2)),
                      const SizedBox(height: 8),
                      // Rating pill
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [AppTheme.primary, AppTheme.secondary]),
                          borderRadius: BorderRadius.circular(20)),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.star_rounded, color: Colors.black, size: 12),
                            const SizedBox(width: 4),
                            Text('${widget.rating} Overall Rating', style: GoogleFonts.outfit(
                              fontSize: 10, fontWeight: FontWeight.w900, color: Colors.black)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          // Quick stats row
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _quickStat('${widget.player?['goals'] ?? 0}', 'Goals'),
                _divider(),
                _quickStat('${widget.player?['assists'] ?? 0}', 'Assists'),
                _divider(),
                _quickStat('${widget.player?['matches'] ?? widget.player?['appearances'] ?? '-'}', 'Matches'),
                _divider(),
                _quickStat('${widget.player?['minutes'] ?? '-'}', 'Minutes'),
              ],
            ),
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }

  Widget _quickStat(String val, String label) => Column(children: [
    Text(val, style: GoogleFonts.rajdhani(
      fontSize: 20, fontWeight: FontWeight.w900, color: AppTheme.text1)),
    Text(label, style: GoogleFonts.outfit(
      fontSize: 10, fontWeight: FontWeight.w600, color: AppTheme.text3)),
  ]);

  Widget _divider() => Container(
    width: 1, height: 28, color: AppTheme.border);

  Widget _buildTabBar() {
    return Container(
      color: AppTheme.surface,
      child: TabBar(
        controller: _tab,
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
          Tab(text: 'Stats'),
          Tab(text: 'Matches'),
          Tab(text: 'Career'),
        ],
      ),
    );
  }

  Widget _buildOverview() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _sectionCard('BIOGRAPHY', Column(
          children: _bio.entries.map((e) => Column(
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 10),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(e.key, style: GoogleFonts.outfit(
                      fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.text3)),
                    Text(e.value, style: GoogleFonts.outfit(
                      fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.text1)),
                  ],
                ),
              ),
              if (e.key != _bio.keys.last)
                Divider(color: AppTheme.border, height: 1),
            ],
          )).toList(),
        )),
      ],
    );
  }

  Widget _buildStats() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _sectionCard('SEASON PERFORMANCE', Column(
          children: _seasonStats.map((s) {
            final val = s['value'] as int;
            final max = s['max'] as int;
            final pct = val / max;
            return Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(s['label'].toString(), style: GoogleFonts.outfit(
                        fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.text2)),
                      Text('$val / $max', style: GoogleFonts.rajdhani(
                        fontSize: 14, fontWeight: FontWeight.w900, color: AppTheme.primary)),
                    ],
                  ),
                  const SizedBox(height: 8),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: Stack(children: [
                      Container(height: 8,
                        decoration: BoxDecoration(
                          color: AppTheme.surface,
                          borderRadius: BorderRadius.circular(4))),
                      FractionallySizedBox(
                        widthFactor: pct,
                        child: Container(
                          height: 8,
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [AppTheme.primary, AppTheme.secondary]),
                            borderRadius: BorderRadius.circular(4),
                            boxShadow: [
                              BoxShadow(color: AppTheme.primary.withOpacity(0.3),
                                blurRadius: 8)]),
                        )),
                    ]),
                  ),
                ],
              ),
            );
          }).toList(),
        )),
      ],
    );
  }

  Widget _buildMatches() {
    final matches = (widget.player?['recent_matches'] as List<dynamic>?) ?? [];
    if (matches.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.sports_soccer_outlined, color: AppTheme.text3, size: 40),
              const SizedBox(height: 12),
              Text('No Recent Match Logs', style: GoogleFonts.outfit(
                fontSize: 14, fontWeight: FontWeight.w700, color: AppTheme.text2)),
              const SizedBox(height: 4),
              Text('Match appearances and ratings will appear here as matches are played.',
                textAlign: TextAlign.center,
                style: GoogleFonts.outfit(fontSize: 11, color: AppTheme.text3)),
            ],
          ),
        ),
      );
    }
    return ListView(
      padding: const EdgeInsets.all(16),
      children: matches.map((m) {
        final match = m is Map ? m : <String, dynamic>{};
        final goals = int.tryParse(match['goals']?.toString() ?? '') ?? 0;
        final rating = double.tryParse(match['rating']?.toString() ?? '') ?? 0.0;
        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppTheme.card, borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppTheme.border)),
          child: Row(children: [
            Expanded(child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(match['opp']?.toString() ?? match['opponent']?.toString() ?? 'Match', style: GoogleFonts.outfit(
                  fontSize: 13, fontWeight: FontWeight.w800, color: AppTheme.text1)),
                Text(match['comp']?.toString() ?? match['competition']?.toString() ?? '', style: GoogleFonts.outfit(
                  fontSize: 11, color: AppTheme.text3)),
                Text(match['date']?.toString() ?? '', style: GoogleFonts.outfit(
                  fontSize: 10, color: AppTheme.text3)),
              ],
            )),
            if (goals > 0)
              Container(
                margin: const EdgeInsets.only(right: 8),
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppTheme.success.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(6)),
                child: Text('$goals ⚽', style: GoogleFonts.outfit(
                  fontSize: 11, fontWeight: FontWeight.w700, color: AppTheme.success))),
            if (rating > 0)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: rating >= 8.0
                    ? AppTheme.success.withOpacity(0.12)
                    : AppTheme.card,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: AppTheme.border)),
                child: Text(rating.toStringAsFixed(1), style: GoogleFonts.rajdhani(
                  fontSize: 14, fontWeight: FontWeight.w900,
                  color: rating >= 8.0 ? AppTheme.success : AppTheme.text2))),
          ]),
        );
      }).toList(),
    );
  }

  Widget _buildCareer() {
    final career = (widget.player?['career'] as List<dynamic>?) ?? [];
    if (career.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.history_toggle_off_rounded, color: AppTheme.text3, size: 40),
              const SizedBox(height: 12),
              Text('Career History Not Available', style: GoogleFonts.outfit(
                fontSize: 14, fontWeight: FontWeight.w700, color: AppTheme.text2)),
              const SizedBox(height: 4),
              Text('Historical transfer and club records will be synced soon.',
                textAlign: TextAlign.center,
                style: GoogleFonts.outfit(fontSize: 11, color: AppTheme.text3)),
            ],
          ),
        ),
      );
    }
    return ListView(
      padding: const EdgeInsets.all(16),
      children: career.map((c) {
        final item = c is Map ? c : <String, dynamic>{};
        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppTheme.card, borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppTheme.border)),
          child: Row(children: [
            Expanded(child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item['club']?.toString() ?? 'Club', style: GoogleFonts.outfit(
                  fontSize: 14, fontWeight: FontWeight.w800, color: AppTheme.text1)),
                Text('${item['from'] ?? ''} – ${item['to'] ?? 'Present'}', style: GoogleFonts.outfit(
                  fontSize: 11, color: AppTheme.text3)),
              ],
            )),
            _statPill('${item['apps'] ?? '-'}', 'Apps'),
            const SizedBox(width: 8),
            _statPill('${item['goals'] ?? '-'}', 'Goals', col: AppTheme.success),
          ]),
        );
      }).toList(),
    );
  }

  Widget _statPill(String val, String label, {Color col = AppTheme.primary}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: col.withOpacity(0.1),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: col.withOpacity(0.2))),
      child: Column(children: [
        Text(val, style: GoogleFonts.rajdhani(
          fontSize: 16, fontWeight: FontWeight.w900, color: col)),
        Text(label, style: GoogleFonts.outfit(
          fontSize: 8, fontWeight: FontWeight.w700, color: col.withOpacity(0.7))),
      ]),
    );
  }

  Widget _sectionCard(String title, Widget child) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.card, borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.border)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: GoogleFonts.outfit(
            fontSize: 10, fontWeight: FontWeight.w800, color: AppTheme.text3,
            letterSpacing: 0.8)),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}
