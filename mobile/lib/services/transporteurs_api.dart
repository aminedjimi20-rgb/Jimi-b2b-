import 'package:dio/dio.dart';

import '../models/transporteur.dart';

class TransporteursApi {
  TransporteursApi(this._dio);
  final Dio _dio;

  Future<List<Transporteur>> list() async {
    final res = await _dio.get('/transporteurs');
    return (res.data as List<dynamic>).map((e) => Transporteur.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<Transporteur> getOne(String id) async {
    final res = await _dio.get('/transporteurs/$id');
    return Transporteur.fromJson(res.data as Map<String, dynamic>);
  }

  Future<Transporteur> create(String nom) async {
    final res = await _dio.post('/transporteurs', data: {'nom': nom});
    return Transporteur.fromJson(res.data as Map<String, dynamic>);
  }

  Future<void> setRate(String transporteurId, String destination, double prix) =>
      _dio.post('/transporteurs/$transporteurId/rates', data: {'destination': destination, 'prix': prix});

  Future<void> removeRate(String transporteurId, String rateId) => _dio.delete('/transporteurs/$transporteurId/rates/$rateId');

  /// Moves to the corbeille (reversible) — see [permanentDelete] to erase for good.
  Future<void> remove(String id) => _dio.delete('/transporteurs/$id');

  Future<List<Transporteur>> trash() async {
    final res = await _dio.get('/transporteurs/trash');
    return (res.data as List<dynamic>).map((e) => Transporteur.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> restore(String id) => _dio.post('/transporteurs/$id/restore');

  Future<void> permanentDelete(String id) => _dio.delete('/transporteurs/$id/permanent');
}
