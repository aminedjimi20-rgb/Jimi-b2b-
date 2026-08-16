import 'package:dio/dio.dart';

import '../models/invoice.dart';

class InvoicesApi {
  InvoicesApi(this._dio);
  final Dio _dio;

  // ── ADMIN ────────────────────────────────────────────────────────────

  Future<InvoiceView> generateFromOrder(String orderId) async {
    final res = await _dio.post('/invoices/from-order/$orderId');
    return InvoiceView.fromJson(res.data as Map<String, dynamic>);
  }

  Future<List<InvoiceView>> listAdmin() async {
    final res = await _dio.get('/invoices');
    return (res.data as List<dynamic>).map((e) => InvoiceView.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<InvoiceView> getAdmin(String id) async {
    final res = await _dio.get('/invoices/$id');
    return InvoiceView.fromJson(res.data as Map<String, dynamic>);
  }

  /// Moves to the corbeille (reversible) — see [permanentDelete] to erase for good.
  Future<void> remove(String id) => _dio.delete('/invoices/$id');

  Future<List<InvoiceView>> trash() async {
    final res = await _dio.get('/invoices/trash');
    return (res.data as List<dynamic>).map((e) => InvoiceView.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> restore(String id) => _dio.post('/invoices/$id/restore');

  Future<void> permanentDelete(String id) => _dio.delete('/invoices/$id/permanent');

  // ── CLIENT ───────────────────────────────────────────────────────────

  Future<List<InvoiceView>> mine() async {
    final res = await _dio.get('/invoices/mine');
    return (res.data as List<dynamic>).map((e) => InvoiceView.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<InvoiceView> getForClient(String id) async {
    final res = await _dio.get('/invoices/mine/$id');
    return InvoiceView.fromJson(res.data as Map<String, dynamic>);
  }
}
