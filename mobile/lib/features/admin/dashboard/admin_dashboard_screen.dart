import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/async_value_widget.dart';
import '../../../models/stats.dart';
import '../../../services/service_providers.dart';

final _dashboardProvider = FutureProvider.autoDispose<DashboardStats>((ref) {
  return ref.watch(statsApiProvider).dashboard();
});

class AdminDashboardScreen extends ConsumerWidget {
  const AdminDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final stats = ref.watch(_dashboardProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Tableau de bord')),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(_dashboardProvider),
        child: AsyncValueWidget<DashboardStats>(
          value: stats,
          onRetry: () => ref.invalidate(_dashboardProvider),
          data: (d) => ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Row(
                children: [
                  Expanded(child: _StatCard(label: "Chiffre d'affaires", value: formatMoney(d.chiffreAffaires), color: AppTheme.primary)),
                  const SizedBox(width: 12),
                  Expanded(child: _StatCard(label: 'Bénéfice', value: formatMoney(d.benefice), color: AppTheme.success)),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(child: _StatCard(label: 'Marge', value: '${d.margePourcentage.toStringAsFixed(1)}%', color: AppTheme.accent)),
                  const SizedBox(width: 12),
                  Expanded(child: _StatCard(label: 'Commandes', value: '${d.nombreCommandes}', color: AppTheme.primary)),
                ],
              ),
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
          ),
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({required this.label, required this.value, required this.color});

  final String label;
  final String value;
  final Color color;

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
          ],
        ),
      ),
    );
  }
}
