import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'api/api_client.dart';
import 'auth/auth_controller.dart';
import 'auth/token_storage.dart';
import 'config/app_config.dart';

final tokenStorageProvider = Provider<TokenStorage>((ref) {
  return TokenStorage(const FlutterSecureStorage());
});

/// Bare Dio (no auth interceptors) — used only for the login/refresh/logout
/// calls made directly by AuthController, which handle their own 401s.
final plainDioProvider = Provider<Dio>((ref) {
  return Dio(BaseOptions(baseUrl: AppConfig.apiBaseUrl, connectTimeout: const Duration(seconds: 15)));
});

/// Authenticated Dio client — attaches the access token and transparently
/// refreshes it on 401. Every feature module (products, orders, ...) talks
/// to the backend exclusively through this.
final apiClientProvider = Provider<ApiClient>((ref) {
  final client = ApiClient(
    ref.watch(tokenStorageProvider),
    onSessionExpired: () => ref.read(authControllerProvider.notifier).forceLogout(),
  );
  return client;
});

final dioProvider = Provider<Dio>((ref) => ref.watch(apiClientProvider).dio);
