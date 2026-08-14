import 'package:dio/dio.dart';

class PaymentsApi {
  PaymentsApi(this._dio);
  final Dio _dio;

  Future<void> create({required String clientId, String? orderId, required double montant, required String method}) =>
      _dio.post('/payments', data: {
        'clientId': clientId,
        if (orderId != null) 'orderId': orderId,
        'montant': montant,
        'method': method,
      });

  Future<List<dynamic>> listAdmin({String? clientId}) async {
    final res = await _dio.get('/payments', queryParameters: {if (clientId != null) 'clientId': clientId});
    return res.data as List<dynamic>;
  }

  Future<List<dynamic>> mine() async {
    final res = await _dio.get('/payments/mine');
    return res.data as List<dynamic>;
  }
}
