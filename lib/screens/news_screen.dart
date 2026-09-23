import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../theme/tailwind_theme.dart';
import '../theme/app_theme.dart';
import '../widgets/tw_card.dart';
import '../widgets/tw_badge.dart';
import '../services/firestore_service.dart' show SupabaseService;

class NewsScreen extends StatefulWidget {
  const NewsScreen({super.key});
  @override
  State<NewsScreen> createState() => _NewsScreenState();
}

class _NewsScreenState extends State<NewsScreen> {
  String _category = 'Top Stories';
  final _categories = ['Top Stories', 'Latest', 'Transfers', 'Videos', 'Breaking'];
  List<Map<String, dynamic>> _articles = [];
  Map<String, dynamic>? _featured;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadNews();
  }

  Future<void> _loadNews() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final all = await SupabaseService.fetchNews(publishedOnly: true, limit: 20);
      if (mounted) {
        setState(() {
          _articles = all;
          _featured = all.isNotEmpty ? all.first : null;
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

  List<Map<String, dynamic>> get _filtered {
    if (_category == 'Top Stories' || _category == 'Latest') return _articles;
    return _articles
        .where((a) => (a['category'] ?? '')
            .toString()
            .toLowerCase()
            .contains(_category.toLowerCase()))
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bg,
      body: SafeArea(
        child: RefreshIndicator(
          color: TwBlue.b600,
          backgroundColor: Colors.white,
          onRefresh: _loadNews,
          child: CustomScrollView(
            slivers: [
              SliverToBoxAdapter(child: _buildHeader()),
              SliverToBoxAdapter(child: _buildCategoryChips()),
              if (_loading) ...[
                SliverToBoxAdapter(child: _shimmerFeatured()),
                SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (_, __) => _shimmerArticle(),
                    childCount: 5,
                  ),
                ),
              ] else if (_error != null) ...[
                SliverFillRemaining(child: _buildErrorState()),
              ] else if (_filtered.isEmpty) ...[
                SliverFillRemaining(child: _buildEmptyState()),
              ] else ...[
                if (_featured != null) SliverToBoxAdapter(child: _buildFeaturedCard()),
                SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (_, i) => _buildArticleRow(_filtered[i]),
                    childCount: _filtered.length,
                  ),
                ),
              ],
              const SliverToBoxAdapter(child: SizedBox(height: TwSpace.p8)),
            ],
          ),
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
            'Sports News',
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
            onPressed: _loadNews,
          ),
        ],
      ),
    );
  }

  Widget _buildCategoryChips() {
    return Container(
      height: 44,
      margin: const EdgeInsets.only(bottom: TwSpace.p3),
      child: ListView.separated(
        padding: const EdgeInsets.symmetric(horizontal: TwSpace.p4),
        scrollDirection: Axis.horizontal,
        itemCount: _categories.length,
        separatorBuilder: (_, __) => const SizedBox(width: TwSpace.p2),
        itemBuilder: (context, i) {
          final cat = _categories[i];
          final isSelected = _category == cat;
          return GestureDetector(
            onTap: () => setState(() => _category = cat),
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
    );
  }

  Widget _buildFeaturedCard() {
    final item = _featured!;
    final title = item['title'] ?? 'Featured Story';
    final imageUrl = item['image_url']?.toString() ?? '';
    final category = item['category'] ?? 'Headlines';

    return Container(
      margin: const EdgeInsets.fromLTRB(TwSpace.p4, 0, TwSpace.p4, TwSpace.p3),
      child: TwCard(
        padding: EdgeInsets.zero,
        onTap: () => _openArticleDetail(item),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (imageUrl.isNotEmpty)
              ClipRRect(
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(TwRadius.xl2),
                  topRight: Radius.circular(TwRadius.xl2),
                ),
                child: CachedNetworkImage(
                  imageUrl: imageUrl,
                  height: 190,
                  width: double.infinity,
                  fit: BoxFit.cover,
                  errorWidget: (_, __, ___) => Container(height: 190, color: TwSlate.s200),
                ),
              ),
            Padding(
              padding: const EdgeInsets.all(TwSpace.p4),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  TwBadge(label: category, variant: TwBadgeVariant.primary),
                  const SizedBox(height: TwSpace.p2),
                  Text(
                    title,
                    style: GoogleFonts.outfit(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                      color: TwSlate.s900,
                      height: 1.3,
                    ),
                  ),
                  const SizedBox(height: TwSpace.p2),
                  Text(
                    _formatTime(item['created_at']),
                    style: GoogleFonts.outfit(fontSize: 12, color: TwSlate.s400),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildArticleRow(Map<String, dynamic> item) {
    final title = item['title'] ?? '';
    final imageUrl = item['image_url']?.toString() ?? '';
    final category = item['category'] ?? 'Sports';

    return Container(
      margin: const EdgeInsets.fromLTRB(TwSpace.p4, 0, TwSpace.p4, TwSpace.p2_5),
      child: TwCard(
        padding: const EdgeInsets.all(TwSpace.p3),
        onTap: () => _openArticleDetail(item),
        child: Row(
          children: [
            if (imageUrl.isNotEmpty)
              ClipRRect(
                borderRadius: BorderRadius.circular(TwRadius.lg),
                child: CachedNetworkImage(
                  imageUrl: imageUrl,
                  width: 78,
                  height: 78,
                  fit: BoxFit.cover,
                  errorWidget: (_, __, ___) => Container(width: 78, height: 78, color: TwSlate.s200),
                ),
              ),
            const SizedBox(width: TwSpace.p3),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  TwBadge(label: category, variant: TwBadgeVariant.neutral),
                  const SizedBox(height: TwSpace.p1),
                  Text(
                    title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.outfit(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: TwSlate.s900,
                      height: 1.3,
                    ),
                  ),
                  const SizedBox(height: TwSpace.p1),
                  Text(
                    _formatTime(item['created_at']),
                    style: GoogleFonts.outfit(fontSize: 11, color: TwSlate.s400),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _openArticleDetail(Map<String, dynamic> item) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(TwRadius.xl3)),
      ),
      builder: (_) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.85,
        maxChildSize: 0.95,
        minChildSize: 0.5,
        builder: (_, scrollController) => ListView(
          controller: scrollController,
          padding: const EdgeInsets.all(TwSpace.p5),
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: TwSpace.p4),
                decoration: BoxDecoration(
                  color: TwSlate.s300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            TwBadge(label: item['category'] ?? 'Sports', variant: TwBadgeVariant.primary),
            const SizedBox(height: TwSpace.p2_5),
            Text(
              item['title'] ?? '',
              style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.w900, color: TwSlate.s900),
            ),
            const SizedBox(height: TwSpace.p2),
            Text(
              _formatTime(item['created_at']),
              style: GoogleFonts.outfit(fontSize: 12, color: TwSlate.s400),
            ),
            const SizedBox(height: TwSpace.p4),
            if (item['image_url'] != null)
              ClipRRect(
                borderRadius: BorderRadius.circular(TwRadius.xl),
                child: CachedNetworkImage(
                  imageUrl: item['image_url'].toString(),
                  height: 200,
                  width: double.infinity,
                  fit: BoxFit.cover,
                ),
              ),
            const SizedBox(height: TwSpace.p4),
            Text(
              item['content'] ?? item['summary'] ?? item['description'] ?? 'No article content available.',
              style: GoogleFonts.outfit(
                fontSize: 14,
                color: TwSlate.s700,
                height: 1.6,
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatTime(dynamic date) {
    if (date == null) return '';
    final d = date is String ? DateTime.tryParse(date) : date as DateTime?;
    if (d == null) return '';
    final diff = DateTime.now().difference(d);
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return '${diff.inDays}d ago';
  }

  Widget _shimmerFeatured() => Container(
        margin: const EdgeInsets.fromLTRB(TwSpace.p4, 0, TwSpace.p4, TwSpace.p3),
        height: 240,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(TwRadius.xl2),
          border: Border.all(color: TwSlate.s200),
        ),
      );

  Widget _shimmerArticle() => Container(
        margin: const EdgeInsets.fromLTRB(TwSpace.p4, 0, TwSpace.p4, TwSpace.p2_5),
        height: 90,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(TwRadius.xl),
          border: Border.all(color: TwSlate.s200),
        ),
      );

  Widget _buildErrorState() => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline_rounded, color: TwRose.r500, size: 48),
            const SizedBox(height: 12),
            Text(_error ?? 'Error loading news', style: GoogleFonts.outfit(color: TwSlate.s600, fontSize: 13)),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _loadNews,
              style: ElevatedButton.styleFrom(
                backgroundColor: TwBlue.b600,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(TwRadius.xl)),
              ),
              child: const Text('Retry', style: TextStyle(color: Colors.white)),
            ),
          ],
        ),
      );

  Widget _buildEmptyState() => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.article_outlined, color: TwSlate.s300, size: 48),
              const SizedBox(height: 12),
              Text(
                'No news articles found in this category',
                style: GoogleFonts.outfit(color: TwSlate.s500, fontSize: 13),
              ),
            ],
          ),
        ),
      );
}