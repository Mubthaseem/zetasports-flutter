import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../services/firestore_service.dart';
import '../theme/tailwind_theme.dart';
import '../theme/app_theme.dart';
import '../widgets/tw_card.dart';
import '../widgets/tw_badge.dart';
import 'player_screen.dart';

class LiveTvScreen extends StatefulWidget {
  const LiveTvScreen({super.key});
  @override
  State<LiveTvScreen> createState() => _LiveTvScreenState();
}

class _LiveTvScreenState extends State<LiveTvScreen> {
  List<Map<String, dynamic>> _streams = [];
  bool _loading = true;
  String _selectedCategory = 'All';
  List<String> _categories = ['All'];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final allStreams = await SupabaseService.fetchStreams(active: true);

      final cats = {'All'};
      for (var s in allStreams) {
        if (s['category'] != null && s['category'].toString().isNotEmpty) {
          cats.add(s['category'].toString().trim());
        }
      }

      setState(() {
        _streams = allStreams;
        _categories = cats.toList()..sort();
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> get _filteredStreams {
    if (_selectedCategory == 'All') return _streams;
    return _streams.where((s) => s['category'] == _selectedCategory).toList();
  }

  void _openStream(Map<String, dynamic> ch) {
    final url = ch['url']?.toString() ?? ch['stream_url']?.toString() ?? '';
    if (url.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Stream URL not configured for ${ch['label'] ?? 'this channel'}',
            style: GoogleFonts.outfit(fontWeight: FontWeight.w600),
          ),
          backgroundColor: TwRose.r600,
        ),
      );
      return;
    }
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => PlayerScreen(
          match: {
            'stream_url': url,
            'home_team': ch['label'] ?? 'Channel',
            'away_team': '',
            'status': 'live',
          },
          username: 'ZetaUser',
          deviceId: 'device_001',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filteredStreams;

    return Scaffold(
      backgroundColor: AppTheme.bg,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 1,
        title: Text(
          'Live TV Channels',
          style: GoogleFonts.outfit(
            fontWeight: FontWeight.w900,
            fontSize: 22,
            color: TwSlate.s900,
            letterSpacing: -0.5,
          ),
        ),
        centerTitle: false,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: TwSlate.s700),
            onPressed: _load,
          ),
          const SizedBox(width: TwSpace.p2),
        ],
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(
                strokeWidth: 2,
                valueColor: AlwaysStoppedAnimation<Color>(TwBlue.b600),
              ),
            )
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Filter Chips
                if (_categories.length > 1)
                  Container(
                    height: 44,
                    margin: const EdgeInsets.only(top: TwSpace.p3, bottom: TwSpace.p2),
                    child: ListView.separated(
                      padding: const EdgeInsets.symmetric(horizontal: TwSpace.p4),
                      scrollDirection: Axis.horizontal,
                      itemCount: _categories.length,
                      separatorBuilder: (_, __) => const SizedBox(width: TwSpace.p2),
                      itemBuilder: (context, index) {
                        final cat = _categories[index];
                        final isSelected = _selectedCategory == cat;
                        return GestureDetector(
                          onTap: () => setState(() => _selectedCategory = cat),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 180),
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            decoration: BoxDecoration(
                              color: isSelected ? TwBlue.b600 : Colors.white,
                              borderRadius: BorderRadius.circular(TwRadius.full),
                              border: Border.all(
                                color: isSelected ? TwBlue.b600 : TwSlate.s200,
                                width: 1,
                              ),
                              boxShadow: isSelected ? TwShadows.sm : null,
                            ),
                            child: Center(
                              child: Text(
                                cat,
                                style: GoogleFonts.outfit(
                                  color: isSelected ? Colors.white : TwSlate.s700,
                                  fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
                                  fontSize: 12,
                                ),
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ),

                // Grid of Channels
                Expanded(
                  child: filtered.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.tv_off_rounded, size: 48, color: TwSlate.s300),
                              const SizedBox(height: TwSpace.p2),
                              Text(
                                'No channels found in "$_selectedCategory"',
                                style: GoogleFonts.outfit(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  color: TwSlate.s500,
                                ),
                              ),
                            ],
                          ),
                        )
                      : GridView.builder(
                          padding: const EdgeInsets.all(TwSpace.p4),
                          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 2,
                            crossAxisSpacing: 14,
                            mainAxisSpacing: 14,
                            childAspectRatio: 1.15,
                          ),
                          itemCount: filtered.length,
                          itemBuilder: (context, index) {
                            final ch = filtered[index];
                            final thumbnail = ch['thumbnail']?.toString() ?? '';
                            return TwCard(
                              padding: EdgeInsets.zero,
                              onTap: () => _openStream(ch),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  Expanded(
                                    child: Stack(
                                      children: [
                                        Positioned.fill(
                                          child: thumbnail.isNotEmpty
                                              ? CachedNetworkImage(
                                                  imageUrl: thumbnail,
                                                  fit: BoxFit.cover,
                                                  errorWidget: (_, __, ___) => Container(
                                                    color: TwSlate.s100,
                                                    child: const Icon(
                                                      Icons.live_tv_rounded,
                                                      color: TwBlue.b600,
                                                      size: 36,
                                                    ),
                                                  ),
                                                )
                                              : Container(
                                                  color: TwSlate.s100,
                                                  child: const Icon(
                                                    Icons.live_tv_rounded,
                                                    color: TwBlue.b600,
                                                    size: 36,
                                                  ),
                                                ),
                                        ),
                                        const Positioned(
                                          top: 8,
                                          right: 8,
                                          child: TwBadge(
                                            label: 'HD',
                                            variant: TwBadgeVariant.primary,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: TwSpace.p3,
                                      vertical: TwSpace.p2_5,
                                    ),
                                    color: Colors.white,
                                    child: Text(
                                      ch['label']?.toString() ?? 'Channel',
                                      style: GoogleFonts.outfit(
                                        color: TwSlate.s900,
                                        fontWeight: FontWeight.w700,
                                        fontSize: 13,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                ),
              ],
            ),
    );
  }
}
