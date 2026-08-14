import 'parsing.dart';

const kOrderStatuses = ['EN_ATTENTE', 'CONFIRMEE', 'PREPARATION', 'PRETE', 'EXPEDIEE', 'LIVREE', 'ANNULEE'];

String orderStatusLabel(String status) {
  switch (status) {
    case 'EN_ATTENTE':
      return 'En attente';
    case 'CONFIRMEE':
      return 'Confirmée';
    case 'PREPARATION':
      return 'En préparation';
    case 'PRETE':
      return 'Prête';
    case 'EXPEDIEE':
      return 'Expédiée';
    case 'LIVREE':
      return 'Livrée';
    case 'ANNULEE':
      return 'Annulée';
    default:
      return status;
  }
}

const kPaymentMethods = ['ESPECES', 'VIREMENT', 'BARIDIMOB', 'LIVRAISON', 'CREDIT'];

String paymentMethodLabel(String method) {
  switch (method) {
    case 'ESPECES':
      return 'Espèces';
    case 'VIREMENT':
      return 'Virement';
    case 'BARIDIMOB':
      return 'BaridiMob';
    case 'LIVRAISON':
      return 'Paiement à la livraison';
    case 'CREDIT':
      return 'Crédit';
    default:
      return method;
  }
}

class OrderItemView {
  OrderItemView({
    required this.productId,
    required this.nom,
    required this.code,
    required this.quantite,
    required this.prixUnitaire,
    required this.sousTotal,
  });

  final String productId;
  final String nom;
  final String code;
  final int quantite;
  final double prixUnitaire;
  final double sousTotal;

  factory OrderItemView.fromJson(Map<String, dynamic> json) => OrderItemView(
        productId: json['productId'] as String,
        nom: json['nom'] as String,
        code: json['code'] as String,
        quantite: json['quantite'] as int,
        prixUnitaire: parseDecimal(json['prixUnitaire']),
        sousTotal: parseDecimal(json['sousTotal']),
      );
}

class OrderView {
  OrderView({
    required this.id,
    required this.reference,
    required this.status,
    required this.paymentMethod,
    this.clientNom,
    this.clientTelephone,
    required this.adresseLivraison,
    required this.telephoneContact,
    this.notes,
    required this.total,
    required this.items,
    required this.createdAt,
  });

  final String id;
  final String reference;
  final String status;
  final String paymentMethod;
  final String? clientNom;
  final String? clientTelephone;
  final String adresseLivraison;
  final String telephoneContact;
  final String? notes;
  final double total;
  final List<OrderItemView> items;
  final DateTime createdAt;

  factory OrderView.fromJson(Map<String, dynamic> json) => OrderView(
        id: json['id'] as String,
        reference: json['reference'] as String,
        status: json['status'] as String,
        paymentMethod: json['paymentMethod'] as String,
        clientNom: json['clientNom'] as String?,
        clientTelephone: json['clientTelephone'] as String?,
        adresseLivraison: json['adresseLivraison'] as String,
        telephoneContact: json['telephoneContact'] as String,
        notes: json['notes'] as String?,
        total: parseDecimal(json['total']),
        items: (json['items'] as List<dynamic>? ?? []).map((e) => OrderItemView.fromJson(e as Map<String, dynamic>)).toList(),
        createdAt: parseDateOrNull(json['createdAt']) ?? DateTime.now(),
      );
}
