import 'package:dio/dio.dart';

import '../models/fabricant.dart';

class FabricantsApi {
  FabricantsApi(this._dio);
  final Dio _dio;

  Future<List<Fabricant>> list() async {
    final res = await _dio.get('/fabricants');
    return (res.data as List<dynamic>).map((e) => Fabricant.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<Fabricant> create(String nom, {String? telephone, String? adresse}) async {
    final res = await _dio.post('/fabricants', data: {
      'nom': nom,
      if (telephone != null && telephone.isNotEmpty) 'telephone': telephone,
      if (adresse != null && adresse.isNotEmpty) 'adresse': adresse,
    });
    return Fabricant.fromJson(res.data as Map<String, dynamic>);
  }
}
