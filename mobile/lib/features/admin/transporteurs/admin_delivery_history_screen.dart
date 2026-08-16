import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/async_value_widget.dart';
import '../../../models/order.dart';
import '../../../models/transporteur.dart';
import '../../../services/service_providers.dart';
import '../orders/admin_order_detail_screen.dart';

class _DeliveryFilters {
  const _DeliveryFilters({this.transporteurId, this.from, this.to});
  final String? transporteurId;
  final DateTime? from;
  final DateTime? to;

  _DeliveryFilters copyWith({String? transporteurId, bool clearTransporteur = false, DateTime? from, DateTime? to, bool clearRange = false}) {
    return _DeliveryFilters(
      transporteurId: clearTransporteur ? null : (transporteurId ?? this.transporteurId),
      from: clearRange ? null : (from ?? this.from),
      to: clearRange ? null : (to ?? this.to),
    );
  }
}

final _filtersProvider = StateProvider.autoDispose<_DeliveryFilters>((ref) => const _DeliveryFilters());

final _transporteursProvider = FutureProvider.autoDispose<List<Transporteur>>((ref) => ref.watch(transporteursApiProvider).list());

final _deliveryHistoryProvider = FutureProvider.autoDispose<List<OrderView>>((ref) {
  final f = ref.watch(_filtersProvider);
  return ref.watch(ordersApiProvider).deliveryHistory(transporteurId: f.transporteurId, from: f.from, to: f.to);
});

/// Historique des livraisons — commandes ayant un transporteur assigné,
/// recherchable par transporteur et par période. Séparé des statistiques de
/// vente : les frais de livraison n'y figurent jamais comme du chiffre d'affaires produits.
class AdminDeliveryHistoryScreen extends ConsumerWidget {
  const AdminDeliveryHistoryScreen({super.key});

  Future<void> _pickRange(BuildContext context, WidgetRef ref) async {
    final now = DateTime.now();
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(now.year - 2),
      lastDate: DateTime(now.year + 1),
    );
    if (picked != null) {
      ref.read(_filtersProvider.notifier).state = ref.read(_filtersProvider).copyWith(from: picked.start, to: picked.end);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orders = ref.watch(_deliveryHistoryProvider);
    final transporteurs = ref.watch(_transporteursProvider);
    final filters = ref.watch(_filtersProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Historique des livraisons')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                transporteurs.when(
                  data: (list) => DropdownButton<String?>(
                    value: filters.transporteurId,
                    hint: const Text('Tous les transporteurs'),
                    items: [
                      const DropdownMenuItem<String?>(value: null, child: Text('Tous les transporteurs')),
                      for (final t in list) DropdownMenuItem<String?>(value: t.id, child: Text(t.nom)),
                    ],
                    onChanged: (v) => ref.read(_filtersProvider.notifier).state = filters.copyWith(transporteurId: v, clearTransporteur: v == null),
                  ),
                  loading: () => const SizedBox.shrink(),
                  error: (_, __) => const SizedBox.shrink(),
                ),
                OutlinedButton.icon(
                  onPressed: () => _pickRange(context, ref),
                  icon: const Icon(Icons.date_range_outlined, size: 18),
                  label: Text(
                    filters.from != null && filters.to != null
                        ? '${formatDate(filters.from!)} → ${formatDate(filters.to!)}'
                        : 'Période',
                  ),
                ),
                if (filters.from != null || filters.transporteurId != null)
                  TextButton(
                    onPressed: () => ref.read(_filtersProvider.notifier).state = const _DeliveryFilters(),
                    child: const Text('Réinitialiser'),
                  ),
              ],
            ),
          ),
          Expanded(
            child: AsyncValueWidget<List<OrderView>>(
              value: orders,
              onRetry: () => ref.invalidate(_deliveryHistoryProvider),
              data: (items) {
                if (items.isEmpty) return const Center(child: Text('Aucune livraison trouvée.'));
                return ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: items.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, i) {
                    final o = items[i];
                    return Card(
                      child: ListTile(
                        leading: const Icon(Icons.local_shipping_outlined),
                        title: Text(o.reference, style: const TextStyle(fontWeight: FontWeight.bold)),
                        subtitle: Text(
                          '${o.clientNom ?? '-'} · ${o.transporteurNom ?? '-'} → ${o.destination ?? '-'}\n${formatDate(o.createdAt)}',
                        ),
                        isThreeLine: true,
                        trailing: Text(formatMoney(o.fraisLivraison), style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primary)),
                        onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => AdminOrderDetailScreen(orderId: o.id))),
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
