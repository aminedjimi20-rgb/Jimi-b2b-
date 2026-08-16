import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/async_value_widget.dart';
import '../../../models/fabricant.dart';
import '../../../services/service_providers.dart';
import 'fabricant_dialog.dart';

final adminFabricantsProvider = FutureProvider.autoDispose<List<Fabricant>>((ref) {
  return ref.watch(fabricantsApiProvider).list();
});

Future<void> _confirmDeleteFabricant(BuildContext context, WidgetRef ref, Fabricant fabricant) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('Supprimer ce fournisseur ?'),
      content: Text('"${fabricant.nom}" sera déplacé vers la corbeille. Vous pourrez le restaurer plus tard.'),
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
    await ref.read(fabricantsApiProvider).remove(fabricant.id);
    ref.invalidate(adminFabricantsProvider);
  } catch (e) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e is ApiException ? e.message : 'Erreur.')));
    }
  }
}

/// Liste des fournisseurs/fabricants — création rapide et suppression
/// (corbeille). La fiche détaillée complète arrive dans une phase suivante.
class AdminFabricantsScreen extends ConsumerWidget {
  const AdminFabricantsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final fabricants = ref.watch(adminFabricantsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Fournisseurs')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          final created = await showCreateFabricantDialog(context, ref);
          if (created != null) ref.invalidate(adminFabricantsProvider);
        },
        icon: const Icon(Icons.add_business_outlined),
        label: const Text('Nouveau fournisseur'),
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(adminFabricantsProvider),
        child: AsyncValueWidget<List<Fabricant>>(
          value: fabricants,
          onRetry: () => ref.invalidate(adminFabricantsProvider),
          data: (items) {
            if (items.isEmpty) {
              return const Center(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: Text('Aucun fournisseur pour le moment.', textAlign: TextAlign.center),
                ),
              );
            }
            return ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, i) {
                final f = items[i];
                return Card(
                  child: ListTile(
                    leading: const Icon(Icons.factory_outlined),
                    title: Text(f.nom),
                    subtitle: Text('${f.telephone ?? f.adresse ?? 'Aucun contact'} · ${f.productCount} produit${f.productCount == 1 ? '' : 's'}'),
                    trailing: IconButton(
                      icon: const Icon(Icons.delete_outline),
                      tooltip: 'Supprimer',
                      onPressed: () => _confirmDeleteFabricant(context, ref, f),
                    ),
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
