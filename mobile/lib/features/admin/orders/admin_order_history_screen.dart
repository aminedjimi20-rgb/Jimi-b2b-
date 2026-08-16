import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/utils/formatters.dart';
import '../../../core/widgets/async_value_widget.dart';
import '../../../models/order.dart';
import '../../../services/service_providers.dart';

final _orderHistoryProvider = FutureProvider.autoDispose.family<List<OrderChangeLogEntry>, String>((ref, orderId) {
  return ref.watch(ordersApiProvider).getHistory(orderId);
});

class AdminOrderHistoryScreen extends ConsumerWidget {
  const AdminOrderHistoryScreen({super.key, required this.orderId, required this.reference});
  final String orderId;
  final String reference;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final history = ref.watch(_orderHistoryProvider(orderId));

    return Scaffold(
      appBar: AppBar(title: Text('Historique · $reference')),
      body: AsyncValueWidget<List<OrderChangeLogEntry>>(
        value: history,
        onRetry: () => ref.invalidate(_orderHistoryProvider(orderId)),
        data: (entries) {
          if (entries.isEmpty) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text('Aucune modification enregistrée pour cette commande.', textAlign: TextAlign.center),
              ),
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: entries.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, i) {
              final entry = entries[i];
              return Card(
                child: ListTile(
                  leading: const Icon(Icons.history),
                  title: Text(entry.summary),
                  subtitle: Text(formatDate(entry.createdAt)),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
