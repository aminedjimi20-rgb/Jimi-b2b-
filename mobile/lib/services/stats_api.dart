import 'package:dio/dio.dart';

import '../models/stats.dart';

class StatsApi {
  StatsApi(this._dio);
  final Dio _dio;

  Future<DashboardStats> dashboard({DateTime? from, DateTime? to}) async {
    final res = await _dio.get('/stats/dashboard', queryParameters: {
      if (from != null) 'from': from.toIso8601String(),
      if (to != null) 'to': to.toIso8601String(),
    });
    return DashboardStats.fromJson(res.data as Map<String, dynamic>);
  }
}
