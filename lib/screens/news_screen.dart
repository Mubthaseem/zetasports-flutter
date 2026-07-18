import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';
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
    setState(() { _loading = true; _error = null; });
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
      if (mounted) setState(() { _loading = false; _error = e.toString(); });
    }
  }

  List<Map<String, dynamic>> get _filtered {
    if (_category == 'Top Stories') return _articles;
    if (_category == 'Latest') return _articles;
    return _articles.where((a) => (a['category'] ?? '').toString().toLowerCase() == _category.toLowerCase()).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bg,
      body: SafeArea(
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
            ] else ...[
              if (_featured != null) SliverToBoxAdapter(child: _buildFeaturedCard()),
              SliverList(
                delegate: SliverChildBuilderDelegate(
                  (_, i) => _buildArticleRow(_filtered[i]),
                  childCount: _filtered.length,
                ),
              ),
            ],
            const SliverToBoxAdapter(child: SizedBox(height: 24)),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
      child: Row(
        children: [
          Text('News', style: GoogleFonts.outfit(
            fontSize: 20, fontWeight: FontWeight.w900, color: AppTheme.text1)),
          const Spacer(),
          Container(
            width: 36, height: 36,
            decoration: BoxDecoration(
              color: AppTheme.surface, borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppTheme.border)),
            child: const Icon(Icons.search_rounded, color: AppTheme.text2, size: 18)),
        ],
      ),
    );
  }

  Widget _buildCategoryChips() {
    return SizedBox(
      height: 38,
      child: ListView.builder(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        scrollDirection: Axis.horizontal,
        itemCount: _categories.length,
        itemBuilder: (_, i) {
          final c = _categories[i];
          final sel = c == _category;
          return GestureDetector(
            onTap: () => setState(() => _category = c),
            child: Container(
              margin: const EdgeInsets.only(right: 8),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: sel ? AppTheme.primary.withOpacity(0.15) : AppTheme.card,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: sel ? AppTheme.primary : AppTheme.border)),
              child: Text(c, style: GoogleFonts.outfit(
                fontSize: 11, fontWeight: FontWeight.w700,
                color: sel ? AppTheme.primary : AppTheme.text2)),
            ),
          );
        },
      ),
    );
  }

  Widget _buildFeaturedCard() {
    final f = _featured!;
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 12),
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(AppTheme.radiusCard),
        border: Border.all(color: AppTheme.border)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: const BorderRadius.only(
              topLeft: Radius.circular(23), topRight: Radius.circular(23)),
            child: Stack(
              children: [
                Image.network(f['thumbnail'] ?? f['image'] ?? 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&auto=format&fit=crop',
                  height: 200, width: double.infinity, fit: BoxFit.cover,
                  color: Colors.black26, colorBlendMode: BlendMode.darken,
                  errorBuilder: (_, __, ___) => Container(height: 200, color: AppTheme.surface)),
                Positioned(top: 12, left: 12, child: _tagBadge(f['tag'] ?? 'NEWS')),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(f['title'] ?? '', style: GoogleFonts.outfit(
                  fontSize: 16, fontWeight: FontWeight.w800, color: AppTheme.text1, height: 1.3)),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Container(
                      width: 20, height: 20,
                      decoration: BoxDecoration(
                        color: AppTheme.primary.withOpacity(0.12),
                        shape: BoxShape.circle),
                      child: const Icon(Icons.person_outline_rounded, color: AppTheme.primary, size: 12)),
                    const SizedBox(width: 6),
                    Text(f['source'] ?? '', style: GoogleFonts.outfit(
                      fontSize: 11, fontWeight: FontWeight.w700, color: AppTheme.text2)),
                    const Spacer(),
                    const Icon(Icons.schedule_outlined, color: AppTheme.text3, size: 13),
                    const SizedBox(width: 4),
                    Text(_formatTime(f['created_at']), style: GoogleFonts.outfit(
                      fontSize: 11, color: AppTheme.text3)),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildArticleRow(Map<String, dynamic> article) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppTheme.border)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _tagBadge(article['tag'] ?? 'NEWS'),
                const SizedBox(height: 6),
                Text(article['title'] ?? '', style: GoogleFonts.outfit(
                  fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.text1, height: 1.4),
                  maxLines: 2, overflow: TextOverflow.ellipsis),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Text(article['source'] ?? '', style: GoogleFonts.outfit(
                      fontSize: 10, fontWeight: FontWeight.w700, color: AppTheme.text3)),
                    const SizedBox(width: 8),
                    Container(width: 3, height: 3,
                      decoration: const BoxDecoration(color: AppTheme.text3, shape: BoxShape.circle)),
                    const SizedBox(width: 8),
                    Text(_formatTime(article['created_at']), style: GoogleFonts.outfit(
                      fontSize: 10, color: AppTheme.text3)),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: Image.network(
              article['thumbnail'] ?? article['image'] ?? 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=200&auto=format&fit=crop',
              width: 76, height: 76, fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => Container(width: 76, height: 76, color: AppTheme.surface)),
          ),
        ],
      ),
    );
  }

  Widget _tagBadge(String tag) {
    Color col;
    switch (tag) {
      case 'BREAKING': col = AppTheme.danger; break;
      case 'TRANSFER': col = AppTheme.warning; break;
      case 'INJURY':   col = const Color(0xFFFF6B35); break;
      default:         col = AppTheme.primary;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: col.withOpacity(0.15),
        borderRadius: BorderRadius.circular(5),
        border: Border.all(color: col.withOpacity(0.3))),
      child: Text(tag, style: GoogleFonts.outfit(
        fontSize: 8, fontWeight: FontWeight.w900, color: col, letterSpacing: 0.5)),
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
    margin: const EdgeInsets.fromLTRB(16, 16, 16, 12),
    decoration: BoxDecoration(color: AppTheme.card, borderRadius: BorderRadius.circular(AppTheme.radiusCard), border: Border.all(color: AppTheme.border)),
    child: Column(children: [
      Container(height: 200, decoration: BoxDecoration(color: AppTheme.surface, borderRadius: const BorderRadius.only(topLeft: Radius.circular(23), topRight: Radius.circular(23)))),
      Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(height: 20, width: 200, color: AppTheme.surface),
        const SizedBox(height: 10),
        Container(height: 14, width: 100, color: AppTheme.surface),
      ])),
    ]));

  Widget _shimmerArticle() => Container(
    margin: const EdgeInsets.fromLTRB(16, 0, 16, 10),
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(color: AppTheme.card, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppTheme.border)),
    child: Row(children: [
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(height: 16, width: 60, color: AppTheme.surface),
        const SizedBox(height: 6),
        Container(height: 14, width: 180, color: AppTheme.surface),
        const SizedBox(height: 8),
        Container(height: 12, width: 100, color: AppTheme.surface),
      ])),
      const SizedBox(width: 12),
      Container(width: 76, height: 76, color: AppTheme.surface),
    ]));

  Widget _buildErrorState() => Center(
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Icon(Icons.error_outline_rounded, color: AppTheme.danger, size: 48),
      const SizedBox(height: 12),
      Text(_error!, style: GoogleFonts.outfit(color: AppTheme.text2, fontSize: 13)),
      const SizedBox(height: 16),
      ElevatedButton(onPressed: _loadNews, child: const Text('Retry')),
    ]));

  Widget _buildEmptyState() => Center(
    child: Padding(padding: const EdgeInsets.all(32), child: Column(mainAxisSize: MainAxisSize.min, children: [
      Icon(Icons.article_rounded, color: AppTheme.text3, size: 48),
      const SizedBox(height: 12),
      Text('No news available', style: GoogleFonts.outfit(color: AppTheme.text2, fontSize: 13)),
    ])));
}