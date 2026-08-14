import 'parsing.dart';

class ProductImage {
  ProductImage({required this.id, required this.url, required this.isPrimary});

  final String id;
  final String url;
  final bool isPrimary;

  factory ProductImage.fromJson(Map<String, dynamic> json) => ProductImage(
        id: json['id'] as String,
        url: json['url'] as String,
        isPrimary: json['isPrimary'] as bool? ?? false,
      );
}

class PriceTier {
  PriceTier({required this.qteMin, this.qteMax, required this.prix});

  final int qteMin;
  final int? qteMax;
  final double prix;

  factory PriceTier.fromJson(Map<String, dynamic> json) => PriceTier(
        qteMin: json['qteMin'] as int,
        qteMax: json['qteMax'] as int?,
        prix: parseDecimal(json['prix']),
      );

  String get label => qteMax == null ? '$qteMin+' : '$qteMin-$qteMax';
}

/// Full product as seen by ADMIN — includes cost/margin/exact stock.
class AdminProduct {
  AdminProduct({
    required this.id,
    required this.nom,
    required this.code,
    required this.categoryId,
    this.description,
    this.taille,
    this.couleur,
    this.marque,
    required this.prixAchat,
    required this.prixVente,
    required this.marge,
    required this.margePourcentage,
    required this.stockReel,
    required this.stockMinimum,
    required this.minCommande,
    required this.actif,
    required this.images,
    required this.priceTiers,
  });

  final String id;
  final String nom;
  final String code;
  final String categoryId;
  final String? description;
  final String? taille;
  final String? couleur;
  final String? marque;
  final double prixAchat;
  final double prixVente;
  final double marge;
  final double margePourcentage;
  final int stockReel;
  final int stockMinimum;
  final int minCommande;
  final bool actif;
  final List<ProductImage> images;
  final List<PriceTier> priceTiers;

  factory AdminProduct.fromJson(Map<String, dynamic> json) => AdminProduct(
        id: json['id'] as String,
        nom: json['nom'] as String,
        code: json['code'] as String,
        categoryId: json['categoryId'] as String,
        description: json['description'] as String?,
        taille: json['taille'] as String?,
        couleur: json['couleur'] as String?,
        marque: json['marque'] as String?,
        prixAchat: parseDecimal(json['prixAchat']),
        prixVente: parseDecimal(json['prixVente']),
        marge: parseDecimal(json['marge']),
        margePourcentage: parseDecimal(json['margePourcentage']),
        stockReel: json['stockReel'] as int,
        stockMinimum: json['stockMinimum'] as int,
        minCommande: json['minCommande'] as int,
        actif: json['actif'] as bool,
        images: (json['images'] as List<dynamic>? ?? []).map((e) => ProductImage.fromJson(e as Map<String, dynamic>)).toList(),
        priceTiers: (json['priceTiers'] as List<dynamic>? ?? []).map((e) => PriceTier.fromJson(e as Map<String, dynamic>)).toList(),
      );
}

/// Product as seen by CLIENT — resolved price for this client only, no
/// cost/margin, derived stock status instead of the real quantity.
class ClientProduct {
  ClientProduct({
    required this.id,
    required this.nom,
    required this.code,
    required this.categoryId,
    this.description,
    this.taille,
    this.couleur,
    this.marque,
    required this.prix,
    required this.prixSource,
    required this.minCommande,
    required this.disponibilite,
    required this.images,
    required this.grilleQuantite,
  });

  final String id;
  final String nom;
  final String code;
  final String categoryId;
  final String? description;
  final String? taille;
  final String? couleur;
  final String? marque;
  final double prix;
  final String prixSource;
  final int minCommande;
  final String disponibilite;
  final List<ProductImage> images;
  final List<PriceTier> grilleQuantite;

  String? get primaryImageUrl {
    if (images.isEmpty) return null;
    return images.firstWhere((i) => i.isPrimary, orElse: () => images.first).url;
  }

  factory ClientProduct.fromJson(Map<String, dynamic> json) => ClientProduct(
        id: json['id'] as String,
        nom: json['nom'] as String,
        code: json['code'] as String,
        categoryId: json['categoryId'] as String,
        description: json['description'] as String?,
        taille: json['taille'] as String?,
        couleur: json['couleur'] as String?,
        marque: json['marque'] as String?,
        prix: parseDecimal(json['prix']),
        prixSource: json['prixSource'] as String,
        minCommande: json['minCommande'] as int,
        disponibilite: json['disponibilite'] as String,
        images: (json['images'] as List<dynamic>? ?? []).map((e) => ProductImage.fromJson(e as Map<String, dynamic>)).toList(),
        grilleQuantite: (json['grilleQuantite'] as List<dynamic>? ?? []).map((e) => PriceTier.fromJson(e as Map<String, dynamic>)).toList(),
      );
}
