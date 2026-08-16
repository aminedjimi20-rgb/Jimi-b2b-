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

  /// Photo search for internal use (checking a product exists before adding
  /// it to a bon de réception, browsing the product list by photo, or a
  /// general search) — full admin shape (prixAchat/marge included).
  Future<List<AdminImageSearchResult>> searchByImageAdmin(String filePath) async {
    final formData = FormData.fromMap({'file': await MultipartFile.fromFile(filePath)});
    final res = await _dio.post('/products/search-image', data: formData);
    return (res.data as List<dynamic>)
        .map((e) => AdminImageSearchResult(
              product: AdminProduct.fromJson(e as Map<String, dynamic>),
              matchScore: e['matchScore'] as int,
            ))
        .toList();
  }

  // ── EMPLOYEE ─────────────────────────────────────────────────────────

  Future<List<EmployeeProduct>> listStaff({String? sortBy}) async {
    final res = await _dio.get('/products/staff', queryParameters: {if (sortBy != null) 'sortBy': sortBy});
    return (res.data as List<dynamic>).map((e) => EmployeeProduct.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<EmployeeProduct> getStaff(String id) async {
    final res = await _dio.get('/products/staff/$id');
    return EmployeeProduct.fromJson(res.data as Map<String, dynamic>);
  }

  /// Same as Client's searchByImage, restricted to the Employee shape (no prixAchat/marge).
  Future<List<EmployeeImageSearchResult>> searchByImageStaff(String filePath) async {
    final formData = FormData.fromMap({'file': await MultipartFile.fromFile(filePath)});
    final res = await _dio.post('/products/staff/search-image', data: formData);
    return (res.data as List<dynamic>)
        .map((e) => EmployeeImageSearchResult(
              product: EmployeeProduct.fromJson(e as Map<String, dynamic>),
              matchScore: e['matchScore'] as int,
            ))
        .toList();
  }

  /// Search-first article picker for the bon d'entrée (Phase 38) — never
  /// browses the full catalog, only matches for `q`.
  Future<List<EmployeeProduct>> searchStaff(String q) async {
    final res = await _dio.get('/products/staff/search', queryParameters: {'q': q});
    return (res.data as List<dynamic>).map((e) => EmployeeProduct.fromJson(e as Map<String, dynamic>)).toList();
  }

  /// Requires canCreerProduit — enforced server-side. Created with stockReel=0; the actual stock is added when the bon d'entrée is confirmed.
  Future<EmployeeProduct> createStaff(Map<String, dynamic> payload) async {
    final res = await _dio.post('/products/staff', data: payload);
    return EmployeeProduct.fromJson(res.data as Map<String, dynamic>);
  }

  /// Requires canModifierProduit — prixAchat is silently ignored server-side unless canModifierPrixAchat is also granted.
  Future<EmployeeProduct> updateStaff(String id, Map<String, dynamic> payload) async {
    final res = await _dio.patch('/products/staff/$id', data: payload);
    return EmployeeProduct.fromJson(res.data as Map<String, dynamic>);
  }

  // ── CLIENT ───────────────────────────────────────────────────────────

  Future<({List<ClientProduct> items, int total})> searchCatalog({
    String? q,
    String? categoryId,
    String? sortBy,
    int page = 1,
    int pageSize = 20,
  }) async {
    final res = await _dio.get('/products/catalog/search', queryParameters: {
      if (q != null && q.isNotEmpty) 'q': q,
      if (categoryId != null) 'categoryId': categoryId,
      if (sortBy != null) 'sortBy': sortBy,
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

class EmployeeImageSearchResult {
  EmployeeImageSearchResult({required this.product, required this.matchScore});
  final EmployeeProduct product;
  final int matchScore;
}

class AdminImageSearchResult {
  AdminImageSearchResult({required this.product, required this.matchScore});
  final AdminProduct product;
  final int matchScore;
}
