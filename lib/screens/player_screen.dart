import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/foundation.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/match_model.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/firestore_service.dart';
import '../theme/app_theme.dart';

class PlayerScreen extends StatefulWidget {
  final ServerModel server;
  final MatchModel match;
  const PlayerScreen({super.key, required this.server, required this.match});

  @override
  State<PlayerScreen> createState() => _PlayerScreenState();
}

class _PlayerScreenState extends State<PlayerScreen> {
  late WebViewController? _webCtrl;
  bool _loading = true;
  bool _fullscreen = false;

  @override
  void initState() {
    super.initState();
    SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);

    if (widget.server.type == 'redirect' || kIsWeb) {
      WidgetsBinding.instance.addPostFrameCallback((_) async {
        final uri = Uri.tryParse(widget.server.url);
        if (uri != null && await canLaunchUrl(uri)) {
          await launchUrl(uri, mode: LaunchMode.externalApplication);
        }
        if (mounted) Navigator.pop(context);
      });
      return;
    }

    _initWebView();
  }

  void _initWebView() {
    final ctrl = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.black)
      ..setNavigationDelegate(NavigationDelegate(
        onPageStarted: (_) => setState(() => _loading = true),
        onPageFinished: (_) => setState(() => _loading = false),
        onWebResourceError: (_) => setState(() => _loading = false),
      ));

    if (widget.server.type == 'm3u8') {
      // HLS player page
      ctrl.loadHtmlString(_buildHlsPage(widget.server.url));
    } else if (widget.server.type == 'iframe') {
      ctrl.loadHtmlString(_buildIframePage(widget.server.url));
    } else if (widget.server.type == 'html') {
      ctrl.loadHtmlString(_buildHtmlPage(widget.server.url));
    }
    _webCtrl = ctrl;
  }

  String _buildHlsPage(String url) => '''
<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
<style>*{margin:0;padding:0}body{background:#000}video{width:100vw;height:100vh;object-fit:contain}</style>
</head><body>
<video id="v" controls autoplay playsinline></video>
<script>
const v=document.getElementById('v');
if(Hls.isSupported()){const h=new Hls({lowLatencyMode:true});h.loadSource('$url');h.attachMedia(v);h.on(Hls.Events.MANIFEST_PARSED,()=>v.play().catch(()=>{}))}
else if(v.canPlayType('application/vnd.apple.mpegurl')){v.src='$url';v.play().catch(()=>{})}
</script></body></html>''';

  String _buildIframePage(String url) => '''
<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{margin:0;padding:0}body{background:#000}iframe{width:100vw;height:100vh;border:none}</style>
</head><body>
<iframe src="$url" allowfullscreen allow="autoplay;encrypted-media"></iframe>
</body></html>''';

  String _buildHtmlPage(String code) => '''
<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#000;display:flex;align-items:center;justify-content:center;height:100vh}
iframe,video,object{max-width:100%;max-height:100%;}</style>
</head><body>$code</body></html>''';

  void _toggleFullscreen() {
    setState(() => _fullscreen = !_fullscreen);
    SystemChrome.setPreferredOrientations(
      _fullscreen
          ? [DeviceOrientation.landscapeLeft, DeviceOrientation.landscapeRight]
          : [DeviceOrientation.portraitUp],
    );
  }

  Future<void> _launchUrl(String url) async {
    final uri = Uri.tryParse(url);
    if (uri != null && await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  void dispose() {
    SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final m = widget.match;

    if (widget.server.type == 'redirect' || kIsWeb) {
      return Scaffold(
        backgroundColor: AppTheme.bg,
        body: Center(child: CircularProgressIndicator(color: AppTheme.accent)),
      );
    }

    return Scaffold(
      backgroundColor: AppTheme.bg,
      body: Column(
        children: [
          // Top bar
          SafeArea(
            bottom: false,
            child: Container(
              color: AppTheme.bg,
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
              child: Row(children: [
                IconButton(
                  icon: Icon(Icons.arrow_back_ios, color: AppTheme.accent2, size: 20),
                  onPressed: () => Navigator.pop(context),
                ),
                Expanded(child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(widget.server.label,
                      style: TextStyle(color: AppTheme.text1, fontSize: 14, fontWeight: FontWeight.w700)),
                    Text('${m.homeTeam} vs ${m.awayTeam}',
                      style: TextStyle(color: AppTheme.text3, fontSize: 11)),
                  ],
                )),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppTheme.accentDim,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: AppTheme.border2),
                  ),
                  child: Text(widget.server.type.toUpperCase(),
                    style: TextStyle(color: AppTheme.accent2, fontSize: 9, fontWeight: FontWeight.w800, letterSpacing: 1)),
                ),
                IconButton(
                  icon: Icon(_fullscreen ? Icons.fullscreen_exit : Icons.fullscreen,
                    color: AppTheme.text2),
                  onPressed: _toggleFullscreen,
                ),
              ]),
            ),
          ),

          // 16:9 video player
          AspectRatio(
            aspectRatio: 16 / 9,
            child: Stack(children: [
              if (_webCtrl != null) WebViewWidget(controller: _webCtrl!),
              if (_loading)
                Container(
                  color: Colors.black,
                  child: Center(child: CircularProgressIndicator(color: AppTheme.accent)),
                ),
            ]),
          ),

          // Scrollable match info below (YouTube style)
          Expanded(
            child: SingleChildScrollView(
              child: Column(children: [
                // Score section
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  color: AppTheme.bg2,
                  child: Column(children: [
                    Text(m.statusDisplay,
                      style: TextStyle(
                        color: m.isLive ? AppTheme.red : AppTheme.text3,
                        fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 1,
                      )),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      children: [
                        Expanded(child: Text(m.homeTeam, textAlign: TextAlign.center,
                          style: TextStyle(color: AppTheme.text1, fontSize: 13, fontWeight: FontWeight.w700))),
                        Text(m.scoreDisplay,
                          style: TextStyle(color: AppTheme.text1, fontSize: 32,
                            fontWeight: FontWeight.w800, letterSpacing: 4)),
                        Expanded(child: Text(m.awayTeam, textAlign: TextAlign.center,
                          style: TextStyle(color: AppTheme.text1, fontSize: 13, fontWeight: FontWeight.w700))),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text('${m.leagueName.isEmpty ? m.leagueId : m.leagueName}',
                      style: TextStyle(color: AppTheme.text3, fontSize: 11)),
                  ]),
                ),

                // Community Hub
                StreamBuilder<Map<String, dynamic>?>(
                  stream: FirestoreService.configStream(),
                  builder: (context, snap) {
                    final config = snap.data;
                    final wa = config?['whatsappUrl'] as String?;
                    final tg = config?['telegramUrl'] as String?;
                    if ((wa == null || wa.isEmpty) && (tg == null || tg.isEmpty)) {
                      return const SizedBox.shrink();
                    }
                    return Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      decoration: BoxDecoration(
                        border: Border(bottom: BorderSide(color: AppTheme.border)),
                      ),
                      child: Row(
                        children: [
                          if (wa != null && wa.isNotEmpty)
                            Expanded(
                              child: _SmallSocialButton(
                                label: 'WHATSAPP',
                                color: const Color(0xFF25D366),
                                icon: Icons.chat,
                                onTap: () => _launchUrl(wa),
                              ),
                            ),
                          if (wa != null && wa.isNotEmpty && tg != null && tg.isNotEmpty)
                            const SizedBox(width: 10),
                          if (tg != null && tg.isNotEmpty)
                            Expanded(
                              child: _SmallSocialButton(
                                label: 'TELEGRAM',
                                color: const Color(0xFF0088CC),
                                icon: Icons.send,
                                onTap: () => _launchUrl(tg),
                              ),
                            ),
                        ],
                      ),
                    );
                  },
                ),

                // Other servers (switcher)
                if (m.servers.length > 1) ...[
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 6),
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: Text('📡 Switch Stream',
                        style: TextStyle(fontSize: 11, color: AppTheme.text3, fontWeight: FontWeight.w700, letterSpacing: .5)),
                    ),
                  ),
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Row(
                      children: m.servers.where((s) => s.type != 'redirect').map((s) {
                        final active = s.url == widget.server.url;
                        return GestureDetector(
                          onTap: active ? null : () {
                            Navigator.pushReplacement(context, MaterialPageRoute(
                              builder: (_) => PlayerScreen(server: s, match: m),
                            ));
                          },
                          child: Container(
                            margin: const EdgeInsets.only(right: 8, bottom: 8),
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            decoration: BoxDecoration(
                              color: active ? AppTheme.accentDim : AppTheme.card,
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: active ? AppTheme.accent : AppTheme.border),
                            ),
                            child: Text(s.label,
                              style: TextStyle(
                                color: active ? AppTheme.accent2 : AppTheme.text2,
                                fontSize: 12, fontWeight: FontWeight.w600,
                              )),
                          ),
                        );
                      }).toList(),
                    ),
                  ),
                ],

                // Match info
                Container(
                  margin: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppTheme.card, borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppTheme.border),
                  ),
                  child: Column(children: [
                    _Row('Date', m.kickoffDate.isEmpty ? '—' : m.kickoffDate),
                    _Row('Kick-off IST', m.kickoffIST.isEmpty ? 'TBD' : m.kickoffIST),
                    _Row('Status', m.status.toUpperCase(), isLast: true),
                  ]),
                ),
              ]),
            ),
          ),
        ],
      ),
    );
  }
}

class _SmallSocialButton extends StatelessWidget {
  final String label;
  final Color color;
  final IconData icon;
  final VoidCallback onTap;

  const _SmallSocialButton({
    required this.label,
    required this.color,
    required this.icon,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(30),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          borderRadius: BorderRadius.circular(30),
          border: Border.all(color: color.withOpacity(0.3)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: color, size: 14),
            const SizedBox(width: 6),
            Text(label, 
              style: GoogleFonts.rajdhani(fontSize: 11, fontWeight: FontWeight.w800, color: color, letterSpacing: 0.5)),
          ],
        ),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  final String label;
  final String value;
  final bool isLast;
  const _Row(this.label, this.value, {this.isLast = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: isLast ? null : BoxDecoration(
        border: Border(bottom: BorderSide(color: AppTheme.border)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: AppTheme.text3, fontSize: 12)),
          Text(value, style: TextStyle(color: AppTheme.text1, fontSize: 13, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
