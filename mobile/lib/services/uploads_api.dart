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
    final relativeUrl = res.data['url'] as String;
    final origin = Uri.parse(AppConfig.apiBaseUrl).replace(path: '').origin;
    return '$origin$relativeUrl';
  }
}
