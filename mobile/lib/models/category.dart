class Category {
  Category({
    required this.id,
    required this.nom,
    this.parentId,
    this.productCount = 0,
    this.visibleToClient = true,
    this.visibleToEmployee = true,
  });

  final String id;
  final String nom;
  final String? parentId;
  final int productCount;
  final bool visibleToClient;
  final bool visibleToEmployee;

  factory Category.fromJson(Map<String, dynamic> json) => Category(
        id: json['id'] as String,
        nom: json['nom'] as String,
        parentId: json['parentId'] as String?,
        productCount: json['productCount'] as int? ?? 0,
        visibleToClient: json['visibleToClient'] as bool? ?? true,
        visibleToEmployee: json['visibleToEmployee'] as bool? ?? true,
      );
}
