import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_exception.dart';
import '../providers.dart';
import 'token_storage.dart';

enum UserRole { admin, client, employee }

UserRole? _roleFromString(String? value) {
  switch (value) {
    case 'ADMIN':
      return UserRole.admin;
    case 'CLIENT':
      return UserRole.client;
    case 'EMPLOYEE':
      return UserRole.employee;
    default:
      return null;
  }
}

sealed class AuthStatus {
  const AuthStatus();
}

class AuthLoading extends AuthStatus {
  const AuthLoading();
}

class AuthAuthenticated extends AuthStatus {
  const AuthAuthenticated(this.role);
  final UserRole role;
}

class AuthUnauthenticated extends AuthStatus {
  const AuthUnauthenticated({this.error});
  final String? error;
}

/// Single source of truth for "who is logged in, as what role" on the
/// mobile side. The role only ever determines which UI/navigation shell
/// is shown — every actual data access restriction is enforced again by
/// the backend regardless of what this controller thinks the role is.
class AuthController extends StateNotifier<AuthStatus> {
  AuthController(this._tokenStorage, this._dio) : super(const AuthLoading()) {
    _restoreSession();
  }

  final TokenStorage _tokenStorage;
  final Dio _dio;

  Future<void> _restoreSession() async {
    final token = await _tokenStorage.accessToken;
    final role = _roleFromString(await _tokenStorage.role);
    if (token != null && role != null) {
      state = AuthAuthenticated(role);
    } else {
      state = const AuthUnauthenticated();
    }
  }

  Future<void> login(String identifier, String password) async {
    state = const AuthLoading();
    try {
      final isEmail = identifier.contains('@');
      final response = await _dio.post('/auth/login', data: {
        isEmail ? 'email' : 'phone': identifier,
        'password': password,
      });

      final accessToken = response.data['accessToken'] as String;
      final refreshToken = response.data['refreshToken'] as String;
      final roleStr = response.data['role'] as String;

      await _tokenStorage.save(accessToken: accessToken, refreshToken: refreshToken, role: roleStr);

      final role = _roleFromString(roleStr);
      if (role == null) {
        state = const AuthUnauthenticated(error: 'Rôle de compte non supporté.');
        return;
      }
      state = AuthAuthenticated(role);
    } on DioException catch (e) {
      state = AuthUnauthenticated(error: ApiException.fromDioError(e).message);
    } catch (_) {
      state = const AuthUnauthenticated(error: 'Une erreur est survenue. Réessayez.');
    }
  }

  Future<void> logout() async {
    final refreshToken = await _tokenStorage.refreshToken;
    if (refreshToken != null) {
      try {
        await _dio.post('/auth/logout', data: {'refreshToken': refreshToken});
      } catch (_) {
        // best-effort revoke server-side; local session is cleared regardless
      }
    }
    await _tokenStorage.clear();
    state = const AuthUnauthenticated();
  }

  /// Called by ApiClient when a refresh fails — drops the app back to login.
  void forceLogout() {
    _tokenStorage.clear();
    state = const AuthUnauthenticated();
  }
}

final authControllerProvider = StateNotifierProvider<AuthController, AuthStatus>((ref) {
  return AuthController(ref.watch(tokenStorageProvider), ref.watch(plainDioProvider));
});
