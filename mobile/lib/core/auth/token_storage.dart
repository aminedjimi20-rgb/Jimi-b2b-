import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Encrypted on-device storage for tokens — never SharedPreferences,
/// which stores in cleartext.
class TokenStorage {
  TokenStorage(this._storage);

  final FlutterSecureStorage _storage;

  static const _accessTokenKey = 'access_token';
  static const _refreshTokenKey = 'refresh_token';
  static const _roleKey = 'role';

  Future<void> save({required String accessToken, required String refreshToken, required String role}) async {
    await _storage.write(key: _accessTokenKey, value: accessToken);
    await _storage.write(key: _refreshTokenKey, value: refreshToken);
    await _storage.write(key: _roleKey, value: role);
  }

  Future<void> updateAccessToken(String accessToken) => _storage.write(key: _accessTokenKey, value: accessToken);

  Future<String?> get accessToken => _storage.read(key: _accessTokenKey);
  Future<String?> get refreshToken => _storage.read(key: _refreshTokenKey);
  Future<String?> get role => _storage.read(key: _roleKey);

  Future<void> clear() async {
    await _storage.delete(key: _accessTokenKey);
    await _storage.delete(key: _refreshTokenKey);
    await _storage.delete(key: _roleKey);
  }
}
