import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/async_value_widget.dart';
import '../../../models/order.dart';
import '../../../services/service_providers.dart';

// Mirrors OrdersService.NEXT_STATUS on the backend — used only to decide
// which action buttons to show; the backend re-validates the transition
// regardless, so this is a UX shortcut, not a security boundary.
const _nextStatuses = {
  'EN_ATTENTE': ['CONFIRMEE', 'ANNULEE'],
  'CONFIRMEE': ['PREPARATION', 'ANNULEE'],
  'PREPARATION': ['PRETE', 'ANNULEE'],
  'PRETE': ['EXPEDIEE', 'ANNULEE'],
  'EXPEDIEE': ['LIVREE'],
  'LIVREE': <String>[],
  'ANNULEE': <String>[],
};

final _adminOrderProvider = FutureProvider.autoDispose.family<OrderView, String>((ref, id) {
  return ref.watch(ordersApiProvider).getAdmin(id);
});

class AdminOrderDetailScreen extends ConsumerWidget {
  const AdminOrderDetailScreen({super.key, required this.orderId});
  final String orderId;

  Future<void> _updateStatus(BuildContext context, WidgetRef ref, String status) async {
    try {
      await ref.read(ordersApiProvider).updateStatus(orderId, status);
      ref.invalidate(_adminOrderProvider(orderId));
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e is ApiException ? e.message : 'Erreur.')));
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final order = ref.watch(_adminOrderProvider(orderId));

    return Scaffold(
      appBar: AppBar(title: const Text('Détail commande')),
      body: AsyncValueWidget<OrderView>(
        value: order,
        onRetry: () => ref.invalidate(_adminOrderProvider(orderId)),
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
                    const SizedBox(height: 4),
                    Text(orderStatusLabel(o.status), style: const TextStyle(color: AppTheme.primary, fontWeight: FontWeight.w600)),
                    const Divider(height: 24),
                    _InfoRow(label: 'Client', value: o.clientNom ?? '-'),
                    _InfoRow(label: 'Téléphone', value: o.telephoneContact),
                    _InfoRow(label: 'Adresse', value: o.adresseLivraison),
                    _InfoRow(label: 'Paiement', value: paymentMethodLabel(o.paymentMethod)),
                    _InfoRow(label: 'Date', value: formatDate(o.createdAt)),
                    if (o.notes != null && o.notes!.isNotEmpty) _InfoRow(label: 'Notes', value: o.notes!),
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
                          subtitle: Text('${item.code} · Qté: ${item.quantite} × ${formatMoney(item.prixUnitaire)}'),
                          trailing: Text(formatMoney(item.sousTotal), style: const TextStyle(fontWeight: FontWeight.bold)),
                        ))
                    .toList(),
              ),
            ),
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Total', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  Text(formatMoney(o.total), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppTheme.primary)),
                ],
              ),
            ),
            const SizedBox(height: 24),
            if ((_nextStatuses[o.status] ?? []).isNotEmpty) ...[
              Text('Changer le statut', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: (_nextStatuses[o.status] ?? [])
                    .map((s) => s == 'ANNULEE'
                        ? OutlinedButton(
                            style: OutlinedButton.styleFrom(foregroundColor: AppTheme.danger),
                            onPressed: () => _updateStatus(context, ref, s),
                            child: Text('Annuler'),
                          )
                        : ElevatedButton(onPressed: () => _updateStatus(context, ref, s), child: Text(orderStatusLabel(s))))
                    .toList(),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 100, child: Text(label, style: TextStyle(color: Colors.grey[600]))),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }
}
