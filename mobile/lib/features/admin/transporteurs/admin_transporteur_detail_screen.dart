import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/async_value_widget.dart';
import '../../../models/transporteur.dart';
import '../../../services/service_providers.dart';

final _transporteurDetailProvider = FutureProvider.autoDispose.family<Transporteur, String>((ref, id) {
  return ref.watch(transporteursApiProvider).getOne(id);
});

/// Fiche transporteur — gère la liste des tarifs par destination.
class AdminTransporteurDetailScreen extends ConsumerWidget {
  const AdminTransporteurDetailScreen({super.key, required this.transporteurId});
  final String transporteurId;

  void _invalidate(WidgetRef ref) => ref.invalidate(_transporteurDetailProvider(transporteurId));

  Future<void> _addOrEditRate(BuildContext context, WidgetRef ref, {DeliveryRate? existing}) async {
    final destinationController = TextEditingController(text: existing?.destination ?? '');
    final prixController = TextEditingController(text: existing != null ? '${existing.prix}' : '');

    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(existing == null ? 'Nouveau tarif' : 'Modifier le tarif'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: destinationController,
              enabled: existing == null,
              decoration: const InputDecoration(labelText: 'Destination (ville/zone)'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: prixController,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(labelText: 'Prix'),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Annuler')),
          ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Enregistrer')),
        ],
      ),
    );
    if (result != true) return;

    final destination = destinationController.text.trim();
    final prix = double.tryParse(prixController.text);
    if (destination.isEmpty || prix == null) return;

    try {
      await ref.read(transporteursApiProvider).setRate(transporteurId, destination, prix);
      _invalidate(ref);
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e is ApiException ? e.message : 'Erreur.')));
      }
    }
  }

  Future<void> _removeRate(BuildContext context, WidgetRef ref, DeliveryRate rate) async {
    try {
      await ref.read(transporteursApiProvider).removeRate(transporteurId, rate.id);
      _invalidate(ref);
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e is ApiException ? e.message : 'Erreur.')));
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final transporteur = ref.watch(_transporteurDetailProvider(transporteurId));

    return Scaffold(
      appBar: AppBar(title: Text(transporteur.valueOrNull?.nom ?? 'Transporteur')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _addOrEditRate(context, ref),
        icon: const Icon(Icons.add),
        label: const Text('Ajouter un tarif'),
      ),
      body: AsyncValueWidget<Transporteur>(
        value: transporteur,
        onRetry: () => _invalidate(ref),
        data: (t) {
          if (t.rates.isEmpty) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text(
                  'Aucun tarif défini. Ajoutez une destination et son prix — il sera proposé automatiquement lors de la création d\'une commande.',
                  textAlign: TextAlign.center,
                ),
              ),
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
            itemCount: t.rates.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, i) {
              final rate = t.rates[i];
              return Card(
                child: ListTile(
                  leading: const Icon(Icons.place_outlined),
                  title: Text(rate.destination),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(formatMoney(rate.prix), style: const TextStyle(fontWeight: FontWeight.bold)),
                      IconButton(icon: const Icon(Icons.edit_outlined), onPressed: () => _addOrEditRate(context, ref, existing: rate)),
                      IconButton(
                        icon: const Icon(Icons.delete_outline, color: AppTheme.danger),
                        onPressed: () => _removeRate(context, ref, rate),
                      ),
                    ],
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
