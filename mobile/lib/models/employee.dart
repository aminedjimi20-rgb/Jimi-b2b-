class EmployeeView {
  EmployeeView({
    required this.id,
    required this.nom,
    this.telephone,
    this.email,
    this.phone,
    this.status,
    this.canSeeClientPhone = false,
    this.canSeeClientAddress = false,
  });

  final String id;
  final String nom;
  final String? telephone;
  final String? email;
  final String? phone;
  final String? status;
  final bool canSeeClientPhone;
  final bool canSeeClientAddress;

  factory EmployeeView.fromJson(Map<String, dynamic> json) => EmployeeView(
        id: json['id'] as String,
        nom: json['nom'] as String,
        telephone: json['telephone'] as String?,
        email: json['email'] as String?,
        phone: json['phone'] as String?,
        status: json['status'] as String?,
        canSeeClientPhone: json['canSeeClientPhone'] as bool? ?? false,
        canSeeClientAddress: json['canSeeClientAddress'] as bool? ?? false,
      );
}
