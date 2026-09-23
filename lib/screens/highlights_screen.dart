import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';
import '../services/firestore_service.dart';
import '../services/ad_service.dart';
import 'player_screen.dart';

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 9 — HIGHLIGHTS
// ─────────────────────────────────────────────────────────────────────────────
class HighlightsScreen extends StatefulWidget {
  const HighlightsScreen({super.key});
  @override
  State<HighlightsScreen> createState() => _HighlightsScreenState();
}

class _HighlightsScreenState extends State<HighlightsScreen> {
  String _filter = 'All';
  final _filters = ['All', 'Trending', 'Popular', 'Football', 'Cricket', 'Basketball'];
  List<Map<String, dynamic>> _highlights = [];
  bool _loading = true;
  String? _error;
  bool _searchActive = false;
  final _searchCtrl = TextEditingController();
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final badge = _filter == 'Trending' ? 'TRENDING'
          : _filter == 'Popular' ? 'POPULAR'
          : null;
      final sport = ['Football','Cricket','Basketball'].contains(_filter) ? _filter : null;
      final res = await SupabaseService.fetchHighlights(
        publishedOnly: true,
        badge: badge,
        searchQuery: _searchQuery.isNotEmpty ? _searchQuery : null,
        isReplay: false,
        limit: 50,
      );
      // Client-side sport filter
      final filtered = sport == null
          ? res
          : res.where((h) =>
              (h['sport'] ?? h['league']?['sport'] ?? '').toString().toLowerCase() ==
              sport.toLowerCase()).toList();
      if (mounted) setState(() { _highlights = filtered; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _loading = false; _error = e.toString(); });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isEmbedded = Navigator.canPop(context);

    return Scaffold(
      backgroundColor: AppTheme.bg,
      body: SafeArea(
        child: Column(children: [
          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
            child: Row(children: [
              if (isEmbedded)
                GestureDetector(
                  onTap: () => Navigator.pop(context),
                  child: Container(
                    width: 36, height: 36,
                    decoration: BoxDecoration(
                      color: AppTheme.surface, borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppTheme.border)),
                    child: const Icon(Icons.arrow_back_ios_new_rounded,
                      color: AppTheme.text2, size: 16))),
              if (isEmbedded) const SizedBox(width: 12),
              Text('Highlights', style: GoogleFonts.outfit(
                fontSize: 20, fontWeight: FontWeight.w900, color: AppTheme.text1)),
              const Spacer(),
              GestureDetector(
                onTap: () => setState(() {
                  _searchActive = !_searchActive;
                  if (!_searchActive) {
                    _searchCtrl.clear();
                    _searchQuery = '';
                    _load();
                  }
                }),
                child: Container(
                  width: 36, height: 36,
                  decoration: BoxDecoration(
                    color: _searchActive
                        ? AppTheme.primary.withValues(alpha: 0.15)
                        : AppTheme.surface,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: _searchActive ? AppTheme.primary : AppTheme.border)),
                  child: Icon(Icons.search_rounded,
                    color: _searchActive ? AppTheme.primary : AppTheme.text2, size: 18))),
            ]),
          ),

          // Search bar
          if (_searchActive)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
              child: TextField(
                controller: _searchCtrl,
                autofocus: true,
                onChanged: (v) { setState(() => _searchQuery = v); _load(); },
                style: GoogleFonts.outfit(color: AppTheme.text1, fontSize: 13),
                decoration: InputDecoration(
                  hintText: 'Search highlights...',
                  hintStyle: GoogleFonts.outfit(color: AppTheme.text3, fontSize: 13),
                  filled: true, fillColor: AppTheme.card,
                  prefixIcon: const Icon(Icons.search_rounded, color: AppTheme.text3, size: 18),
                  suffixIcon: _searchQuery.isNotEmpty
                    ? GestureDetector(
                        onTap: () { _searchCtrl.clear(); setState(() => _searchQuery = ''); _load(); },
                        child: const Icon(Icons.close_rounded, color: AppTheme.text3, size: 16))
                    : null,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide.none)),
              ),
            ),

          // Filter chips
          SizedBox(
            height: 36,
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              scrollDirection: Axis.horizontal,
              itemCount: _filters.length,
              itemBuilder: (_, i) {
                final f = _filters[i];
                final sel = f == _filter;
                return GestureDetector(
                  onTap: () { setState(() => _filter = f); _load(); },
                  child: Container(
                    margin: const EdgeInsets.only(right: 8),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
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
          ),
          const SizedBox(height: 12),

          // Content
          Expanded(
            child: RefreshIndicator(
              color: AppTheme.primary,
              backgroundColor: AppTheme.surface,
              onRefresh: _load,
              child: _loading
                ? _buildShimmer()
                : _error != null
                    ? _buildError()
                    : _highlights.isEmpty
                        ? _buildEmpty()
                        : _buildGrid(),
            ),
          ),
        ]),
      ),
    );
  }

  Widget _buildGrid() {
    return GridView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2, crossAxisSpacing: 10,
        mainAxisSpacing: 10, childAspectRatio: 0.82),
      itemCount: _highlights.length + (_highlights.length ~/ 6), // +1 ad slot per 6 items
      itemBuilder: (_, i) {
        // Insert ad every 6 items
        final adSlots = i ~/ 7;
        if (i > 0 && (i + 1) % 7 == 0) {
          return const Center(child: BannerAdWidget());
        }
        final idx = i - adSlots;
        if (idx >= _highlights.length) return const SizedBox.shrink();
        return _buildCard(_highlights[idx]);
      },
    );
  }

  Widget _buildCard(Map<String, dynamic> hl) {
    final badge = hl['badge']?.toString() ?? '';
    final isTrend  = badge == 'TRENDING';
    final isPopular = badge == 'POPULAR';
    final badgeCol = isTrend ? AppTheme.danger : (isPopular ? AppTheme.primary : AppTheme.warning);
    final thumbnail = hl['thumbnail'] ?? hl['thumb_url'] ?? '';
    final duration  = hl['duration'] ?? hl['duration_str'] ?? '';
    final views     = hl['views'] != null ? _formatViews(hl['views']) : '';
    final league    = hl['league_name'] ?? hl['league']?['name'] ?? '';

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
                  'league_name': league,
                },
                username: 'ZetaUser',
                deviceId: 'device_001',
              ),
            ));
          }
        });
      },
      child: Container(
        decoration: BoxDecoration(
          color: AppTheme.card, borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppTheme.border)),
        child: Column(children: [
          Expanded(
            flex: 3,
            child: Stack(children: [
              Positioned.fill(child: ClipRRect(
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(15), topRight: Radius.circular(15)),
                child: thumbnail.isNotEmpty
                  ? Image.network(thumbnail, fit: BoxFit.cover,
                      color: Colors.black.withValues(alpha: 0.2),
                      colorBlendMode: BlendMode.darken,
                      errorBuilder: (_, __, ___) => Container(color: AppTheme.surface,
                        child: const Icon(Icons.video_library_rounded,
                          color: AppTheme.text3, size: 32)))
                  : Container(color: AppTheme.surface,
                      child: const Icon(Icons.video_library_rounded,
                        color: AppTheme.text3, size: 32)))),
              // Badge
              if (badge.isNotEmpty)
                Positioned(top: 8, left: 8, child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                  decoration: BoxDecoration(
                    color: badgeCol, borderRadius: BorderRadius.circular(5)),
                  child: Text(badge, style: GoogleFonts.outfit(
                    color: Colors.white, fontSize: 7, fontWeight: FontWeight.w900)))),
              // Duration
              if (duration.isNotEmpty)
                Positioned(bottom: 6, right: 6, child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.black87, borderRadius: BorderRadius.circular(4)),
                  child: Text(duration.toString(), style: GoogleFonts.rajdhani(
                    color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold)))),
              // Play button
              Center(child: Container(
                width: 38, height: 38,
                decoration: BoxDecoration(
                  color: AppTheme.primary.withValues(alpha: 0.9),
                  shape: BoxShape.circle,
                  boxShadow: [BoxShadow(
                    color: AppTheme.primary.withValues(alpha: 0.4), blurRadius: 12)]),
                child: const Icon(Icons.play_arrow_rounded, color: Colors.black, size: 22))),
            ]),
          ),
          Expanded(
            flex: 2,
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(hl['title']?.toString() ?? 'Highlight',
                    style: GoogleFonts.outfit(
                      fontSize: 10, fontWeight: FontWeight.w700, color: AppTheme.text1),
                    maxLines: 2, overflow: TextOverflow.ellipsis),
                  Row(children: [
                    Expanded(child: Text(league.toString(),
                      style: GoogleFonts.outfit(fontSize: 8, color: AppTheme.text3),
                      overflow: TextOverflow.ellipsis)),
                    if (views.isNotEmpty)
                      Text('$views views', style: GoogleFonts.outfit(
                        fontSize: 8, color: AppTheme.text3)),
                  ]),
                ],
              ),
            ),
          ),
        ]),
      ),
    );
  }

  String _formatViews(dynamic v) {
    try {
      final n = int.parse(v.toString());
      if (n >= 1000000) return '${(n / 1000000).toStringAsFixed(1)}M';
      if (n >= 1000) return '${(n / 1000).toStringAsFixed(1)}K';
      return '$n';
    } catch (_) {
      return v.toString();
    }
  }

  Widget _buildShimmer() {
    return GridView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2, crossAxisSpacing: 10, mainAxisSpacing: 10, childAspectRatio: 0.82),
      itemCount: 8,
      itemBuilder: (_, __) => Container(
        decoration: BoxDecoration(
          color: AppTheme.card, borderRadius: BorderRadius.circular(16))));
  }

  Widget _buildError() {
    return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
      const Icon(Icons.error_outline_rounded, color: AppTheme.danger, size: 48),
      const SizedBox(height: 12),
      Text('Failed to load highlights', style: GoogleFonts.outfit(
        fontSize: 14, fontWeight: FontWeight.w700, color: AppTheme.text1)),
      const SizedBox(height: 16),
      ElevatedButton.icon(
        onPressed: _load,
        icon: const Icon(Icons.refresh_rounded),
        label: const Text('Retry'),
        style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primary)),
    ]));
  }

  Widget _buildEmpty() {
    return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
      const Icon(Icons.video_library_rounded, color: AppTheme.text3, size: 52),
      const SizedBox(height: 16),
      Text('No highlights found', style: GoogleFonts.outfit(
        fontSize: 14, fontWeight: FontWeight.w700, color: AppTheme.text1)),
      const SizedBox(height: 6),
      Text('Try a different filter or check back later',
        style: GoogleFonts.outfit(fontSize: 12, color: AppTheme.text2)),
    ]));
  }
}