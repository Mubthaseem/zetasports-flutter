import 'package:flutter/material.dart';
import '../models/match_model.dart';
import '../services/firestore_service.dart';
import '../theme/app_theme.dart';
import '../widgets/match_card.dart';
import '../services/ad_service.dart';

class MatchesScreen extends StatefulWidget {
  const MatchesScreen({super.key});

  @override
  State<MatchesScreen> createState() => _MatchesScreenState();
}

class _MatchesScreenState extends State<MatchesScreen> {
  String _filter = 'all';

  final _filters = [
    {'id': 'all',      'label': 'All'},
    {'id': 'live',     'label': '🔴 Live'},
    {'id': 'upcoming', 'label': '⏰ Upcoming'},
    {'id': 'finished', 'label': '✅ Finished'},
  ];

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<List<MatchModel>>(
      stream: FirestoreService.matchesStream(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return Center(child: CircularProgressIndicator(color: AppTheme.accent));
        }
        final all = snapshot.data ?? [];
        final filtered = _filter == 'all'
            ? all
            : all.where((m) {
                if (_filter == 'live') return m.isLive;
                if (_filter == 'upcoming') return m.isUpcoming;
                if (_filter == 'finished') return m.isFinished;
                return true;
              }).toList();

        return Column(
          children: [
            // Filter chips
            Container(
              color: AppTheme.bg,
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 0),
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: _filters.map((f) {
                    final active = _filter == f['id'];
                    return GestureDetector(
                      onTap: () => setState(() => _filter = f['id']!),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        margin: const EdgeInsets.only(right: 8),
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        decoration: BoxDecoration(
                          color: active ? AppTheme.accentDim : AppTheme.card,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: active ? AppTheme.accent : AppTheme.border,
                          ),
                        ),
                        child: Text(
                          f['label']!,
                          style: TextStyle(
                            fontSize: 13, fontWeight: FontWeight.w600,
                            color: active ? AppTheme.accent2 : AppTheme.text2,
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ),
            ),
            // List
            Expanded(
              child: filtered.isEmpty
                  ? Center(
                      child: Text('No matches found',
                          style: TextStyle(color: AppTheme.text3)))
                    : ListView.builder(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        itemCount: filtered.length + (filtered.length / 4).floor(),
                        itemBuilder: (_, i) {
                          if (i > 0 && i % 4 == 0) {
                            return AdService.getNativeAdWidget();
                          }
                          // Adjust index to skip ads when fetching from 'filtered' list
                          final matchIndex = i - (i / 4).floor();
                          return MatchCard(match: filtered[matchIndex]);
                        },
                      ),
            ),
          ],
        );
      },
    );
  }
}
