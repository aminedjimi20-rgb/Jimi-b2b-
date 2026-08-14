import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/async_value_widget.dart';
import '../../../models/order.dart';
import '../../../services/service_providers.dart';
import 'client_order_detail_screen.dart';

final clientOrdersProvider = FutureProvider.autoDispose<List<OrderView>>((ref) {
  return ref.watch(ordersApiProvider).mine();
});

final _pendingOrdersProvider = FutureProvider.autoDispose<List<({String id, Map<String, dynamic> payload, DateTime createdAt})>>((ref) {
  return ref.watch(appDatabaseProvider).readPendingOrders();
});

class ClientOrdersScreen extends ConsumerWidget {
  const ClientOrdersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orders = ref.watch(clientOrdersProvider);
    final pending = ref.watch(_pendingOrdersProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Mes commandes')),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(clientOrdersProvider);
          ref.invalidate(_pendingOrdersProvider);
        },
        child: AsyncValueWidget<List<OrderView>>(
          value: orders,
          onRetry: () => ref.invalidate(clientOrdersProvider),
          data: (items) {
            final pendingItems = pending.valueOrNull ?? [];
            if (items.isEmpty && pendingItems.isEmpty) {
              return const Center(child: Text('Vous n\'avez pas encore de commande.'));
            }
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                ...pendingItems.map((p) => Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Card(
                        color: AppTheme.warning.withValues(alpha: 0.08),
                        child: ListTile(
                          leading: const Icon(Icons.cloud_off, color: AppTheme.warning),
                          title: Text('Commande en attente d\'envoi (${(p.payload['items'] as List).length} article(s))'),
                          subtitle: Text('Créée le ${formatDate(p.createdAt)} · sera envoyée dès la reconnexion'),
                        ),
                      ),
                    )),
                ...items.map((o) => Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Card(
                        child: ListTile(
                          title: Text(o.reference, style: const TextStyle(fontWeight: FontWeight.bold)),
                          subtitle: Text(formatDate(o.createdAt)),
                          trailing: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(formatMoney(o.total), style: const TextStyle(fontWeight: FontWeight.bold)),
                              Container(
                                margin: const EdgeInsets.only(top: 4),
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration:
                                    BoxDecoration(color: AppTheme.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(20)),
                                child: Text(orderStatusLabel(o.status),
                                    style: const TextStyle(color: AppTheme.primary, fontSize: 11, fontWeight: FontWeight.w600)),
                              ),
                            ],
                          ),
                          onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => ClientOrderDetailScreen(orderId: o.id))),
                        ),
                      ),
                    )),
              ],
            );
          },
        ),
      ),
    );
  }
}
