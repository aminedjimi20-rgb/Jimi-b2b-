import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/async_value_widget.dart';
import '../../../models/product_request.dart';
import '../../../services/service_providers.dart';

final _statusFilterProvider = StateProvider.autoDispose<String?>((ref) => 'EN_ATTENTE');

final _adminRequestsProvider = FutureProvider.autoDispose<List<ProductRequestView>>((ref) {
  final status = ref.watch(_statusFilterProvider);
  return ref.watch(productRequestsApiProvider).listAdmin(status: status);
});

Color _statusColor(String status) {
  switch (status) {
    case 'TRAITEE':
      return AppTheme.success;
    case 'REJETEE':
      return AppTheme.danger;
    default:
      return AppTheme.warning;
  }
}

Future<void> _showResolveDialog(BuildContext context, WidgetRef ref, ProductRequestView r, String status) async {
  final noteController = TextEditingController();
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(status == 'TRAITEE' ? 'Marquer comme traitée' : 'Refuser la demande'),
      content: TextField(
        controller: noteController,
        decoration: const InputDecoration(labelText: 'Note pour le client (optionnel)'),
        maxLines: 3,
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Annuler')),
        ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Confirmer')),
      ],
    ),
  );
  if (confirmed != true) return;

  try {
    await ref.read(productRequestsApiProvider).updateStatus(r.id, status, adminNote: noteController.text.trim());
    ref.invalidate(_adminRequestsProvider);
  } catch (e) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e is ApiException ? e.message : 'Erreur.')));
    }
  }
}

/// Admin review queue for clients' "demander un produit" photos — see
/// ClientRequestProductScreen on the mobile side / ProductRequestsService
/// on the backend for the full flow.
class AdminProductRequestsScreen extends ConsumerWidget {
  const AdminProductRequestsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final requests = ref.watch(_adminRequestsProvider);
    final selectedStatus = ref.watch(_statusFilterProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Demandes de produits')),
      body: Column(
        children: [
          SizedBox(
            height: 48,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              children: [
                _FilterChip(label: 'Toutes', selected: selectedStatus == null, onTap: () => ref.read(_statusFilterProvider.notifier).state = null),
                ...kProductRequestStatuses.map((s) => _FilterChip(
                      label: productRequestStatusLabel(s),
                      selected: selectedStatus == s,
                      onTap: () => ref.read(_statusFilterProvider.notifier).state = s,
                    )),
              ],
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async => ref.invalidate(_adminRequestsProvider),
              child: AsyncValueWidget<List<ProductRequestView>>(
                value: requests,
                onRetry: () => ref.invalidate(_adminRequestsProvider),
                data: (items) {
                  if (items.isEmpty) return const Center(child: Text('Aucune demande.'));
                  return ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: items.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (context, i) {
                      final r = items[i];
                      return Card(
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  ClipRRect(
                                    borderRadius: BorderRadius.circular(8),
                                    child: CachedNetworkImage(imageUrl: r.imageUrl, width: 72, height: 72, fit: BoxFit.cover),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(r.clientNom ?? '-', style: const TextStyle(fontWeight: FontWeight.bold)),
                                        Text(r.clientTelephone ?? '-', style: TextStyle(color: Colors.grey[600], fontSize: 12)),
                                        if (r.description != null && r.description!.isNotEmpty) Text(r.description!),
                                        Text(formatDate(r.createdAt), style: TextStyle(color: Colors.grey[600], fontSize: 12)),
                                      ],
                                    ),
                                  ),
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                        decoration: BoxDecoration(
                                            color: _statusColor(r.status).withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
                                        child: Text(productRequestStatusLabel(r.status),
                                            style: TextStyle(color: _statusColor(r.status), fontSize: 11, fontWeight: FontWeight.w600)),
                                      ),
                                      IconButton(
                                        icon: const Icon(Icons.delete_outline, size: 20),
                                        tooltip: 'Supprimer',
                                        onPressed: () async {
                                          await ref.read(productRequestsApiProvider).remove(r.id);
                                          ref.invalidate(_adminRequestsProvider);
                                        },
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                              if (r.status == 'EN_ATTENTE') ...[
                                const SizedBox(height: 8),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.end,
                                  children: [
                                    TextButton(
                                      onPressed: () => _showResolveDialog(context, ref, r, 'REJETEE'),
                                      style: TextButton.styleFrom(foregroundColor: AppTheme.danger),
                                      child: const Text('Refuser'),
                                    ),
                                    const SizedBox(width: 8),
                                    ElevatedButton(
                                      onPressed: () => _showResolveDialog(context, ref, r, 'TRAITEE'),
                                      child: const Text('Traiter'),
                                    ),
                                  ],
                                ),
                              ] else if (r.adminNote != null && r.adminNote!.isNotEmpty) ...[
                                const Divider(height: 16),
                                Text('Note: ${r.adminNote}', style: TextStyle(color: Colors.grey[700], fontStyle: FontStyle.italic)),
                              ],
                            ],
                          ),
                        ),
                      );
                    },
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
