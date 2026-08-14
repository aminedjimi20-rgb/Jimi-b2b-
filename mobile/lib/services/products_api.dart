import 'package:dio/dio.dart';

import '../models/product.dart';

class ProductsApi {
  ProductsApi(this._dio);
  final Dio _dio;

  // ── ADMIN ────────────────────────────────────────────────────────────

  Future<List<AdminProduct>> listAdmin({String? categoryId}) async {
    final res = await _dio.get('/products', queryParameters: {if (categoryId != null) 'categoryId': categoryId});
    return (res.data as List<dynamic>).map((e) => AdminProduct.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<AdminProduct> getAdmin(String id) async {
    final res = await _dio.get('/products/$id');
    return AdminProduct.fromJson(res.data as Map<String, dynamic>);
  }

  Future<AdminProduct> create(Map<String, dynamic> payload) async {
    final res = await _dio.post('/products', data: payload);
    return AdminProduct.fromJson(res.data as Map<String, dynamic>);
  }

  Future<AdminProduct> update(String id, Map<String, dynamic> payload) async {
    final res = await _dio.patch('/products/$id', data: payload);
    return AdminProduct.fromJson(res.data as Map<String, dynamic>);
  }

  Future<void> remove(String id) => _dio.delete('/products/$id');

  Future<void> setCustomPrice(String productId, String clientId, double prix) =>
      _dio.post('/products/$productId/custom-price', data: {'clientId': clientId, 'prix': prix});

  // ── CLIENT ───────────────────────────────────────────────────────────

  Future<({List<ClientProduct> items, int total})> searchCatalog({
    String? q,
    String? categoryId,
    int page = 1,
    int pageSize = 20,
  }) async {
    final res = await _dio.get('/products/catalog/search', queryParameters: {
      if (q != null && q.isNotEmpty) 'q': q,
      if (categoryId != null) 'categoryId': categoryId,
      'page': page,
      'pageSize': pageSize,
    });
    final data = res.data as Map<String, dynamic>;
    final items = (data['items'] as List<dynamic>).map((e) => ClientProduct.fromJson(e as Map<String, dynamic>)).toList();
    return (items: items, total: data['total'] as int);
  }

  Future<ClientProduct> getForClient(String id) async {
    final res = await _dio.get('/products/catalog/$id');
    return ClientProduct.fromJson(res.data as Map<String, dynamic>);
  }
}
