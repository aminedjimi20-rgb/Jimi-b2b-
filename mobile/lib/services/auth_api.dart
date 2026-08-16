import 'package:dio/dio.dart';

/// Authenticated-only auth actions (uses the auth-attached [dioProvider],
/// unlike register/login/forgot-password which use plainDioProvider directly
/// from AuthController — see core/auth/auth_controller.dart).
class AuthApi {
  AuthApi(this._dio);
  final Dio _dio;

  Future<void> changePassword(String currentPassword, String newPassword) =>
      _dio.post('/auth/change-password', data: {'currentPassword': currentPassword, 'newPassword': newPassword});
}
