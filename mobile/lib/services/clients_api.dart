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

  Future<ClientView> setStatus(String id, String status) async {
    final res = await _dio.patch('/clients/$id/status', data: {'status': status});
    return ClientView.fromJson(res.data as Map<String, dynamic>);
  }

  // ── CLIENT (self) ────────────────────────────────────────────────────

  Future<ClientView> myProfile() async {
    final res = await _dio.get('/clients/me/profile');
    return ClientView.fromJson(res.data as Map<String, dynamic>);
  }
}
