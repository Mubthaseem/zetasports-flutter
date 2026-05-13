import 'package:cloud_firestore/cloud_firestore.dart';

class MatchModel {
  final String id;
  final String homeTeam;
  final String awayTeam;
  final String home;   // 3-letter code
  final String away;
  final String? homeLogo;
  final String? awayLogo;
  final String leagueId;
  final String leagueName;
  final String status; // upcoming | live | ht | finished
  final String kickoffDate;
  final String kickoffIST;
  final int? homeScore;
  final int? awayScore;
  final String? minute;
  final bool featured;
  final List<ServerModel> servers;
  final String? preview;

  MatchModel({
    required this.id,
    required this.homeTeam,
    required this.awayTeam,
    required this.home,
    required this.away,
    this.homeLogo,
    this.awayLogo,
    required this.leagueId,
    required this.leagueName,
    required this.status,
    required this.kickoffDate,
    required this.kickoffIST,
    this.homeScore,
    this.awayScore,
    this.minute,
    required this.featured,
    required this.servers,
    this.preview,
  });

  factory MatchModel.fromFirestore(DocumentSnapshot doc) {
    final d = doc.data() as Map<String, dynamic>;
    return MatchModel(
      id: doc.id,
      homeTeam: d['homeTeam'] ?? d['home'] ?? '',
      awayTeam: d['awayTeam'] ?? d['away'] ?? '',
      home: d['home'] ?? '',
      away: d['away'] ?? '',
      homeLogo: d['homeLogo'],
      awayLogo: d['awayLogo'],
      leagueId: d['leagueId'] ?? '',
      leagueName: d['leagueName'] ?? d['leagueId'] ?? '',
      status: d['status'] ?? 'upcoming',
      kickoffDate: d['kickoffDate'] ?? '',
      kickoffIST: d['kickoffIST'] ?? '',
      homeScore: d['homeScore'],
      awayScore: d['awayScore'],
      minute: d['minute'],
      featured: d['featured'] ?? false,
      servers: (d['servers'] as List<dynamic>? ?? [])
          .map((s) => ServerModel.fromMap(s as Map<String, dynamic>))
          .where((s) => s.enabled)
          .toList(),
      preview: d['preview'],
    );
  }

  bool get isLive => status == 'live' || status == 'ht';
  bool get isUpcoming => status == 'upcoming';
  bool get isFinished => status == 'finished';

  String get scoreDisplay {
    if (status == 'upcoming') return 'vs';
    return '${homeScore ?? 0} : ${awayScore ?? 0}';
  }

  String get kickoffTime12 {
    if (kickoffIST.isEmpty) return '';
    try {
      final parts = kickoffIST.split(':');
      if (parts.length < 2) return kickoffIST;
      int h = int.parse(parts[0]);
      final m = parts[1];
      final ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12;
      if (h == 0) h = 12;
      return '$h:$m $ampm';
    } catch (_) {
      return kickoffIST;
    }
  }

  String get localTime12 {
    final dt = kickoffDateTime;
    if (dt == null) return kickoffTime12;
    final localDt = dt.toLocal();
    int h = localDt.hour;
    final m = localDt.minute.toString().padLeft(2, '0');
    final ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h == 0) h = 12;
    return '$h:$m $ampm';
  }

  String get statusDisplay {
    switch (status) {
      case 'live': return '🔴 LIVE · ${minute ?? ''}';
      case 'ht': return '⏸ HALF TIME';
      case 'finished': return '⏹ FULL TIME';
      default: return '⏰ $localTime12';
    }
  }

  DateTime? get kickoffDateTime {
    if (kickoffDate.isEmpty || kickoffIST.isEmpty) return null;
    try {
      return DateTime.parse('${kickoffDate}T$kickoffIST:00+05:30');
    } catch (_) {
      return null;
    }
  }
}

class ServerModel {
  final String label;
  final String type; // redirect | m3u8 | iframe | html
  final String url;
  final bool enabled;

  ServerModel({
    required this.label,
    required this.type,
    required this.url,
    required this.enabled,
  });

  factory ServerModel.fromMap(Map<String, dynamic> m) {
    return ServerModel(
      label: m['label'] ?? 'Server',
      type: m['type'] ?? 'redirect',
      url: m['url'] ?? '',
      enabled: m['enabled'] != false,
    );
  }
}
