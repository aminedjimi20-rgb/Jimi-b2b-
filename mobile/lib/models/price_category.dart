class PriceCategory {
  PriceCategory({required this.id, required this.nom, this.orderByCarton = false});

  final String id;
  final String nom;
  final bool orderByCarton;

  factory PriceCategory.fromJson(Map<String, dynamic> json) => PriceCategory(
        id: json['id'] as String,
        nom: json['nom'] as String,
        orderByCarton: json['orderByCarton'] as bool? ?? false,
      );
}
