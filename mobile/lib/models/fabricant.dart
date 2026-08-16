import 'parsing.dart';

class Fabricant {
  Fabricant({required this.id, required this.nom, this.telephone, this.adresse, this.productCount = 0});

  final String id;
  final String nom;
  final String? telephone;
  final String? adresse;
  final int productCount;

  factory Fabricant.fromJson(Map<String, dynamic> json) => Fabricant(
        id: json['id'] as String,
        nom: json['nom'] as String,
        telephone: json['telephone'] as String?,
        adresse: json['adresse'] as String?,
        productCount: json['productCount'] as int? ?? 0,
      );
}

class FabricantProduct {
  FabricantProduct({
    required this.id,
    required this.nom,
    required this.code,
    required this.prixAchat,
    required this.prixVente,
    required this.stockReel,
    this.imageUrl,
  });

  final String id;
  final String nom;
  final String code;
  final double prixAchat;
  final double prixVente;
  final int stockReel;
  final String? imageUrl;

  factory FabricantProduct.fromJson(Map<String, dynamic> json) => FabricantProduct(
        id: json['id'] as String,
        nom: json['nom'] as String,
        code: json['code'] as String,
        prixAchat: parseDecimal(json['prixAchat']),
        prixVente: parseDecimal(json['prixVente']),
        stockReel: json['stockReel'] as int? ?? 0,
        imageUrl: json['imageUrl'] as String?,
      );
}

class FabricantReceiptSummary {
  FabricantReceiptSummary({
    required this.id,
    required this.reference,
    required this.createdAt,
    required this.totalAchat,
    required this.montantPaye,
    required this.montantRestant,
    required this.statutPaiement,
  });

  final String id;
  final String reference;
  final DateTime createdAt;
  final double totalAchat;
  final double montantPaye;
  final double montantRestant;
  final String statutPaiement;

  factory FabricantReceiptSummary.fromJson(Map<String, dynamic> json) => FabricantReceiptSummary(
        id: json['id'] as String,
        reference: json['reference'] as String,
        createdAt: parseDateOrNull(json['createdAt']) ?? DateTime.now(),
        totalAchat: parseDecimal(json['totalAchat']),
        montantPaye: parseDecimal(json['montantPaye']),
        montantRestant: parseDecimal(json['montantRestant']),
        statutPaiement: json['statutPaiement'] as String? ?? 'NON_PAYE',
      );
}

class FabricantPayment {
  FabricantPayment({required this.id, required this.montant, required this.method, this.stockReceiptId, required this.createdAt});

  final String id;
  final double montant;
  final String method;
  final String? stockReceiptId;
  final DateTime createdAt;

  factory FabricantPayment.fromJson(Map<String, dynamic> json) => FabricantPayment(
        id: json['id'] as String,
        montant: parseDecimal(json['montant']),
        method: json['method'] as String,
        stockReceiptId: json['stockReceiptId'] as String?,
        createdAt: parseDateOrNull(json['createdAt']) ?? DateTime.now(),
      );
}

/// Fiche fournisseur complète — info, articles associés, bons, paiements et totaux.
class FabricantDetail {
  FabricantDetail({
    required this.id,
    required this.nom,
    this.telephone,
    this.adresse,
    required this.createdAt,
    required this.totalAchat,
    required this.totalPaye,
    required this.totalRestant,
    required this.products,
    required this.receipts,
    required this.payments,
  });

  final String id;
  final String nom;
  final String? telephone;
  final String? adresse;
  final DateTime createdAt;
  final double totalAchat;
  final double totalPaye;
  final double totalRestant;
  final List<FabricantProduct> products;
  final List<FabricantReceiptSummary> receipts;
  final List<FabricantPayment> payments;

  factory FabricantDetail.fromJson(Map<String, dynamic> json) => FabricantDetail(
        id: json['id'] as String,
        nom: json['nom'] as String,
        telephone: json['telephone'] as String?,
        adresse: json['adresse'] as String?,
        createdAt: parseDateOrNull(json['createdAt']) ?? DateTime.now(),
        totalAchat: parseDecimal(json['totalAchat']),
        totalPaye: parseDecimal(json['totalPaye']),
        totalRestant: parseDecimal(json['totalRestant']),
        products: (json['products'] as List<dynamic>? ?? []).map((e) => FabricantProduct.fromJson(e as Map<String, dynamic>)).toList(),
        receipts: (json['receipts'] as List<dynamic>? ?? []).map((e) => FabricantReceiptSummary.fromJson(e as Map<String, dynamic>)).toList(),
        payments: (json['payments'] as List<dynamic>? ?? []).map((e) => FabricantPayment.fromJson(e as Map<String, dynamic>)).toList(),
      );
}
