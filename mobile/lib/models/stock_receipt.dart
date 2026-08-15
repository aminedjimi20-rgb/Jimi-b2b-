import 'parsing.dart';

class StockReceiptItemView {
  StockReceiptItemView({
    required this.productId,
    required this.nom,
    required this.code,
    this.imageUrl,
    required this.cartons,
    required this.unitesParCarton,
    required this.quantite,
    required this.prixAchat,
    required this.prixVente,
    required this.sousTotalAchat,
    required this.sousTotal,
  });

  final String productId;
  final String nom;
  final String code;
  final String? imageUrl;
  final int cartons;
  final int unitesParCarton;
  final int quantite;
  final double prixAchat;
  final double prixVente;
  final double sousTotalAchat;
  final double sousTotal;

  factory StockReceiptItemView.fromJson(Map<String, dynamic> json) => StockReceiptItemView(
        productId: json['productId'] as String,
        nom: json['nom'] as String,
        code: json['code'] as String,
        imageUrl: json['imageUrl'] as String?,
        cartons: json['cartons'] as int,
        unitesParCarton: json['unitesParCarton'] as int,
        quantite: json['quantite'] as int,
        prixAchat: parseDecimal(json['prixAchat']),
        prixVente: parseDecimal(json['prixVente']),
        sousTotalAchat: parseDecimal(json['sousTotalAchat']),
        sousTotal: parseDecimal(json['sousTotal']),
      );
}

class StockReceiptView {
  StockReceiptView({
    required this.id,
    required this.reference,
    required this.fabricantId,
    required this.fabricantNom,
    this.notes,
    required this.total,
    required this.totalAchat,
    required this.items,
    required this.createdAt,
  });

  final String id;
  final String reference;
  final String fabricantId;
  final String fabricantNom;
  final String? notes;
  final double total;
  final double totalAchat;
  final List<StockReceiptItemView> items;
  final DateTime createdAt;

  factory StockReceiptView.fromJson(Map<String, dynamic> json) => StockReceiptView(
        id: json['id'] as String,
        reference: json['reference'] as String,
        fabricantId: json['fabricantId'] as String,
        fabricantNom: json['fabricantNom'] as String,
        notes: json['notes'] as String?,
        total: parseDecimal(json['total']),
        totalAchat: parseDecimal(json['totalAchat']),
        items: (json['items'] as List<dynamic>? ?? [])
            .map((e) => StockReceiptItemView.fromJson(e as Map<String, dynamic>))
            .toList(),
        createdAt: parseDateOrNull(json['createdAt']) ?? DateTime.now(),
      );
}
