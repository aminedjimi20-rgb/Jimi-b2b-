import 'package:dio/dio.dart';

import '../models/stock_receipt.dart';

class StockReceiptItemInput {
  StockReceiptItemInput({
    required this.productId,
    required this.cartons,
    required this.unitesParCarton,
    required this.prixAchat,
    required this.prixVente,
  });

  final String productId;
  final int cartons;
  final int unitesParCarton;
  final double prixAchat;
  final double prixVente;

  Map<String, dynamic> toJson() => {
        'productId': productId,
        'cartons': cartons,
        'unitesParCarton': unitesParCarton,
        'prixAchat': prixAchat,
        'prixVente': prixVente,
      };
}

/// No prixVente — a bon d'entrée created by an Employee is purchase-only
/// (see Phase 24/38), the sale price is always derived server-side.
class BonEntreeItemInput {
  BonEntreeItemInput({required this.productId, required this.cartons, required this.unitesParCarton, required this.prixAchat});

  final String productId;
  final int cartons;
  final int unitesParCarton;
  final double prixAchat;

  Map<String, dynamic> toJson() => {
        'productId': productId,
        'cartons': cartons,
        'unitesParCarton': unitesParCarton,
        'prixAchat': prixAchat,
      };
}

class StockReceiptChangeLogEntry {
  StockReceiptChangeLogEntry({required this.id, required this.summary, required this.createdAt});

  final String id;
  final String summary;
  final DateTime createdAt;

  factory StockReceiptChangeLogEntry.fromJson(Map<String, dynamic> json) => StockReceiptChangeLogEntry(
        id: json['id'] as String,
        summary: json['summary'] as String,
        createdAt: DateTime.parse(json['createdAt'] as String),
      );
}

class StockReceiptsApi {
  StockReceiptsApi(this._dio);
  final Dio _dio;

  // ── ADMIN ────────────────────────────────────────────────────────────

  Future<StockReceiptView> create({
    required String fabricantId,
    required List<StockReceiptItemInput> items,
    String? notes,
    double? remisePourcentage,
  }) async {
    final res = await _dio.post('/stock-receipts', data: {
      'fabricantId': fabricantId,
      'items': items.map((e) => e.toJson()).toList(),
      if (notes != null && notes.isNotEmpty) 'notes': notes,
      if (remisePourcentage != null && remisePourcentage > 0) 'remisePourcentage': remisePourcentage,
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

  Future<StockReceiptView> adminEdit(String id, Map<String, dynamic> payload) async {
    final res = await _dio.patch('/stock-receipts/$id/admin-edit', data: payload);
    return StockReceiptView.fromJson(res.data as Map<String, dynamic>);
  }

  Future<List<StockReceiptChangeLogEntry>> getHistory(String id) async {
    final res = await _dio.get('/stock-receipts/$id/history');
    return (res.data as List<dynamic>).map((e) => StockReceiptChangeLogEntry.fromJson(e as Map<String, dynamic>)).toList();
  }

  /// Admin confirms a draft created by an Employee — same BROUILLON → CONFIRMEE transition.
  Future<StockReceiptView> confirmForAdmin(String id, {double? montantPaye, String? method}) async {
    final res = await _dio.post('/stock-receipts/$id/confirm', data: {
      if (montantPaye != null && montantPaye > 0) 'montantPaye': montantPaye,
      if (method != null) 'method': method,
    });
    return StockReceiptView.fromJson(res.data as Map<String, dynamic>);
  }

  /// Moves to the corbeille (reversible) — see [permanentDelete] to erase for good.
  Future<void> remove(String id) => _dio.delete('/stock-receipts/$id');

  Future<List<StockReceiptView>> trash() async {
    final res = await _dio.get('/stock-receipts/trash');
    return (res.data as List<dynamic>).map((e) => StockReceiptView.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> restore(String id) => _dio.post('/stock-receipts/$id/restore');

  Future<void> permanentDelete(String id) => _dio.delete('/stock-receipts/$id/permanent');

  // ── EMPLOYEE ─────────────────────────────────────────────────────────
  // Bon d'entrée (Phase 38) — BROUILLON tant que non confirmé, jamais
  // d'effet sur le stock/le solde fournisseur avant confirmDraft().

  Future<StockReceiptView> createDraft({
    required String fabricantId,
    required List<BonEntreeItemInput> items,
    String? numeroBonFournisseur,
    String? notes,
    double? remisePourcentage,
    String? transporteurId,
    String? destination,
    double? fraisLivraison,
  }) async {
    final res = await _dio.post('/stock-receipts/staff', data: {
      'fabricantId': fabricantId,
      'items': items.map((e) => e.toJson()).toList(),
      if (numeroBonFournisseur != null && numeroBonFournisseur.isNotEmpty) 'numeroBonFournisseur': numeroBonFournisseur,
      if (notes != null && notes.isNotEmpty) 'notes': notes,
      if (remisePourcentage != null && remisePourcentage > 0) 'remisePourcentage': remisePourcentage,
      if (transporteurId != null) 'transporteurId': transporteurId,
      if (destination != null && destination.isNotEmpty) 'destination': destination,
      if (fraisLivraison != null) 'fraisLivraison': fraisLivraison,
    });
    return StockReceiptView.fromJson(res.data as Map<String, dynamic>);
  }

  Future<StockReceiptView> updateDraft(
    String id, {
    required String fabricantId,
    required List<BonEntreeItemInput> items,
    String? numeroBonFournisseur,
    String? notes,
    double? remisePourcentage,
    String? transporteurId,
    String? destination,
    double? fraisLivraison,
  }) async {
    final res = await _dio.patch('/stock-receipts/staff/$id', data: {
      'fabricantId': fabricantId,
      'items': items.map((e) => e.toJson()).toList(),
      if (numeroBonFournisseur != null && numeroBonFournisseur.isNotEmpty) 'numeroBonFournisseur': numeroBonFournisseur,
      if (notes != null && notes.isNotEmpty) 'notes': notes,
      if (remisePourcentage != null && remisePourcentage > 0) 'remisePourcentage': remisePourcentage,
      if (transporteurId != null) 'transporteurId': transporteurId,
      if (destination != null && destination.isNotEmpty) 'destination': destination,
      if (fraisLivraison != null) 'fraisLivraison': fraisLivraison,
    });
    return StockReceiptView.fromJson(res.data as Map<String, dynamic>);
  }

  Future<List<StockReceiptView>> findMine() async {
    final res = await _dio.get('/stock-receipts/staff/mine');
    return (res.data as List<dynamic>).map((e) => StockReceiptView.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<StockReceiptView> findMineOne(String id) async {
    final res = await _dio.get('/stock-receipts/staff/mine/$id');
    return StockReceiptView.fromJson(res.data as Map<String, dynamic>);
  }

  /// BROUILLON → CONFIRMEE — c'est ici, et seulement ici, que le stock/coût/paiement sont appliqués.
  Future<StockReceiptView> confirmDraft(String id, {double? montantPaye, String? method}) async {
    final res = await _dio.post('/stock-receipts/staff/$id/confirm', data: {
      if (montantPaye != null && montantPaye > 0) 'montantPaye': montantPaye,
      if (method != null) 'method': method,
    });
    return StockReceiptView.fromJson(res.data as Map<String, dynamic>);
  }

  /// Only if the Admin granted canModifierBonApresConfirmation.
  Future<StockReceiptView> editConfirmed(String id, Map<String, dynamic> payload) async {
    final res = await _dio.patch('/stock-receipts/staff/$id/edit-confirmed', data: payload);
    return StockReceiptView.fromJson(res.data as Map<String, dynamic>);
  }

  /// Annule un brouillon — jamais appliqué au stock, rien à reverser.
  Future<void> cancelDraft(String id) => _dio.delete('/stock-receipts/staff/$id');
}
