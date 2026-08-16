import 'package:dio/dio.dart';

import '../models/product_request.dart';

class ProductRequestsApi {
  ProductRequestsApi(this._dio);
  final Dio _dio;

  // ── CLIENT ───────────────────────────────────────────────────────────

  Future<ProductRequestView> create({required String imageUrl, String? description}) async {
    final res = await _dio.post('/product-requests', data: {
      'imageUrl': imageUrl,
      if (description != null && description.isNotEmpty) 'description': description,
    });
    return ProductRequestView.fromJson(res.data as Map<String, dynamic>);
  }

  Future<List<ProductRequestView>> mine() async {
    final res = await _dio.get('/product-requests/mine');
    return (res.data as List<dynamic>).map((e) => ProductRequestView.fromJson(e as Map<String, dynamic>)).toList();
  }

  // ── ADMIN ────────────────────────────────────────────────────────────

  Future<List<ProductRequestView>> listAdmin({String? status}) async {
    final res = await _dio.get('/product-requests', queryParameters: {if (status != null) 'status': status});
    return (res.data as List<dynamic>).map((e) => ProductRequestView.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<ProductRequestView> updateStatus(String id, String status, {String? adminNote}) async {
    final res = await _dio.patch('/product-requests/$id/status', data: {
      'status': status,
      if (adminNote != null && adminNote.isNotEmpty) 'adminNote': adminNote,
    });
    return ProductRequestView.fromJson(res.data as Map<String, dynamic>);
  }

  /// Moves to the corbeille (reversible) — see [permanentDelete] to erase for good.
  Future<void> remove(String id) => _dio.delete('/product-requests/$id');

  Future<List<ProductRequestView>> trash() async {
    final res = await _dio.get('/product-requests/trash');
    return (res.data as List<dynamic>).map((e) => ProductRequestView.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> restore(String id) => _dio.post('/product-requests/$id/restore');

  Future<void> permanentDelete(String id) => _dio.delete('/product-requests/$id/permanent');
}
