import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../theme/tailwind_theme.dart';
import '../theme/app_theme.dart';
import '../widgets/tw_card.dart';
import '../widgets/tw_badge.dart';
import '../services/firestore_service.dart';
import '../services/ad_service.dart';
import 'highlights_screen.dart';
import 'player_screen.dart';

class WatchScreen extends StatefulWidget {
  const WatchScreen({super.key});
  @override
  State<WatchScreen> createState() => _WatchScreenState();
}

class _WatchScreenState extends State<WatchScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tab;
  List<Map<String, dynamic>> _matches = [];
  List<Map<String, dynamic>> _streams = [];
  List<Map<String, dynamic>> _highlights = [];
  List<Map<String, dynamic>> _replays = [];
  bool _loading = true;
  String? _error;

  final _tvSearchCtrl = TextEditingController();
  String _tvQuery = '';

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: 4, vsync: this);
    _tab.addListener(() {
      if (!_tab.indexIsChanging) setState(() {});
    });
    _load();
  }

  @override
  void dispose() {
    _tab.dispose();
    _tvSearchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await Future.wait([
        SupabaseService.fetchMatches(status: 'live', limit: 30),
        SupabaseService.fetchStreams(active: true),
        SupabaseService.fetchHighlights(publishedOnly: true, isReplay: false, limit: 20),
        SupabaseService.fetchHighlights(publishedOnly: true, isReplay: true, limit: 20),
      ]);
      if (mounted) {
        setState(() {
          _matches = List<Map<String, dynamic>>.from(results[0] as List);
          _streams = List<Map<String, dynamic>>.from(results[1] as List);
          _highlights = List<Map<String, dynamic>>.from(results[2] as List);
          _replays = List<Map<String, dynamic>>.from(results[3] as List);
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

  List<Map<String, dynamic>> get _filteredStreams {
    if (_tvQuery.isEmpty) return _streams;
    return _streams
        .where((s) => (s['label'] ?? '')
            .toString()
            .toLowerCase()
            .contains(_tvQuery.toLowerCase()))
        .toList();
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

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(TwSpace.p4, TwSpace.p3, TwSpace.p4, TwSpace.p2),
      child: Row(
        children: [
          Text(
            'Watch & Streams',
            style: GoogleFonts.outfit(
              fontSize: 22,
              fontWeight: FontWeight.w900,
              color: TwSlate.s900,
              letterSpacing: -0.5,
            ),
          ),
          const Spacer(),
          _iconBtn(Icons.cast_rounded, _showCastDialog),
          const SizedBox(width: TwSpace.p2),
          _iconBtn(Icons.refresh_rounded, _load),
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

  Widget _buildTabBar() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: TwSpace.p4),
      height: 42,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(TwRadius.full),
        border: Border.all(color: TwSlate.s200, width: 1),
      ),
      child: TabBar(
        controller: _tab,
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
        tabs: const [
          Tab(text: 'Live Streams'),
          Tab(text: 'Live TV'),
          Tab(text: 'Highlights'),
          Tab(text: 'Replays'),
        ],
      ),
    );
  }

  Widget _buildForYouTab() {
    return RefreshIndicator(
      color: TwBlue.b600,
      backgroundColor: Colors.white,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.only(top: TwSpace.p3),
        children: [
          _buildHeroPlayer(),
          _buildSectionTitle('🔴 LIVE MATCHES NOW'),
          _buildTopLiveList(),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 8),
            child: Center(child: BannerAdWidget()),
          ),
          _buildSectionTitle('🎯 TRENDING REVIEWS & HIGHLIGHTS'),
          _buildHighlightsList(),
          const SizedBox(height: TwSpace.p6),
        ],
      ),
    );
  }

  Widget _buildHeroPlayer() {
    final f = _featured;
    final isLive = f?['status'] == 'live';
    final title = f != null
        ? '${f['home_team'] ?? ''} vs ${f['away_team'] ?? ''}'
        : 'Explore Upcoming Matches';
    final league = f?['league_name'] ?? 'ZetaSports Broadcast';

    return GestureDetector(
      onTap: () {
        if (f == null) return;
        AdService.showInterstitial(onDismissed: () {
          if (mounted) {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => PlayerScreen(
                  match: f,
                  username: 'ZetaUser',
                  deviceId: 'device_001',
                ),
              ),
            );
          }
        });
      },
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: TwSpace.p4),
        height: 220,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(TwRadius.xl2),
          gradient: const LinearGradient(
            colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          boxShadow: TwShadows.md,
        ),
        child: Stack(
          children: [
            Positioned(
              top: 16,
              left: 16,
              right: 16,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  TwBadge(
                    label: isLive ? 'STREAMING NOW' : 'FEATURED',
                    variant: isLive ? TwBadgeVariant.live : TwBadgeVariant.primary,
                    pulse: isLive,
                  ),
                  Text(
                    league,
                    style: GoogleFonts.outfit(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: TwSlate.s400,
                    ),
                  ),
                ],
              ),
            ),
            Center(
              child: Container(
                width: 60,
                height: 60,
                decoration: BoxDecoration(
                  color: TwBlue.b600,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: TwBlue.b600.withValues(alpha: 0.4),
                      blurRadius: 18,
                      spreadRadius: 2,
                    ),
                  ],
                ),
                child: const Icon(Icons.play_arrow_rounded, color: Colors.white, size: 36),
              ),
            ),
            Positioned(
              bottom: 16,
              left: 16,
              right: 16,
              child: Text(
                title,
                textAlign: TextAlign.center,
                style: GoogleFonts.outfit(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(TwSpace.p4, TwSpace.p5, TwSpace.p4, TwSpace.p2),
      child: Text(
        title,
        style: GoogleFonts.outfit(
          fontSize: 14,
          fontWeight: FontWeight.w800,
          color: TwSlate.s800,
          letterSpacing: 0.4,
        ),
      ),
    );
  }

  Widget _buildTopLiveList() {
    if (_matches.isEmpty) {
      return Container(
        margin: const EdgeInsets.symmetric(horizontal: TwSpace.p4),
        padding: const EdgeInsets.all(TwSpace.p4),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(TwRadius.xl),
          border: Border.all(color: TwSlate.s200),
        ),
        child: Text(
          'No active live streams at this moment. Check back soon!',
          style: GoogleFonts.outfit(fontSize: 13, color: TwSlate.s600),
        ),
      );
    }

    return ListView.separated(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: TwSpace.p4),
      itemCount: _matches.length,
      separatorBuilder: (_, __) => const SizedBox(height: TwSpace.p2_5),
      itemBuilder: (context, i) {
        final m = _matches[i];
        return TwCard(
          padding: const EdgeInsets.all(TwSpace.p3_5),
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => PlayerScreen(
                  match: m,
                  username: 'ZetaUser',
                  deviceId: 'device_001',
                ),
              ),
            );
          },
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: TwRose.r50,
                  borderRadius: BorderRadius.circular(TwRadius.xl),
                  border: Border.all(color: TwRose.r200),
                ),
                child: const Icon(Icons.play_arrow_rounded, color: TwRose.r600, size: 24),
              ),
              const SizedBox(width: TwSpace.p3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${m['home_team']} vs ${m['away_team']}',
                      style: GoogleFonts.outfit(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: TwSlate.s900,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      m['league_name'] ?? 'Live Match Stream',
                      style: GoogleFonts.outfit(
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: TwSlate.s500,
                      ),
                    ),
                  ],
                ),
              ),
              TwBadge(label: 'LIVE', variant: TwBadgeVariant.live, pulse: true),
            ],
          ),
        );
      },
    );
  }

  Widget _buildLiveTVTab() {
    final streams = _filteredStreams;
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(TwSpace.p4),
          child: TextField(
            controller: _tvSearchCtrl,
            onChanged: (v) => setState(() => _tvQuery = v),
            style: GoogleFonts.outfit(fontSize: 13, color: TwSlate.s900),
            decoration: InputDecoration(
              hintText: 'Search TV channels & feeds...',
              hintStyle: GoogleFonts.outfit(color: TwSlate.s400, fontSize: 13),
              filled: true,
              fillColor: Colors.white,
              prefixIcon: const Icon(Icons.search_rounded, color: TwSlate.s400, size: 18),
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
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
        ),
        Expanded(
          child: streams.isEmpty
              ? Center(
                  child: Text(
                    'No channels found',
                    style: GoogleFonts.outfit(fontSize: 14, color: TwSlate.s500),
                  ),
                )
              : GridView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: TwSpace.p4),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                    childAspectRatio: 1.25,
                  ),
                  itemCount: streams.length,
                  itemBuilder: (context, i) {
                    final s = streams[i];
                    return TwCard(
                      padding: const EdgeInsets.all(TwSpace.p3),
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => PlayerScreen(
                              match: {'label': s['label'] ?? 'Channel', 'stream_url': s['stream_url']},
                              username: 'ZetaUser',
                              deviceId: 'device_001',
                            ),
                          ),
                        );
                      },
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.tv_rounded, size: 36, color: TwBlue.b600),
                          const SizedBox(height: TwSpace.p2),
                          Text(
                            s['label'] ?? 'Channel ${i + 1}',
                            textAlign: TextAlign.center,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: GoogleFonts.outfit(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: TwSlate.s800,
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

  Widget _buildHighlightsTab() {
    if (_highlights.isEmpty) {
      return Center(
        child: Text(
          'No highlights available right now',
          style: GoogleFonts.outfit(color: TwSlate.s500),
        ),
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.all(TwSpace.p4),
      itemCount: _highlights.length,
      separatorBuilder: (_, __) => const SizedBox(height: TwSpace.p3),
      itemBuilder: (context, i) {
        final h = _highlights[i];
        final thumb = h['thumbnail']?.toString() ?? '';
        return TwCard(
          padding: EdgeInsets.zero,
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const HighlightsScreen()),
            );
          },
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (thumb.isNotEmpty)
                CachedNetworkImage(
                  imageUrl: thumb,
                  height: 160,
                  width: double.infinity,
                  fit: BoxFit.cover,
                  errorWidget: (_, __, ___) => Container(height: 160, color: TwSlate.s200),
                ),
              Padding(
                padding: const EdgeInsets.all(TwSpace.p3_5),
                child: Text(
                  h['title'] ?? 'Match Highlight',
                  style: GoogleFonts.outfit(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: TwSlate.s900,
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildReplaysTab() {
    if (_replays.isEmpty) {
      return Center(
        child: Text(
          'No match replays available yet',
          style: GoogleFonts.outfit(color: TwSlate.s500),
        ),
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.all(TwSpace.p4),
      itemCount: _replays.length,
      separatorBuilder: (_, __) => const SizedBox(height: TwSpace.p3),
      itemBuilder: (context, i) {
        final r = _replays[i];
        return TwCard(
          padding: const EdgeInsets.all(TwSpace.p3_5),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: TwBlue.b50,
                  borderRadius: BorderRadius.circular(TwRadius.xl),
                ),
                child: const Icon(Icons.replay_rounded, color: TwBlue.b600, size: 24),
              ),
              const SizedBox(width: TwSpace.p3),
              Expanded(
                child: Text(
                  r['title'] ?? 'Full Match Replay',
                  style: GoogleFonts.outfit(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: TwSlate.s900,
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildHighlightsList() {
    return SizedBox(
      height: 140,
      child: ListView.separated(
        padding: const EdgeInsets.symmetric(horizontal: TwSpace.p4),
        scrollDirection: Axis.horizontal,
        itemCount: _highlights.take(4).length,
        separatorBuilder: (_, __) => const SizedBox(width: TwSpace.p3),
        itemBuilder: (context, i) {
          final h = _highlights[i];
          return SizedBox(
            width: 180,
            child: TwCard(
              padding: const EdgeInsets.all(TwSpace.p3),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.movie_creation_outlined, color: TwBlue.b600, size: 24),
                  const Spacer(),
                  Text(
                    h['title'] ?? 'Highlight',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.outfit(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: TwSlate.s900,
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

  void _showCastDialog() {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(TwRadius.xl2)),
        title: Text(
          'Cast to Device',
          style: GoogleFonts.outfit(fontWeight: FontWeight.w800, color: TwSlate.s900),
        ),
        content: Text(
          'Ensure your TV or Chromecast is connected to the same Wi-Fi network.',
          style: GoogleFonts.outfit(fontSize: 13, color: TwSlate.s600),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('Close', style: GoogleFonts.outfit(color: TwBlue.b600, fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
  }

  Widget _buildShimmer() {
    return const Center(
      child: CircularProgressIndicator(strokeWidth: 2, valueColor: AlwaysStoppedAnimation(TwBlue.b600)),
    );
  }

  Widget _buildError() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.wifi_off_rounded, size: 40, color: TwRose.r500),
          const SizedBox(height: TwSpace.p2),
          Text(
            'Unable to connect to stream servers',
            style: GoogleFonts.outfit(fontWeight: FontWeight.w700, color: TwSlate.s800),
          ),
          const SizedBox(height: TwSpace.p3),
          ElevatedButton(
            onPressed: _load,
            style: ElevatedButton.styleFrom(
              backgroundColor: TwBlue.b600,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(TwRadius.xl)),
            ),
            child: Text('Retry', style: GoogleFonts.outfit(color: Colors.white)),
          ),
        ],
      ),
    );
  }
}