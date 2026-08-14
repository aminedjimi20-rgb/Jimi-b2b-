import 'package:dio/dio.dart';

class StockMovementInput {
  StockMovementInput({required this.productId, required this.type, required this.quantite, this.motif});
  final String productId;
  final String type; // ENTREE | SORTIE | RETOUR | AJUSTEMENT
  final int quantite;
  final String? motif;

  Map<String, dynamic> toJson() => {
        'productId': productId,
        'type': type,
        'quantite': quantite,
        if (motif != null && motif!.isNotEmpty) 'motif': motif,
      };
}

class StockApi {
  StockApi(this._dio);
  final Dio _dio;

  Future<void> createMovement(StockMovementInput input) => _dio.post('/stock/movements', data: input.toJson());

  Future<List<dynamic>> history(String productId) async {
    final res = await _dio.get('/stock/movements/$productId');
    return res.data as List<dynamic>;
  }

  Future<List<dynamic>> lowStock() async {
    final res = await _dio.get('/stock/low');
    return res.data as List<dynamic>;
  }
}
