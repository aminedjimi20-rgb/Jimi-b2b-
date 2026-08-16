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

  Future<void> update(String id, {String? nom, bool? visibleToClient, bool? visibleToEmployee}) => _dio.patch('/categories/$id', data: {
        if (nom != null) 'nom': nom,
        if (visibleToClient != null) 'visibleToClient': visibleToClient,
        if (visibleToEmployee != null) 'visibleToEmployee': visibleToEmployee,
      });

  /// Moves to the corbeille (reversible) — see [permanentDelete] to erase for good.
  Future<void> remove(String id) => _dio.delete('/categories/$id');

  Future<List<Category>> trash() async {
    final res = await _dio.get('/categories/trash');
    return (res.data as List<dynamic>).map((e) => Category.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> restore(String id) => _dio.post('/categories/$id/restore');

  Future<void> permanentDelete(String id) => _dio.delete('/categories/$id/permanent');
}
