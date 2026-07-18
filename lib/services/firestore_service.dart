import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

// ─────────────────────────────────────────────────────────────────────────────
// SUPABASE SERVICE
// NOTE: Uses `dynamic` query variables to allow chaining .eq()/.ilike() filters
// BEFORE .order()/.limit() — required by supabase_flutter v2 type system.
// ─────────────────────────────────────────────────────────────────────────────
class SupabaseService {
  static final _db = Supabase.instance.client;

  static List<Map<String, dynamic>> _mapMatchRelations(dynamic res) {
    final List<Map<String, dynamic>> list = [];
    for (var row in res as List) {
      final m = Map<String, dynamic>.from(row as Map);
      final home = m['zeta_teams'];
      if (home is Map) {
        m['home_team'] = home['name'];
        m['home_team_logo'] = home['logo'];
        m['home_team_color'] = home['color'];
      }
      final away = m['teams:away'] ?? (m['teams'] is Map ? m['teams']['away'] : null);
      if (away is Map) {
        m['away_team'] = away['name'];
        m['away_team_logo'] = away['logo'];
        m['away_team_color'] = away['color'];
      }
      final lg = m['zeta_leagues'];
      if (lg is Map) {
        m['league_name'] = lg['name'];
        m['league_banner'] = lg['banner'];
      }
      list.add(m);
    }
    return list;
  }

  // ── MATCHES ────────────────────────────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> fetchMatches({
    String? status,
    String? leagueId,
    String? sport,
    String? searchQuery,
    int limit = 100,
    int offset = 0,
  }) async {
    try {
      dynamic q = _db.from('zeta_matches').select('''
        *,
        zeta_teams!home_team_id(*),
        away_team:zeta_teams!away_team_id(*),
        zeta_leagues!league_id(*)
      ''');
      if (status != null) q = q.eq('status', status);
      if (leagueId != null) q = q.eq('league_id', leagueId);
      if (sport != null) q = q.eq('sport', sport);
      if (searchQuery != null && searchQuery.isNotEmpty) {
        q = q.or(
          'venue.ilike.%$searchQuery%,'
          'zeta_teams!home_team_id.name.ilike.%$searchQuery%,'
          'zeta_teams!away_team_id.name.ilike.%$searchQuery%,'
          'zeta_leagues!league_id.name.ilike.%$searchQuery%');
      }
      final res = await q.order('created_at', ascending: true).range(offset, offset + limit - 1);
      return _mapMatchRelations(res);
    } catch (e) {
      debugPrint('fetchMatches: $e');
      return [];
    }
  }

  static Future<Map<String, dynamic>?> fetchMatchById(String id) async {
    try {
      final res = await _db.from('zeta_matches').select('''
        *,
        zeta_teams!home_team_id(*),
        away_team:zeta_teams!away_team_id(*),
        zeta_leagues!league_id(*)
      ''').eq('id', id).maybeSingle();
      if (res == null) return null;
      final m = Map<String, dynamic>.from(res);
      final home = m['zeta_teams'];
      if (home is Map) {
        m['home_team'] = home['name'];
        m['home_team_logo'] = home['logo'];
        m['home_team_color'] = home['color'];
      }
      final away = m['teams:away'] ?? (m['teams'] is Map ? m['teams']['away'] : null);
      if (away is Map) {
        m['away_team'] = away['name'];
        m['away_team_logo'] = away['logo'];
        m['away_team_color'] = away['color'];
      }
      final lg = m['zeta_leagues'];
      if (lg is Map) {
        m['league_name'] = lg['name'];
        m['league_banner'] = lg['banner'];
      }
      return m;
    } catch (e) {
      debugPrint('fetchMatchById: $e');
      return null;
    }
  }

  static RealtimeChannel subscribeToMatchUpdates(
      String matchId, void Function(Map<String, dynamic>) onUpdate) {
    final channel = _db.channel('public:zeta_matches:id=eq.$matchId');
    channel.onPostgresChanges(
      event: PostgresChangeEvent.update,
      schema: 'public',
      table: 'zeta_matches',
      filter: PostgresChangeFilter(
        type: PostgresChangeFilterType.eq,
        column: 'id',
        value: matchId,
      ),
      callback: (payload) {
        onUpdate(Map<String, dynamic>.from(payload.newRecord));
      },
    ).subscribe();
    return channel;
  }
  static Future<void> incrementViewers(String matchId) async {
    try {
      final match = await _db.from('zeta_matches').select('viewers').eq('id', matchId).maybeSingle();
      if (match != null) {
        final current = int.tryParse(match['viewers']?.toString() ?? '') ?? 0;
        await _db.from('zeta_matches').update({'viewers': current + 1}).eq('id', matchId);
      }
    } catch (e) {
      debugPrint('incrementViewers error: $e');
    }
  }

  static Future<void> decrementViewers(String matchId) async {
    try {
      final match = await _db.from('zeta_matches').select('viewers').eq('id', matchId).maybeSingle();
      if (match != null) {
        final current = int.tryParse(match['viewers']?.toString() ?? '') ?? 0;
        final newVal = (current - 1).clamp(0, 9999999);
        await _db.from('zeta_matches').update({'viewers': newVal}).eq('id', matchId);
      }
    } catch (e) {
      debugPrint('decrementViewers error: $e');
    }
  }

  static Future<List<Map<String, dynamic>>> fetchLiveMatches({int limit = 30}) =>
      fetchMatches(status: 'live', limit: limit);

  static Future<List<Map<String, dynamic>>> fetchUpcomingMatches({int limit = 30}) =>
      fetchMatches(status: 'scheduled', limit: limit);

  static Future<List<Map<String, dynamic>>> fetchFinishedMatches({int limit = 30}) =>
      fetchMatches(status: 'finished', limit: limit);

  // ── MATCH DETAILS ──────────────────────────────────────────────────────────
  static Future<Map<String, dynamic>?> fetchLineup(String matchId) async {
    try {
      final res = await _db
          .from('zeta_match_lineups')
          .select()
          .eq('match_id', matchId)
          .maybeSingle();
      return res;
    } catch (e) {
      debugPrint('fetchLineup: $e');
      return null;
    }
  }

  static Future<Map<String, dynamic>?> fetchMatchStats(String matchId) async {
    try {
      final res = await _db
          .from('zeta_match_stats')
          .select()
          .eq('match_id', matchId)
          .maybeSingle();
      return res;
    } catch (e) {
      debugPrint('fetchMatchStats: $e');
      return null;
    }
  }

  static Future<List<Map<String, dynamic>>> fetchCommentary(String matchId) async {
    try {
      final res = await _db
          .from('zeta_match_commentary')
          .select()
          .eq('match_id', matchId)
          .order('time_stamp', ascending: false);
      return List<Map<String, dynamic>>.from(res);
    } catch (e) {
      debugPrint('fetchCommentary: $e');
      return [];
    }
  }

  static Future<List<Map<String, dynamic>>> fetchMatchEvents(String matchId) async {
    try {
      final res = await _db
          .from('zeta_match_events')
          .select()
          .eq('match_id', matchId)
          .order('time_stamp', ascending: true);
      return List<Map<String, dynamic>>.from(res);
    } catch (e) {
      debugPrint('fetchMatchEvents: $e');
      return [];
    }
  }

  // ── STANDINGS ──────────────────────────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> fetchLeagueStandings(String leagueId) async {
    try {
      final res = await _db
          .from('zeta_league_standings')
          .select()
          .eq('league_id', leagueId)
          .order('position', ascending: true);
      return List<Map<String, dynamic>>.from(res);
    } catch (e) {
      debugPrint('fetchLeagueStandings: $e');
      return [];
    }
  }

  // ── LEAGUES ────────────────────────────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> fetchLeagues({
    String? sport,
    String? type,
    bool? featured,
  }) async {
    try {
      dynamic q = _db.from('zeta_leagues').select();
      if (sport != null) q = q.eq('sport', sport);
      if (type != null) q = q.eq('type', type);
      if (featured != null) q = q.eq('featured', featured);
      final res = await q.order('name');
      return List<Map<String, dynamic>>.from(res as List);
    } catch (e) {
      debugPrint('fetchLeagues: $e');
      return [];
    }
  }

  // ── TEAMS ──────────────────────────────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> fetchTeams({
    String? sport,
    int limit = 100,
  }) async {
    try {
      dynamic q = _db.from('zeta_teams').select();
      if (sport != null) q = q.eq('sport', sport);
      final res = await q.order('name').limit(limit);
      return List<Map<String, dynamic>>.from(res as List);
    } catch (e) {
      debugPrint('fetchTeams: $e');
      return [];
    }
  }

  // ── PLAYERS ────────────────────────────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> fetchPlayers({
    String? teamId,
    String? searchQuery,
    int limit = 50,
  }) async {
    try {
      dynamic q = _db.from('zeta_players').select();
      if (teamId != null) q = q.eq('team_id', teamId);
      if (searchQuery != null && searchQuery.isNotEmpty) {
        q = q.ilike('name', '%$searchQuery%');
      }
      final res = await q.order('name').limit(limit);
      return List<Map<String, dynamic>>.from(res as List);
    } catch (e) {
      debugPrint('fetchPlayers: $e');
      return [];
    }
  }

  static Future<Map<String, dynamic>?> fetchPlayerById(String id) async {
    try {
      final res = await _db.from('zeta_players').select().eq('id', id).maybeSingle();
      return res;
    } catch (e) {
      debugPrint('fetchPlayerById: $e');
      return null;
    }
  }

  // ── HIGHLIGHTS ─────────────────────────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> fetchHighlights({
    String? leagueId,
    String? matchId,
    bool? publishedOnly,
    String? badge,
    String? searchQuery,
    bool? isReplay,
    int limit = 30,
  }) async {
    try {
      dynamic q = _db.from('zeta_highlights').select('''
        *,
        matches:zeta_matches(home_team_id, away_team_id, home_team:zeta_teams!home_team_id(name, logo), away_team:zeta_teams!away_team_id(name, logo)),
        leagues:zeta_leagues(name, sport)
      ''');
      if (leagueId != null) q = q.eq('league_id', leagueId);
      if (matchId != null) q = q.eq('match_id', matchId);
      if (publishedOnly == true) q = q.eq('published', true);
      if (badge != null) q = q.eq('badge', badge);
      if (isReplay != null) {
        if (isReplay) {
          q = q.eq('is_replay', true);
        } else {
          q = q.or('is_replay.eq.false,is_replay.is.null');
        }
      }
      if (searchQuery != null && searchQuery.isNotEmpty) {
        q = q.ilike('title', '%$searchQuery%');
      }
      final res = await q.order('created_at', ascending: false).limit(limit);
      final List<Map<String, dynamic>> list = [];
      for (var row in res as List) {
        final h = Map<String, dynamic>.from(row as Map);
        final match = h['matches'];
        if (match is Map) {
          h['match'] = match;
        }
        final league = h['leagues'];
        if (league is Map) {
          h['league'] = league;
          h['league_name'] = league['name'];
        }
        list.add(h);
      }
      return list;
    } catch (e) {
      debugPrint('fetchHighlights: $e');
      return [];
    }
  }

  // ── NEWS ───────────────────────────────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> fetchNews({
    String? category,
    bool? publishedOnly,
    String? searchQuery,
    int limit = 30,
  }) async {
    try {
      dynamic q = _db.from('zeta_news').select();
      if (category != null) q = q.eq('category', category);
      if (publishedOnly == true) q = q.eq('published', true);
      if (searchQuery != null && searchQuery.isNotEmpty) {
        q = q.ilike('title', '%$searchQuery%');
      }
      final res = await q.order('created_at', ascending: false).limit(limit);
      return List<Map<String, dynamic>>.from(res as List);
    } catch (e) {
      debugPrint('fetchNews: $e');
      return [];
    }
  }

  // ── LIVE STREAMS ───────────────────────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> fetchStreams({
    bool? active,
    String? category,
    String? searchQuery,
  }) async {
    try {
      dynamic q = _db.from('zeta_streams').select().neq('deleted', true);
      if (active != null) q = q.eq('active', active);
      if (searchQuery != null && searchQuery.isNotEmpty) {
        q = q.ilike('label', '%$searchQuery%');
      }
      final res = await q.order('created_at', ascending: false);
      return List<Map<String, dynamic>>.from(res as List);
    } catch (e) {
      debugPrint('fetchStreams: $e');
      return [];
    }
  }

  static Future<Map<String, dynamic>?> fetchStreamById(String id) async {
    try {
      final res = await _db.from('zeta_streams').select().eq('id', id).maybeSingle();
      return res != null ? Map<String, dynamic>.from(res) : null;
    } catch (e) {
      debugPrint('fetchStreamById: $e');
      return null;
    }
  }

  // ── NOTIFICATIONS ──────────────────────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> fetchNotifications({
    String? username,
    String? category,
    bool? read,
    int limit = 50,
  }) async {
    try {
      dynamic q = _db.from('zeta_notifications').select();
      if (username != null) q = q.eq('username', username);
      if (category != null) q = q.eq('category', category);
      if (read != null) q = q.eq('read', read);
      final res = await q.order('created_at', ascending: false).limit(limit);
      return List<Map<String, dynamic>>.from(res as List);
    } catch (e) {
      debugPrint('fetchNotifications: $e');
      return [];
    }
  }

  static Future<void> markNotificationRead(String id) async {
    try {
      await _db.from('zeta_notifications').update({'read': true}).eq('id', id);
    } catch (e) {
      debugPrint('markNotificationRead: $e');
    }
  }

  static Future<void> markAllNotificationsRead(String username) async {
    try {
      await _db.from('zeta_notifications').update({'read': true}).eq('username', username);
    } catch (e) {
      debugPrint('markAllNotificationsRead: $e');
    }
  }

  // ── USER PROFILE (AUTH) ───────────────────────────────────────────────────
  static Future<Map<String, dynamic>?> fetchUserProfileAuth() async {
    try {
      final user = _db.auth.currentUser;
      if (user == null) return null;
      final res = await _db
          .from('zeta_user_profiles')
          .select()
          .eq('id', user.id)
          .maybeSingle();
      return res;
    } catch (e) {
      debugPrint('fetchUserProfileAuth: $e');
      return null;
    }
  }

  static Future<void> updateFavTeams(List<String> teamIds) async {
    try {
      final user = _db.auth.currentUser;
      if (user == null) return;
      await _db
          .from('zeta_user_profiles')
          .update({'favorite_teams': teamIds})
          .eq('id', user.id);
    } catch (e) {
      debugPrint('updateFavTeams: $e');
    }
  }

  static Future<void> updateFavLeagues(List<String> leagueIds) async {
    try {
      final user = _db.auth.currentUser;
      if (user == null) return;
      await _db
          .from('zeta_user_profiles')
          .update({'favorite_leagues': leagueIds})
          .eq('id', user.id);
    } catch (e) {
      debugPrint('updateFavLeagues: $e');
    }
  }

  static Future<void> updateFavPlayers(List<String> playerIds) async {
    try {
      final user = _db.auth.currentUser;
      if (user == null) return;
      await _db
          .from('zeta_user_profiles')
          .update({'favorite_players': playerIds})
          .eq('id', user.id);
    } catch (e) {
      debugPrint('updateFavPlayers: $e');
    }
  }

  // ── USER PROFILE ───────────────────────────────────────────────────────────
  static Future<Map<String, dynamic>?> fetchUserProfile(String username) async {
    try {
      final res = await _db
          .from('zeta_users')
          .select()
          .eq('username', username.trim().toLowerCase())
          .maybeSingle();
      return res;
    } catch (e) {
      debugPrint('fetchUserProfile: $e');
      return null;
    }
  }

  static Future<void> updateUserProfile(
      String username, Map<String, dynamic> data) async {
    try {
      await _db
          .from('zeta_users')
          .update(data)
          .eq('username', username.trim().toLowerCase());
    } catch (e) {
      debugPrint('updateUserProfile: $e');
    }
  }

  static Future<void> registerGuestSession(
      String username, String deviceId) async {
    try {
      final normalizedUser = username.trim().toLowerCase();
      final data = await _db
          .from('zeta_users')
          .select('active_devices')
          .eq('username', normalizedUser)
          .maybeSingle();
      final Map<String, dynamic> devices = data != null
          ? Map<String, dynamic>.from(data['active_devices'] ?? {})
          : {};
      devices[deviceId] = DateTime.now().millisecondsSinceEpoch;
      await _db.from('zeta_users').upsert({
        'username': normalizedUser,
        'active_devices': devices,
        'paid': false,
        'passcode': '0000',
      });
    } catch (e) {
      debugPrint('registerGuestSession: $e');
    }
  }

  // ── FAVORITES ──────────────────────────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> fetchFavorites(String username) async {
    try {
      final res = await _db
          .from('zeta_user_favorites')
          .select()
          .eq('username', username.trim().toLowerCase());
      return List<Map<String, dynamic>>.from(res);
    } catch (e) {
      debugPrint('fetchFavorites: $e');
      return [];
    }
  }

  // ── HEAD TO HEAD ───────────────────────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> fetchH2H(
      String team1, String team2, {int limit = 10}) async {
    try {
      final res = await _db
          .from('zeta_matches')
          .select()
          .or('and(home_team.eq.$team1,away_team.eq.$team2),'
              'and(home_team.eq.$team2,away_team.eq.$team1)')
          .eq('status', 'finished')
          .order('created_at', ascending: false)
          .limit(limit);
      return List<Map<String, dynamic>>.from(res);
    } catch (e) {
      debugPrint('fetchH2H: $e');
      return [];
    }
  }

  // ── CONTINUE WATCHING ──────────────────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> fetchContinueWatching(String username) async {
    try {
      final res = await _db
          .from('zeta_user_watch_history')
          .select()
          .eq('username', username.trim().toLowerCase())
          .order('updated_at', ascending: false)
          .limit(10);
      return List<Map<String, dynamic>>.from(res);
    } catch (e) {
      debugPrint('fetchContinueWatching: $e');
      return [];
    }
  }

  // ── TOURNAMENTS ────────────────────────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> fetchFeaturedTournaments({int limit = 8}) async {
    try {
      final res = await _db
          .from('zeta_tournaments')
          .select()
          .eq('featured', true)
          .order('order')
          .limit(limit);
      return List<Map<String, dynamic>>.from(res);
    } catch (e) {
      debugPrint('fetchFeaturedTournaments: $e');
      return [];
    }
  }

  // ── LIVE CHAT ──────────────────────────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> fetchChatMessages(String matchId) async {
    try {
      final res = await _db
          .from('zeta_chat')
          .select()
          .eq('match_id', matchId)
          .order('created_at', ascending: true)
          .limit(100);
      return List<Map<String, dynamic>>.from(res as List);
    } catch (e) {
      debugPrint('fetchChatMessages: $e');
      return [];
    }
  }

  static Future<bool> sendChatMessage(
      String matchId, String username, String message, String color) async {
    try {
      await _db.from('zeta_chat').insert({
        'match_id': matchId,
        'username': username.trim(),
        'message': message.trim(),
        'color': color,
      });
      return true;
    } catch (e) {
      debugPrint('sendChatMessage: $e');
      return false;
    }
  }

  static RealtimeChannel subscribeToChatUpdates(
      String matchId, void Function(Map<String, dynamic>) onInsert) {
    final channel = _db.channel('public:zeta_chat:match_id=eq.$matchId');
    channel.onPostgresChanges(
      event: PostgresChangeEvent.insert,
      schema: 'public',
      table: 'zeta_chat',
      filter: PostgresChangeFilter(
        type: PostgresChangeFilterType.eq,
        column: 'match_id',
        value: matchId,
      ),
      callback: (payload) {
        onInsert(Map<String, dynamic>.from(payload.newRecord));
      },
    ).subscribe();
    return channel;
  }
}