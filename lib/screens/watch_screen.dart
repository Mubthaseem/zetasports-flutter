import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';
import '../services/firestore_service.dart';
import '../services/ad_service.dart';
import 'match_detail_screen.dart';
import 'highlights_screen.dart';
import 'player_screen.dart';

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 3 — WATCH  (JioHotstar + FanCode style)
// ─────────────────────────────────────────────────────────────────────────────
class WatchScreen extends StatefulWidget {
  const WatchScreen({super.key});
  @override
  State<WatchScreen> createState() => _WatchScreenState();
}

class _WatchScreenState extends State<WatchScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tab;
  List<Map<String, dynamic>> _matches     = [];
  List<Map<String, dynamic>> _streams     = [];
  List<Map<String, dynamic>> _highlights  = [];
  List<Map<String, dynamic>> _replays     = [];
  bool _loading = true;
  String? _error;

  // Live TV search
  final _tvSearchCtrl  = TextEditingController();
  String _tvQuery      = '';

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: 4, vsync: this);
    _tab.addListener(() { if (!_tab.indexIsChanging) setState(() {}); });
    _load();
  }

  @override
  void dispose() {
    _tab.dispose();
    _tvSearchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final results = await Future.wait([
        SupabaseService.fetchMatches(status: 'live', limit: 30),
        SupabaseService.fetchStreams(active: true),
        SupabaseService.fetchHighlights(publishedOnly: true, isReplay: false, limit: 20),
        SupabaseService.fetchHighlights(publishedOnly: true, isReplay: true, limit: 20),
      ]);
      if (mounted) {
        setState(() {
          _matches    = List<Map<String, dynamic>>.from(results[0] as List);
          _streams    = List<Map<String, dynamic>>.from(results[1] as List);
          _highlights = List<Map<String, dynamic>>.from(results[2] as List);
          _replays    = List<Map<String, dynamic>>.from(results[3] as List);
          _loading    = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() { _loading = false; _error = e.toString(); });
    }
  }

  List<Map<String, dynamic>> get _filteredStreams {
    if (_tvQuery.isEmpty) return _streams;
    return _streams.where((s) =>
      (s['label'] ?? '').toString().toLowerCase().contains(_tvQuery.toLowerCase())).toList();
  }

  Map<String, dynamic>? get _featured =>
      _matches.isNotEmpty ? _matches.first : null;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bg,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            _buildTabBar(),
            Expanded(
              child: _loading
                ? _buildShimmer()
                : _error != null
                    ? _buildError()
                    : TabBarView(
                        controller: _tab,
                        physics: const NeverScrollableScrollPhysics(),
                        children: [
                          _buildForYouTab(),
                          _buildLiveTVTab(),
                          _buildHighlightsTab(),
                          _buildReplaysTab(),
                        ],
                      ),
            ),
          ],
        ),
      ),
    );
  }

  // ── HEADER ────────────────────────────────────────────────────────────────
  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
      child: Row(children: [
        Text('Watch', style: GoogleFonts.outfit(
          fontSize: 20, fontWeight: FontWeight.w900, color: AppTheme.text1)),
        const Spacer(),
        _iconBtn(Icons.cast_rounded, _showCastDialog),
        const SizedBox(width: 8),
        _iconBtn(Icons.refresh_rounded, _load),
      ]),
    );
  }

  Widget _buildTabBar() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      height: 40,
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.circular(20)),
      child: TabBar(
        controller: _tab,
        indicator: BoxDecoration(
          gradient: const LinearGradient(
            colors: [AppTheme.primary, AppTheme.secondary]),
          borderRadius: BorderRadius.circular(20)),
        indicatorSize: TabBarIndicatorSize.tab,
        labelStyle: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.w800),
        unselectedLabelStyle: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.w600),
        labelColor: Colors.black,
        unselectedLabelColor: AppTheme.text2,
        dividerColor: Colors.transparent,
        tabs: const [
          Tab(text: 'For You'),
          Tab(text: 'Live TV'),
          Tab(text: 'Highlights'),
          Tab(text: 'Replays'),
        ],
      ),
    );
  }

  // ── FOR YOU TAB ──────────────────────────────────────────────────────────
  Widget _buildForYouTab() {
    return RefreshIndicator(
      color: AppTheme.primary,
      backgroundColor: AppTheme.surface,
      onRefresh: _load,
      child: ListView(
        children: [
          _buildHeroPlayer(),
          _buildSectionTitle('🔴 TOP LIVE MATCHES'),
          _buildTopLiveList(),
          // Banner ad
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 8),
            child: Center(child: BannerAdWidget()),
          ),
          _buildSectionTitle('🎯 TRENDING HIGHLIGHTS'),
          _buildHighlightsList(),
          const SizedBox(height: 20),
        ],
      ),
    );
  }

  Widget _buildHeroPlayer() {
    final f = _featured;
    final isLive = f?['status'] == 'live';
    final title = f != null
        ? '${f['home_team'] ?? ''} vs ${f['away_team'] ?? ''}'
        : 'No Live Match Right Now';
    final league = f?['league_name'] ?? 'ZetaSports Live';

    return GestureDetector(
      onTap: () {
        if (f == null) return;
        AdService.showInterstitial(onDismissed: () {
          if (mounted) {
            Navigator.push(context,
              MaterialPageRoute(builder: (_) => PlayerScreen(
                match: f,
                username: 'ZetaUser',
                deviceId: 'device_001')));
          }
        });
      },
      child: Container(
        margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
        height: 220,
        decoration: BoxDecoration(
          color: AppTheme.surface,
          borderRadius: BorderRadius.circular(AppTheme.radiusCard),
          border: Border.all(color: AppTheme.border),
          image: f?['league_banner'] != null
              ? DecorationImage(
                  image: NetworkImage(f?['league_banner'] as String),
                  fit: BoxFit.cover,
                  colorFilter: const ColorFilter.mode(Colors.black54, BlendMode.darken),
                )
              : null,
          gradient: f?['league_banner'] == null
              ? const LinearGradient(
                  colors: [Color(0xFF0A2E15), Color(0xFF07132B)],
                  begin: Alignment.topLeft, end: Alignment.bottomRight)
              : null),
        child: Stack(children: [
          // Dark gradient overlay at bottom
          Positioned.fill(child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(AppTheme.radiusCard),
              gradient: const LinearGradient(
                colors: [Color(0xDD000000), Colors.transparent],
                begin: Alignment.bottomCenter, end: Alignment.topCenter)))),
          // Top badges
          Positioned(top: 14, left: 14, child: Row(children: [
            if (isLive) _liveBadge(),
            if (isLive) const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.black45, borderRadius: BorderRadius.circular(6)),
              child: Row(children: [
                const Icon(Icons.remove_red_eye_outlined, color: Colors.white70, size: 12),
                const SizedBox(width: 4),
                Text('${_matches.length} matches', style: GoogleFonts.outfit(
                  color: Colors.white70, fontSize: 10, fontWeight: FontWeight.w600)),
              ]),
            ),
          ])),
          // Play button
          Center(child: Container(
            width: 60, height: 60,
            decoration: BoxDecoration(
              color: AppTheme.primary.withValues(alpha: 0.9),
              shape: BoxShape.circle,
              boxShadow: [BoxShadow(
                color: AppTheme.primary.withValues(alpha: 0.4),
                blurRadius: 24, spreadRadius: 4)]),
            child: const Icon(Icons.play_arrow_rounded, color: Colors.black, size: 34))),
          // Bottom info
          Positioned(bottom: 14, left: 14, right: 14, child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: GoogleFonts.outfit(
                fontSize: 16, fontWeight: FontWeight.w900, color: Colors.white)),
              Text(league.toString().toUpperCase(), style: GoogleFonts.outfit(
                fontSize: 10, fontWeight: FontWeight.w600, color: AppTheme.text2)),
            ],
          )),
        ]),
      ),
    );
  }



  Widget _buildTopLiveList() {
    if (_matches.isEmpty) {
      return _empty('No live matches right now', Icons.sports_soccer_rounded);
    }
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        children: _matches.take(6).map((m) => GestureDetector(
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
              color: AppTheme.card, borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppTheme.border)),
            child: Row(children: [
              Container(
                width: 36, height: 36,
                decoration: BoxDecoration(
                  color: AppTheme.primary.withValues(alpha: 0.12),
                  shape: BoxShape.circle,
                  border: Border.all(color: AppTheme.primary.withValues(alpha: 0.3))),
                child: Center(child: Text(
                  (m['home_team']?.toString() ?? '??').substring(0, 2).toUpperCase(),
                  style: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.w900, color: AppTheme.primary)))),
              const SizedBox(width: 12),
              Expanded(child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('${m['home_team'] ?? ''} vs ${m['away_team'] ?? ''}',
                    style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w700, color: AppTheme.text1)),
                  Text(m['league_name'] ?? '',
                    style: GoogleFonts.outfit(fontSize: 10, color: AppTheme.text2)),
                ],
              )),
              Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text(m['time_elapsed']?.toString() ?? 'LIVE',
                  style: GoogleFonts.outfit(fontSize: 10, fontWeight: FontWeight.w900, color: AppTheme.success)),
                const SizedBox(height: 4),
                const Icon(Icons.play_circle_rounded, color: AppTheme.primary, size: 24),
              ]),
            ]),
          ),
        )).toList(),
      ),
    );
  }

  Widget _buildHighlightsList() {
    if (_highlights.isEmpty) {
      return _empty('No highlights yet', Icons.video_library_rounded);
    }
    return SizedBox(
      height: 160,
      child: ListView.builder(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        scrollDirection: Axis.horizontal,
        itemCount: _highlights.length,
        itemBuilder: (_, i) {
          final hl = _highlights[i];
          return GestureDetector(
            onTap: () {
              AdService.showInterstitial(onDismissed: () {
                if (mounted) {
                  Navigator.push(context, MaterialPageRoute(
                    builder: (_) => PlayerScreen(
                      match: {
                        'id': hl['id'],
                        'stream_url': hl['video_url'] ?? '',
                        'home_team': hl['title'] ?? 'Highlight',
                        'away_team': '',
                        'status': 'finished',
                        'league_name': hl['league_name'] ?? '',
                      },
                      username: 'ZetaUser',
                      deviceId: 'device_001',
                    ),
                  ));
                }
              });
            },
            child: Container(
              width: 160, margin: const EdgeInsets.only(right: 10),
              decoration: BoxDecoration(
                color: AppTheme.card, borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppTheme.border)),
              child: Column(children: [
                Expanded(child: Stack(children: [
                  Positioned.fill(child: ClipRRect(
                    borderRadius: const BorderRadius.only(
                      topLeft: Radius.circular(13), topRight: Radius.circular(13)),
                    child: hl['thumbnail'] != null
                      ? Image.network(hl['thumbnail'], fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => Container(color: AppTheme.surface))
                      : Container(color: AppTheme.surface))),
                  Center(child: Container(
                    padding: const EdgeInsets.all(6),
                    decoration: const BoxDecoration(
                      color: Colors.black45, shape: BoxShape.circle),
                    child: const Icon(Icons.play_arrow_rounded, color: Colors.white, size: 18))),
                ])),
                Padding(
                  padding: const EdgeInsets.all(8),
                  child: Text(hl['title']?.toString() ?? 'Highlight',
                    style: GoogleFonts.outfit(fontSize: 10, fontWeight: FontWeight.w700, color: AppTheme.text1),
                    maxLines: 2, overflow: TextOverflow.ellipsis)),
              ]),
            ),
          );
        },
      ),
    );
  }

  // ── LIVE TV TAB ───────────────────────────────────────────────────────────
  Widget _buildLiveTVTab() {
    final channels = _filteredStreams;
    return RefreshIndicator(
      color: AppTheme.primary,
      backgroundColor: AppTheme.surface,
      onRefresh: _load,
      child: Column(children: [
        // Search bar
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
          child: TextField(
            controller: _tvSearchCtrl,
            onChanged: (v) => setState(() => _tvQuery = v),
            style: GoogleFonts.outfit(color: AppTheme.text1, fontSize: 13),
            decoration: InputDecoration(
              hintText: 'Search channels...',
              hintStyle: GoogleFonts.outfit(color: AppTheme.text3, fontSize: 13),
              filled: true, fillColor: AppTheme.card,
              prefixIcon: const Icon(Icons.search_rounded, color: AppTheme.text3, size: 18),
              suffixIcon: _tvQuery.isNotEmpty
                ? GestureDetector(
                    onTap: () { _tvSearchCtrl.clear(); setState(() => _tvQuery = ''); },
                    child: const Icon(Icons.close_rounded, color: AppTheme.text3, size: 16))
                : null,
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none)),
          ),
        ),
        if (channels.isEmpty)
          Expanded(child: _empty('No channels found', Icons.live_tv_rounded))
        else
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: channels.length,
              itemBuilder: (_, i) {
                final ch = channels[i];
                final col = _hexColor(ch['color'] as String? ?? '#00D4FF');
                return GestureDetector(
                  onTap: () => _openStream(ch),
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppTheme.card, borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: AppTheme.border)),
                    child: Row(children: [
                      Container(
                        width: 44, height: 44,
                        decoration: BoxDecoration(
                          color: col.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: col.withValues(alpha: 0.3))),
                        child: Icon(Icons.live_tv_rounded, color: col, size: 20)),
                      const SizedBox(width: 12),
                      Expanded(child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(ch['label']?.toString() ?? 'Channel',
                            style: GoogleFonts.outfit(
                              fontSize: 13, fontWeight: FontWeight.w700, color: AppTheme.text1)),
                          Text(ch['quality']?.toString() ?? 'HD',
                            style: GoogleFonts.outfit(fontSize: 10, color: AppTheme.text3)),
                        ],
                      )),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: AppTheme.success.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(8)),
                        child: Text('WATCH', style: GoogleFonts.outfit(
                          fontSize: 10, fontWeight: FontWeight.w900, color: AppTheme.success))),
                    ]),
                  ),
                );
              },
            ),
          ),
      ]),
    );
  }

  // ── HIGHLIGHTS TAB ────────────────────────────────────────────────────────
  Widget _buildHighlightsTab() {
    return const HighlightsScreen();
  }

  // ── REPLAYS TAB ───────────────────────────────────────────────────────────
  Widget _buildReplaysTab() {
    final replays = _replays;
    if (replays.isEmpty) {
      return _empty('No replays available', Icons.replay_rounded);
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: replays.length,
      itemBuilder: (_, i) {
        final hl = replays[i];
        return GestureDetector(
          onTap: () {
            AdService.showInterstitial(onDismissed: () {
              if (mounted) {
                Navigator.push(context, MaterialPageRoute(
                  builder: (_) => PlayerScreen(
                    match: {
                      'id': hl['id'],
                      'stream_url': hl['video_url'] ?? '',
                      'home_team': hl['title'] ?? 'Replay',
                      'away_team': '',
                      'status': 'finished',
                      'league_name': hl['league_name'] ?? '',
                    },
                    username: 'ZetaUser',
                    deviceId: 'device_001',
                  ),
                ));
              }
            });
          },
          child: Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppTheme.card, borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppTheme.border)),
            child: Row(children: [
              Container(
                width: 80, height: 54,
                decoration: BoxDecoration(
                  color: AppTheme.surface, borderRadius: BorderRadius.circular(8)),
                child: Stack(children: [
                  if (hl['thumbnail'] != null)
                    Positioned.fill(child: ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: Image.network(hl['thumbnail'], fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => const SizedBox()))),
                  Center(child: const Icon(Icons.play_circle_outline_rounded,
                    color: Colors.white70, size: 24)),
                ])),
              const SizedBox(width: 12),
              Expanded(child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(hl['title']?.toString() ?? 'Replay',
                    style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.text1),
                    maxLines: 2, overflow: TextOverflow.ellipsis),
                  const SizedBox(height: 4),
                  Row(children: [
                    Text(hl['league_name']?.toString() ?? '',
                      style: GoogleFonts.outfit(fontSize: 10, color: AppTheme.text3)),
                    const Spacer(),
                    Text(hl['duration']?.toString() ?? '',
                      style: GoogleFonts.outfit(fontSize: 10, color: AppTheme.text3)),
                  ]),
                ],
              )),
            ]),
          ),
        );
      },
    );
  }

  // ── HELPERS ───────────────────────────────────────────────────────────────
  void _openStream(Map<String, dynamic> ch) {
    final url = ch['url']?.toString() ?? ch['stream_url']?.toString() ?? '';
    if (url.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('Stream URL not configured for ${ch['label'] ?? 'this channel'}',
          style: GoogleFonts.outfit(fontWeight: FontWeight.w700)),
        backgroundColor: AppTheme.warning,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))));
      return;
    }
    // Open the PlayerScreen with the stream as a "match"
    AdService.showInterstitial(onDismissed: () {
      if (mounted) {
        Navigator.push(context, MaterialPageRoute(
          builder: (_) => PlayerScreen(
            match: {'stream_url': url, 'home_team': ch['label'] ?? 'Channel', 'away_team': '', 'status': 'live'},
            username: 'ZetaUser',
            deviceId: 'device_001')));
      }
    });
  }

  void _showCastDialog() => showDialog(
    context: context,
    builder: (_) => AlertDialog(
      backgroundColor: AppTheme.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: Row(children: [
        const Icon(Icons.cast_connected_rounded, color: AppTheme.primary, size: 22),
        const SizedBox(width: 10),
        Text('Cast to TV', style: GoogleFonts.outfit(fontWeight: FontWeight.w800, fontSize: 15)),
      ]),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        const CircularProgressIndicator(color: AppTheme.primary, strokeWidth: 2),
        const SizedBox(height: 14),
        Text('Searching for devices on your network...',
          style: GoogleFonts.outfit(fontSize: 12, color: AppTheme.text2),
          textAlign: TextAlign.center),
      ]),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text('Cancel', style: GoogleFonts.outfit(
            color: AppTheme.primary, fontWeight: FontWeight.w800))),
      ],
    ));

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 10),
      child: Text(title, style: GoogleFonts.outfit(
        fontSize: 13, fontWeight: FontWeight.w900, color: AppTheme.text1)),
    );
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

  Widget _liveBadge() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(color: AppTheme.danger, borderRadius: BorderRadius.circular(4)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Container(width: 5, height: 5,
          decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle)),
        const SizedBox(width: 4),
        Text('LIVE', style: GoogleFonts.outfit(
          color: Colors.white, fontSize: 8, fontWeight: FontWeight.w900)),
      ]),
    );
  }

  Color _hexColor(String hex) {
    try {
      hex = hex.replaceAll('#', '');
      if (hex.length == 6) hex = 'FF$hex';
      return Color(int.parse(hex, radix: 16));
    } catch (_) {
      return AppTheme.primary;
    }
  }

  Widget _empty(String msg, IconData icon, {double height = 120}) {
    return SizedBox(
      height: height,
      child: Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, color: AppTheme.text3, size: 36),
        const SizedBox(height: 8),
        Text(msg, style: GoogleFonts.outfit(fontSize: 12, color: AppTheme.text2),
          textAlign: TextAlign.center),
      ])),
    );
  }

  Widget _buildShimmer() {
    return ListView(padding: const EdgeInsets.all(16),
      children: List.generate(3, (_) => Container(
        margin: const EdgeInsets.only(bottom: 12), height: 80,
        decoration: BoxDecoration(
          color: AppTheme.card, borderRadius: BorderRadius.circular(14)))));
  }

  Widget _buildError() {
    return Center(child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Icon(Icons.error_outline_rounded, color: AppTheme.danger, size: 48),
        const SizedBox(height: 12),
        Text('Failed to load watch data', style: GoogleFonts.outfit(
          fontSize: 14, fontWeight: FontWeight.w700, color: AppTheme.text1)),
        const SizedBox(height: 16),
        ElevatedButton.icon(
          onPressed: _load,
          icon: const Icon(Icons.refresh_rounded),
          label: const Text('Retry'),
          style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primary)),
      ]),
    ));
  }
}