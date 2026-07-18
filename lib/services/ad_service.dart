import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';

// ─────────────────────────────────────────────────────────────────────────────
// AD SERVICE  — centralised AdMob integration
// ─────────────────────────────────────────────────────────────────────────────
class AdService {
  // ── Ad Unit IDs ──────────────────────────────────────────────────────────
  // Android
  static const String _bannerAndroid        = 'ca-app-pub-3548919865618698/6738029276';
  static const String _interstitialAndroid  = 'ca-app-pub-3548919865618698/7640400995';
  static const String _rewardedAndroid      = 'ca-app-pub-3548919865618698/1822731013';
  static const String _nativeAndroid        = 'ca-app-pub-3548919865618698/9686732994';
  static const String _appOpenAndroid       = 'ca-app-pub-3548919865618698/7942406481';

  // iOS
  static const String _banneriOS            = 'ca-app-pub-3548919865618698/6738029276';
  static const String _interstitialiOS      = 'ca-app-pub-3548919865618698/9004206719';
  static const String _rewardediOS          = 'ca-app-pub-3548919865618698/1822731013';
  static const String _nativeiOS            = 'ca-app-pub-3548919865618698/9686732994';

  // ── Resolved IDs based on platform ──────────────────────────────────────
  static String get bannerAdUnitId {
    if (kDebugMode) {
      return Platform.isAndroid
          ? 'ca-app-pub-3940256099942544/6300978111'
          : 'ca-app-pub-3940256099942544/2934735716';
    }
    return Platform.isAndroid ? _bannerAndroid : _banneriOS;
  }

  static String get interstitialAdUnitId {
    if (kDebugMode) {
      return Platform.isAndroid
          ? 'ca-app-pub-3940256099942544/1033173712'
          : 'ca-app-pub-3940256099942544/4411468910';
    }
    return Platform.isAndroid ? _interstitialAndroid : _interstitialiOS;
  }

  static String get rewardedAdUnitId {
    if (kDebugMode) {
      return Platform.isAndroid
          ? 'ca-app-pub-3940256099942544/5224354917'
          : 'ca-app-pub-3940256099942544/1712485313';
    }
    return Platform.isAndroid ? _rewardedAndroid : _rewardediOS;
  }

  static String get nativeAdUnitId {
    if (kDebugMode) {
      return Platform.isAndroid
          ? 'ca-app-pub-3940256099942544/2247696110'
          : 'ca-app-pub-3940256099942544/3986624511';
    }
    return Platform.isAndroid ? _nativeAndroid : _nativeiOS;
  }

  static String get appOpenAdUnitId {
    if (kDebugMode) {
      return 'ca-app-pub-3940256099942544/9257395921';
    }
    return _appOpenAndroid;
  }

  // ── Initialization ────────────────────────────────────────────────────────
  static Future<void> initialize() async {
    await MobileAds.instance.initialize();
  }

  // ── Interstitial Ad ──────────────────────────────────────────────────────
  static InterstitialAd? _interstitial;
  static bool _interstitialLoading = false;

  static Future<void> loadInterstitial() async {
    if (_interstitialLoading) return; // prevent double-load
    _interstitialLoading = true;
    try {
      await InterstitialAd.load(
        adUnitId: interstitialAdUnitId,
        request: const AdRequest(),
        adLoadCallback: InterstitialAdLoadCallback(
          onAdLoaded: (ad) {
            _interstitial = ad;
            _interstitialLoading = false;
            debugPrint('[AdMob] Interstitial loaded ✅');
          },
          onAdFailedToLoad: (err) {
            debugPrint('[AdMob] Interstitial failed: $err — retrying in 30s');
            _interstitial = null;
            _interstitialLoading = false;
            // Auto-retry after 30 seconds
            Future.delayed(const Duration(seconds: 30), loadInterstitial);
          },
        ),
      );
    } catch (e) {
      _interstitialLoading = false;
      debugPrint('[AdMob] loadInterstitial exception: $e');
    }
  }

  /// Shows interstitial if ready, otherwise calls [onDismissed] immediately
  /// so the UX never gets stuck waiting for an ad.
  static void showInterstitial({VoidCallback? onDismissed}) {
    if (_interstitial == null) {
      debugPrint('[AdMob] Interstitial not ready — loading for next time');
      loadInterstitial(); // kick off a fresh load
      onDismissed?.call();
      return;
    }
    _interstitial!.fullScreenContentCallback = FullScreenContentCallback(
      onAdDismissedFullScreenContent: (ad) {
        ad.dispose();
        _interstitial = null;
        loadInterstitial(); // preload next
        onDismissed?.call();
      },
      onAdFailedToShowFullScreenContent: (ad, err) {
        debugPrint('[AdMob] Interstitial failed to show: $err');
        ad.dispose();
        _interstitial = null;
        loadInterstitial();
        onDismissed?.call();
      },
    );
    _interstitial!.show();
  }

  // ── Rewarded Ad ──────────────────────────────────────────────────────────
  static RewardedAd? _rewarded;
  static bool _rewardedLoading = false;

  static Future<void> loadRewarded() async {
    if (_rewardedLoading) return;
    _rewardedLoading = true;
    try {
      await RewardedAd.load(
        adUnitId: rewardedAdUnitId,
        request: const AdRequest(),
        rewardedAdLoadCallback: RewardedAdLoadCallback(
          onAdLoaded: (ad) {
            _rewarded = ad;
            _rewardedLoading = false;
            debugPrint('[AdMob] Rewarded loaded ✅');
          },
          onAdFailedToLoad: (err) {
            debugPrint('[AdMob] Rewarded failed: $err — retrying in 30s');
            _rewarded = null;
            _rewardedLoading = false;
            Future.delayed(const Duration(seconds: 30), loadRewarded);
          },
        ),
      );
    } catch (e) {
      _rewardedLoading = false;
      debugPrint('[AdMob] loadRewarded exception: $e');
    }
  }

  static void showRewarded({
    required void Function(AdWithoutView ad, RewardItem reward) onRewarded,
    VoidCallback? onDismissed,
  }) {
    if (_rewarded == null) {
      debugPrint('[AdMob] Rewarded not ready');
      loadRewarded();
      onDismissed?.call();
      return;
    }
    _rewarded!.fullScreenContentCallback = FullScreenContentCallback(
      onAdDismissedFullScreenContent: (ad) {
        ad.dispose();
        _rewarded = null;
        loadRewarded();
        onDismissed?.call();
      },
      onAdFailedToShowFullScreenContent: (ad, err) {
        debugPrint('[AdMob] Rewarded failed to show: $err');
        ad.dispose();
        _rewarded = null;
        loadRewarded();
        onDismissed?.call();
      },
    );
    _rewarded!.show(onUserEarnedReward: onRewarded);
  }

  static void showAppOpenAd({required VoidCallback onDismissed}) {
    AppOpenAd.load(
      adUnitId: appOpenAdUnitId,
      request: const AdRequest(),
      adLoadCallback: AppOpenAdLoadCallback(
        onAdLoaded: (ad) {
          ad.fullScreenContentCallback = FullScreenContentCallback(
            onAdDismissedFullScreenContent: (ad) {
              ad.dispose();
              onDismissed();
            },
            onAdFailedToShowFullScreenContent: (ad, err) {
              ad.dispose();
              onDismissed();
            },
          );
          ad.show();
        },
        onAdFailedToLoad: (err) {
          debugPrint('[AdMob] AppOpenAd failed to load: $err');
          onDismissed();
        },
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BANNER AD WIDGET — drop-in anywhere in your widget tree
// Usage: const BannerAdWidget()
// ─────────────────────────────────────────────────────────────────────────────
class BannerAdWidget extends StatefulWidget {
  final AdSize size;
  const BannerAdWidget({super.key, this.size = AdSize.banner});

  @override
  State<BannerAdWidget> createState() => _BannerAdWidgetState();
}

class _BannerAdWidgetState extends State<BannerAdWidget> {
  BannerAd? _banner;
  bool _loaded = false;
  int _retryCount = 0;
  static const int _maxRetries = 3;

  @override
  void initState() {
    super.initState();
    _loadBanner();
  }

  void _loadBanner() {
    _banner?.dispose();
    _banner = BannerAd(
      adUnitId: AdService.bannerAdUnitId,
      size: widget.size,
      request: const AdRequest(),
      listener: BannerAdListener(
        onAdLoaded: (_) {
          if (mounted) setState(() => _loaded = true);
          debugPrint('[AdMob] Banner loaded ✅');
        },
        onAdFailedToLoad: (ad, err) {
          debugPrint('[AdMob] Banner failed (attempt ${_retryCount + 1}): $err');
          ad.dispose();
          if (mounted && _retryCount < _maxRetries) {
            _retryCount++;
            // Exponential back-off: 5s, 15s, 45s
            final delay = Duration(seconds: 5 * _retryCount * _retryCount);
            Future.delayed(delay, _loadBanner);
          }
        },
      ),
    )..load();
  }

  @override
  void dispose() {
    _banner?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_loaded || _banner == null) return const SizedBox.shrink();
    return Container(
      alignment: Alignment.center,
      width: _banner!.size.width.toDouble(),
      height: _banner!.size.height.toDouble(),
      child: AdWidget(ad: _banner!),
    );
  }
}
