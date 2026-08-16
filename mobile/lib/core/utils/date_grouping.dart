import 'package:intl/intl.dart';

final _monthYearFormat = DateFormat('MMMM yyyy', 'fr_FR');

/// Groups a date-sorted (newest first) list under French section headers —
/// "Aujourd'hui" / "Hier" / "Cette semaine" / "Ce mois-ci" / "Mois Année"
/// for anything older. Used to turn a flat "bons" history into a dated,
/// scannable list (see AdminOrdersScreen / AdminStockReceiptsScreen).
Map<String, List<T>> groupByDateLabel<T>(List<T> items, DateTime Function(T) dateOf) {
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final yesterday = today.subtract(const Duration(days: 1));
  final weekStart = today.subtract(const Duration(days: 7));
  final monthStart = DateTime(now.year, now.month, 1);

  final groups = <String, List<T>>{};
  for (final item in items) {
    final d = dateOf(item);
    final day = DateTime(d.year, d.month, d.day);
    final String label;
    if (day == today) {
      label = "Aujourd'hui";
    } else if (day == yesterday) {
      label = 'Hier';
    } else if (day.isAfter(weekStart)) {
      label = 'Cette semaine';
    } else if (day.isAfter(monthStart) || day == monthStart) {
      label = 'Ce mois-ci';
    } else {
      final formatted = _monthYearFormat.format(d);
      label = formatted[0].toUpperCase() + formatted.substring(1);
    }
    groups.putIfAbsent(label, () => []).add(item);
  }
  return groups;
}
