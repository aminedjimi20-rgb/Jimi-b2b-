import 'parsing.dart';

class AppNotification {
  AppNotification({
    required this.id,
    required this.type,
    required this.titre,
    required this.message,
    required this.lu,
    required this.createdAt,
  });

  final String id;
  final String type;
  final String titre;
  final String message;
  final bool lu;
  final DateTime createdAt;

  factory AppNotification.fromJson(Map<String, dynamic> json) => AppNotification(
        id: json['id'] as String,
        type: json['type'] as String,
        titre: json['titre'] as String,
        message: json['message'] as String,
        lu: json['lu'] as bool,
        createdAt: parseDateOrNull(json['createdAt']) ?? DateTime.now(),
      );
}
