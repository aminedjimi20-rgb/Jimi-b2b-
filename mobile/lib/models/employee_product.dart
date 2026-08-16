import 'parsing.dart';
import 'product.dart';

/// Product as seen by an EMPLOYEE — real stock (needed to prepare/sell) and
/// the normal sale price, but never prixAchat/marge (Admin-only, same rule
/// as the client's own view).
class EmployeeProduct {
  EmployeeProduct({
    required this.id,
    required this.nom,
    required this.code,
    required this.categoryId,
    this.fabricantNom,
    this.description,
    this.taille,
    this.couleur,
    this.marque,
    required this.prixVente,
    required this.stockReel,
    required this.stockMinimum,
    required this.minCommande,
    this.uniteParCarton,
    required this.estNouveau,
    required this.estSaisonnier,
    required this.estPromo,
    required this.images,
  });

  final String id;
  final String nom;
  final String code;
  final String categoryId;
  final String? fabricantNom;
  final String? description;
  final String? taille;
  final String? couleur;
  final String? marque;
  final double prixVente;
  final int stockReel;
  final int stockMinimum;
  final int minCommande;
  final int? uniteParCarton;
  final bool estNouveau;
  final bool estSaisonnier;
  final bool estPromo;
  final List<ProductImage> images;

  String? get primaryImageUrl {
    if (images.isEmpty) return null;
    return images.firstWhere((i) => i.isPrimary, orElse: () => images.first).url;
  }

  factory EmployeeProduct.fromJson(Map<String, dynamic> json) => EmployeeProduct(
        id: json['id'] as String,
        nom: json['nom'] as String,
        code: json['code'] as String,
        categoryId: json['categoryId'] as String,
        fabricantNom: json['fabricantNom'] as String?,
        description: json['description'] as String?,
        taille: json['taille'] as String?,
        couleur: json['couleur'] as String?,
        marque: json['marque'] as String?,
        prixVente: parseDecimal(json['prixVente']),
        stockReel: json['stockReel'] as int,
        stockMinimum: json['stockMinimum'] as int,
        minCommande: json['minCommande'] as int,
        uniteParCarton: json['uniteParCarton'] as int?,
        estNouveau: json['estNouveau'] as bool? ?? false,
        estSaisonnier: json['estSaisonnier'] as bool? ?? false,
        estPromo: json['estPromo'] as bool? ?? false,
        images: (json['images'] as List<dynamic>? ?? []).map((e) => ProductImage.fromJson(e as Map<String, dynamic>)).toList(),
      );
}
