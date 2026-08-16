class PriceCategory {
  PriceCategory({required this.id, required this.nom});

  final String id;
  final String nom;

  factory PriceCategory.fromJson(Map<String, dynamic> json) => PriceCategory(
        id: json['id'] as String,
        nom: json['nom'] as String,
      );
}
