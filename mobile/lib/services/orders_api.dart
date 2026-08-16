import 'package:dio/dio.dart';

import '../models/order.dart';

class OrderItemInput {
  OrderItemInput({required this.productId, required this.quantite});
  final String productId;
  final int quantite;

  Map<String, dynamic> toJson() => {'productId': productId, 'quantite': quantite};
}

class OrdersApi {
  OrdersApi(this._dio);
  final Dio _dio;

  // ── CLIENT ───────────────────────────────────────────────────────────

  Future<OrderView> create({
    required List<OrderItemInput> items,
    required String paymentMethod,
    required String adresseLivraison,
    required String telephoneContact,
    String? nom,
    String? notes,
  }) async {
    final res = await _dio.post('/orders', data: {
      'items': items.map((e) => e.toJson()).toList(),
      'paymentMethod': paymentMethod,
      'adresseLivraison': adresseLivraison,
      'telephoneContact': telephoneContact,
      if (nom != null && nom.isNotEmpty) 'nom': nom,
      if (notes != null && notes.isNotEmpty) 'notes': notes,
    });
    return OrderView.fromJson(res.data as Map<String, dynamic>);
  }

  Future<List<OrderView>> mine() async {
    final res = await _dio.get('/orders/mine');
    return (res.data as List<dynamic>).map((e) => OrderView.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<OrderView> mineOne(String id) async {
    final res = await _dio.get('/orders/mine/$id');
    return OrderView.fromJson(res.data as Map<String, dynamic>);
  }

  Future<OrderView> reorder(String id) async {
    final res = await _dio.post('/orders/$id/reorder');
    return OrderView.fromJson(res.data as Map<String, dynamic>);
  }

  // ── ADMIN ────────────────────────────────────────────────────────────

  /// Counter sale — Admin places an order directly for a walk-in client.
  /// `remisePourcentage` is admin-only — there is no client-facing equivalent.
  Future<OrderView> createForAdmin({
    required String clientId,
    required List<OrderItemInput> items,
    required String paymentMethod,
    required String adresseLivraison,
    required String telephoneContact,
    String? nom,
    double? remisePourcentage,
    String? notes,
  }) async {
    final res = await _dio.post('/orders/admin', data: {
      'clientId': clientId,
      'items': items.map((e) => e.toJson()).toList(),
      'paymentMethod': paymentMethod,
      'adresseLivraison': adresseLivraison,
      'telephoneContact': telephoneContact,
      if (nom != null && nom.isNotEmpty) 'nom': nom,
      if (remisePourcentage != null && remisePourcentage > 0) 'remisePourcentage': remisePourcentage,
      if (notes != null && notes.isNotEmpty) 'notes': notes,
    });
    return OrderView.fromJson(res.data as Map<String, dynamic>);
  }

  Future<List<OrderView>> listAdmin({String? status}) async {
    final res = await _dio.get('/orders', queryParameters: {if (status != null) 'status': status});
    return (res.data as List<dynamic>).map((e) => OrderView.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<OrderView> getAdmin(String id) async {
    final res = await _dio.get('/orders/$id');
    return OrderView.fromJson(res.data as Map<String, dynamic>);
  }

  Future<OrderView> updateStatus(String id, String status) async {
    final res = await _dio.patch('/orders/$id/status', data: {'status': status});
    return OrderView.fromJson(res.data as Map<String, dynamic>);
  }

  Future<OrderView> updatePayment(String id, bool estPayee) async {
    final res = await _dio.patch('/orders/$id/payment', data: {'estPayee': estPayee});
    return OrderView.fromJson(res.data as Map<String, dynamic>);
  }

  /// Moves to the corbeille (reversible) — see [permanentDelete] to erase for good.
  Future<void> remove(String id) => _dio.delete('/orders/$id');

  Future<List<OrderView>> trash() async {
    final res = await _dio.get('/orders/trash');
    return (res.data as List<dynamic>).map((e) => OrderView.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> restore(String id) => _dio.post('/orders/$id/restore');

  Future<void> permanentDelete(String id) => _dio.delete('/orders/$id/permanent');
}
