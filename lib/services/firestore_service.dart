import 'package:flutter/foundation.dart';
import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class FirestoreService {
  static final _client = Supabase.instance.client;

  // Hash the 4-digit PIN for verification
  static String hashPin(String pin) {
    final bytes = utf8.encode(pin);
    final digest = sha256.convert(bytes);
    return digest.toString();
  }

  // ── Authentication & Sessions ───────────────────────────────────

  // Check login credentials. Returns document fields if valid, else null
  static Future<Map<String, dynamic>?> checkLogin(String username, String pin) async {
    try {
      final normalizedUser = username.trim().toLowerCase();
      final data = await _client
          .from('fifa_users')
          .select()
          .eq('username', normalizedUser)
          .maybeSingle();

      if (data == null) return null;

      final inputHash = hashPin(pin);
      
      // Check secure SHA-256 hashed PIN
      if (data.containsKey('pin') && data['pin'] == inputHash) {
        return data;
      }
      
      // Fallback: check plain passcode
      if (data.containsKey('pin') && data['pin'].toString() == pin) {
        return data;
      }

      return null;
    } catch (e) {
      debugPrint("Login check error: $e");
      return null;
    }
  }

  // Enforce session limit (max 2 active devices) and register device
  static Future<bool> registerSession(String username, String deviceId) async {
    try {
      final normalizedUser = username.trim().toLowerCase();
      final data = await _client
          .from('fifa_users')
          .select('active_devices')
          .eq('username', normalizedUser)
          .maybeSingle();

      if (data == null) return false;

      final Map<String, dynamic> activeDevices = Map<String, dynamic>.from(data['active_devices'] ?? {});
      final nowMs = DateTime.now().millisecondsSinceEpoch;

      // Prune inactive sessions (older than 10 minutes)
      final activeKeys = activeDevices.keys.where((devId) {
        if (devId == deviceId) return true;
        final timestamp = activeDevices[devId] as num;
        return (nowMs - timestamp) < (10 * 60 * 1000); // 10 minutes
      }).toList();

      // Check if limit exceeded (max 2 active devices)
      if (!activeKeys.contains(deviceId) && activeKeys.length >= 2) {
        return false;
      }

      // Rebuild cleaned map with current device registered
      final Map<String, int> cleanSessions = {};
      for (var k in activeKeys) {
        cleanSessions[k] = activeDevices[k] as int;
      }
      cleanSessions[deviceId] = nowMs;

      await _client
          .from('fifa_users')
          .update({'active_devices': cleanSessions})
          .eq('username', normalizedUser);
      return true;
    } catch (e) {
      debugPrint("Register session error: $e");
      return false;
    }
  }

  // Update active session timestamp (Heartbeat)
  static Future<void> sendHeartbeat(String username, String deviceId) async {
    try {
      final normalizedUser = username.trim().toLowerCase();
      final data = await _client
          .from('fifa_users')
          .select('active_devices')
          .eq('username', normalizedUser)
          .maybeSingle();

      if (data == null) return;

      final Map<String, dynamic> activeDevices = Map<String, dynamic>.from(data['active_devices'] ?? {});
      final nowMs = DateTime.now().millisecondsSinceEpoch;
      activeDevices[deviceId] = nowMs;

      await _client
          .from('fifa_users')
          .update({'active_devices': activeDevices})
          .eq('username', normalizedUser);
    } catch (e) {
      debugPrint("Heartbeat error: $e");
    }
  }

  // Remove active session (Logout or session force close)
  static Future<void> removeSession(String username, String deviceId) async {
    try {
      final normalizedUser = username.trim().toLowerCase();
      final data = await _client
          .from('fifa_users')
          .select('active_devices')
          .eq('username', normalizedUser)
          .maybeSingle();

      if (data == null) return;

      final Map<String, dynamic> activeDevices = Map<String, dynamic>.from(data['active_devices'] ?? {});
      activeDevices.remove(deviceId);

      await _client
          .from('fifa_users')
          .update({'active_devices': activeDevices})
          .eq('username', normalizedUser);
    } catch (e) {
      debugPrint("Remove session error: $e");
    }
  }

  // ── Streams List & Config ────────────────────────────────────────

  // Get live streams
  static Stream<List<Map<String, dynamic>>> streamsStream() {
    return _client
        .from('fifa_streams')
        .stream(primaryKey: ['id'])
        .map((list) {
          final result = <Map<String, dynamic>>[];
          for (var row in list) {
            if (row['deleted'] != true) {
              result.add(row);
            }
          }
          return result;
        });
  }

  // Get global settings (prices, contact numbers, watermark)
  static Stream<Map<String, dynamic>?> configStream() {
    return _client
        .from('fifa_settings')
        .stream(primaryKey: ['id'])
        .eq('id', 'global')
        .map((list) => list.isNotEmpty ? list.first : null);
  }
}
