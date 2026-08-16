import 'package:dio/dio.dart';

import '../models/employee.dart';
import '../models/employee_permissions.dart';

class EmployeesApi {
  EmployeesApi(this._dio);
  final Dio _dio;

  Future<List<EmployeeView>> listAdmin() async {
    final res = await _dio.get('/employees');
    return (res.data as List<dynamic>).map((e) => EmployeeView.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<EmployeeView> create(Map<String, dynamic> payload) async {
    final res = await _dio.post('/employees', data: payload);
    return EmployeeView.fromJson(res.data as Map<String, dynamic>);
  }

  Future<EmployeeView> setStatus(String id, String status) async {
    final res = await _dio.patch('/employees/$id/status', data: {'status': status});
    return EmployeeView.fromJson(res.data as Map<String, dynamic>);
  }

  /// Admin-only visibility/permission toggles — enforced server-side, not just hidden in the UI.
  Future<EmployeeView> updatePermissions(String id, Map<String, bool> permissions) async {
    final res = await _dio.patch('/employees/$id', data: permissions);
    return EmployeeView.fromJson(res.data as Map<String, dynamic>);
  }

  /// Moves to the corbeille (reversible, also suspends login) — see [permanentDelete] to erase for good.
  Future<void> remove(String id) => _dio.delete('/employees/$id');

  Future<List<EmployeeView>> trash() async {
    final res = await _dio.get('/employees/trash');
    return (res.data as List<dynamic>).map((e) => EmployeeView.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> restore(String id) => _dio.post('/employees/$id/restore');

  Future<void> permanentDelete(String id) => _dio.delete('/employees/$id/permanent');

  // ── EMPLOYEE ─────────────────────────────────────────────────────────

  Future<EmployeePermissions> myPermissions() async {
    final res = await _dio.get('/employees/staff/me');
    return EmployeePermissions.fromJson(res.data as Map<String, dynamic>);
  }
}
