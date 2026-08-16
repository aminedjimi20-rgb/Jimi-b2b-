import 'parsing.dart';

class ClientView {
  ClientView({
    required this.id,
    required this.raisonSociale,
    required this.telephone,
    this.adresse,
    this.ville,
    this.email,
    this.phone,
    this.status,
    required this.limiteCredit,
    required this.soldeCredit,
    this.priceCategoryId,
    this.priceCategoryNom,
    this.notesInternes,
  });

  final String id;
  final String raisonSociale;
  final String telephone;
  final String? adresse;
  final String? ville;
  final String? email;
  final String? phone;
  final String? status;
  final double limiteCredit;
  final double soldeCredit;
  final String? priceCategoryId;
  final String? priceCategoryNom;
  final String? notesInternes;

  factory ClientView.fromJson(Map<String, dynamic> json) => ClientView(
        id: json['id'] as String,
        raisonSociale: json['raisonSociale'] as String,
        telephone: json['telephone'] as String,
        adresse: json['adresse'] as String?,
        ville: json['ville'] as String?,
        email: json['email'] as String?,
        phone: json['phone'] as String?,
        status: json['status'] as String?,
        limiteCredit: parseDecimal(json['limiteCredit']),
        soldeCredit: parseDecimal(json['soldeCredit']),
        priceCategoryId: json['priceCategoryId'] as String?,
        priceCategoryNom: json['priceCategoryNom'] as String?,
        notesInternes: json['notesInternes'] as String?,
      );
}
