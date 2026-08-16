import 'package:dio/dio.dart';

class PaymentsApi {
  PaymentsApi(this._dio);
  final Dio _dio;

  /// Money IN from a client (optionally settling one specific order), or
  /// money OUT to a fabricant (optionally settling one specific bon de
  /// réception) — exactly one of clientId/fabricantId must be set.
  Future<void> create({
    String? clientId,
    String? orderId,
    String? fabricantId,
    String? stockReceiptId,
    required double montant,
    required String method,
  }) =>
      _dio.post('/payments', data: {
        if (clientId != null) 'clientId': clientId,
        if (orderId != null) 'orderId': orderId,
        if (fabricantId != null) 'fabricantId': fabricantId,
        if (stockReceiptId != null) 'stockReceiptId': stockReceiptId,
        'montant': montant,
        'method': method,
      });

  Future<List<dynamic>> listAdmin({String? clientId, String? fabricantId}) async {
    final res = await _dio.get('/payments', queryParameters: {
      if (clientId != null) 'clientId': clientId,
      if (fabricantId != null) 'fabricantId': fabricantId,
    });
    return res.data as List<dynamic>;
  }

  Future<List<dynamic>> mine() async {
    final res = await _dio.get('/payments/mine');
    return res.data as List<dynamic>;
  }
}
