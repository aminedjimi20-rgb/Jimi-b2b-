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
    this.status = 'CONFIRMEE',
    required this.fabricantId,
    required this.fabricantNom,
    this.employeeId,
    this.employeeNom,
    this.numeroBonFournisseur,
    this.notes,
    required this.total,
    required this.totalAchat,
    this.remisePourcentage,
    required this.montantRemise,
    required this.totalApresRemise,
    this.transporteurId,
    this.transporteurNom,
    this.destination,
    this.fraisLivraison = 0,
    required this.montantPaye,
    required this.montantRestant,
    required this.statutPaiement,
    required this.items,
    required this.createdAt,
  });

  final String id;
  final String reference;
  final String status; // BROUILLON | CONFIRMEE | ANNULEE
  final String fabricantId;
  final String fabricantNom;
  final String? employeeId;
  final String? employeeNom;
  final String? numeroBonFournisseur;
  final String? notes;
  final double total;
  final double totalAchat; // sous-total achat AVANT remise
  final double? remisePourcentage;
  final double montantRemise;
  final double totalApresRemise; // montant réellement dû — base du "reste à payer"
  final String? transporteurId;
  final String? transporteurNom;
  final String? destination;
  final double fraisLivraison;
  final double montantPaye;
  final double montantRestant;
  final String statutPaiement;
  final List<StockReceiptItemView> items;
  final DateTime createdAt;

  bool get isBrouillon => status == 'BROUILLON';

  factory StockReceiptView.fromJson(Map<String, dynamic> json) => StockReceiptView(
        id: json['id'] as String,
        reference: json['reference'] as String,
        status: json['status'] as String? ?? 'CONFIRMEE',
        fabricantId: json['fabricantId'] as String,
        fabricantNom: json['fabricantNom'] as String,
        employeeId: json['employeeId'] as String?,
        employeeNom: json['employeeNom'] as String?,
        numeroBonFournisseur: json['numeroBonFournisseur'] as String?,
        notes: json['notes'] as String?,
        total: parseDecimal(json['total']),
        totalAchat: parseDecimal(json['totalAchat']),
        remisePourcentage: json['remisePourcentage'] == null ? null : parseDecimal(json['remisePourcentage']),
        montantRemise: parseDecimal(json['montantRemise']),
        totalApresRemise: json['totalApresRemise'] == null ? parseDecimal(json['totalAchat']) : parseDecimal(json['totalApresRemise']),
        transporteurId: json['transporteurId'] as String?,
        transporteurNom: json['transporteurNom'] as String?,
        destination: json['destination'] as String?,
        fraisLivraison: parseDecimal(json['fraisLivraison']),
        montantPaye: parseDecimal(json['montantPaye']),
        montantRestant: parseDecimal(json['montantRestant']),
        statutPaiement: json['statutPaiement'] as String? ?? 'NON_PAYE',
        items: (json['items'] as List<dynamic>? ?? [])
            .map((e) => StockReceiptItemView.fromJson(e as Map<String, dynamic>))
            .toList(),
        createdAt: parseDateOrNull(json['createdAt']) ?? DateTime.now(),
      );
}
