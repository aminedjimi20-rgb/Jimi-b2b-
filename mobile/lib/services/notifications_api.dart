import 'package:dio/dio.dart';

import '../models/app_notification.dart';

class NotificationsApi {
  NotificationsApi(this._dio);
  final Dio _dio;

  Future<List<AppNotification>> list() async {
    final res = await _dio.get('/notifications');
    return (res.data as List<dynamic>).map((e) => AppNotification.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> markRead(String id) => _dio.patch('/notifications/$id/read');
  Future<void> markAllRead() => _dio.patch('/notifications/read-all');

  Future<void> registerDeviceToken(String token, String platform) =>
      _dio.post('/notifications/device-token', data: {'token': token, 'platform': platform});

  Future<void> unregisterDeviceToken(String token) => _dio.delete('/notifications/device-token/$token');

  /// Moves to the corbeille (reversible) — see [permanentDelete] to erase for good.
  Future<void> remove(String id) => _dio.delete('/notifications/$id');

  Future<List<AppNotification>> trash() async {
    final res = await _dio.get('/notifications/trash');
    return (res.data as List<dynamic>).map((e) => AppNotification.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> restore(String id) => _dio.post('/notifications/$id/restore');

  Future<void> permanentDelete(String id) => _dio.delete('/notifications/$id/permanent');

  /// ADMIN-only: push a SYSTEME notification to a chosen audience or a single client/employee.
  Future<int> broadcast({required String titre, required String message, required String audience, String? targetId}) async {
    final res = await _dio.post('/notifications/broadcast', data: {
      'titre': titre,
      'message': message,
      'audience': audience,
      if (targetId != null) 'targetId': targetId,
    });
    return (res.data as Map<String, dynamic>)['sent'] as int;
  }
}
