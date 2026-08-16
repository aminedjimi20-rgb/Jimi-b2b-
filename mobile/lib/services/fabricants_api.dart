import 'package:dio/dio.dart';

import '../models/fabricant.dart';

class FabricantsApi {
  FabricantsApi(this._dio);
  final Dio _dio;

  Future<List<Fabricant>> list() async {
    final res = await _dio.get('/fabricants');
    return (res.data as List<dynamic>).map((e) => Fabricant.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<Fabricant> create(String nom, {String? telephone, String? adresse, String? email, String? notesInternes}) async {
    final res = await _dio.post('/fabricants', data: {
      'nom': nom,
      if (telephone != null && telephone.isNotEmpty) 'telephone': telephone,
      if (adresse != null && adresse.isNotEmpty) 'adresse': adresse,
      if (email != null && email.isNotEmpty) 'email': email,
      if (notesInternes != null && notesInternes.isNotEmpty) 'notesInternes': notesInternes,
    });
    return Fabricant.fromJson(res.data as Map<String, dynamic>);
  }

  Future<void> update(String id, {String? nom, String? telephone, String? adresse, String? email, String? notesInternes}) =>
      _dio.patch('/fabricants/$id', data: {
        if (nom != null) 'nom': nom,
        if (telephone != null) 'telephone': telephone,
        if (adresse != null) 'adresse': adresse,
        if (email != null) 'email': email,
        if (notesInternes != null) 'notesInternes': notesInternes,
      });

  Future<FabricantDetail> getOne(String id) async {
    final res = await _dio.get('/fabricants/$id');
    return FabricantDetail.fromJson(res.data as Map<String, dynamic>);
  }

  Future<void> associateProduct(String fabricantId, String productId) =>
      _dio.post('/fabricants/$fabricantId/products/$productId');

  Future<void> dissociateProduct(String fabricantId, String productId) =>
      _dio.delete('/fabricants/$fabricantId/products/$productId');

  /// Moves to the corbeille (reversible) — see [permanentDelete] to erase for good.
  Future<void> remove(String id) => _dio.delete('/fabricants/$id');

  Future<List<Fabricant>> trash() async {
    final res = await _dio.get('/fabricants/trash');
    return (res.data as List<dynamic>).map((e) => Fabricant.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> restore(String id) => _dio.post('/fabricants/$id/restore');

  Future<void> permanentDelete(String id) => _dio.delete('/fabricants/$id/permanent');
}
