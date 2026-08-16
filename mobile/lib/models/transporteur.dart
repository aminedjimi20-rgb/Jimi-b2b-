import 'parsing.dart';

class DeliveryRate {
  DeliveryRate({required this.id, required this.destination, required this.prix});

  final String id;
  final String destination;
  final double prix;

  factory DeliveryRate.fromJson(Map<String, dynamic> json) => DeliveryRate(
        id: json['id'] as String,
        destination: json['destination'] as String,
        prix: parseDecimal(json['prix']),
      );
}

class Transporteur {
  Transporteur({required this.id, required this.nom, this.chauffeur, this.vehicule, this.tonnage, this.rates = const []});

  final String id;
  final String nom;
  final String? chauffeur;
  final String? vehicule;
  final double? tonnage;
  final List<DeliveryRate> rates;

  factory Transporteur.fromJson(Map<String, dynamic> json) => Transporteur(
        id: json['id'] as String,
        nom: json['nom'] as String,
        chauffeur: json['chauffeur'] as String?,
        vehicule: json['vehicule'] as String?,
        tonnage: json['tonnage'] == null ? null : parseDecimal(json['tonnage']),
        rates: (json['rates'] as List<dynamic>? ?? []).map((e) => DeliveryRate.fromJson(e as Map<String, dynamic>)).toList(),
      );
}
