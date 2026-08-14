import 'package:dio/dio.dart';

/// Normalizes Dio/backend errors into a single user-displayable message,
/// preferring the backend's own French error text (NestJS ValidationPipe /
/// exception filters return `{ message: string | string[] }`).
class ApiException implements Exception {
  ApiException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  factory ApiException.fromDioError(DioException error) {
    final data = error.response?.data;
    if (data is Map && data['message'] != null) {
      final msg = data['message'];
      final text = msg is List ? msg.join('\n') : msg.toString();
      return ApiException(text, statusCode: error.response?.statusCode);
    }
    if (error.type == DioExceptionType.connectionTimeout || error.type == DioExceptionType.connectionError) {
      return ApiException('Connexion impossible. Vérifiez votre connexion internet.');
    }
    return ApiException('Une erreur est survenue. Réessayez.', statusCode: error.response?.statusCode);
  }

  @override
  String toString() => message;
}
