import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';
import '../services/firestore_service.dart';

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 11 — FAVORITES
// ─────────────────────────────────────────────────────────────────────────────
class FavoritesScreen extends StatefulWidget {
  const FavoritesScreen({super.key});
  @override
  State<FavoritesScreen> createState() => _FavoritesScreenState();
}

class _FavoritesScreenState extends State<FavoritesScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tab;
  bool _isLoading = true;
  String? _error;

  // Master lists loaded from database
  List<Map<String, dynamic>> _allTeams = [];
  List<Map<String, dynamic>> _allLeagues = [];
  List<Map<String, dynamic>> _allPlayers = [];

  // Starred IDs tracking
  final Set<String> _starredTeamIds = {};
  final Set<String> _starredLeagueIds = {};
  final Set<String> _starredPlayerIds = {};

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: 3, vsync: this);
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final results = await Future.wait([
        SupabaseService.fetchTeams(limit: 150),
        SupabaseService.fetchLeagues(),
        SupabaseService.fetchPlayers(limit: 150),
        SupabaseService.fetchUserProfileAuth(),
      ]);

      final teams = List<Map<String, dynamic>>.from(results[0] as List);
      final leagues = List<Map<String, dynamic>>.from(results[1] as List);
      final players = List<Map<String, dynamic>>.from(results[2] as List);
      final profile = results[3] as Map<String, dynamic>?;

      if (profile != null) {
        // Load favorite teams
        final favTeams = profile['favorite_teams'] as List<dynamic>? ?? [];
        _starredTeamIds.addAll(favTeams.map((e) => e.toString()));

        // Load favorite leagues
        final favLeagues = profile['favorite_leagues'] as List<dynamic>? ?? [];
        _starredLeagueIds.addAll(favLeagues.map((e) => e.toString()));

        // Load favorite players
        final favPlayers = profile['favorite_players'] as List<dynamic>? ?? [];
        _starredPlayerIds.addAll(favPlayers.map((e) => e.toString()));
      }

      if (mounted) {
        setState(() {
          _allTeams = teams;
          _allLeagues = leagues;
          _allPlayers = players;
          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint('FavoritesScreen _loadData error: $e');
      if (mounted) {
        setState(() {
          _isLoading = false;
          _error = 'Failed to load configuration. Make sure user profiles table is configured.';
        });
      }
    }
  }

  Future<void> _saveFavorites() async {
    setState(() => _isLoading = true);

    try {
      await Future.wait([
        SupabaseService.updateFavTeams(_starredTeamIds.toList()),
        SupabaseService.updateFavLeagues(_starredLeagueIds.toList()),
        SupabaseService.updateFavPlayers(_starredPlayerIds.toList()),
      ]);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Preferences saved! Feed updated.',
            style: GoogleFonts.outfit(fontWeight: FontWeight.w700)),
          backgroundColor: AppTheme.success,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))));
        
        Navigator.canPop(context) ? Navigator.pop(context) : null;
      }
    } catch (e) {
      debugPrint('FavoritesScreen _saveFavorites error: $e');
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Error saving preferences: $e',
            style: GoogleFonts.outfit(fontWeight: FontWeight.w700)),
          backgroundColor: AppTheme.danger,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))));
      }
    }
  }

  Color _hexColor(String? hex) {
    if (hex == null || hex.isEmpty) return AppTheme.primary;
    try {
      hex = hex.replaceAll('#', '');
      if (hex.length == 6) hex = 'FF$hex';
      return Color(int.parse(hex, radix: 16));
    } catch (_) {
      return AppTheme.primary;
    }
  }

  @override
  void dispose() {
    _tab.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final savedCount = _starredTeamIds.length + _starredLeagueIds.length + _starredPlayerIds.length;

    return Scaffold(
      backgroundColor: AppTheme.bg,
      body: SafeArea(
        child: Column(
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 14),
              child: Row(children: [
                GestureDetector(
                  onTap: () => Navigator.canPop(context) ? Navigator.pop(context) : null,
                  child: Container(
                    width: 36, height: 36,
                    decoration: BoxDecoration(
                      color: AppTheme.surface, borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppTheme.border)),
                    child: const Icon(Icons.arrow_back_ios_new_rounded,
                      color: AppTheme.text2, size: 16))),
                const SizedBox(width: 14),
                Text('Favorites', style: GoogleFonts.outfit(
                  fontSize: 20, fontWeight: FontWeight.w900, color: AppTheme.text1)),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(colors: [AppTheme.primary, AppTheme.secondary]),
                    borderRadius: BorderRadius.circular(20)),
                  child: Text('Saved $savedCount',
                    style: GoogleFonts.outfit(
                      fontSize: 11, fontWeight: FontWeight.w800, color: Colors.black))),
              ]),
            ),

            // Tab bar
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 16),
              height: 40,
              decoration: BoxDecoration(
                color: AppTheme.surface, borderRadius: BorderRadius.circular(20)),
              child: TabBar(
                controller: _tab,
                indicator: BoxDecoration(
                  gradient: const LinearGradient(colors: [AppTheme.primary, AppTheme.secondary]),
                  borderRadius: BorderRadius.circular(20)),
                indicatorSize: TabBarIndicatorSize.tab,
                labelStyle: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w800),
                unselectedLabelStyle: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600),
                labelColor: Colors.black,
                unselectedLabelColor: AppTheme.text2,
                dividerColor: Colors.transparent,
                tabs: const [
                  Tab(text: 'Teams'),
                  Tab(text: 'Leagues'),
                  Tab(text: 'Players'),
                ],
              ),
            ),
            const SizedBox(height: 12),

            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator(color: AppTheme.primary))
                  : _error != null
                      ? _buildErrorState()
                      : TabBarView(
                          controller: _tab,
                          children: [
                            _buildTeamsTab(),
                            _buildLeaguesTab(),
                            _buildPlayersTab(),
                          ],
                        ),
            ),

            // Save button
            if (!_isLoading && _error == null)
              Padding(
                padding: const EdgeInsets.all(16),
                child: GestureDetector(
                  onTap: _saveFavorites,
                  child: Container(
                    height: 50,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(colors: [AppTheme.primary, AppTheme.secondary]),
                      borderRadius: BorderRadius.circular(AppTheme.radiusBtn),
                      boxShadow: [BoxShadow(
                        color: AppTheme.primary.withValues(alpha: 0.3),
                        blurRadius: 20, offset: const Offset(0, 8))]),
                    child: Center(child: Text('SAVE PREFERENCES',
                      style: GoogleFonts.outfit(
                        fontSize: 13, fontWeight: FontWeight.w900, color: Colors.black))),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildErrorState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline_rounded, color: AppTheme.danger, size: 48),
            const SizedBox(height: 16),
            Text(
              _error ?? 'An error occurred',
              style: GoogleFonts.outfit(color: AppTheme.text2, fontSize: 14),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _loadData,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.surface,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: Text('Retry', style: GoogleFonts.outfit(fontWeight: FontWeight.w700)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTeamsTab() {
    if (_allTeams.isEmpty) {
      return _buildEmptyState('No teams configured in the database yet.', Icons.sports_soccer_rounded);
    }

    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      itemCount: _allTeams.length,
      itemBuilder: (_, i) {
        final t = _allTeams[i];
        final id = t['id'].toString();
        final starred = _starredTeamIds.contains(id);
        final col = _hexColor(t['color']?.toString());
        final logoUrl = t['logo']?.toString() ?? '';

        return Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppTheme.card,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: starred ? col.withValues(alpha: 0.3) : AppTheme.border,
              width: starred ? 1.5 : 1)),
          child: Row(children: [
            // Logo / Initial
            Container(
              width: 44, height: 44,
              decoration: BoxDecoration(
                color: col.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: col.withValues(alpha: 0.3))),
              child: logoUrl.isNotEmpty
                  ? ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: Image.network(
                        logoUrl,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Center(child: Text(
                          t['name'].toString().substring(0, 2).toUpperCase(),
                          style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w900, color: col))),
                      ),
                    )
                  : Center(child: Text(
                      t['name'].toString().substring(0, 2).toUpperCase(),
                      style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w900, color: col)))),
            const SizedBox(width: 12),
            Expanded(child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(t['name'].toString(), style: GoogleFonts.outfit(
                  fontSize: 13, fontWeight: FontWeight.w700, color: AppTheme.text1)),
                Text('${t['sport'] ?? 'Football'} • ${t['country'] ?? 'International'}', style: GoogleFonts.outfit(
                  fontSize: 10, color: AppTheme.text3)),
              ],
            )),
            GestureDetector(
              onTap: () {
                setState(() {
                  if (starred) {
                    _starredTeamIds.remove(id);
                  } else {
                    _starredTeamIds.add(id);
                  }
                });
              },
              child: Container(
                width: 36, height: 36,
                decoration: BoxDecoration(
                  color: starred ? AppTheme.warning.withValues(alpha: 0.12) : AppTheme.surface,
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: starred ? AppTheme.warning.withValues(alpha: 0.4) : AppTheme.border)),
                child: Icon(
                  starred ? Icons.star_rounded : Icons.star_outline_rounded,
                  color: starred ? AppTheme.warning : AppTheme.text3, size: 18))),
          ]),
        );
      },
    );
  }

  Widget _buildLeaguesTab() {
    if (_allLeagues.isEmpty) {
      return _buildEmptyState('No leagues configured in the database yet.', Icons.emoji_events_rounded);
    }

    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      itemCount: _allLeagues.length,
      itemBuilder: (_, i) {
        final l = _allLeagues[i];
        final id = l['id'].toString();
        final starred = _starredLeagueIds.contains(id);
        final col = _hexColor(l['color']?.toString());
        final logoUrl = l['logo']?.toString() ?? '';

        return Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppTheme.card,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: starred ? col.withValues(alpha: 0.3) : AppTheme.border,
              width: starred ? 1.5 : 1)),
          child: Row(children: [
            Container(
              width: 44, height: 44,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [col.withValues(alpha: 0.3), col.withValues(alpha: 0.1)]),
                borderRadius: BorderRadius.circular(12)),
              child: logoUrl.isNotEmpty
                  ? ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: Image.network(
                        logoUrl,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => const Icon(Icons.emoji_events_rounded, color: Colors.white, size: 20),
                      ),
                    )
                  : const Icon(Icons.emoji_events_rounded, color: Colors.white, size: 20)),
            const SizedBox(width: 12),
            Expanded(child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(l['name'].toString(), style: GoogleFonts.outfit(
                  fontSize: 13, fontWeight: FontWeight.w700, color: AppTheme.text1)),
                Text('${l['sport'] ?? 'Football'} • ${l['country'] ?? 'International'}', style: GoogleFonts.outfit(
                  fontSize: 10, color: AppTheme.text3)),
              ],
            )),
            GestureDetector(
              onTap: () {
                setState(() {
                  if (starred) {
                    _starredLeagueIds.remove(id);
                  } else {
                    _starredLeagueIds.add(id);
                  }
                });
              },
              child: Container(
                width: 36, height: 36,
                decoration: BoxDecoration(
                  color: starred ? AppTheme.warning.withValues(alpha: 0.12) : AppTheme.surface,
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: starred ? AppTheme.warning.withValues(alpha: 0.4) : AppTheme.border)),
                child: Icon(
                  starred ? Icons.star_rounded : Icons.star_outline_rounded,
                  color: starred ? AppTheme.warning : AppTheme.text3, size: 18))),
          ]),
        );
      },
    );
  }

  Widget _buildPlayersTab() {
    if (_allPlayers.isEmpty) {
      return _buildEmptyState('No players configured in the database yet.', Icons.person_rounded);
    }

    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      itemCount: _allPlayers.length,
      itemBuilder: (_, i) {
        final p = _allPlayers[i];
        final id = p['id'].toString();
        final starred = _starredPlayerIds.contains(id);
        final rating = double.tryParse(p['rating']?.toString() ?? '') ?? 7.0;
        final rCol = rating >= 8.5 ? AppTheme.success : AppTheme.primary;
        final photoUrl = p['photo']?.toString() ?? '';

        return Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppTheme.card,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: starred ? AppTheme.primary.withValues(alpha: 0.3) : AppTheme.border,
              width: starred ? 1.5 : 1)),
          child: Row(children: [
            Container(
              width: 44, height: 44,
              decoration: BoxDecoration(
                color: AppTheme.primary.withValues(alpha: 0.1),
                shape: BoxShape.circle,
                border: Border.all(color: AppTheme.primary.withValues(alpha: 0.3))),
              child: photoUrl.isNotEmpty
                  ? ClipRRect(
                      borderRadius: BorderRadius.circular(22),
                      child: Image.network(
                        photoUrl,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Center(child: Text(
                          (p['nationality'] ?? '🏳️').toString(),
                          style: const TextStyle(fontSize: 20))),
                      ),
                    )
                  : Center(child: Text(
                      (p['nationality'] ?? '🏳️').toString(),
                      style: const TextStyle(fontSize: 20)))),
            const SizedBox(width: 12),
            Expanded(child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(p['name'].toString(), style: GoogleFonts.outfit(
                  fontSize: 13, fontWeight: FontWeight.w700, color: AppTheme.text1)),
                Text('${p['position'] ?? 'Player'} • ${p['nationality'] ?? 'Global'}', style: GoogleFonts.outfit(
                  fontSize: 10, color: AppTheme.text3)),
              ],
            )),
            Container(
              margin: const EdgeInsets.only(right: 8),
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: rCol.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)),
              child: Text(rating.toStringAsFixed(1), style: GoogleFonts.rajdhani(
                fontSize: 14, fontWeight: FontWeight.w900, color: rCol))),
            GestureDetector(
              onTap: () {
                setState(() {
                  if (starred) {
                    _starredPlayerIds.remove(id);
                  } else {
                    _starredPlayerIds.add(id);
                  }
                });
              },
              child: Container(
                width: 36, height: 36,
                decoration: BoxDecoration(
                  color: starred ? AppTheme.warning.withValues(alpha: 0.12) : AppTheme.surface,
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: starred ? AppTheme.warning.withValues(alpha: 0.4) : AppTheme.border)),
                child: Icon(
                  starred ? Icons.star_rounded : Icons.star_outline_rounded,
                  color: starred ? AppTheme.warning : AppTheme.text3, size: 18))),
          ]),
        );
      },
    );
  }

  Widget _buildEmptyState(String msg, IconData icon) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: AppTheme.text3, size: 40),
            const SizedBox(height: 12),
            Text(
              msg,
              style: GoogleFonts.outfit(color: AppTheme.text3, fontSize: 13),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
