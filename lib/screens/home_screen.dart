import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';
import '../services/firestore_service.dart' show SupabaseService;
import 'match_detail_screen.dart';
import 'highlights_screen.dart';
import 'notification_center_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  List<Map<String, dynamic>> _matches = [];
  List<Map<String, dynamic>> _highlights = [];
  List<Map<String, dynamic>> _news = [];
  List<Map<String, dynamic>> _tournaments = [];
  bool _loading = true;
  String? _error;
  int _heroIndex = 0;
  Timer? _heroTimer;
  final PageController _heroCtrl = PageController();

  String _favTeam = 'All';
  final List<String> _favTeams = ['All'];

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() { _loading = true; _error = null; });
    try {
      final results = await Future.wait([
        SupabaseService.fetchMatches(limit: 50),
        SupabaseService.fetchHighlights(publishedOnly: true, limit: 20),
        SupabaseService.fetchNews(publishedOnly: true, limit: 10),
        SupabaseService.fetchLeagues(),
      ]);
      
      _matches = results[0] as List<Map<String, dynamic>>;
      _highlights = results[1] as List<Map<String, dynamic>>;
      _news = results[2] as List<Map<String, dynamic>>;
      _tournaments = (results[3] as List<Map<String, dynamic>>).take(6).toList();
      
      // Extract unique teams for fav filter
      final teams = <String>{'All'};
      for (final m in _matches) {
        if (m['home_team'] != null) teams.add(m['home_team'] as String);
        if (m['away_team'] != null) teams.add(m['away_team'] as String);
      }
      
      if (mounted) {
        setState(() {
          _favTeams.clear();
          _favTeams.addAll(teams);
          _loading = false;
        });
        _startHeroTimer();
      }
    } catch (e) {
      if (mounted) {
        setState(() { _loading = false; _error = e.toString(); });
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Failed to load data: $_error',
            style: GoogleFonts.outfit(fontWeight: FontWeight.w700)),
          backgroundColor: AppTheme.danger,
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 4),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))));
      }
    }
  }

  void _startHeroTimer() {
    _heroTimer?.cancel();
    if (_heroMatches.length < 2) return;
    _heroTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      if (!mounted) return;
      final next = (_heroIndex + 1) % _heroMatches.length;
      _heroCtrl.animateToPage(next,
        duration: const Duration(milliseconds: 600), curve: Curves.easeInOut);
    });
  }

  List<Map<String, dynamic>> get _heroMatches {
    final lives = _matches.where((m) => m['status'] == 'live').toList();
    if (lives.isNotEmpty) return lives.take(5).toList();
    return _matches.take(5).toList();
  }

  List<Map<String, dynamic>> get _liveMatches =>
      _matches.where((m) => m['status'] == 'live').toList();

  List<Map<String, dynamic>> get _upcomingMatches =>
      _matches.where((m) => m['status'] == 'scheduled' || m['status'] == 'upcoming').toList();

  List<Map<String, dynamic>> get _filteredUpcoming {
    if (_favTeam == 'All') return _upcomingMatches.take(5).toList();
    return _upcomingMatches.where((m) => 
      m['home_team'] == _favTeam || m['away_team'] == _favTeam).take(5).toList();
  }

  @override
  void dispose() {
    _heroTimer?.cancel();
    _heroCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bg,
      body: SafeArea(
        child: RefreshIndicator(
          color: AppTheme.primary,
          backgroundColor: AppTheme.surface,
          onRefresh: _loadData,
          child: CustomScrollView(
            slivers: [
              _buildSliverHeader(),
              SliverToBoxAdapter(child: _buildHeroCarousel()),
              SliverToBoxAdapter(child: _buildSectionHeader('🔴 LIVE NOW', 'View All', () {})),
              SliverToBoxAdapter(child: _buildLiveMatchesStrip()),
              SliverToBoxAdapter(child: _buildSectionHeader('▶ CONTINUE WATCHING', 'View All', () {})),
              SliverToBoxAdapter(child: _buildContinueWatching()),
              SliverToBoxAdapter(child: _buildFavTeamChips()),
              SliverToBoxAdapter(child: _buildSectionHeader('🗓 UPCOMING MATCHES', 'View All', () {})),
              SliverToBoxAdapter(child: _buildUpcomingList()),
              SliverToBoxAdapter(child: _buildSectionHeader('🏆 FEATURED TOURNAMENTS', '', null)),
              SliverToBoxAdapter(child: _buildTournamentCards()),
              SliverToBoxAdapter(child: _buildSectionHeader('🎯 TRENDING HIGHLIGHTS', 'View All', () {
                Navigator.push(context, MaterialPageRoute(builder: (_) => const HighlightsScreen()));
              })),
              SliverToBoxAdapter(child: _buildTrendingHighlights()),
              SliverToBoxAdapter(child: _buildSectionHeader('📰 TOP HEADLINES', 'View All', () {})),
              SliverToBoxAdapter(child: _buildNewsSection()),
              const SliverToBoxAdapter(child: SizedBox(height: 24)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSliverHeader() {
    return SliverAppBar(
      backgroundColor: AppTheme.bg,
      floating: true,
      snap: true,
      elevation: 0,
      toolbarHeight: 60,
      flexibleSpace: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            RichText(text: TextSpan(children: [
              TextSpan(text: 'ZETA', style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.w900, color: AppTheme.text1)),
              TextSpan(text: 'SPORTS', style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.w900, color: AppTheme.primary)),
            ])),
            const Spacer(),
            _iconBtn(Icons.search_rounded, () {}),
            const SizedBox(width: 4),
            _iconBtn(Icons.notifications_outlined, () {
              Navigator.push(context, MaterialPageRoute(builder: (_) => const NotificationCenterScreen()));
            }),
          ],
        ),
      ),
    );
  }

  Widget _iconBtn(IconData icon, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(width: 40, height: 40,
        decoration: BoxDecoration(color: AppTheme.surface, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppTheme.border)),
        child: Icon(icon, color: AppTheme.text2, size: 20),
      ),
    );
  }

  Widget _buildHeroCarousel() {
    final heroes = _heroMatches;
    if (_loading) return _shimmerBlock(260);
    if (heroes.isEmpty) return _buildEmptyHero();
    return SizedBox(
      height: 270,
      child: Stack(children: [
        PageView.builder(
          controller: _heroCtrl,
          itemCount: heroes.length,
          onPageChanged: (i) => setState(() => _heroIndex = i),
          itemBuilder: (_, i) => _buildHeroCard(heroes[i]),
        ),
        Positioned(bottom: 16, left: 0, right: 0,
          child: Row(mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(heroes.length, (i) => AnimatedContainer(
              duration: const Duration(milliseconds: 300), margin: const EdgeInsets.symmetric(horizontal: 3),
              width: _heroIndex == i ? 20 : 6, height: 6,
              decoration: BoxDecoration(color: _heroIndex == i ? AppTheme.primary : Colors.white30, borderRadius: BorderRadius.circular(3)),
            )),
          ),
        ),
      ]),
    );
  }

  Widget _buildHeroCard(Map<String, dynamic> m) {
    final isLive = m['status'] == 'live';
    final homeTeam = m['home_team'] ?? 'TBD';
    final awayTeam = m['away_team'] ?? 'TBD';
    final league = m['league_name'] ?? m['zeta_leagues']?['name'] ?? 'Tournament';
    final homeScore = m['home_score'] ?? 0;
    final awayScore = m['away_score'] ?? 0;
    final timeElapsed = m['time_elapsed'] ?? 'LIVE';
    final homeLogo = m['home_team_logo'] ?? m['zeta_teams']?['logo'];
    final awayLogo = m['away_team_logo'] ?? m['teams:away']?['logo'];
    final homeColor = _hexColor(m['home_team_color']?.toString() ?? m['zeta_teams']?['color']?.toString());
    final awayColor = _hexColor(m['away_team_color']?.toString() ?? m['teams:away']?['color']?.toString());

    return GestureDetector(
      onTap: () => _goToMatch(m),
      child: Container(
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 8),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(AppTheme.radiusCard),
          image: DecorationImage(
            image: NetworkImage(m['league_banner']?.toString() ?? 'https://images.unsplash.com/photo-1540747737956-37872f84a62f?w=800&auto=format&fit=crop'),
            fit: BoxFit.cover,
            colorFilter: const ColorFilter.mode(Color(0x88000000), BlendMode.darken),
          ),
        ),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppTheme.radiusCard),
            gradient: const LinearGradient(
              colors: [Color(0xCC000000), Color(0x44000000)],
              begin: Alignment.bottomCenter, end: Alignment.topCenter,
            ),
          ),
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(color: AppTheme.primary.withOpacity(0.2), borderRadius: BorderRadius.circular(6), border: Border.all(color: AppTheme.primary.withOpacity(0.4))),
                  child: Text('FEATURED MATCH', style: GoogleFonts.outfit(color: AppTheme.primary, fontSize: 9, fontWeight: FontWeight.w900, letterSpacing: 1.0))),
                if (isLive) _livePulse() else const SizedBox.shrink(),
              ]),
              const Spacer(),
              Center(child: Column(children: [
                Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  _teamLogo(homeTeam, homeLogo, homeColor, 52),
                  Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: Column(children: [
                    if (isLive)
                      Text('$homeScore - $awayScore', style: AppTheme.score)
                    else
                      Text('VS', style: GoogleFonts.rajdhani(fontSize: 22, fontWeight: FontWeight.w900, color: AppTheme.text2)),
                    if (isLive)
                      Text(timeElapsed, style: GoogleFonts.outfit(color: AppTheme.success, fontSize: 11, fontWeight: FontWeight.w800)),
                  ])),
                  _teamLogo(awayTeam, awayLogo, awayColor, 52),
                ]),
                const SizedBox(height: 8),
                Text('$homeTeam vs $awayTeam', style: GoogleFonts.outfit(fontSize: 17, fontWeight: FontWeight.w900, color: Colors.white)),
                Text(league.toString().toUpperCase(), style: GoogleFonts.outfit(fontSize: 10, color: AppTheme.text2, fontWeight: FontWeight.w600)),
              ])),
              const SizedBox(height: 16),
              Row(children: [
                Expanded(child: _primaryBtn(Icons.play_arrow_rounded, isLive ? 'WATCH NOW' : 'SET REMINDER', () => _goToMatch(m))),
                const SizedBox(width: 10),
                _outlineIconBtn(Icons.notifications_outlined, () {}),
              ]),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildEmptyHero() {
    return _buildHeroCard({
      'home_team': 'TBD', 'away_team': 'TBD',
      'league_name': 'No matches scheduled',
      'status': 'upcoming', 'home_score': 0, 'away_score': 0,
    });
  }

  Widget _buildSectionHeader(String title, String action, VoidCallback? onAction) {
    return Padding(padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
      child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Text(title, style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w900, color: AppTheme.text1, letterSpacing: 0.3)),
        if (action.isNotEmpty && onAction != null)
          GestureDetector(onTap: onAction, child: Text(action, style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.primary))),
      ]),
    );
  }

  Widget _buildLiveMatchesStrip() {
    final lives = _liveMatches;
    if (_loading) return _shimmerBlock(120);
    if (lives.isEmpty) return _buildEmptyState('No live matches at the moment', Icons.sports_soccer_rounded);
    return SizedBox(height: 120, child: ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      scrollDirection: Axis.horizontal,
      itemCount: lives.length,
      itemBuilder: (_, i) => _buildLiveCard(lives[i]),
    ));
  }

  Widget _buildLiveCard(Map<String, dynamic> m) {
    final isLive = m['status'] == 'live';
    return GestureDetector(onTap: () => _goToMatch(m),
      child: Container(width: 160, margin: const EdgeInsets.only(right: 12), padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: AppTheme.card, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppTheme.border)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Text(m['time_elapsed'] ?? 'LIVE', style: GoogleFonts.outfit(color: AppTheme.success, fontSize: 11, fontWeight: FontWeight.w800)),
            if (isLive) _livePulse(),
          ]),
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Expanded(child: Text(m['home_team'] ?? '', style: GoogleFonts.outfit(color: AppTheme.text1, fontSize: 12, fontWeight: FontWeight.w800), overflow: TextOverflow.ellipsis)),
            Padding(padding: const EdgeInsets.symmetric(horizontal: 4), child: Text('${m['home_score'] ?? 0}-${m['away_score'] ?? 0}', style: GoogleFonts.rajdhani(color: AppTheme.text1, fontSize: 18, fontWeight: FontWeight.w900))),
            Expanded(child: Text(m['away_team'] ?? '', style: GoogleFonts.outfit(color: AppTheme.text1, fontSize: 12, fontWeight: FontWeight.w800), textAlign: TextAlign.end, overflow: TextOverflow.ellipsis)),
          ]),
          Text((m['league_name'] ?? m['zeta_leagues']?['name'] ?? '').toString(), style: GoogleFonts.outfit(color: AppTheme.text3, fontSize: 9, fontWeight: FontWeight.w700)),
        ]),
      ),
    );
  }

  Widget _buildContinueWatching() {
    if (_loading) return _shimmerBlock(130);
    // In a real app, this would come from user watch history
    // For now, show recent finished matches with progress
    final recentFinished = _matches.where((m) => m['status'] == 'finished').take(2).toList();
    if (recentFinished.isEmpty) return _buildEmptyState('No recent matches to continue', Icons.history_rounded);
    return SizedBox(height: 130, child: ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      scrollDirection: Axis.horizontal,
      itemCount: recentFinished.length,
      itemBuilder: (_, i) {
        final m = recentFinished[i];
        return Container(width: 240, margin: const EdgeInsets.only(right: 12),
          decoration: BoxDecoration(color: AppTheme.card, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppTheme.border)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(child: Stack(children: [
              Positioned.fill(child: ClipRRect(borderRadius: const BorderRadius.only(topLeft: Radius.circular(15), topRight: Radius.circular(15)), child: Image.network(
                m['thumbnail'] ?? 'https://images.unsplash.com/photo-1540747737956-37872f84a62f?w=400&auto=format&fit=crop', fit: BoxFit.cover, color: Colors.black38, colorBlendMode: BlendMode.darken))),
              Positioned(bottom: 0, left: 0, right: 0, child: LinearProgressIndicator(value: 0.72, backgroundColor: Colors.white12, valueColor: AlwaysStoppedAnimation<Color>(AppTheme.primary), minHeight: 3)),
              Center(child: Container(padding: const EdgeInsets.all(8), decoration: const BoxDecoration(color: Colors.black54, shape: BoxShape.circle), child: const Icon(Icons.play_arrow_rounded, color: Colors.white, size: 18))),
            ])),
            Padding(padding: const EdgeInsets.all(8), child: Text(m['home_team'] ?? '' + ' vs ' + m['away_team'] ?? '', style: GoogleFonts.outfit(fontSize: 10, fontWeight: FontWeight.w700, color: AppTheme.text1), maxLines: 1, overflow: TextOverflow.ellipsis)),
          ]),
        );
      },
    ));
  }

  Widget _buildFavTeamChips() {
    return Padding(padding: const EdgeInsets.fromLTRB(16, 20, 16, 0), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('MY FAVOURITES', style: AppTheme.label),
      const SizedBox(height: 10),
      Wrap(spacing: 8, runSpacing: 8, children: _favTeams.map((t) {
        final sel = _favTeam == t;
        return GestureDetector(onTap: () => setState(() => _favTeam = t), child: AnimatedContainer(duration: const Duration(milliseconds: 200), padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8), decoration: BoxDecoration(color: sel ? AppTheme.primary.withOpacity(0.15) : AppTheme.card, borderRadius: BorderRadius.circular(20), border: Border.all(color: sel ? AppTheme.primary : AppTheme.border)), child: Text(t, style: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.w700, color: sel ? AppTheme.primary : AppTheme.text2))));
      }).toList()),
    ]));
  }

  Widget _buildUpcomingList() {
    final upcoming = _filteredUpcoming;
    if (_loading) return _shimmerBlock(200);
    if (upcoming.isEmpty) return _buildEmptyState('No upcoming matches', Icons.calendar_today_rounded);
    return Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: Column(children: upcoming.map((m) => _buildUpcomingCard(m)).toList()));
  }

  Widget _buildUpcomingCard(Map<String, dynamic> m) {
    return GestureDetector(onTap: () => _goToMatch(m), child: Container(margin: const EdgeInsets.only(bottom: 10), padding: const EdgeInsets.all(14), decoration: BoxDecoration(color: AppTheme.card, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppTheme.border)), child: Row(children: [
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('${m['home_team']} vs ${m['away_team']}', style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w700, color: AppTheme.text1)),
        const SizedBox(height: 4),
        Text(m['league_name'] ?? m['zeta_leagues']?['name'] ?? '', style: AppTheme.caption),
      ])),
      IconButton(icon: Icon(Icons.notifications_outlined, color: AppTheme.text3, size: 20), onPressed: () {}),
    ])));
  }

  Widget _buildTournamentCards() {
    if (_tournaments.isEmpty) return _buildEmptyState('No tournaments', Icons.emoji_events_rounded);
    return SizedBox(height: 90, child: ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16), scrollDirection: Axis.horizontal,
      itemCount: _tournaments.length, itemBuilder: (_, i) {
        final t = _tournaments[i];
        final col = _hexColor(t['color']?.toString(), defaultColor: Color((i * 0x1E40AF) | 0xFF000000));
        return Container(width: 160, margin: const EdgeInsets.only(right: 12), padding: const EdgeInsets.all(16), decoration: BoxDecoration(gradient: LinearGradient(colors: [col.withOpacity(0.3), col.withOpacity(0.1)], begin: Alignment.topLeft, end: Alignment.bottomRight), borderRadius: BorderRadius.circular(16), border: Border.all(color: col.withOpacity(0.3))), child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Text(t['name'] ?? '', style: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.w800, color: AppTheme.text1), maxLines: 2, overflow: TextOverflow.ellipsis),
          Text('${t['team_count'] ?? '—'} Teams', style: GoogleFonts.outfit(fontSize: 10, fontWeight: FontWeight.w600, color: col)),
        ]));
      },
    ));
  }

  Widget _buildTrendingHighlights() {
    if (_loading) return _shimmerBlock(140);
    final trending = _highlights.where((h) => h['badge'] == 'TRENDING' || h['badge'] == 'POPULAR').take(6).toList();
    if (trending.isEmpty && _highlights.isNotEmpty) {
      trending.addAll(_highlights.take(6));
    }
    if (trending.isEmpty) return _buildEmptyState('No highlights available', Icons.video_library_rounded);
    return SizedBox(height: 140, child: ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16), scrollDirection: Axis.horizontal,
      itemCount: trending.length, itemBuilder: (_, i) => _buildHighlightCard(trending[i]),
    ));
  }

  Widget _buildHighlightCard(Map<String, dynamic> hl) {
    final badge = hl['badge']?.toString() ?? '';
    final isTrend = badge == 'TRENDING';
    final isPopular = badge == 'POPULAR';
    final badgeCol = isTrend ? AppTheme.danger : AppTheme.warning;
    return GestureDetector(onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const HighlightsScreen())), child: Container(width: 200, margin: const EdgeInsets.only(right: 12), decoration: BoxDecoration(color: AppTheme.card, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppTheme.border)), child: Column(children: [
      Expanded(flex: 3, child: Stack(children: [
        Positioned.fill(child: ClipRRect(borderRadius: const BorderRadius.only(topLeft: Radius.circular(15), topRight: Radius.circular(15)), child: Image.network(hl['thumbnail'] ?? 'https://images.unsplash.com/photo-1540747737956-37872f84a62f?w=400&auto=format&fit=crop', fit: BoxFit.cover, color: Colors.black.withValues(alpha: 0.2), colorBlendMode: BlendMode.darken))),
        if (badge.isNotEmpty) Positioned(top: 8, left: 8, child: Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3), decoration: BoxDecoration(color: badgeCol, borderRadius: BorderRadius.circular(5)), child: Text(badge, style: GoogleFonts.outfit(color: Colors.white, fontSize: 7, fontWeight: FontWeight.w900)))),
        Positioned(bottom: 6, right: 6, child: Container(padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2), color: Colors.black87, child: Text(hl['duration'] ?? '', style: GoogleFonts.rajdhani(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold)))),
        Center(child: Container(width: 36, height: 36, decoration: BoxDecoration(color: AppTheme.primary.withOpacity(0.9), shape: BoxShape.circle, boxShadow: [BoxShadow(color: AppTheme.primary.withOpacity(0.4), blurRadius: 12)]), child: const Icon(Icons.play_arrow_rounded, color: Colors.black, size: 22))),
      ])),
      Expanded(flex: 2, child: Padding(padding: const EdgeInsets.all(8), child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Text(hl['title'] ?? '', style: GoogleFonts.outfit(fontSize: 10, fontWeight: FontWeight.w700, color: AppTheme.text1), maxLines: 2, overflow: TextOverflow.ellipsis),
        Row(children: [Expanded(child: Text(hl['zeta_leagues']?['name'] ?? hl['league_name'] ?? '', style: GoogleFonts.outfit(fontSize: 8, fontWeight: FontWeight.w700, color: AppTheme.text3), overflow: TextOverflow.ellipsis)), Text('${hl['views'] ?? 0} views', style: GoogleFonts.outfit(fontSize: 8, color: AppTheme.text3))]),
      ]))),
    ])));
  }

  Widget _buildNewsSection() {
    if (_loading) return _shimmerBlock(200);
    if (_news.isEmpty) return _buildEmptyState('No news available', Icons.article_rounded);
    return Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: Column(children: _news.map((n) => Container(margin: const EdgeInsets.only(bottom: 10), padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: AppTheme.card, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppTheme.border)), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _tagBadge(n['tag'] ?? 'NEWS'),
        const SizedBox(height: 6),
        Text(n['title'] ?? '', style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.text1, height: 1.4), maxLines: 2, overflow: TextOverflow.ellipsis),
        const SizedBox(height: 8),
        Row(children: [
          Text(n['source'] ?? '', style: GoogleFonts.outfit(fontSize: 10, fontWeight: FontWeight.w700, color: AppTheme.text3)),
          const SizedBox(width: 8), Container(width: 3, height: 3, decoration: const BoxDecoration(color: AppTheme.text3, shape: BoxShape.circle)),
          const SizedBox(width: 8), Text(n['time_ago'] ?? n['created_at'] != null ? _formatTime(n['created_at']) : '', style: GoogleFonts.outfit(fontSize: 10, color: AppTheme.text3)),
        ]),
      ])), const SizedBox(width: 12),
      ClipRRect(borderRadius: BorderRadius.circular(10), child: Image.network(n['image'] ?? n['thumbnail'] ?? 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=200&auto=format&fit=crop', width: 72, height: 72, fit: BoxFit.cover)),
    ]))).toList()));
  }

  Widget _tagBadge(String tag) {
    Color col;
    switch (tag) {
      case 'BREAKING': col = AppTheme.danger; break;
      case 'TRANSFER': col = AppTheme.warning; break;
      case 'INJURY': col = const Color(0xFFFF6B35); break;
      default: col = AppTheme.primary;
    }
    return Container(padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3), decoration: BoxDecoration(color: col.withOpacity(0.15), borderRadius: BorderRadius.circular(5), border: Border.all(color: col.withOpacity(0.3))), child: Text(tag, style: GoogleFonts.outfit(fontSize: 8, fontWeight: FontWeight.w900, color: col, letterSpacing: 0.5)));
  }

  String _formatTime(dynamic date) {
    if (date == null) return '';
    final d = date is String ? DateTime.parse(date) : date as DateTime;
    final diff = DateTime.now().difference(d);
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return '${diff.inDays}d ago';
  }

  Widget _livePulse() => Container(padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3), decoration: BoxDecoration(color: AppTheme.danger.withOpacity(0.15), borderRadius: BorderRadius.circular(5), border: Border.all(color: AppTheme.danger.withOpacity(0.5))), child: Row(mainAxisSize: MainAxisSize.min, children: [Container(width: 5, height: 5, decoration: const BoxDecoration(color: AppTheme.danger, shape: BoxShape.circle)), const SizedBox(width: 4), Text('LIVE', style: GoogleFonts.outfit(color: AppTheme.danger, fontSize: 8, fontWeight: FontWeight.w900, letterSpacing: 0.8))]));

  Widget _teamLogo(String name, String? logoUrl, Color color, double size) {
    final abbr = name.length >= 3 ? name.substring(0, 3).toUpperCase() : name.toUpperCase();
    if (logoUrl != null && logoUrl.isNotEmpty) {
      return Container(width: size, height: size, decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: color.withOpacity(0.4), width: 2)), child: ClipOval(child: Image.network(logoUrl, fit: BoxFit.cover, errorBuilder: (_, __, ___) => _logoFallback(abbr, color))));
    }
    return Container(width: size, height: size, decoration: BoxDecoration(color: color.withOpacity(0.15), shape: BoxShape.circle, border: Border.all(color: color.withOpacity(0.4), width: 2)), child: Center(child: Text(abbr, style: GoogleFonts.outfit(fontSize: size * 0.23, fontWeight: FontWeight.w900, color: color))));
  }

  Widget _logoFallback(String abbr, Color color) => Center(child: Text(abbr, style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w900, color: color)));

  Widget _primaryBtn(IconData icon, String label, VoidCallback onTap) => GestureDetector(onTap: onTap, child: Container(height: 42, decoration: BoxDecoration(gradient: const LinearGradient(colors: [AppTheme.primary, AppTheme.secondary]), borderRadius: BorderRadius.circular(AppTheme.radiusBtn)), child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [Icon(icon, color: Colors.black, size: 16), const SizedBox(width: 6), Text(label, style: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.w900, color: Colors.black))])));

  Widget _outlineIconBtn(IconData icon, VoidCallback onTap) => GestureDetector(onTap: onTap, child: Container(width: 42, height: 42, decoration: BoxDecoration(color: Colors.white10, borderRadius: BorderRadius.circular(AppTheme.radiusBtn), border: Border.all(color: Colors.white24)), child: Icon(icon, color: Colors.white, size: 18)));

  Widget _shimmerBlock(double height) => Container(height: height, margin: const EdgeInsets.all(16), decoration: BoxDecoration(color: AppTheme.card, borderRadius: BorderRadius.circular(AppTheme.radiusCard)));

  Widget _buildEmptyState(String msg, IconData icon) => Container(padding: const EdgeInsets.all(32), child: Column(children: [Icon(icon, color: AppTheme.text3, size: 48), const SizedBox(height: 12), Text(msg, style: GoogleFonts.outfit(color: AppTheme.text2, fontSize: 13)),]));

  void _goToMatch(Map<String, dynamic> m) {
    Navigator.push(context, MaterialPageRoute(builder: (_) => MatchDetailScreen(match: m)));
  }

  Color _hexColor(String? hex, {Color defaultColor = AppTheme.primary}) {
    if (hex == null || hex.isEmpty) return defaultColor;
    try {
      hex = hex.replaceAll('#', '');
      if (hex.length == 6) hex = 'FF$hex';
      return Color(int.parse(hex, radix: 16));
    } catch (_) {
      return defaultColor;
    }
  }
}