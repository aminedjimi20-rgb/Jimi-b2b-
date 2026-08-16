import 'package:dio/dio.dart';

import '../models/price_category.dart';

class PriceCategoriesApi {
  PriceCategoriesApi(this._dio);
  final Dio _dio;

  Future<List<PriceCategory>> list() async {
    final res = await _dio.get('/price-categories');
    return (res.data as List<dynamic>).map((e) => PriceCategory.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<PriceCategory> create(String nom, {bool orderByCarton = false}) async {
    final res = await _dio.post('/price-categories', data: {'nom': nom, 'orderByCarton': orderByCarton});
    return PriceCategory.fromJson(res.data as Map<String, dynamic>);
  }

  Future<PriceCategory> update(String id, {String? nom, bool? orderByCarton}) async {
    final res = await _dio.patch('/price-categories/$id', data: {
      if (nom != null) 'nom': nom,
      if (orderByCarton != null) 'orderByCarton': orderByCarton,
    });
    return PriceCategory.fromJson(res.data as Map<String, dynamic>);
  }

  Future<void> remove(String id) => _dio.delete('/price-categories/$id');
}
