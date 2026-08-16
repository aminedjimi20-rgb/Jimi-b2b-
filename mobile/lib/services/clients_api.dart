import 'package:dio/dio.dart';

import '../models/client.dart';

class ClientsApi {
  ClientsApi(this._dio);
  final Dio _dio;

  // ── ADMIN ────────────────────────────────────────────────────────────

  Future<List<ClientView>> listAdmin() async {
    final res = await _dio.get('/clients');
    return (res.data as List<dynamic>).map((e) => ClientView.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<ClientView> getAdmin(String id) async {
    final res = await _dio.get('/clients/$id');
    return ClientView.fromJson(res.data as Map<String, dynamic>);
  }

  Future<ClientView> create(Map<String, dynamic> payload) async {
    final res = await _dio.post('/clients', data: payload);
    return ClientView.fromJson(res.data as Map<String, dynamic>);
  }

  Future<ClientView> update(String id, Map<String, dynamic> payload) async {
    final res = await _dio.patch('/clients/$id', data: payload);
    return ClientView.fromJson(res.data as Map<String, dynamic>);
  }

  Future<ClientView> setStatus(String id, String status) async {
    final res = await _dio.patch('/clients/$id/status', data: {'status': status});
    return ClientView.fromJson(res.data as Map<String, dynamic>);
  }

  /// Moves to the corbeille (reversible, also suspends login) — see [permanentDelete] to erase for good.
  Future<void> remove(String id) => _dio.delete('/clients/$id');

  Future<List<ClientView>> trash() async {
    final res = await _dio.get('/clients/trash');
    return (res.data as List<dynamic>).map((e) => ClientView.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> restore(String id) => _dio.post('/clients/$id/restore');

  Future<void> permanentDelete(String id) => _dio.delete('/clients/$id/permanent');

  // ── EMPLOYEE ─────────────────────────────────────────────────────────

  /// Restricted list for picking a client on an on-site order — no credit exposure (see ClientsService.findAllForEmployee).
  Future<List<ClientView>> listStaff() async {
    final res = await _dio.get('/clients/staff');
    return (res.data as List<dynamic>).map((e) => ClientView.fromJson(e as Map<String, dynamic>)).toList();
  }

  // ── CLIENT (self) ────────────────────────────────────────────────────

  Future<ClientView> myProfile() async {
    final res = await _dio.get('/clients/me/profile');
    return ClientView.fromJson(res.data as Map<String, dynamic>);
  }
}
