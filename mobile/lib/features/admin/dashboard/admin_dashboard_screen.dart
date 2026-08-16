import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/async_value_widget.dart';
import '../../../models/stats.dart';
import '../../../services/service_providers.dart';

enum _Period { today, yesterday, week, lastWeek, month, lastMonth, months3, months6, year, lastYear, custom }

extension on _Period {
  String get label => switch (this) {
        _Period.today => "Aujourd'hui",
        _Period.yesterday => 'Hier',
        _Period.week => 'Cette semaine',
        _Period.lastWeek => 'Semaine précédente',
        _Period.month => 'Ce mois',
        _Period.lastMonth => 'Mois précédent',
        _Period.months3 => '3 mois',
        _Period.months6 => '6 mois',
        _Period.year => 'Cette année',
        _Period.lastYear => 'Année précédente',
        _Period.custom => 'Période personnalisée',
      };

  /// [custom] is handled separately (see _customRangeProvider) — this range is unused for it.
  ({DateTime from, DateTime to}) range(DateTime now) {
    final todayStart = DateTime(now.year, now.month, now.day);
    final weekday = now.weekday; // 1 = lundi
    final thisWeekStart = todayStart.subtract(Duration(days: weekday - 1));
    final thisMonthStart = DateTime(now.year, now.month, 1);
    return switch (this) {
      _Period.today => (from: todayStart, to: now),
      _Period.yesterday => (from: todayStart.subtract(const Duration(days: 1)), to: todayStart.subtract(const Duration(seconds: 1))),
      _Period.week => (from: thisWeekStart, to: now),
      _Period.lastWeek => (from: thisWeekStart.subtract(const Duration(days: 7)), to: thisWeekStart.subtract(const Duration(seconds: 1))),
      _Period.month => (from: thisMonthStart, to: now),
      _Period.lastMonth => (
          from: DateTime(now.year, now.month - 1, 1),
          to: thisMonthStart.subtract(const Duration(seconds: 1)),
        ),
      _Period.months3 => (from: DateTime(now.year, now.month - 3, now.day), to: now),
      _Period.months6 => (from: DateTime(now.year, now.month - 6, now.day), to: now),
      _Period.year => (from: DateTime(now.year, 1, 1), to: now),
      _Period.lastYear => (from: DateTime(now.year - 1, 1, 1), to: DateTime(now.year - 1, 12, 31, 23, 59, 59)),
      _Period.custom => (from: todayStart, to: now),
    };
  }
}

final _periodProvider = StateProvider.autoDispose<_Period>((ref) => _Period.week);
final _chartVisibleProvider = StateProvider.autoDispose<bool>((ref) => false);
final _customRangeProvider = StateProvider.autoDispose<DateTimeRange?>((ref) => null);

({DateTime from, DateTime to}) _resolveRange(_Period period, DateTimeRange? custom) {
  if (period == _Period.custom && custom != null) {
    return (from: custom.start, to: DateTime(custom.end.year, custom.end.month, custom.end.day, 23, 59, 59));
  }
  return period.range(DateTime.now());
}

final _dashboardProvider = FutureProvider.autoDispose<DashboardStats>((ref) {
  final period = ref.watch(_periodProvider);
  final custom = ref.watch(_customRangeProvider);
  final range = _resolveRange(period, custom);
  return ref.watch(statsApiProvider).dashboard(from: range.from, to: range.to);
});

/// Same-length period immediately preceding the selected one — e.g. for
/// "7 jours" this is the 7 days before that, giving a like-for-like
/// comparison instead of an arbitrary baseline.
final _previousDashboardProvider = FutureProvider.autoDispose<DashboardStats>((ref) {
  final period = ref.watch(_periodProvider);
  final custom = ref.watch(_customRangeProvider);
  final range = _resolveRange(period, custom);
  final duration = range.to.difference(range.from);
  return ref.watch(statsApiProvider).dashboard(from: range.from.subtract(duration), to: range.from);
});

class AdminDashboardScreen extends ConsumerWidget {
  const AdminDashboardScreen({super.key});

  Future<void> _pickCustomRange(BuildContext context, WidgetRef ref) async {
    final now = DateTime.now();
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(now.year - 5),
      lastDate: now,
      initialDateRange: ref.read(_customRangeProvider) ?? DateTimeRange(start: now.subtract(const Duration(days: 6)), end: now),
    );
    if (picked != null) {
      ref.read(_customRangeProvider.notifier).state = picked;
      ref.read(_periodProvider.notifier).state = _Period.custom;
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final stats = ref.watch(_dashboardProvider);
    final previous = ref.watch(_previousDashboardProvider);
    final period = ref.watch(_periodProvider);
    final customRange = ref.watch(_customRangeProvider);
    final chartVisible = ref.watch(_chartVisibleProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Tableau de bord')),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(_dashboardProvider);
          ref.invalidate(_previousDashboardProvider);
        },
        child: AsyncValueWidget<DashboardStats>(
          value: stats,
          onRetry: () => ref.invalidate(_dashboardProvider),
          data: (d) {
            final prev = previous.valueOrNull;
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                SizedBox(
                  height: 40,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    children: _Period.values
                        .map((p) => Padding(
                              padding: const EdgeInsets.only(right: 8),
                              child: ChoiceChip(
                                label: Text(p == _Period.custom && customRange != null
                                    ? '${formatDate(customRange.start)} → ${formatDate(customRange.end)}'
                                    : p.label),
                                selected: period == p,
                                onSelected: (_) {
                                  if (p == _Period.custom) {
                                    _pickCustomRange(context, ref);
                                  } else {
                                    ref.read(_periodProvider.notifier).state = p;
                                  }
                                },
                              ),
                            ))
                        .toList(),
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: _StatCard(
                        label: "Chiffre d'affaires",
                        value: formatMoney(d.chiffreAffaires),
                        color: AppTheme.primary,
                        change: prev == null ? null : _percentChange(d.chiffreAffaires, prev.chiffreAffaires),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _StatCard(
                        label: 'Bénéfice',
                        value: formatMoney(d.benefice),
                        color: AppTheme.success,
                        change: prev == null ? null : _percentChange(d.benefice, prev.benefice),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(child: _StatCard(label: 'Marge', value: '${d.margePourcentage.toStringAsFixed(1)}%', color: AppTheme.accent)),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _StatCard(
                        label: 'Commandes',
                        value: '${d.nombreCommandes}',
                        color: AppTheme.primary,
                        change: prev == null ? null : _percentChange(d.nombreCommandes.toDouble(), prev.nombreCommandes.toDouble()),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                // Hidden by default — revenue figures shouldn't be visible on
                // screen at a glance (e.g. someone looking over the shoulder).
                OutlinedButton.icon(
                  onPressed: () => ref.read(_chartVisibleProvider.notifier).state = !chartVisible,
                  icon: Icon(chartVisible ? Icons.visibility_off_outlined : Icons.bar_chart_outlined),
                  label: Text(chartVisible ? 'Masquer le graphique' : "Afficher le graphique du chiffre d'affaires"),
                ),
                if (chartVisible) ...[
                  const SizedBox(height: 12),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: _RevenueChart(series: d.series),
                    ),
                  ),
                ],
                const SizedBox(height: 24),
                if (d.stockFaible.isNotEmpty) ...[
                  Text('Stock faible', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  Card(
                    child: Column(
                      children: d.stockFaible
                          .map((p) => ListTile(
                                leading: const Icon(Icons.warning_amber_rounded, color: AppTheme.warning),
                                title: Text(p.nom),
                                subtitle: Text('Code: ${p.code}'),
                                trailing: Text('${p.stockReel} / min ${p.stockMinimum}'),
                              ))
                          .toList(),
                    ),
                  ),
                  const SizedBox(height: 24),
                ],
                Text('Meilleurs produits', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                Card(
                  child: Column(
                    children: d.topProduits.isEmpty
                        ? [const Padding(padding: EdgeInsets.all(16), child: Text('Aucune donnée pour le moment.'))]
                        : d.topProduits
                            .map((p) => ListTile(
                                  title: Text(p.nom),
                                  subtitle: Text('${p.quantite} unités vendues'),
                                  trailing: Text(formatMoney(p.ca)),
                                ))
                            .toList(),
                  ),
                ),
                const SizedBox(height: 24),
                Text('Meilleurs clients', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                Card(
                  child: Column(
                    children: d.topClients.isEmpty
                        ? [const Padding(padding: EdgeInsets.all(16), child: Text('Aucune donnée pour le moment.'))]
                        : d.topClients
                            .map((c) => ListTile(title: Text(c.nom), trailing: Text(formatMoney(c.ca))))
                            .toList(),
                  ),
                ),
                const SizedBox(height: 24),
              ],
            );
          },
        ),
      ),
    );
  }
}

/// null when the previous period had nothing to compare against (avoids a divide-by-zero reading as +∞%).
double? _percentChange(double current, double previous) {
  if (previous == 0) return null;
  return (current - previous) / previous * 100;
}

class _StatCard extends StatelessWidget {
  const _StatCard({required this.label, required this.value, required this.color, this.change});

  final String label;
  final String value;
  final Color color;
  final double? change;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.grey[600])),
            const SizedBox(height: 6),
            Text(value, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold, color: color)),
            if (change != null) ...[
              const SizedBox(height: 4),
              Row(
                children: [
                  Icon(change! >= 0 ? Icons.arrow_upward : Icons.arrow_downward,
                      size: 14, color: change! >= 0 ? AppTheme.success : AppTheme.danger),
                  const SizedBox(width: 2),
                  Text(
                    '${change!.abs().toStringAsFixed(1)}% vs période précédente',
                    style: TextStyle(fontSize: 11, color: change! >= 0 ? AppTheme.success : AppTheme.danger),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _RevenueChart extends StatelessWidget {
  const _RevenueChart({required this.series});
  final List<DashboardSeriesPoint> series;

  @override
  Widget build(BuildContext context) {
    if (series.isEmpty) {
      return const SizedBox(height: 120, child: Center(child: Text('Aucune donnée pour cette période.')));
    }
    final maxValue = series.map((p) => p.chiffreAffaires).reduce((a, b) => a > b ? a : b);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text("Chiffre d'affaires par jour", style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold)),
        const SizedBox(height: 12),
        SizedBox(
          height: 140,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: series
                .map((p) => Expanded(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 2),
                        child: Tooltip(
                          message: '${formatDate(p.date)}\n${formatMoney(p.chiffreAffaires)}',
                          child: FractionallySizedBox(
                            heightFactor: maxValue == 0 ? 0 : (p.chiffreAffaires / maxValue).clamp(0.02, 1.0),
                            alignment: Alignment.bottomCenter,
                            child: Container(
                              decoration: BoxDecoration(
                                color: AppTheme.primary.withValues(alpha: 0.8),
                                borderRadius: const BorderRadius.vertical(top: Radius.circular(3)),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ))
                .toList(),
          ),
        ),
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(formatDate(series.first.date), style: TextStyle(fontSize: 11, color: Colors.grey[600])),
            Text(formatDate(series.last.date), style: TextStyle(fontSize: 11, color: Colors.grey[600])),
          ],
        ),
      ],
    );
  }
}
