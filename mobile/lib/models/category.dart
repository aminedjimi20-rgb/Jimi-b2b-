class Category {
  Category({required this.id, required this.nom, this.parentId});

  final String id;
  final String nom;
  final String? parentId;

  factory Category.fromJson(Map<String, dynamic> json) => Category(
        id: json['id'] as String,
        nom: json['nom'] as String,
        parentId: json['parentId'] as String?,
      );
}
