import 'package:dio/dio.dart';

import '../models/product.dart';

class FavoritesApi {
  FavoritesApi(this._dio);
  final Dio _dio;

  Future<List<ClientProduct>> list() async {
    final res = await _dio.get('/favorites');
    return (res.data as List<dynamic>).map((e) => ClientProduct.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> add(String productId) => _dio.post('/favorites/$productId');
  Future<void> remove(String productId) => _dio.delete('/favorites/$productId');
}
