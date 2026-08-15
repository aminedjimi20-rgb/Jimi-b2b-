import 'package:dio/dio.dart';

import '../models/stock_receipt.dart';

class StockReceiptItemInput {
  StockReceiptItemInput({
    required this.productId,
    required this.cartons,
    required this.unitesParCarton,
    required this.prixVente,
  });

  final String productId;
  final int cartons;
  final int unitesParCarton;
  final double prixVente;

  Map<String, dynamic> toJson() => {
        'productId': productId,
        'cartons': cartons,
        'unitesParCarton': unitesParCarton,
        'prixVente': prixVente,
      };
}

class StockReceiptsApi {
  StockReceiptsApi(this._dio);
  final Dio _dio;

  Future<StockReceiptView> create({
    required String fabricantId,
    required List<StockReceiptItemInput> items,
    String? notes,
  }) async {
    final res = await _dio.post('/stock-receipts', data: {
      'fabricantId': fabricantId,
      'items': items.map((e) => e.toJson()).toList(),
      if (notes != null && notes.isNotEmpty) 'notes': notes,
    });
    return StockReceiptView.fromJson(res.data as Map<String, dynamic>);
  }

  Future<List<StockReceiptView>> list() async {
    final res = await _dio.get('/stock-receipts');
    return (res.data as List<dynamic>).map((e) => StockReceiptView.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<StockReceiptView> getOne(String id) async {
    final res = await _dio.get('/stock-receipts/$id');
    return StockReceiptView.fromJson(res.data as Map<String, dynamic>);
  }
}
