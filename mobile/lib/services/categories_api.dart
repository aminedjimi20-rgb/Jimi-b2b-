import 'package:dio/dio.dart';

import '../models/category.dart';

class CategoriesApi {
  CategoriesApi(this._dio);
  final Dio _dio;

  Future<List<Category>> list() async {
    final res = await _dio.get('/categories');
    return (res.data as List<dynamic>).map((e) => Category.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> create(String nom, {String? parentId}) =>
      _dio.post('/categories', data: {'nom': nom, if (parentId != null) 'parentId': parentId});

  Future<void> remove(String id) => _dio.delete('/categories/$id');
}
