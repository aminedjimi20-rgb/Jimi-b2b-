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

  Future<void> _editDetails(BuildContext context, WidgetRef ref, Transporteur t) async {
    final chauffeurController = TextEditingController(text: t.chauffeur ?? '');
    final vehiculeController = TextEditingController(text: t.vehicule ?? '');
    final tonnageController = TextEditingController(text: t.tonnage != null ? '${t.tonnage}' : '');

    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Détails du transporteur'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: chauffeurController, decoration: const InputDecoration(labelText: 'Chauffeur (optionnel)')),
            const SizedBox(height: 12),
            TextField(controller: vehiculeController, decoration: const InputDecoration(labelText: 'Véhicule (optionnel)')),
            const SizedBox(height: 12),
            TextField(
              controller: tonnageController,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(labelText: 'Tonnage (optionnel)'),
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

    try {
      await ref.read(transporteursApiProvider).update(
            transporteurId,
            chauffeur: chauffeurController.text.trim().isEmpty ? null : chauffeurController.text.trim(),
            vehicule: vehiculeController.text.trim().isEmpty ? null : vehiculeController.text.trim(),
            tonnage: double.tryParse(tonnageController.text.replaceAll(',', '.')),
          );
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
      appBar: AppBar(
        title: Text(transporteur.valueOrNull?.nom ?? 'Transporteur'),
        actions: [
          transporteur.maybeWhen(
            data: (t) => IconButton(
              icon: const Icon(Icons.edit_outlined),
              tooltip: 'Modifier les détails',
              onPressed: () => _editDetails(context, ref, t),
            ),
            orElse: () => const SizedBox.shrink(),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _addOrEditRate(context, ref),
        icon: const Icon(Icons.add),
        label: const Text('Ajouter un tarif'),
      ),
      body: AsyncValueWidget<Transporteur>(
        value: transporteur,
        onRetry: () => _invalidate(ref),
        data: (t) {
          final hasDetails = (t.chauffeur?.isNotEmpty ?? false) || (t.vehicule?.isNotEmpty ?? false) || t.tonnage != null;
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
            children: [
              if (hasDetails) ...[
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (t.chauffeur != null && t.chauffeur!.isNotEmpty)
                          _DetailRow(icon: Icons.person_outline, label: 'Chauffeur', value: t.chauffeur!),
                        if (t.vehicule != null && t.vehicule!.isNotEmpty)
                          _DetailRow(icon: Icons.local_shipping_outlined, label: 'Véhicule', value: t.vehicule!),
                        if (t.tonnage != null) _DetailRow(icon: Icons.scale_outlined, label: 'Tonnage', value: '${t.tonnage} T'),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
              ],
              Text('Tarifs par destination', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              if (t.rates.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(24),
                  child: Text(
                    'Aucun tarif défini. Ajoutez une destination et son prix — il sera proposé automatiquement lors de la création d\'une commande.',
                    textAlign: TextAlign.center,
                  ),
                )
              else
                for (final rate in t.rates)
                  Card(
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
                  ),
            ],
          );
        },
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.icon, required this.label, required this.value});
  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(icon, size: 18, color: Colors.grey[600]),
          const SizedBox(width: 8),
          Text('$label: ', style: TextStyle(color: Colors.grey[600])),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }
}
