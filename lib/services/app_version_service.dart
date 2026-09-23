import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// App configuration fetched from `zeta_config` table in Supabase.
/// Admin panel sets these values to control force-update.
class AppConfig {
  final String minVersion;      // minimum required version e.g. "1.2.0"
  final String latestVersion;   // latest available version e.g. "1.3.0"
  final bool   forceUpdate;     // if true, block app until updated
  final String androidStoreUrl; // Play Store URL
  final String iosStoreUrl;     // App Store URL
  final String apkUrl;          // Direct APK URL for self-hosted updates
  final String updateMessage;   // Custom message shown in update dialog
  final String releaseNotes;    // Changelog notes
  final bool   maintenanceMode; // block all users for maintenance
  final String onesignalAppId;  // OneSignal App ID
  final int    requiredPatchVersion; // Required Shorebird patch version

  const AppConfig({
    required this.minVersion,
    required this.latestVersion,
    required this.forceUpdate,
    required this.androidStoreUrl,
    required this.iosStoreUrl,
    required this.apkUrl,
    required this.updateMessage,
    required this.releaseNotes,
    required this.maintenanceMode,
    required this.onesignalAppId,
    required this.requiredPatchVersion,
  });

  factory AppConfig.fromMap(Map<String, dynamic> m) => AppConfig(
    minVersion      : m['min_version']       ?? '1.0.0',
    latestVersion   : m['latest_version']    ?? '1.0.0',
    forceUpdate     : m['force_update']      ?? false,
    androidStoreUrl : m['android_store_url'] ??
        'https://play.google.com/store/apps/details?id=com.zetasports.zetasports',
    iosStoreUrl     : m['ios_store_url']     ??
        'https://apps.apple.com/app/zetasports/id000000000',
    apkUrl          : m['apk_url']           ?? '',
    updateMessage   : m['update_message']    ??
        'A new version is available. Please update to continue.',
    releaseNotes    : m['release_notes']     ?? '',
    maintenanceMode : m['maintenance_mode']  ?? false,
    onesignalAppId  : m['onesignal_app_id']  ?? '',
    requiredPatchVersion : m['required_patch_version'] ?? 0,
  );

  /// Fallback when Supabase is unreachable — allow app to open normally
  factory AppConfig.fallback() => const AppConfig(
    minVersion      : '1.0.0',
    latestVersion   : '1.0.0',
    forceUpdate     : false,
    androidStoreUrl : '',
    iosStoreUrl     : '',
    apkUrl          : '',
    updateMessage   : '',
    releaseNotes    : '',
    maintenanceMode : false,
    onesignalAppId  : '',
    requiredPatchVersion : 0,
  );
}

class AppVersionService {
  static final _db = Supabase.instance.client;
  static AppConfig? activeConfig;

  // Current app version (matches pubspec.yaml 1.2.0)
  static const String currentVersion = '1.2.1';
  
  // Current Shorebird patch version (hardcoded in compiled patch code)
  static const int currentPatchVersion = 19;

  /// Fetch app_config row from Supabase.
  /// Table: zeta_config (single row, id = 'global')
  static Future<AppConfig> fetchConfig() async {
    try {
      final res = await _db
          .from('zeta_config')
          .select()
          .eq('id', 'global')
          .maybeSingle();
      if (res == null) {
        activeConfig = AppConfig.fallback();
        return activeConfig!;
      }
      activeConfig = AppConfig.fromMap(res);
      return activeConfig!;
    } catch (e) {
      debugPrint('AppVersionService.fetchConfig: $e');
      activeConfig = AppConfig.fallback();
      return activeConfig!;
    }
  }

  /// Robust version comparison supporting 'v1.2.0', '1.2.0+17', spaces, etc.
  /// Returns true if [current] is strictly older than [minimum].
  static bool isOutdated(String current, String minimum) {
    try {
      final c = _parseVersion(current);
      final m = _parseVersion(minimum);
      for (int i = 0; i < 3; i++) {
        if (c[i] < m[i]) {
          debugPrint('[AppVersionService] Outdated: current $current ($c) < target $minimum ($m)');
          return true;
        }
        if (c[i] > m[i]) {
          return false;
        }
      }
      return false; // equal - not outdated
    } catch (e) {
      debugPrint('[AppVersionService] isOutdated parsing error: $e');
      return false;
    }
  }

  static List<int> _parseVersion(String raw) {
    String s = raw.trim().toLowerCase();
    if (s.startsWith('v')) {
      s = s.substring(1).trim();
    }
    final plusIdx = s.indexOf('+');
    if (plusIdx != -1) {
      s = s.substring(0, plusIdx);
    }
    final dashIdx = s.indexOf('-');
    if (dashIdx != -1) {
      s = s.substring(0, dashIdx);
    }

    final parts = s.split('.').map((part) => int.tryParse(part.trim()) ?? 0).toList();
    while (parts.length < 3) {
      parts.add(0);
    }
    return parts.take(3).toList();
  }
}
