import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../models/match_model.dart';
import '../models/news_model.dart';
import '../services/firestore_service.dart';
import '../theme/app_theme.dart';
import '../widgets/match_card.dart';

class LeaguesScreen extends StatelessWidget {
  const LeaguesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final defaultLeagues = LeagueModel.defaults;
    return StreamBuilder<List<LeagueModel>>(
      stream: FirestoreService.leaguesStream(),
      builder: (context, snap) {
        final leagues = snap.data?.isNotEmpty == true ? snap.data! : defaultLeagues;
        return StreamBuilder<List<MatchModel>>(
          stream: FirestoreService.matchesStream(),
          builder: (context, mSnap) {
            final matches = mSnap.data ?? [];
            return ListView.builder(
              padding: const EdgeInsets.symmetric(vertical: 8),
              itemCount: leagues.length,
              itemBuilder: (_, i) {
                final l = leagues[i];
                final lMatches = matches.where((m) => m.leagueId == l.id).toList();
                return _LeagueTile(league: l, matches: lMatches);
              },
            );
          },
        );
      },
    );
  }
}

class _LeagueTile extends StatefulWidget {
  final LeagueModel league;
  final List<MatchModel> matches;
  const _LeagueTile({required this.league, required this.matches});

  @override
  State<_LeagueTile> createState() => _LeagueTileState();
}

class _LeagueTileState extends State<_LeagueTile> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 5),
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppTheme.border),
      ),
      child: Column(
        children: [
          InkWell(
            borderRadius: BorderRadius.circular(14),
            onTap: () => setState(() => _expanded = !_expanded),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: widget.league.logo != null && widget.league.logo!.isNotEmpty
                      ? CachedNetworkImage(
                          imageUrl: widget.league.logo!,
                          width: 40, height: 40,
                          fit: BoxFit.contain,
                        )
                      : Container(
                          width: 40, height: 40,
                          color: AppTheme.accent.withOpacity(0.1),
                          child: Icon(Icons.emoji_events, color: AppTheme.accent2, size: 24),
                        ),
                ),
                const SizedBox(width: 14),
                Expanded(child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(widget.league.name,
                      style: TextStyle(color: AppTheme.text1, fontSize: 15, fontWeight: FontWeight.w700)),
                    Text(widget.league.country,
                      style: TextStyle(color: AppTheme.text3, fontSize: 12)),
                  ],
                )),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppTheme.accentDim,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text('${widget.matches.length}',
                    style: TextStyle(color: AppTheme.accent2, fontSize: 12, fontWeight: FontWeight.w700)),
                ),
                const SizedBox(width: 8),
                Icon(
                  _expanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                  color: AppTheme.text3,
                ),
              ]),
            ),
          ),
          if (_expanded && widget.matches.isNotEmpty)
            Column(
              children: [
                Divider(height: 1, color: AppTheme.border),
                ...widget.matches.map((m) => MatchCard(match: m, compact: true)),
              ],
            ),
          if (_expanded && widget.matches.isEmpty)
            Padding(
              padding: EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: Text('No matches for this league',
                style: TextStyle(color: AppTheme.text3, fontSize: 12)),
            ),
        ],
      ),
    );
  }
}
