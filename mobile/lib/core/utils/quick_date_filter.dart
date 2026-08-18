import 'package:flutter/material.dart';

/// The quick period filters offered on the Réceptions fournisseurs and
/// Commandes lists (spec points 54/57) — `custom` covers both "une date
/// précise" (pick the same start/end day) and "une période personnalisée".
enum QuickDateFilter { all, today, yesterday, last7, last30, thisMonth, lastMonth, last3Months, last6Months, lastYear, custom }

extension QuickDateFilterLabel on QuickDateFilter {
  String get label => switch (this) {
        QuickDateFilter.all => 'Tout',
        QuickDateFilter.today => "Aujourd'hui",
        QuickDateFilter.yesterday => 'Hier',
        QuickDateFilter.last7 => '7 derniers jours',
        QuickDateFilter.last30 => '30 derniers jours',
        QuickDateFilter.thisMonth => 'Ce mois',
        QuickDateFilter.lastMonth => 'Mois précédent',
        QuickDateFilter.last3Months => '3 mois',
        QuickDateFilter.last6Months => '6 mois',
        QuickDateFilter.lastYear => '1 an',
        QuickDateFilter.custom => 'Personnalisé',
      };
}

/// [to] is exclusive (the day after the last day included) so callers can
/// compare with a plain `isBefore`. Returns (null, null) for [QuickDateFilter.all].
({DateTime? from, DateTime? to}) quickDateRange(QuickDateFilter filter, {DateTimeRange? custom}) {
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final tomorrow = today.add(const Duration(days: 1));
  switch (filter) {
    case QuickDateFilter.all:
      return (from: null, to: null);
    case QuickDateFilter.today:
      return (from: today, to: tomorrow);
    case QuickDateFilter.yesterday:
      return (from: today.subtract(const Duration(days: 1)), to: today);
    case QuickDateFilter.last7:
      return (from: today.subtract(const Duration(days: 7)), to: tomorrow);
    case QuickDateFilter.last30:
      return (from: today.subtract(const Duration(days: 30)), to: tomorrow);
    case QuickDateFilter.thisMonth:
      return (from: DateTime(now.year, now.month, 1), to: tomorrow);
    case QuickDateFilter.lastMonth:
      return (from: DateTime(now.year, now.month - 1, 1), to: DateTime(now.year, now.month, 1));
    case QuickDateFilter.last3Months:
      return (from: DateTime(now.year, now.month - 3, now.day), to: tomorrow);
    case QuickDateFilter.last6Months:
      return (from: DateTime(now.year, now.month - 6, now.day), to: tomorrow);
    case QuickDateFilter.lastYear:
      return (from: DateTime(now.year - 1, now.month, now.day), to: tomorrow);
    case QuickDateFilter.custom:
      if (custom == null) return (from: null, to: null);
      final start = DateTime(custom.start.year, custom.start.month, custom.start.day);
      final end = DateTime(custom.end.year, custom.end.month, custom.end.day).add(const Duration(days: 1));
      return (from: start, to: end);
  }
}
