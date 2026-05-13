import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/news_model.dart';
import '../services/firestore_service.dart';
import '../theme/app_theme.dart';

class NewsScreen extends StatelessWidget {
  const NewsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<List<NewsModel>>(
      stream: FirestoreService.newsStream(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return Center(child: CircularProgressIndicator(color: AppTheme.accent));
        }
        final news = snapshot.data ?? [];
        if (news.isEmpty) {
          return Center(child: Text('No news yet', style: TextStyle(color: AppTheme.text3)));
        }
        return ListView.builder(
          padding: const EdgeInsets.symmetric(vertical: 8),
          itemCount: news.length,
          itemBuilder: (_, i) => _NewsCard(article: news[i]),
        );
      },
    );
  }
}

class _NewsCard extends StatelessWidget {
  final NewsModel article;
  const _NewsCard({required this.article});

  void _open(BuildContext context) {
    if (article.isInternal) {
      Navigator.push(context, MaterialPageRoute(
        builder: (_) => _ArticleReader(article: article),
      ));
    } else if (article.articleUrl != null) {
      launchUrl(Uri.parse(article.articleUrl!), mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => _open(context),
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        decoration: BoxDecoration(
          color: AppTheme.card,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppTheme.border),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Thumbnail
            if (article.thumbnailUrl != null)
              CachedNetworkImage(
                imageUrl: article.thumbnailUrl!,
                height: 160,
                width: double.infinity,
                fit: BoxFit.cover,
                errorWidget: (_, __, ___) => _EmojiThumb(emoji: article.emoji),
              )
            else
              _EmojiThumb(emoji: article.emoji),

            Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: AppTheme.accentDim,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(article.category,
                        style: TextStyle(color: AppTheme.accent2, fontSize: 10, fontWeight: FontWeight.w700)),
                    ),
                    if (!article.isInternal) ...[
                      const SizedBox(width: 6),
                      Icon(Icons.open_in_new, size: 12, color: AppTheme.text3),
                    ],
                  ]),
                  const SizedBox(height: 8),
                  Text(article.title,
                    style: TextStyle(color: AppTheme.text1, fontSize: 14,
                      fontWeight: FontWeight.w700, height: 1.5)),
                  if (article.publishedAt != null) ...[
                    const SizedBox(height: 6),
                    Text(
                      _formatDate(article.publishedAt!),
                      style: TextStyle(color: AppTheme.text3, fontSize: 11),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatDate(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return '${diff.inDays}d ago';
  }
}

class _EmojiThumb extends StatelessWidget {
  final String emoji;
  const _EmojiThumb({required this.emoji});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 120,
      width: double.infinity,
      color: AppTheme.bg3,
      child: Center(child: Text(emoji, style: const TextStyle(fontSize: 48))),
    );
  }
}

// ── Article Reader ─────────────────────────────────────────────
class _ArticleReader extends StatelessWidget {
  final NewsModel article;
  const _ArticleReader({required this.article});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bg,
      appBar: AppBar(
        backgroundColor: AppTheme.bg,
        leading: IconButton(
          icon: Icon(Icons.arrow_back_ios, color: AppTheme.accent2),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(article.category,
          style: TextStyle(color: AppTheme.accent, fontSize: 12,
            fontWeight: FontWeight.w700, letterSpacing: 1)),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (article.thumbnailUrl != null)
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: CachedNetworkImage(
                  imageUrl: article.thumbnailUrl!,
                  width: double.infinity,
                  fit: BoxFit.cover,
                ),
              )
            else
              Container(
                height: 160, width: double.infinity,
                decoration: BoxDecoration(
                  color: AppTheme.bg3, borderRadius: BorderRadius.circular(12)),
                child: Center(child: Text(article.emoji, style: const TextStyle(fontSize: 56))),
              ),
            const SizedBox(height: 20),
            Text(article.title,
              style: TextStyle(color: AppTheme.text1, fontSize: 20,
                fontWeight: FontWeight.w800, height: 1.4)),
            const SizedBox(height: 16),
            Divider(color: AppTheme.border),
            const SizedBox(height: 16),
            if (article.content != null)
              Text(article.content!,
                style: TextStyle(color: AppTheme.text1, fontSize: 15, height: 1.9)),
          ],
        ),
      ),
    );
  }
}
