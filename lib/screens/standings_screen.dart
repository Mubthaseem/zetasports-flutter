import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../theme/app_theme.dart';

class StandingsScreen extends StatefulWidget {
  const StandingsScreen({super.key});

  @override
  State<StandingsScreen> createState() => _StandingsScreenState();
}

class _StandingsScreenState extends State<StandingsScreen> {
  bool _isLoading = true;
  Map<String, dynamic> _standingsData = {};
  String _selectedLeague = 'PL'; // Default to Premier League

  final Map<String, String> _leagueCodes = {
    'PL': 'Premier League',
    'PD': 'La Liga',
    'SA': 'Serie A',
    'BL1': 'Bundesliga',
    'FL1': 'Ligue 1',
  };

  @override
  void initState() {
    super.initState();
    _listenToStandings();
  }

  void _listenToStandings() {
    FirebaseFirestore.instance.collection('standings').snapshots().listen((snap) {
      final Map<String, dynamic> newData = {};
      for (var doc in snap.docs) {
        newData[doc.id] = doc.data();
      }
      if (mounted) {
        setState(() {
          _standingsData = newData;
          _isLoading = false;
        });
      }
    });
  }

  Future<void> _fetchStandings() async {
    // This is now handled by the listener, but we keep it for RefreshIndicator compatibility
    setState(() => _isLoading = true);
    await Future.delayed(const Duration(milliseconds: 500));
    setState(() => _isLoading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bg,
      appBar: AppBar(
        title: const Text('League Tables'),
        backgroundColor: AppTheme.bg,
      ),
      body: Column(
        children: [
          // League Selector
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: _leagueCodes.entries.map((e) => Padding(
                padding: const EdgeInsets.only(right: 8),
                child: ChoiceChip(
                  label: Text(e.value, style: TextStyle(
                    color: _selectedLeague == e.key ? AppTheme.bg : AppTheme.text2,
                    fontWeight: FontWeight.w700,
                  )),
                  selected: _selectedLeague == e.key,
                  selectedColor: AppTheme.accent,
                  backgroundColor: AppTheme.card,
                  onSelected: (val) => setState(() => _selectedLeague = e.key),
                ),
              )).toList(),
            ),
          ),

          // Table Header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            color: AppTheme.card,
            child: Row(
              children: [
                SizedBox(width: 24, child: Text('#', style: TextStyle(color: AppTheme.text3, fontSize: 12, fontWeight: FontWeight.bold))),
                Expanded(child: Text('CLUB', style: TextStyle(color: AppTheme.text3, fontSize: 12, fontWeight: FontWeight.bold))),
                _colText('P'),
                _colText('W'),
                _colText('D'),
                _colText('L'),
                _colText('GD'),
                _colText('PTS', color: AppTheme.accent2),
              ],
            ),
          ),

          // Table Body
          Expanded(
            child: _isLoading 
                ? const Center(child: CircularProgressIndicator())
                : _standingsData.isEmpty || !_standingsData.containsKey(_selectedLeague)
                    ? Center(child: Text('Table data not available yet.\nPlease set up fetch_standings.php', textAlign: TextAlign.center, style: TextStyle(color: AppTheme.text3)))
                    : RefreshIndicator(
                        onRefresh: _fetchStandings,
                        child: ListView.separated(
                          itemCount: _standingsData[_selectedLeague]['table'].length,
                          separatorBuilder: (context, index) => Divider(height: 1, color: AppTheme.border),
                          itemBuilder: (context, index) {
                            final row = _standingsData[_selectedLeague]['table'][index];
                            return Container(
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                              child: Row(
                                children: [
                                  SizedBox(
                                    width: 24, 
                                    child: Text('${row['position']}', style: TextStyle(
                                      color: index < 4 ? AppTheme.liveGreen : AppTheme.text2, 
                                      fontWeight: FontWeight.bold
                                    ))
                                  ),
                                  Expanded(
                                    child: Row(
                                      children: [
                                        CachedNetworkImage(
                                          imageUrl: row['crest'] ?? '',
                                          width: 20, height: 20,
                                          errorWidget: (c,u,e) => Icon(Icons.shield, size: 20, color: AppTheme.text3),
                                        ),
                                        const SizedBox(width: 8),
                                        Expanded(
                                          child: Text(row['teamName'] ?? '', 
                                            style: TextStyle(color: AppTheme.text1, fontWeight: FontWeight.w600),
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ),
                                      ],
                                    )
                                  ),
                                  _colText('${row['played']}', color: AppTheme.text1),
                                  _colText('${row['won']}', color: AppTheme.text2),
                                  _colText('${row['drawn']}', color: AppTheme.text3),
                                  _colText('${row['lost']}', color: AppTheme.red),
                                  _colText('${row['goalDifference']}', color: AppTheme.text2),
                                  _colText('${row['points']}', color: AppTheme.accent, isBold: true),
                                ],
                              ),
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _colText(String text, {Color? color, bool isBold = false}) {
    color ??= AppTheme.text3;
    return SizedBox(
      width: 28,
      child: Text(
        text, 
        textAlign: TextAlign.center,
        style: TextStyle(
          color: color, 
          fontSize: 12, 
          fontWeight: isBold ? FontWeight.bold : FontWeight.w600
        )
      ),
    );
  }
}
