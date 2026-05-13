import 'package:flutter/material.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';
import 'package:app_tracking_transparency/app_tracking_transparency.dart';
import 'dart:io';
import 'firestore_service.dart';

class AdService {
  static AppOpenAd? _appOpenAd;
  static bool _isAppOpenAdLoading = false;
  static DateTime? _appOpenLoadTime;

  static bool _isAdEnabled = false;

  static void init() {
    // Request tracking permission for iOS
    requestTrackingPermission().then((_) {
      FirestoreService.configStream().listen((config) {
        if (config != null) {
          _isAdEnabled = config['adsEnabled'] ?? false;
          if (_isAdEnabled) {
            loadAppOpenAd();
          }
        }
      });
    });
  }

  static Future<void> requestTrackingPermission() async {
    if (Platform.isIOS) {
      final status = await AppTrackingTransparency.trackingAuthorizationStatus;
      if (status == TrackingStatus.notDetermined) {
        // Wait a bit for the UI to be ready
        await Future.delayed(const Duration(milliseconds: 1000));
        await AppTrackingTransparency.requestTrackingAuthorization();
      }
    }
  }

  // --- APP OPEN AD ---
  static void loadAppOpenAd() async {
    if (!_isAdEnabled || _isAppOpenAdLoading) return;

    final config = await FirestoreService.configStream().first;
    final adUnitId = config?['admobAppOpenId'] ?? 'ca-app-pub-3940256099942544/9257395921';

    _isAppOpenAdLoading = true;
    AppOpenAd.load(
      adUnitId: adUnitId,
      request: const AdRequest(),
      adLoadCallback: AppOpenAdLoadCallback(
        onAdLoaded: (ad) {
          _appOpenLoadTime = DateTime.now();
          _appOpenAd = ad;
          _isAppOpenAdLoading = false;
        },
        onAdFailedToLoad: (error) {
          _isAppOpenAdLoading = false;
        },
      ),
    );
  }

  static void showAppOpenAdIfAvailable() {
    if (!_isAdEnabled || _appOpenAd == null) return;
    
    // Check if ad is expired (4 hours)
    if (_appOpenLoadTime != null && 
        DateTime.now().difference(_appOpenLoadTime!).inHours >= 4) {
      _appOpenAd!.dispose();
      _appOpenAd = null;
      loadAppOpenAd();
      return;
    }

    _appOpenAd!.fullScreenContentCallback = FullScreenContentCallback(
      onAdDismissedFullScreenContent: (ad) {
        _appOpenAd = null;
        loadAppOpenAd();
      },
    );
    _appOpenAd!.show();
  }

  // --- BANNER AD ---
  static Widget getBannerWidget(BuildContext context) {
    if (!_isAdEnabled) return const SizedBox.shrink();

    return StreamBuilder<Map<String, dynamic>?>(
      stream: FirestoreService.configStream(),
      builder: (context, snapshot) {
        final config = snapshot.data;
        if (config == null || !(config['adsEnabled'] ?? false)) return const SizedBox.shrink();

        final adUnitId = config['admobBannerId'] ?? 'ca-app-pub-3940256099942544/6300978111';
        return BannerAdWidget(adUnitId: adUnitId);
      },
    );
  }

  // --- INTERSTITIAL AD ---
  static Future<void> showInterstitial(BuildContext context, VoidCallback onComplete) async {
    if (!_isAdEnabled) {
      onComplete();
      return;
    }

    final config = await FirestoreService.configStream().first;
    final adUnitId = config?['admobInterstitialId'] ?? 'ca-app-pub-3940256099942544/1033173712';

    InterstitialAd.load(
      adUnitId: adUnitId,
      request: const AdRequest(),
      adLoadCallback: InterstitialAdLoadCallback(
        onAdLoaded: (ad) {
          ad.fullScreenContentCallback = FullScreenContentCallback(
            onAdDismissedFullScreenContent: (ad) {
              ad.dispose();
              onComplete();
            },
            onAdFailedToShowFullScreenContent: (ad, error) {
              ad.dispose();
              onComplete();
            },
          );
          ad.show();
        },
        onAdFailedToLoad: (err) {
          onComplete();
        },
      ),
    );
  }

  // --- REWARDED AD ---
  static Future<void> showRewardedAd(BuildContext context, {required Function onRewardEarned, required VoidCallback onClosed}) async {
    if (!_isAdEnabled) {
      onRewardEarned();
      return;
    }

    final config = await FirestoreService.configStream().first;
    final adUnitId = config?['admobRewardedId'] ?? 'ca-app-pub-3940256099942544/5224354917';

    RewardedAd.load(
      adUnitId: adUnitId,
      request: const AdRequest(),
      rewardedAdLoadCallback: RewardedAdLoadCallback(
        onAdLoaded: (ad) {
          ad.fullScreenContentCallback = FullScreenContentCallback(
            onAdDismissedFullScreenContent: (ad) {
              ad.dispose();
              onClosed();
            },
            onAdFailedToShowFullScreenContent: (ad, err) {
              ad.dispose();
              onClosed();
            },
          );
          ad.show(onUserEarnedReward: (ad, reward) => onRewardEarned());
        },
        onAdFailedToLoad: (err) {
          onClosed();
        },
      ),
    );
  }

  // --- NATIVE AD WIDGET ---
  static Widget getNativeAdWidget() {
    if (!_isAdEnabled) return const SizedBox.shrink();
    return StreamBuilder<Map<String, dynamic>?>(
      stream: FirestoreService.configStream(),
      builder: (context, snapshot) {
        final config = snapshot.data;
        if (config == null || !(config['adsEnabled'] ?? false)) return const SizedBox.shrink();
        final adUnitId = config['admobNativeId'] ?? 'ca-app-pub-3940256099942544/2247696110';
        return NativeAdItem(adUnitId: adUnitId);
      },
    );
  }
}

class BannerAdWidget extends StatefulWidget {
  final String adUnitId;
  const BannerAdWidget({super.key, required this.adUnitId});
  @override
  State<BannerAdWidget> createState() => _BannerAdWidgetState();
}

class _BannerAdWidgetState extends State<BannerAdWidget> {
  BannerAd? _bannerAd;
  bool _isLoaded = false;

  @override
  void initState() {
    super.initState();
    _loadAd();
  }

  void _loadAd() {
    _bannerAd = BannerAd(
      adUnitId: widget.adUnitId,
      size: AdSize.banner,
      request: const AdRequest(),
      listener: BannerAdListener(
        onAdLoaded: (ad) => setState(() => _isLoaded = true),
        onAdFailedToLoad: (ad, error) => ad.dispose(),
      ),
    )..load();
  }

  @override
  void dispose() {
    _bannerAd?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_isLoaded || _bannerAd == null) return const SizedBox.shrink();
    return Container(
      alignment: Alignment.center,
      width: _bannerAd!.size.width.toDouble(),
      height: _bannerAd!.size.height.toDouble(),
      child: AdWidget(ad: _bannerAd!),
    );
  }
}

class NativeAdItem extends StatefulWidget {
  final String adUnitId;
  const NativeAdItem({super.key, required this.adUnitId});
  @override
  State<NativeAdItem> createState() => _NativeAdItemState();
}

class _NativeAdItemState extends State<NativeAdItem> {
  NativeAd? _nativeAd;
  bool _isLoaded = false;

  @override
  void initState() {
    super.initState();
    _loadAd();
  }

  void _loadAd() {
    _nativeAd = NativeAd(
      adUnitId: widget.adUnitId,
      factoryId: 'listTile', // Requires native side implementation, using default if available
      request: const AdRequest(),
      listener: NativeAdListener(
        onAdLoaded: (ad) => setState(() => _isLoaded = true),
        onAdFailedToLoad: (ad, error) {
          ad.dispose();
          debugPrint('Native Ad failed to load: $error');
        },
      ),
    )..load();
  }

  @override
  void dispose() {
    _nativeAd?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_isLoaded || _nativeAd == null) return const SizedBox.shrink();
    return Container(
      height: 100,
      margin: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
      decoration: BoxDecoration(
        color: Colors.white10,
        borderRadius: BorderRadius.circular(12),
      ),
      child: AdWidget(ad: _nativeAd!),
    );
  }
}
