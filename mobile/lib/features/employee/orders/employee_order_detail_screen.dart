import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/async_value_widget.dart';
import '../../../core/widgets/photo_gallery_viewer.dart';
import '../../../models/order.dart';
import '../../../services/service_providers.dart';

// An employee only ever prepares — EN_ATTENTE/CONFIRMEE -> PREPARATION -> PRETE.
// Confirming (Admin validates the on-site order), cancelling and shipping stay
// Admin-only; the backend re-validates this regardless (see updateStatusEmployee),
// this is just the corresponding UX shortcut.
const _employeeNextStatus = {
  'CONFIRMEE': 'PREPARATION',
  'PREPARATION': 'PRETE',
};

final _employeeOrderProvider = FutureProvider.autoDispose.family<OrderView, String>((ref, id) {
  return ref.watch(ordersApiProvider).mineOneEmployee(id);
});

class EmployeeOrderDetailScreen extends ConsumerStatefulWidget {
  const EmployeeOrderDetailScreen({super.key, required this.orderId});
  final String orderId;

  @override
  ConsumerState<EmployeeOrderDetailScreen> createState() => _EmployeeOrderDetailScreenState();
}

class _EmployeeOrderDetailScreenState extends ConsumerState<EmployeeOrderDetailScreen> {
  bool _updating = false;

  Future<void> _updateStatus(String status) async {
    setState(() => _updating = true);
    try {
      await ref.read(ordersApiProvider).updateStatusEmployee(widget.orderId, status);
      ref.invalidate(_employeeOrderProvider(widget.orderId));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e is ApiException ? e.message : 'Erreur.')));
      }
    } finally {
      if (mounted) setState(() => _updating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final order = ref.watch(_employeeOrderProvider(widget.orderId));

    return Scaffold(
      appBar: AppBar(title: const Text('Détail commande')),
      body: AsyncValueWidget<OrderView>(
        value: order,
        onRetry: () => ref.invalidate(_employeeOrderProvider(widget.orderId)),
        data: (o) {
          final next = _employeeNextStatus[o.status];
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        o.nom != null && o.nom!.isNotEmpty ? o.nom! : o.reference,
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
                      ),
                      if (o.nom != null && o.nom!.isNotEmpty) Text(o.reference, style: TextStyle(color: Colors.grey[600])),
                      const SizedBox(height: 8),
                      _StatusChip(label: orderStatusLabel(o.status), color: AppTheme.primary),
                      const Divider(height: 24),
                      _InfoRow(label: 'Client', value: o.clientNom ?? '-'),
                      _InfoRow(label: 'Téléphone', value: o.telephoneContact),
                      _InfoRow(label: 'Adresse', value: o.adresseLivraison),
                      _InfoRow(label: 'Paiement', value: paymentMethodLabel(o.paymentMethod)),
                      _InfoRow(label: 'Date', value: formatDate(o.createdAt)),
                      if (o.transporteurNom != null) _InfoRow(label: 'Transporteur', value: o.transporteurNom!),
                      if (o.destination != null && o.destination!.isNotEmpty) _InfoRow(label: 'Destination', value: o.destination!),
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
                            leading: GestureDetector(
                              onTap: item.imageUrl != null ? () => PhotoGalleryViewer.open(context, [item.imageUrl!]) : null,
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(8),
                                child: SizedBox(
                                  width: 44,
                                  height: 44,
                                  child: item.imageUrl != null
                                      ? CachedNetworkImage(imageUrl: item.imageUrl!, fit: BoxFit.cover, errorWidget: (_, __, ___) => const Icon(Icons.inventory_2_outlined))
                                      : const Icon(Icons.inventory_2_outlined),
                                ),
                              ),
                            ),
                            title: Text(item.nom),
                            subtitle: Text('${item.code} · Qté: ${item.quantite}'),
                          ))
                      .toList(),
                ),
              ),
              const SizedBox(height: 16),
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
              if (next != null) ...[
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _updating ? null : () => _updateStatus(next),
                    child: _updating
                        ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : Text('Marquer ${orderStatusLabel(next).toLowerCase()}'),
                  ),
                ),
              ] else if (o.status == 'EN_ATTENTE') ...[
                const SizedBox(height: 24),
                const Text(
                  'En attente de validation par l\'Admin avant préparation.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppTheme.warning),
                ),
              ],
            ],
          );
        },
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

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.label, required this.color});
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
      child: Text(label, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600)),
    );
  }
}
