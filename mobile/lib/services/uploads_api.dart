import 'package:dio/dio.dart';

import '../core/config/app_config.dart';

class UploadsApi {
  UploadsApi(this._dio);
  final Dio _dio;

  /// Uploads a product photo (from camera or gallery) and returns the
  /// absolute URL to attach to the product.
  Future<String> uploadProductImage(String filePath) async {
    final formData = FormData.fromMap({'file': await MultipartFile.fromFile(filePath)});
    final res = await _dio.post('/uploads/product-image', data: formData);
    return _toAbsolute(res.data['url'] as String);
  }

  /// Uploads a photo for a client's "demander un produit" request — see
  /// ProductRequestsApi.create.
  Future<String> uploadRequestPhoto(String filePath) async {
    final formData = FormData.fromMap({'file': await MultipartFile.fromFile(filePath)});
    final res = await _dio.post('/uploads/request-photo', data: formData);
    return _toAbsolute(res.data['url'] as String);
  }

  String _toAbsolute(String relativeUrl) {
    final origin = Uri.parse(AppConfig.apiBaseUrl).replace(path: '').origin;
    return '$origin$relativeUrl';
  }
}
