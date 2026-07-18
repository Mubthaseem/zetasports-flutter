import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/firestore_service.dart';
import '../theme/app_theme.dart';
import 'player_screen.dart';

class LiveTvScreen extends StatefulWidget {
  const LiveTvScreen({super.key});
  @override
  State<LiveTvScreen> createState() => _LiveTvScreenState();
}

class _LiveTvScreenState extends State<LiveTvScreen> {
  List<Map<String, dynamic>> _streams = [];
  bool _loading = true;
  String _selectedCategory = 'All';
  List<String> _categories = ['All'];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final allStreams = await SupabaseService.fetchStreams(active: true);
    
    // Extract unique categories
    final cats = {'All'};
    for (var s in allStreams) {
      if (s['category'] != null && s['category'].toString().isNotEmpty) {
        cats.add(s['category'].toString().trim());
      }
    }
    
    setState(() {
      _streams = allStreams;
      _categories = cats.toList()..sort();
      _loading = false;
    });
  }

  List<Map<String, dynamic>> get _filteredStreams {
    if (_selectedCategory == 'All') return _streams;
    return _streams.where((s) => s['category'] == _selectedCategory).toList();
  }

  void _openStream(Map<String, dynamic> ch) {
    final url = ch['url']?.toString() ?? '';
    if (url.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Stream URL not configured for ${ch['label'] ?? 'this channel'}')),
      );
      return;
    }
    Navigator.push(context, MaterialPageRoute(
      builder: (_) => PlayerScreen(
        match: {'stream_url': url, 'home_team': ch['label'] ?? 'Channel', 'away_team': '', 'status': 'live'},
        username: 'ZetaUser',
        deviceId: 'device_001',
      )
    ));
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filteredStreams;

    return Scaffold(
      backgroundColor: AppTheme.bg,
      appBar: AppBar(
        backgroundColor: AppTheme.surface,
        elevation: 0,
        title: Text('Live TV', style: GoogleFonts.outfit(
          fontWeight: FontWeight.w800, fontSize: 22, color: Colors.white)),
        centerTitle: false,
      ),
      body: _loading
        ? const Center(child: CircularProgressIndicator(color: AppTheme.primary))
        : Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Filter Chips
              if (_categories.length > 1)
                Container(
                  height: 50,
                  margin: const EdgeInsets.only(top: 8, bottom: 8),
                  child: ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    scrollDirection: Axis.horizontal,
                    itemCount: _categories.length,
                    itemBuilder: (context, index) {
                      final cat = _categories[index];
                      final isSelected = _selectedCategory == cat;
                      return Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: ChoiceChip(
                          label: Text(cat, style: GoogleFonts.outfit(
                            color: isSelected ? Colors.black : Colors.white70,
                            fontWeight: FontWeight.w600,
                          )),
                          selected: isSelected,
                          onSelected: (selected) {
                            if (selected) setState(() => _selectedCategory = cat);
                          },
                          selectedColor: AppTheme.primary,
                          backgroundColor: AppTheme.surface,
                          side: BorderSide(color: isSelected ? AppTheme.primary : AppTheme.border),
                        ),
                      );
                    },
                  ),
                ),
                
              // Grid of Channels
              Expanded(
                child: filtered.isEmpty
                  ? Center(child: Text('No channels found for "$_selectedCategory"', style: GoogleFonts.outfit(color: AppTheme.text3)))
                  : GridView.builder(
                      padding: const EdgeInsets.all(16),
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 2,
                        crossAxisSpacing: 16,
                        mainAxisSpacing: 16,
                        childAspectRatio: 1.2,
                      ),
                      itemCount: filtered.length,
                      itemBuilder: (context, index) {
                        final ch = filtered[index];
                        final thumbnail = ch['thumbnail']?.toString() ?? '';
                        return GestureDetector(
                          onTap: () => _openStream(ch),
                          child: Container(
                            decoration: BoxDecoration(
                              color: AppTheme.surface,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: AppTheme.border),
                              boxShadow: const [
                                BoxShadow(color: Colors.black26, blurRadius: 8, offset: Offset(0, 4))
                              ]
                            ),
                            clipBehavior: Clip.antiAlias,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Expanded(
                                  child: thumbnail.isNotEmpty
                                    ? Image.network(thumbnail, fit: BoxFit.cover,
                                        errorBuilder: (_, __, ___) => const Icon(Icons.live_tv_rounded, color: AppTheme.primary, size: 40))
                                    : const Icon(Icons.live_tv_rounded, color: AppTheme.primary, size: 40),
                                ),
                                Container(
                                  padding: const EdgeInsets.all(12),
                                  color: AppTheme.surface,
                                  child: Text(
                                    ch['label']?.toString() ?? 'Channel',
                                    style: GoogleFonts.outfit(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w700,
                                      fontSize: 14,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
              ),
            ],
          ),
    );
  }
}
