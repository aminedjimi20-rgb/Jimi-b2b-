import 'package:intl/intl.dart';

final _monthYearFormat = DateFormat('MMMM yyyy', 'fr_FR');
final _dayMonthYearFormat = DateFormat('dd/MM/yyyy', 'fr_FR');

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
    // .toLocal() — dateOf(item) is a raw UTC DateTime from the backend;
    // comparing it against `now` (local) without converting first can
    // misfile items into the wrong day/week near midnight.
    final d = dateOf(item).toLocal();
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

/// French label for a single calendar day — "Aujourd'hui" / "Hier" / dd/MM/yyyy.
String dayLabel(DateTime day) {
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final yesterday = today.subtract(const Duration(days: 1));
  if (day == today) return "Aujourd'hui";
  if (day == yesterday) return 'Hier';
  return _dayMonthYearFormat.format(day);
}

/// Buckets a date-sorted (newest first) list strictly by calendar day (not
/// the coarser week/month buckets of [groupByDateLabel]) — powers a list
/// where "Aujourd'hui" is shown open and every earlier day collapses into
/// its own one-line summary card the user expands individually (see
/// DatedCollapsibleList / points 55-56 of the spec: never render thousands
/// of bons at once, and never lose access to older ones).
List<MapEntry<DateTime, List<T>>> groupByCalendarDay<T>(List<T> items, DateTime Function(T) dateOf) {
  final groups = <DateTime, List<T>>{};
  for (final item in items) {
    final d = dateOf(item).toLocal();
    final day = DateTime(d.year, d.month, d.day);
    groups.putIfAbsent(day, () => []).add(item);
  }
  final entries = groups.entries.toList()..sort((a, b) => b.key.compareTo(a.key));
  return entries;
}
