import 'dart:async';
import 'package:url_launcher/url_launcher.dart';
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/match_model.dart';
import '../services/firestore_service.dart';
import '../theme/app_theme.dart';
import '../widgets/match_card.dart';
import '../widgets/team_crest.dart';
import 'match_detail_screen.dart';
import '../services/ad_service.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  String _dateFilter = 'today';
  final PageController _trendingController = PageController();
  Timer? _timer;
  int _currentPage = 0;

  @override
  void initState() {
    super.initState();
    _startAutoSlide();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _trendingController.dispose();
    super.dispose();
  }

  void _startAutoSlide() {
    _timer = Timer.periodic(const Duration(milliseconds: 3500), (timer) {
      if (_trendingController.hasClients) {
        _currentPage++;
        _trendingController.animateToPage(
          _currentPage,
          duration: const Duration(milliseconds: 600),
          curve: Curves.easeInOutCubic,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<List<MatchModel>>(
      stream: FirestoreService.matchesStream(),
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.error_outline, color: AppTheme.red, size: 48),
                const SizedBox(height: 16),
                Text('CONNECTION ERROR', style: GoogleFonts.rajdhani(color: AppTheme.text1, fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                Text('Please check your internet connection', style: TextStyle(color: AppTheme.text3, fontSize: 12)),
              ],
            ),
          );
        }

        if (snapshot.connectionState == ConnectionState.waiting) {
          return _buildShimmerLoading();
        }

        final matches = snapshot.data ?? [];
        final trending = matches.where((m) => m.featured).toList();
        final live = matches.where((m) => m.isLive).toList();
        
        return RefreshIndicator(
          color: AppTheme.accent,
          backgroundColor: AppTheme.card,
          onRefresh: () async => await Future.delayed(const Duration(milliseconds: 1000)),
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Global Announcement Bar
                _buildAnnouncementBar(),

                // Community Hub
                _buildCommunityHub(),

                // Live Matches (Priority)
                if (live.isNotEmpty) ...[
                  _SectionHeader(
                    icon: Icons.fiber_manual_record,
                    iconColor: AppTheme.red,
                    title: 'LIVE NOW',
                  ),
                  ...live.map((m) => MatchCard(match: m)),
                ],

                // Trending Matches Carousel
                if (trending.isNotEmpty) ...[
                  _SectionHeader(
                    icon: Icons.local_fire_department,
                    iconColor: AppTheme.red,
                    title: 'TRENDING MATCHES',
                  ),
                  _buildTrendingCarousel(trending),
                ],

                // All Matches (The Reliable Section!)
                _SectionHeader(
                  icon: Icons.sports_soccer,
                  iconColor: AppTheme.gold,
                  title: 'TOP MATCHES',
                ),
                
                if (matches.isNotEmpty)
                  ..._buildLeagueGroups(matches)
                else
                  _buildEmptyState(),

                const SizedBox(height: 100), // Extra space for banner
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildShimmerLoading() {
    return SingleChildScrollView(
      child: Column(
        children: List.generate(5, (index) => 
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            height: 80,
            decoration: BoxDecoration(
              color: AppTheme.card.withOpacity(0.5),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Center(child: CircularProgressIndicator(strokeWidth: 1)),
          ),
        ),
      ),
    );
  }

  Widget _buildAnnouncementBar() {
    return StreamBuilder<Map<String, dynamic>?>(
      stream: FirestoreService.configStream(),
      builder: (context, snap) {
        final msg = snap.data?['announcement'] as String?;
        if (msg == null || msg.isEmpty) return const SizedBox.shrink();
        return Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
          margin: const EdgeInsets.only(bottom: 8),
          decoration: BoxDecoration(
            color: AppTheme.accent.withOpacity(0.15),
            border: Border(bottom: BorderSide(color: AppTheme.accent.withOpacity(0.3))),
          ),
          child: Row(
            children: [
              Icon(Icons.campaign, color: AppTheme.accent2, size: 18),
              const SizedBox(width: 10),
              Expanded(
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Text(
                    msg.toUpperCase(),
                    style: GoogleFonts.inter(
                      fontSize: 11, fontWeight: FontWeight.w800,
                      color: AppTheme.accent2, letterSpacing: 0.5,
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildCommunityHub() {
    return StreamBuilder<Map<String, dynamic>?>(
      stream: FirestoreService.configStream(),
      builder: (context, snap) {
        final config = snap.data;
        final wa = config?['whatsappUrl'] as String?;
        final tg = config?['telegramUrl'] as String?;
        if ((wa == null || wa.isEmpty) && (tg == null || tg.isEmpty)) return const SizedBox.shrink();
        return Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppTheme.card,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppTheme.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.groups, color: AppTheme.accent, size: 20),
                    const SizedBox(width: 10),
                    Text('COMMUNITY HUB', style: GoogleFonts.rajdhani(fontSize: 14, fontWeight: FontWeight.w800, color: AppTheme.text1, letterSpacing: 1)),
                  ],
                ),
                const SizedBox(height: 4),
                Text('Join our official groups for instant match updates and VIP tips!', style: TextStyle(color: AppTheme.text3, fontSize: 11)),
                const SizedBox(height: 16),
                Row(
                  children: [
                    if (wa != null && wa.isNotEmpty)
                      Expanded(child: _SocialButton(
                        label: 'WHATSAPP', 
                        color: const Color(0xFF25D366), 
                        icon: Icons.chat, 
                        onTap: () => launchUrl(Uri.parse(wa), mode: LaunchMode.externalApplication),
                      )),
                    if (wa != null && wa.isNotEmpty && tg != null && tg.isNotEmpty) const SizedBox(width: 12),
                    if (tg != null && tg.isNotEmpty)
                      Expanded(child: _SocialButton(
                        label: 'TELEGRAM', 
                        color: const Color(0xFF0088CC), 
                        icon: Icons.send, 
                        onTap: () => launchUrl(Uri.parse(tg), mode: LaunchMode.externalApplication),
                      )),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildTrendingCarousel(List<MatchModel> trending) {
    return SizedBox(
      height: 200,
      child: Stack(
        children: [
          PageView.builder(
            controller: _trendingController,
            onPageChanged: (i) => _currentPage = i,
            itemBuilder: (context, index) => _TrendingMatchBanner(match: trending[index % trending.length]),
          ),
          _buildCarouselNav(),
        ],
      ),
    );
  }

  Widget _buildCarouselNav() {
    return Stack(
      children: [
        Positioned(
          left: 10, top: 0, bottom: 0,
          child: Center(
            child: IconButton(
              icon: Icon(Icons.chevron_left, color: Colors.white.withOpacity(0.3), size: 28),
              onPressed: () => _trendingController.previousPage(duration: const Duration(milliseconds: 400), curve: Curves.easeOut),
            ),
          ),
        ),
        Positioned(
          right: 10, top: 0, bottom: 0,
          child: Center(
            child: IconButton(
              icon: Icon(Icons.chevron_right, color: Colors.white.withOpacity(0.3), size: 28),
              onPressed: () => _trendingController.nextPage(duration: const Duration(milliseconds: 400), curve: Curves.easeOut),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildDateFilters() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Row(
          children: [
            _DateChip(label: 'Yesterday', isSelected: _dateFilter == 'yesterday', onTap: () => setState(() => _dateFilter = 'yesterday')),
            const SizedBox(width: 10),
            _DateChip(label: 'Today', isSelected: _dateFilter == 'today', onTap: () => setState(() => _dateFilter = 'today')),
            const SizedBox(width: 10),
            _DateChip(label: 'Tomorrow', isSelected: _dateFilter == 'tomorrow', onTap: () => setState(() => _dateFilter = 'tomorrow')),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 60, horizontal: 30),
      child: Center(
        child: Column(
          children: [
            Icon(Icons.event_busy, color: AppTheme.text3.withOpacity(0.2), size: 48),
            const SizedBox(height: 12),
            Text('No matches scheduled for this date.', style: TextStyle(color: AppTheme.text3, fontSize: 13, fontWeight: FontWeight.w500)),
          ],
        ),
      ),
    );
  }

  List<Widget> _buildLeagueGroups(List<MatchModel> mList) {
    final map = <String, List<MatchModel>>{};
    for (final m in mList) {
      final key = m.leagueName.isNotEmpty ? m.leagueName : 'OTHER MATCHES';
      if (!map.containsKey(key)) map[key] = [];
      map[key]!.add(m);
    }
    final widgets = <Widget>[];
    map.forEach((league, leagueMatches) {
      widgets.add(_SectionHeader(
        icon: Icons.emoji_events,
        iconColor: AppTheme.gold,
        title: league.toUpperCase(),
      ));
      widgets.addAll(leagueMatches.map((m) => MatchCard(match: m)));
    });
    return widgets;
  }
}

class _DateChip extends StatelessWidget {
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  const _DateChip({required this.label, required this.isSelected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        alignment: Alignment.center,
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
        decoration: BoxDecoration(
          color: isSelected ? AppTheme.accent.withOpacity(0.15) : Colors.transparent,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: isSelected ? AppTheme.accent : AppTheme.border),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? AppTheme.accent2 : AppTheme.text3,
            fontSize: 12,
            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
          ),
        ),
      ),
    );
  }
}

class _TrendingMatchBanner extends StatelessWidget {
  final MatchModel match;
  const _TrendingMatchBanner({required this.match});

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.of(context).size.width;
    return GestureDetector(
      onTap: () {
        AdService.showInterstitial(context, () {
          Navigator.push(context,
            MaterialPageRoute(builder: (_) => MatchDetailScreen(matchId: match.id)));
        });
      },
      child: Container(
        width: width,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                const Color(0xFF0D1F4A).withOpacity(0.9),
                const Color(0xFF05080F),
              ],
            ),
            border: Border.all(color: AppTheme.border2),
            boxShadow: [
              BoxShadow(
                color: AppTheme.accent.withOpacity(0.1),
                blurRadius: 20,
                spreadRadius: -5,
              )
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(20),
            child: Stack(
              children: [
                // Decorative BG Glow
                Positioned(
                  top: -40, right: -40,
                  child: Container(
                    width: 140, height: 140,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppTheme.accent.withOpacity(0.04),
                    ),
                  ),
                ),
                
                Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    children: [
                      // Top: League & Status
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              Container(
                                width: 6, height: 6,
                                decoration: BoxDecoration(shape: BoxShape.circle, color: AppTheme.accent),
                              ),
                              const SizedBox(width: 8),
                              Text(match.leagueName.toUpperCase(),
                                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: AppTheme.text3, letterSpacing: 1)),
                            ],
                          ),
                          if (match.isLive)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(color: AppTheme.red, borderRadius: BorderRadius.circular(20)),
                              child: Row(
                                children: [
                                  const Icon(Icons.fiber_manual_record, size: 8, color: Colors.white),
                                  const SizedBox(width: 4),
                                  Text(match.minute ?? 'LIVE', style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: Colors.white)),
                                ],
                              ),
                            )
                          else
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(color: AppTheme.accent.withOpacity(0.1), borderRadius: BorderRadius.circular(20)),
                              child: Text('UPCOMING', style: TextStyle(fontSize: 8, fontWeight: FontWeight.w800, color: AppTheme.accent2)),
                            ),
                        ],
                      ),
                      const Spacer(),
                      // Center: Teams & Score
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                        children: [
                          // Home
                          Expanded(
                            child: Column(
                              children: [
                                TeamCrest(logoUrl: match.homeLogo, code: match.home, size: 54),
                                const SizedBox(height: 8),
                                Text(match.homeTeam, 
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.white),
                                  maxLines: 1, overflow: TextOverflow.ellipsis),
                              ],
                            ),
                          ),
                          
                          // Score/VS (12hr Format applied)
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 10),
                            child: Column(
                              children: [
                                if (match.status == 'upcoming')
                                  Text('VS', style: GoogleFonts.rajdhani(fontSize: 24, fontWeight: FontWeight.w800, color: AppTheme.text3))
                                else
                                  Text('${match.homeScore} - ${match.awayScore}', 
                                    style: GoogleFonts.rajdhani(fontSize: 38, fontWeight: FontWeight.w800, color: Colors.white, letterSpacing: 2)),
                                
                                if (match.status == 'upcoming')
                                  Text(match.kickoffTime12, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.accent2))
                                else
                                  const SizedBox(height: 10),
                              ],
                            ),
                          ),
  
                          // Away
                          Expanded(
                            child: Column(
                              children: [
                                TeamCrest(logoUrl: match.awayLogo, code: match.away, size: 54),
                                const SizedBox(height: 8),
                                Text(match.awayTeam, 
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.white),
                                  maxLines: 1, overflow: TextOverflow.ellipsis),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const Spacer(),
                      // Footer
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(match.kickoffDate, style: TextStyle(fontSize: 10, color: AppTheme.text3)),
                          Row(
                            children: [
                              Icon(Icons.play_circle_fill, size: 14, color: AppTheme.accent2),
                              const SizedBox(width: 4),
                              Text('WATCH NOW', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: AppTheme.accent2)),
                            ],
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}


class _SectionHeader extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String title;

  const _SectionHeader({required this.icon, required this.iconColor, required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 24, 16, 12),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              color: iconColor.withOpacity(0.1),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Icon(icon, size: 14, color: iconColor),
          ),
          const SizedBox(width: 10),
          Text(
            title,
            style: GoogleFonts.inter(
              fontSize: 12, fontWeight: FontWeight.w900,
              color: AppTheme.text1, letterSpacing: 1.2,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(child: Divider(color: AppTheme.border, thickness: 1)),
        ],
      ),
    );
  }
}

class _SocialButton extends StatelessWidget {
  final String label;
  final Color color;
  final IconData icon;
  final VoidCallback onTap;

  const _SocialButton({
    required this.label,
    required this.color,
    required this.icon,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withOpacity(0.3)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: color, size: 16),
            const SizedBox(width: 8),
            Text(label, 
              style: GoogleFonts.rajdhani(fontSize: 12, fontWeight: FontWeight.w800, color: color, letterSpacing: 1)),
          ],
        ),
      ),
    );
  }
}

class _FeaturedBanner extends StatelessWidget {
  final MatchModel match;
  const _FeaturedBanner({required this.match});

  @override
  Widget build(BuildContext context) {
    final isLive = match.isLive;
    return GestureDetector(
      onTap: () {
        AdService.showInterstitial(context, () {
          Navigator.push(context,
            MaterialPageRoute(builder: (_) => MatchDetailScreen(matchId: match.id)));
        });
      },
      child: Container(
        margin: const EdgeInsets.all(16),
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF0D1F4A), Color(0xFF0A0F1E)],
          ),
          border: Border.all(color: AppTheme.border2),
          boxShadow: [
            BoxShadow(
              color: AppTheme.accent.withOpacity(0.15),
              blurRadius: 20, spreadRadius: 2,
            ),
          ],
        ),
        child: Column(
          children: [
            Row(
              children: [
                if (isLive) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: AppTheme.red.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: AppTheme.red.withOpacity(0.5)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(width: 6, height: 6, decoration: BoxDecoration(color: AppTheme.red, shape: BoxShape.circle)),
                        const SizedBox(width: 4),
                        Text('LIVE', style: TextStyle(color: AppTheme.red, fontSize: 10, fontWeight: FontWeight.w800)),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                ],
                Text(
                  '${match.leagueName.isEmpty ? match.leagueId : match.leagueName}',
                  style: TextStyle(color: AppTheme.text3, fontSize: 11, fontWeight: FontWeight.w600),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                Expanded(child: Column(
                  children: [
                    TeamCrest(logoUrl: match.homeLogo, code: match.home, size: 56),
                    const SizedBox(height: 8),
                    Text(match.homeTeam, textAlign: TextAlign.center,
                      style: TextStyle(color: AppTheme.text1, fontSize: 13, fontWeight: FontWeight.w700)),
                  ],
                )),
                Column(
                  children: [
                    Text(
                      match.scoreDisplay,
                      style: GoogleFonts.rajdhani(
                        fontSize: 32, fontWeight: FontWeight.w800,
                        color: AppTheme.text1, letterSpacing: 4,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(match.statusDisplay,
                      style: TextStyle(color: AppTheme.text3, fontSize: 11)),
                  ],
                ),
                Expanded(child: Column(
                  children: [
                    TeamCrest(logoUrl: match.awayLogo, code: match.away, size: 56),
                    const SizedBox(height: 8),
                    Text(match.awayTeam, textAlign: TextAlign.center,
                      style: TextStyle(color: AppTheme.text1, fontSize: 13, fontWeight: FontWeight.w700)),
                  ],
                )),
              ],
            ),
            const SizedBox(height: 16),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 10),
              decoration: BoxDecoration(
                color: AppTheme.accent.withOpacity(0.15),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppTheme.accent.withOpacity(0.3)),
              ),
              child: Center(
                child: Text('▶  Watch Now', style: TextStyle(
                  color: AppTheme.accent2, fontWeight: FontWeight.w700, fontSize: 13)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
