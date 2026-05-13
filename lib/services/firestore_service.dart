import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/match_model.dart';
import '../models/news_model.dart';

class FirestoreService {
  static final _db = FirebaseFirestore.instance;

  // ── Matches ─────────────────────────────────────────────────
  static Stream<List<MatchModel>> matchesStream() {
    return _db
        .collection('matches')
        .orderBy('kickoffDate', descending: false)
        .snapshots()
        .map((s) => s.docs.map(MatchModel.fromFirestore).toList());
  }

  static Stream<MatchModel?> matchStream(String id) {
    return _db
        .collection('matches')
        .doc(id)
        .snapshots()
        .map((s) => s.exists ? MatchModel.fromFirestore(s) : null);
  }

  // ── News ─────────────────────────────────────────────────────
  static Stream<List<NewsModel>> newsStream() {
    return _db
        .collection('news')
        .orderBy('publishedAt', descending: true)
        .snapshots()
        .map((s) => s.docs.map(NewsModel.fromFirestore).toList());
  }

  // ── Leagues ──────────────────────────────────────────────────
  static Stream<List<LeagueModel>> leaguesStream() {
    return _db
        .collection('leagues')
        .snapshots()
        .map((s) => s.docs.map(LeagueModel.fromFirestore).toList());
  }

  // ── FCM Token ─────────────────────────────────────────────────
  static Future<void> saveToken(String token) async {
    await _db.collection('fcm_tokens').doc(token).set({
      'token': token,
      'platform': 'android',
      'subscribedAt': FieldValue.serverTimestamp(),
    });
  }

  // ── App Config ────────────────────────────────────────────────
  static Stream<Map<String, dynamic>?> configStream() {
    return _db.collection('settings').doc('app_config').snapshots().map((s) => s.data());
  }
}
