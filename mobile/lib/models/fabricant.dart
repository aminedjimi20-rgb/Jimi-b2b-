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
