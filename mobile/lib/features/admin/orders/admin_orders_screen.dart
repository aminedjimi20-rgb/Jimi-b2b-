import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/date_grouping.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/async_value_widget.dart';
import '../../../models/order.dart';
import '../../../services/service_providers.dart';
import '../bons_search/admin_bons_search_screen.dart';
import 'admin_create_order_screen.dart';
import 'admin_order_detail_screen.dart';

final _statusFilterProvider = StateProvider.autoDispose<String?>((ref) => null);

final _adminOrdersProvider = FutureProvider.autoDispose<List<OrderView>>((ref) {
  final status = ref.watch(_statusFilterProvider);
  return ref.watch(ordersApiProvider).listAdmin(status: status);
});

class AdminOrdersScreen extends ConsumerStatefulWidget {
  const AdminOrdersScreen({super.key});

  @override
  ConsumerState<AdminOrdersScreen> createState() => _AdminOrdersScreenState();
}

class _AdminOrdersScreenState extends ConsumerState<AdminOrdersScreen> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final orders = ref.watch(_adminOrdersProvider);
    final selectedStatus = ref.watch(_statusFilterProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Commandes'),
        actions: [
          IconButton(
            icon: const Icon(Icons.search),
            tooltip: 'Recherche globale des bons',
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AdminBonsSearchScreen())),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AdminCreateOrderScreen()));
          ref.invalidate(_adminOrdersProvider);
        },
        icon: const Icon(Icons.point_of_sale_outlined),
        label: const Text('Commande comptoir'),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: TextField(
              decoration: const InputDecoration(hintText: 'Rechercher par référence, nom, client...', prefixIcon: Icon(Icons.search), isDense: true),
              onChanged: (v) => setState(() => _query = v.trim().toLowerCase()),
            ),
          ),
          SizedBox(
            height: 48,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              children: [
                _FilterChip(label: 'Toutes', selected: selectedStatus == null, onTap: () => ref.read(_statusFilterProvider.notifier).state = null),
                ...kOrderStatuses.map((s) => _FilterChip(
                      label: orderStatusLabel(s),
                      selected: selectedStatus == s,
                      onTap: () => ref.read(_statusFilterProvider.notifier).state = s,
                    )),
              ],
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async => ref.invalidate(_adminOrdersProvider),
              child: AsyncValueWidget<List<OrderView>>(
                value: orders,
                onRetry: () => ref.invalidate(_adminOrdersProvider),
                data: (items) {
                  final filtered = _query.isEmpty
                      ? items
                      : items
                          .where((o) =>
                              o.reference.toLowerCase().contains(_query) ||
                              (o.nom ?? '').toLowerCase().contains(_query) ||
                              (o.clientNom ?? '').toLowerCase().contains(_query) ||
                              o.telephoneContact.toLowerCase().contains(_query))
                          .toList();
                  if (filtered.isEmpty) {
                    return Center(child: Text(items.isEmpty ? 'Aucune commande.' : 'Aucun résultat pour "$_query".'));
                  }
                  final groups = groupByDateLabel(filtered, (o) => o.createdAt);
                  return ListView(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
                    children: [
                      for (final entry in groups.entries) ...[
                        Padding(
                          padding: const EdgeInsets.only(bottom: 8, top: 4),
                          child: Text(entry.key, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold, color: Colors.grey[700])),
                        ),
                        ...entry.value.map((o) => Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: Card(
                                child: ListTile(
                                  title: Text(
                                    o.nom != null && o.nom!.isNotEmpty ? '${o.nom} (${o.reference})' : o.reference,
                                    style: const TextStyle(fontWeight: FontWeight.bold),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  subtitle: Text('${o.clientNom ?? ''} · ${formatDate(o.createdAt)}'),
                                  trailing: Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    children: [
                                      Text(formatMoney(o.total), style: const TextStyle(fontWeight: FontWeight.bold)),
                                      Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          _PaymentBadge(status: o.statutPaiement),
                                          const SizedBox(width: 4),
                                          _StatusBadge(status: o.status),
                                        ],
                                      ),
                                    ],
                                  ),
                                  onTap: () async {
                                    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => AdminOrderDetailScreen(orderId: o.id)));
                                    ref.invalidate(_adminOrdersProvider);
                                  },
                                ),
                              ),
                            )),
                      ],
                    ],
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({required this.label, required this.selected, required this.onTap});
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(label: Text(label), selected: selected, onSelected: (_) => onTap()),
    );
  }
}

class _PaymentBadge extends StatelessWidget {
  const _PaymentBadge({required this.status});
  final String status;

  Color get _color {
    switch (status) {
      case 'PAYE':
        return AppTheme.success;
      case 'PARTIEL':
        return AppTheme.warning;
      default:
        return AppTheme.danger;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 4),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: _color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
      child: Text(paymentStatusLabel(status), style: TextStyle(color: _color, fontSize: 11, fontWeight: FontWeight.w600)),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.status});
  final String status;

  Color get _color {
    switch (status) {
      case 'LIVREE':
        return AppTheme.success;
      case 'ANNULEE':
        return AppTheme.danger;
      case 'EN_ATTENTE':
        return AppTheme.warning;
      default:
        return AppTheme.primary;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 4),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: _color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
      child: Text(orderStatusLabel(status), style: TextStyle(color: _color, fontSize: 11, fontWeight: FontWeight.w600)),
    );
  }
}
