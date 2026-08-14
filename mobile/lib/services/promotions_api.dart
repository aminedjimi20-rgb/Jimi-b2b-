import 'package:dio/dio.dart';

class PromotionsApi {
  PromotionsApi(this._dio);
  final Dio _dio;

  Future<List<dynamic>> list() async {
    final res = await _dio.get('/promotions');
    return res.data as List<dynamic>;
  }

  Future<void> create(Map<String, dynamic> payload) => _dio.post('/promotions', data: payload);
  Future<void> setActive(String id, bool actif) => _dio.patch('/promotions/$id/active', data: {'actif': actif});
  Future<void> remove(String id) => _dio.delete('/promotions/$id');
}
