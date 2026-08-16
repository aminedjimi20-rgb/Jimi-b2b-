import 'parsing.dart';

class TopProductStat {
  TopProductStat({required this.productId, required this.nom, required this.quantite, required this.ca});
  final String productId;
  final String nom;
  final int quantite;
  final double ca;

  factory TopProductStat.fromJson(Map<String, dynamic> json) => TopProductStat(
        productId: json['productId'] as String,
        nom: json['nom'] as String,
        quantite: json['quantite'] as int,
        ca: parseDecimal(json['ca']),
      );
}

class TopClientStat {
  TopClientStat({required this.clientId, required this.nom, required this.ca});
  final String clientId;
  final String nom;
  final double ca;

  factory TopClientStat.fromJson(Map<String, dynamic> json) => TopClientStat(
        clientId: json['clientId'] as String,
        nom: json['nom'] as String,
        ca: parseDecimal(json['ca']),
      );
}

class LowStockItem {
  LowStockItem({required this.id, required this.nom, required this.code, required this.stockReel, required this.stockMinimum});
  final String id;
  final String nom;
  final String code;
  final int stockReel;
  final int stockMinimum;

  factory LowStockItem.fromJson(Map<String, dynamic> json) => LowStockItem(
        id: json['id'] as String,
        nom: json['nom'] as String,
        code: json['code'] as String,
        stockReel: json['stockReel'] as int,
        stockMinimum: json['stockMinimum'] as int,
      );
}

class DashboardSeriesPoint {
  DashboardSeriesPoint({required this.date, required this.chiffreAffaires});
  final DateTime date;
  final double chiffreAffaires;

  factory DashboardSeriesPoint.fromJson(Map<String, dynamic> json) => DashboardSeriesPoint(
        date: DateTime.parse(json['date'] as String),
        chiffreAffaires: parseDecimal(json['chiffreAffaires']),
      );
}

class DashboardStats {
  DashboardStats({
    required this.chiffreAffaires,
    required this.benefice,
    required this.margePourcentage,
    required this.nombreCommandes,
    required this.series,
    required this.topProduits,
    required this.topClients,
    required this.stockFaible,
  });

  final double chiffreAffaires;
  final double benefice;
  final double margePourcentage;
  final int nombreCommandes;
  final List<DashboardSeriesPoint> series;
  final List<TopProductStat> topProduits;
  final List<TopClientStat> topClients;
  final List<LowStockItem> stockFaible;

  factory DashboardStats.fromJson(Map<String, dynamic> json) => DashboardStats(
        chiffreAffaires: parseDecimal(json['chiffreAffaires']),
        benefice: parseDecimal(json['benefice']),
        margePourcentage: parseDecimal(json['margePourcentage']),
        nombreCommandes: json['nombreCommandes'] as int,
        series: (json['series'] as List<dynamic>? ?? []).map((e) => DashboardSeriesPoint.fromJson(e as Map<String, dynamic>)).toList(),
        topProduits: (json['topProduits'] as List<dynamic>? ?? []).map((e) => TopProductStat.fromJson(e as Map<String, dynamic>)).toList(),
        topClients: (json['topClients'] as List<dynamic>? ?? []).map((e) => TopClientStat.fromJson(e as Map<String, dynamic>)).toList(),
        stockFaible: (json['stockFaible'] as List<dynamic>? ?? []).map((e) => LowStockItem.fromJson(e as Map<String, dynamic>)).toList(),
      );
}
