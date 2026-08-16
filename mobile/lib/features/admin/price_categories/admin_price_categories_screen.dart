import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/async_value_widget.dart';
import '../../../models/price_category.dart';
import '../../../services/service_providers.dart';

final _priceCategoriesProvider = FutureProvider.autoDispose<List<PriceCategory>>((ref) {
  return ref.watch(priceCategoriesApiProvider).list();
});

/// Manages the small global list of price categories (ex: "Gros", "Détail",
/// "VIP") — a client is assigned one, and each product can carry a price
/// for it, auto-applied at order time. Not tied to any single product.
class AdminPriceCategoriesScreen extends ConsumerWidget {
  const AdminPriceCategoriesScreen({super.key});

  Future<void> _create(BuildContext context, WidgetRef ref) async {
    final controller = TextEditingController();
    var orderByCarton = false;
    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setState) => AlertDialog(
          title: const Text('Nouvelle catégorie de prix'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(controller: controller, decoration: const InputDecoration(labelText: 'Nom (ex: Gros, VIP...)')),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Commande par carton'),
                subtitle: const Text('Grossiste — sinon commande à l\'unité (détail)'),
                value: orderByCarton,
                onChanged: (v) => setState(() => orderByCarton = v),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Annuler')),
            ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Créer')),
          ],
        ),
      ),
    );
    if (result != true || controller.text.trim().isEmpty) return;

    try {
      await ref.read(priceCategoriesApiProvider).create(controller.text.trim(), orderByCarton: orderByCarton);
      ref.invalidate(_priceCategoriesProvider);
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e is ApiException ? e.message : 'Erreur.')));
      }
    }
  }

  Future<void> _edit(BuildContext context, WidgetRef ref, PriceCategory category) async {
    final controller = TextEditingController(text: category.nom);
    var orderByCarton = category.orderByCarton;
    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setState) => AlertDialog(
          title: const Text('Modifier la catégorie'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(controller: controller, decoration: const InputDecoration(labelText: 'Nom')),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Commande par carton'),
                subtitle: const Text('Grossiste — sinon commande à l\'unité (détail)'),
                value: orderByCarton,
                onChanged: (v) => setState(() => orderByCarton = v),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Annuler')),
            ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Enregistrer')),
          ],
        ),
      ),
    );
    if (result != true || controller.text.trim().isEmpty) return;

    try {
      await ref.read(priceCategoriesApiProvider).update(category.id, nom: controller.text.trim(), orderByCarton: orderByCarton);
      ref.invalidate(_priceCategoriesProvider);
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e is ApiException ? e.message : 'Erreur.')));
      }
    }
  }

  Future<void> _confirmDelete(BuildContext context, WidgetRef ref, PriceCategory category) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Supprimer cette catégorie ?'),
        content: Text(
          '"${category.nom}" sera supprimée. Les clients assignés reviendront au prix normal, et les prix définis pour cette catégorie seront effacés. Cette action est irréversible.',
        ),
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
      await ref.read(priceCategoriesApiProvider).remove(category.id);
      ref.invalidate(_priceCategoriesProvider);
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e is ApiException ? e.message : 'Erreur.')));
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final categories = ref.watch(_priceCategoriesProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Catégories de prix')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _create(context, ref),
        icon: const Icon(Icons.add),
        label: const Text('Nouvelle catégorie'),
      ),
      body: AsyncValueWidget<List<PriceCategory>>(
        value: categories,
        onRetry: () => ref.invalidate(_priceCategoriesProvider),
        data: (items) {
          if (items.isEmpty) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text(
                  'Aucune catégorie de prix. Créez-en une pour proposer plusieurs prix de vente (Gros, VIP...) selon le client.',
                  textAlign: TextAlign.center,
                ),
              ),
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, i) {
              final c = items[i];
              return Card(
                child: ListTile(
                  leading: const Icon(Icons.sell_outlined),
                  title: Text(c.nom),
                  subtitle: Text(c.orderByCarton ? 'Grossiste — commande par carton' : 'Détail — commande à l\'unité'),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(icon: const Icon(Icons.edit_outlined), tooltip: 'Modifier', onPressed: () => _edit(context, ref, c)),
                      IconButton(
                        icon: const Icon(Icons.delete_outline),
                        tooltip: 'Supprimer',
                        onPressed: () => _confirmDelete(context, ref, c),
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
