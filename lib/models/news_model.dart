import 'package:cloud_firestore/cloud_firestore.dart';

class NewsModel {
  final String id;
  final String title;
  final String category;
  final String emoji;
  final String? thumbnailUrl;
  final String articleType; // internal | external
  final String? content;
  final String? articleUrl;
  final DateTime? publishedAt;

  NewsModel({
    required this.id,
    required this.title,
    required this.category,
    required this.emoji,
    this.thumbnailUrl,
    required this.articleType,
    this.content,
    this.articleUrl,
    this.publishedAt,
  });

  factory NewsModel.fromFirestore(DocumentSnapshot doc) {
    final d = doc.data() as Map<String, dynamic>;
    return NewsModel(
      id: doc.id,
      title: d['title'] ?? '',
      category: d['category'] ?? 'News',
      emoji: d['emoji'] ?? '⚽',
      thumbnailUrl: d['thumbnailUrl'],
      articleType: d['articleType'] ?? 'external',
      content: d['content'],
      articleUrl: d['articleUrl'],
      publishedAt: (d['publishedAt'] as Timestamp?)?.toDate(),
    );
  }

  bool get isInternal => articleType == 'internal';
}

class LeagueModel {
  final String id;
  final String name;
  final String emoji;
  final String country;
  final String color;
  final String? logo;

  LeagueModel({
    required this.id,
    required this.name,
    required this.emoji,
    required this.country,
    required this.color,
    this.logo,
  });

  factory LeagueModel.fromFirestore(DocumentSnapshot doc) {
    final d = doc.data() as Map<String, dynamic>;
    return LeagueModel(
      id: doc.id,
      name: d['name'] ?? doc.id,
      emoji: d['emoji'] ?? '⚽',
      country: d['country'] ?? '',
      color: d['color'] ?? '#2979ff',
      logo: d['logo'],
    );
  }

  static List<LeagueModel> get defaults => [
    LeagueModel(id:'EPL',        name:'Premier League',    emoji:'⚽', country:'England', color:'#3d195b'),
    LeagueModel(id:'UCL',        name:'Champions League',  emoji:'⭐', country:'Europe',  color:'#1a237e'),
    LeagueModel(id:'LALIGA',     name:'La Liga',           emoji:'🇪🇸', country:'Spain',   color:'#b71c1c'),
    LeagueModel(id:'BUNDESLIGA', name:'Bundesliga',        emoji:'🦅', country:'Germany', color:'#bf360c'),
    LeagueModel(id:'SERIEA',     name:'Serie A',           emoji:'🇮🇹', country:'Italy',   color:'#1b5e20'),
    LeagueModel(id:'ISL',        name:'Indian Super League',emoji:'🇮🇳',country:'India',   color:'#e65100'),
    LeagueModel(id:'LIGUE1',     name:'Ligue 1',           emoji:'🇫🇷', country:'France',  color:'#0d47a1'),
  ];
}
