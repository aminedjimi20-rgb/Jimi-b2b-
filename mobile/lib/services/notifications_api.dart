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
}
