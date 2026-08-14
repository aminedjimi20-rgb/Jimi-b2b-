import 'dart:async';

import 'package:dio/dio.dart';

import '../auth/token_storage.dart';
import '../config/app_config.dart';

/// Thin wrapper around Dio that:
///  - attaches the access token to every request,
///  - transparently refreshes it once on a 401 and retries the original
///    request, using a single in-flight refresh (concurrent 401s don't
///    each trigger their own refresh call),
///  - surfaces `onSessionExpired` when the refresh itself fails, so the
///    app can drop back to the login screen.
class ApiClient {
  ApiClient(this._tokenStorage, {this.onSessionExpired}) {
    _dio = Dio(BaseOptions(baseUrl: AppConfig.apiBaseUrl, connectTimeout: const Duration(seconds: 15)));
    _refreshDio = Dio(BaseOptions(baseUrl: AppConfig.apiBaseUrl));

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _tokenStorage.accessToken;
          if (token != null) options.headers['Authorization'] = 'Bearer $token';
          handler.next(options);
        },
        onError: (error, handler) async {
          final isAuthRoute = error.requestOptions.path.contains('/auth/');
          if (error.response?.statusCode == 401 && !isAuthRoute) {
            final retried = await _retryWithRefreshedToken(error.requestOptions);
            if (retried != null) return handler.resolve(retried);
            onSessionExpired?.call();
          }
          handler.next(error);
        },
      ),
    );
  }

  final TokenStorage _tokenStorage;
  final void Function()? onSessionExpired;
  late final Dio _dio;
  late final Dio _refreshDio;
  Future<String?>? _refreshInFlight;

  Dio get dio => _dio;

  Future<Response<dynamic>?> _retryWithRefreshedToken(RequestOptions failedRequest) async {
    _refreshInFlight ??= _refreshAccessToken();
    final newToken = await _refreshInFlight;
    _refreshInFlight = null;
    if (newToken == null) return null;

    failedRequest.headers['Authorization'] = 'Bearer $newToken';
    return _dio.fetch(failedRequest);
  }

  Future<String?> _refreshAccessToken() async {
    final refreshToken = await _tokenStorage.refreshToken;
    if (refreshToken == null) return null;
    try {
      final response = await _refreshDio.post('/auth/refresh', data: {'refreshToken': refreshToken});
      final newAccessToken = response.data['accessToken'] as String;
      final newRefreshToken = response.data['refreshToken'] as String;
      final role = await _tokenStorage.role ?? '';
      await _tokenStorage.save(accessToken: newAccessToken, refreshToken: newRefreshToken, role: role);
      return newAccessToken;
    } catch (_) {
      await _tokenStorage.clear();
      return null;
    }
  }
}
