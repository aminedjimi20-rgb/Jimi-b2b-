import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/async_value_widget.dart';
import '../../../models/order.dart';
import '../../../services/service_providers.dart';
import 'client_order_detail_screen.dart';

final clientOrdersProvider = FutureProvider.autoDispose<List<OrderView>>((ref) {
  return ref.watch(ordersApiProvider).mine();
});

class ClientOrdersScreen extends ConsumerWidget {
  const ClientOrdersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orders = ref.watch(clientOrdersProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Mes commandes')),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(clientOrdersProvider),
        child: AsyncValueWidget<List<OrderView>>(
          value: orders,
          onRetry: () => ref.invalidate(clientOrdersProvider),
          data: (items) {
            if (items.isEmpty) return const Center(child: Text('Vous n\'avez pas encore de commande.'));
            return ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, i) {
                final o = items[i];
                return Card(
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
                          decoration: BoxDecoration(color: AppTheme.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(20)),
                          child: Text(orderStatusLabel(o.status), style: const TextStyle(color: AppTheme.primary, fontSize: 11, fontWeight: FontWeight.w600)),
                        ),
                      ],
                    ),
                    onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => ClientOrderDetailScreen(orderId: o.id))),
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}
