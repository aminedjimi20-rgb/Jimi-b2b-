import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/async_value_widget.dart';
import '../../../models/order.dart';
import '../../../services/service_providers.dart';
import 'client_orders_screen.dart';

final _clientOrderProvider = FutureProvider.autoDispose.family<OrderView, String>((ref, id) {
  return ref.watch(ordersApiProvider).mineOne(id);
});

class ClientOrderDetailScreen extends ConsumerWidget {
  const ClientOrderDetailScreen({super.key, required this.orderId});
  final String orderId;

  Future<void> _reorder(BuildContext context, WidgetRef ref) async {
    try {
      final newOrder = await ref.read(ordersApiProvider).reorder(orderId);
      ref.invalidate(clientOrdersProvider);
      if (context.mounted) {
        Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => ClientOrderDetailScreen(orderId: newOrder.id)));
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e is ApiException ? e.message : 'Erreur.')));
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final order = ref.watch(_clientOrderProvider(orderId));

    return Scaffold(
      appBar: AppBar(title: const Text('Ma commande')),
      body: AsyncValueWidget<OrderView>(
        value: order,
        onRetry: () => ref.invalidate(_clientOrderProvider(orderId)),
        data: (o) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(o.reference, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    _StatusTimeline(currentStatus: o.status),
                    const Divider(height: 24),
                    _Row(label: 'Adresse', value: o.adresseLivraison),
                    _Row(label: 'Téléphone', value: o.telephoneContact),
                    _Row(label: 'Paiement', value: paymentMethodLabel(o.paymentMethod)),
                    _Row(label: 'Date', value: formatDate(o.createdAt)),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text('Articles', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Card(
              child: Column(
                children: o.items
                    .map((item) => ListTile(
                          title: Text(item.nom),
                          subtitle: Text('Qté: ${item.quantite} × ${formatMoney(item.prixUnitaire)}'),
                          trailing: Text(formatMoney(item.sousTotal), style: const TextStyle(fontWeight: FontWeight.bold)),
                        ))
                    .toList(),
              ),
            ),
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Column(
                children: [
                  if (o.fraisLivraison > 0)
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [const Text('Frais de livraison'), Text(formatMoney(o.fraisLivraison))],
                    ),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Total', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                      Text(formatMoney(o.total), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppTheme.primary)),
                    ],
                  ),
                  if (o.montantPaye > 0)
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [const Text('Payé'), Text(formatMoney(o.montantPaye), style: const TextStyle(color: AppTheme.success))],
                    ),
                  if (o.montantRestant > 0)
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [const Text('Reste à payer'), Text(formatMoney(o.montantRestant), style: const TextStyle(color: AppTheme.danger))],
                    ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            OutlinedButton.icon(
              onPressed: () => _reorder(context, ref),
              icon: const Icon(Icons.replay),
              label: const Text('Commander à nouveau'),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatusTimeline extends StatelessWidget {
  const _StatusTimeline({required this.currentStatus});
  final String currentStatus;

  static const _steps = ['EN_ATTENTE', 'CONFIRMEE', 'PREPARATION', 'PRETE', 'EXPEDIEE', 'LIVREE'];

  @override
  Widget build(BuildContext context) {
    if (currentStatus == 'ANNULEE') {
      return const Text('Commande annulée', style: TextStyle(color: AppTheme.danger, fontWeight: FontWeight.bold));
    }
    final currentIndex = _steps.indexOf(currentStatus);
    return Row(
      children: _steps.asMap().entries.map((entry) {
        final done = entry.key <= currentIndex;
        return Expanded(
          child: Column(
            children: [
              Container(
                width: 12,
                height: 12,
                decoration: BoxDecoration(shape: BoxShape.circle, color: done ? AppTheme.success : Colors.grey.shade300),
              ),
              const SizedBox(height: 4),
              Text(orderStatusLabel(entry.value), style: TextStyle(fontSize: 9, color: done ? AppTheme.success : Colors.grey), textAlign: TextAlign.center),
            ],
          ),
        );
      }).toList(),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 90, child: Text(label, style: TextStyle(color: Colors.grey[600]))),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }
}
