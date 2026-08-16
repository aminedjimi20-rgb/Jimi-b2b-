import 'parsing.dart';

const kProductRequestStatuses = ['EN_ATTENTE', 'TRAITEE', 'REJETEE'];

String productRequestStatusLabel(String status) {
  switch (status) {
    case 'TRAITEE':
      return 'Traitée';
    case 'REJETEE':
      return 'Refusée';
    case 'EN_ATTENTE':
    default:
      return 'En attente';
  }
}

class ProductRequestView {
  ProductRequestView({
    required this.id,
    required this.imageUrl,
    this.description,
    required this.status,
    this.adminNote,
    this.clientId,
    this.clientNom,
    this.clientTelephone,
    required this.createdAt,
  });

  final String id;
  final String imageUrl;
  final String? description;
  final String status;
  final String? adminNote;
  final String? clientId;
  final String? clientNom;
  final String? clientTelephone;
  final DateTime createdAt;

  factory ProductRequestView.fromJson(Map<String, dynamic> json) => ProductRequestView(
        id: json['id'] as String,
        imageUrl: json['imageUrl'] as String,
        description: json['description'] as String?,
        status: json['status'] as String? ?? 'EN_ATTENTE',
        adminNote: json['adminNote'] as String?,
        clientId: json['clientId'] as String?,
        clientNom: json['clientNom'] as String?,
        clientTelephone: json['clientTelephone'] as String?,
        createdAt: parseDateOrNull(json['createdAt']) ?? DateTime.now(),
      );
}
