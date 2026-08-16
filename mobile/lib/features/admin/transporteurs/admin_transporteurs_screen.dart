import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/async_value_widget.dart';
import '../../../models/transporteur.dart';
import '../../../services/service_providers.dart';
import 'admin_transporteur_detail_screen.dart';

final adminTransporteursProvider = FutureProvider.autoDispose<List<Transporteur>>((ref) {
  return ref.watch(transporteursApiProvider).list();
});

Future<Transporteur?> showCreateTransporteurDialog(BuildContext context, WidgetRef ref) async {
  final controller = TextEditingController();
  final nom = await showDialog<String>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('Nouveau transporteur'),
      content: TextField(controller: controller, decoration: const InputDecoration(labelText: 'Nom')),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Annuler')),
        ElevatedButton(onPressed: () => Navigator.pop(ctx, controller.text.trim()), child: const Text('Créer')),
      ],
    ),
  );
  if (nom == null || nom.isEmpty) return null;

  try {
    return await ref.read(transporteursApiProvider).create(nom);
  } catch (e) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e is ApiException ? e.message : 'Erreur.')));
    }
    return null;
  }
}

/// Transporteurs (sociétés/personnes qui livrent) — chacun a une liste de
/// tarifs par destination, sélectionnable sur une commande pour préremplir
/// automatiquement les frais de livraison.
class AdminTransporteursScreen extends ConsumerWidget {
  const AdminTransporteursScreen({super.key});

  Future<void> _confirmDelete(BuildContext context, WidgetRef ref, Transporteur t) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Supprimer ce transporteur ?'),
        content: Text('"${t.nom}" sera déplacé vers la corbeille. Vous pourrez le restaurer plus tard.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Annuler')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: AppTheme.danger),
            child: const Text('Supprimer'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    try {
      await ref.read(transporteursApiProvider).remove(t.id);
      ref.invalidate(adminTransporteursProvider);
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e is ApiException ? e.message : 'Erreur.')));
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final transporteurs = ref.watch(adminTransporteursProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Transporteurs')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          final created = await showCreateTransporteurDialog(context, ref);
          if (created != null) ref.invalidate(adminTransporteursProvider);
        },
        icon: const Icon(Icons.local_shipping_outlined),
        label: const Text('Nouveau transporteur'),
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(adminTransporteursProvider),
        child: AsyncValueWidget<List<Transporteur>>(
          value: transporteurs,
          onRetry: () => ref.invalidate(adminTransporteursProvider),
          data: (items) {
            if (items.isEmpty) {
              return const Center(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: Text('Aucun transporteur pour le moment.', textAlign: TextAlign.center),
                ),
              );
            }
            return ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, i) {
                final t = items[i];
                return Card(
                  child: ListTile(
                    leading: const Icon(Icons.local_shipping_outlined),
                    title: Text(t.nom),
                    subtitle: Text('${t.rates.length} tarif${t.rates.length == 1 ? '' : 's'} de destination'),
                    trailing: IconButton(
                      icon: const Icon(Icons.delete_outline),
                      tooltip: 'Supprimer',
                      onPressed: () => _confirmDelete(context, ref, t),
                    ),
                    onTap: () async {
                      await Navigator.of(context).push(MaterialPageRoute(builder: (_) => AdminTransporteurDetailScreen(transporteurId: t.id)));
                      ref.invalidate(adminTransporteursProvider);
                    },
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
