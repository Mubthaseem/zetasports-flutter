import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// App configuration fetched from `app_config` table in Supabase.
/// Admin panel sets these values to control force-update.
class AppConfig {
  final String minVersion;      // minimum required version e.g. "1.2.0"
  final String latestVersion;   // latest available version e.g. "1.3.0"
  final bool   forceUpdate;     // if true, block app until updated
  final String androidStoreUrl; // Play Store URL
  final String iosStoreUrl;     // App Store URL
  final String updateMessage;   // Custom message shown in update dialog
  final bool   maintenanceMode; // block all users for maintenance
  final String onesignalAppId;  // OneSignal App ID
  final int    requiredPatchVersion; // Required Shorebird patch version

  const AppConfig({
    required this.minVersion,
    required this.latestVersion,
    required this.forceUpdate,
    required this.androidStoreUrl,
    required this.iosStoreUrl,
    required this.updateMessage,
    required this.maintenanceMode,
    required this.onesignalAppId,
    required this.requiredPatchVersion,
  });

  factory AppConfig.fromMap(Map<String, dynamic> m) => AppConfig(
    minVersion      : m['min_version']       ?? '1.0.0',
    latestVersion   : m['latest_version']    ?? '1.0.0',
    forceUpdate     : m['force_update']      ?? false,
    androidStoreUrl : m['android_store_url'] ??
        'https://play.google.com/store/apps/details?id=com.zetasports.app',
    iosStoreUrl     : m['ios_store_url']     ??
        'https://apps.apple.com/app/zetasports/id000000000',
    updateMessage   : m['update_message']    ??
        'A new version is available. Please update to continue.',
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
    updateMessage   : '',
    maintenanceMode : false,
    onesignalAppId  : '',
    requiredPatchVersion : 0,
  );
}

class AppVersionService {
  static final _db = Supabase.instance.client;
  static AppConfig? activeConfig;

  // ── Current app version (bump this with every release) ─────────────────────
  static const String currentVersion = '1.1.5';
  
  // ── Current Shorebird patch version (hardcoded in compiled patch code) ─────
  static const int currentPatchVersion = 19;

  /// Fetch app_config row from Supabase.
  /// Table: app_config  (single row, id = 'global')
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

  /// Returns true if [current] is older than [minimum].
  /// Compares semver strings like "1.2.3".
  static bool isOutdated(String current, String minimum) {
    try {
      final c = current.split('.').map(int.parse).toList();
      final m = minimum.split('.').map(int.parse).toList();
      while (c.length < 3) c.add(0);
      while (m.length < 3) m.add(0);
      for (int i = 0; i < 3; i++) {
        if (c[i] < m[i]) return true;
        if (c[i] > m[i]) return false;
      }
      return false; // equal — not outdated
    } catch (_) {
      return false;
    }
  }
}
