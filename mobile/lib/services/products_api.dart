import 'package:dio/dio.dart';

import '../models/employee_product.dart';
import '../models/product.dart';

class ProductsApi {
  ProductsApi(this._dio);
  final Dio _dio;

  // ── ADMIN ────────────────────────────────────────────────────────────

  Future<List<AdminProduct>> listAdmin({String? categoryId, String? sortBy}) async {
    final res = await _dio.get('/products', queryParameters: {
      if (categoryId != null) 'categoryId': categoryId,
      if (sortBy != null) 'sortBy': sortBy,
    });
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

  /// Moves to the corbeille (reversible) — see [permanentDelete] to erase for good.
  Future<void> remove(String id) => _dio.delete('/products/$id');

  Future<List<AdminProduct>> trash() async {
    final res = await _dio.get('/products/trash');
    return (res.data as List<dynamic>).map((e) => AdminProduct.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> restore(String id) => _dio.post('/products/$id/restore');

  Future<void> permanentDelete(String id) => _dio.delete('/products/$id/permanent');

  Future<void> setCustomPrice(String productId, String clientId, double prix) =>
      _dio.post('/products/$productId/custom-price', data: {'clientId': clientId, 'prix': prix});

  // ── EMPLOYEE ─────────────────────────────────────────────────────────

  Future<List<EmployeeProduct>> listStaff() async {
    final res = await _dio.get('/products/staff');
    return (res.data as List<dynamic>).map((e) => EmployeeProduct.fromJson(e as Map<String, dynamic>)).toList();
  }

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

  /// Search by photo — the mobile app takes/picks a picture and the backend
  /// matches it against stored product photo hashes (see docs/ARCHITECTURE.md §8).
  Future<List<ImageSearchResult>> searchByImage(String filePath) async {
    final formData = FormData.fromMap({'file': await MultipartFile.fromFile(filePath)});
    final res = await _dio.post('/products/catalog/search-image', data: formData);
    return (res.data as List<dynamic>)
        .map((e) => ImageSearchResult(
              product: ClientProduct.fromJson(e as Map<String, dynamic>),
              matchScore: e['matchScore'] as int,
            ))
        .toList();
  }
}

class ImageSearchResult {
  ImageSearchResult({required this.product, required this.matchScore});
  final ClientProduct product;
  final int matchScore;
}
