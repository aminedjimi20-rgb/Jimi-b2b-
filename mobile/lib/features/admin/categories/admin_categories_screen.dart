import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/async_value_widget.dart';
import '../../../models/category.dart';
import '../../../services/service_providers.dart';

final adminCategoriesProvider = FutureProvider.autoDispose<List<Category>>((ref) {
  return ref.watch(categoriesApiProvider).list();
});

/// Opens the "new category" dialog. Returns true if a category was created —
/// shared by the Catégories screen and the "+" folder shortcut on Produits.
Future<bool> showCreateCategoryDialog(BuildContext context, WidgetRef ref) async {
  final controller = TextEditingController();
  String? error;
  var created = false;

  await showDialog(
    context: context,
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, setState) => AlertDialog(
        title: const Text('Nouvelle catégorie'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: controller,
              autofocus: true,
              decoration: const InputDecoration(labelText: 'Nom de la catégorie'),
            ),
            if (error != null) ...[
              const SizedBox(height: 8),
              Text(error!, style: const TextStyle(color: AppTheme.danger)),
            ],
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Annuler')),
          ElevatedButton(
            onPressed: () async {
              final nom = controller.text.trim();
              if (nom.isEmpty) {
                setState(() => error = 'Le nom est requis.');
                return;
              }
              try {
                await ref.read(categoriesApiProvider).create(nom);
                created = true;
                if (ctx.mounted) Navigator.pop(ctx);
                ref.invalidate(adminCategoriesProvider);
              } catch (e) {
                setState(() => error = e is ApiException ? e.message : 'Erreur.');
              }
            },
            child: const Text('Créer'),
          ),
        ],
      ),
    ),
  );

  return created;
}

Future<void> _showEditCategoryDialog(BuildContext context, WidgetRef ref, Category category) async {
  final controller = TextEditingController(text: category.nom);
  bool visibleToClient = category.visibleToClient;
  bool visibleToEmployee = category.visibleToEmployee;
  String? error;

  await showDialog(
    context: context,
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, setState) => AlertDialog(
        title: const Text('Modifier le dossier'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: controller, autofocus: true, decoration: const InputDecoration(labelText: 'Nom du dossier')),
            const SizedBox(height: 12),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Visible pour les clients'),
              value: visibleToClient,
              onChanged: (v) => setState(() => visibleToClient = v),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Visible pour les employés'),
              value: visibleToEmployee,
              onChanged: (v) => setState(() => visibleToEmployee = v),
            ),
            if (error != null) ...[
              const SizedBox(height: 8),
              Text(error!, style: const TextStyle(color: AppTheme.danger)),
            ],
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Annuler')),
          ElevatedButton(
            onPressed: () async {
              final nom = controller.text.trim();
              if (nom.isEmpty) {
                setState(() => error = 'Le nom est requis.');
                return;
              }
              try {
                await ref.read(categoriesApiProvider).update(
                      category.id,
                      nom: nom,
                      visibleToClient: visibleToClient,
                      visibleToEmployee: visibleToEmployee,
                    );
                if (ctx.mounted) Navigator.pop(ctx);
                ref.invalidate(adminCategoriesProvider);
              } catch (e) {
                setState(() => error = e is ApiException ? e.message : 'Erreur.');
              }
            },
            child: const Text('Enregistrer'),
          ),
        ],
      ),
    ),
  );
}

Future<void> _confirmDeleteCategory(BuildContext context, WidgetRef ref, Category category) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('Supprimer cette catégorie ?'),
      content: Text('"${category.nom}" sera déplacée vers la corbeille. Vous pourrez la restaurer plus tard.'),
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
    await ref.read(categoriesApiProvider).remove(category.id);
    ref.invalidate(adminCategoriesProvider);
  } catch (e) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e is ApiException ? e.message : 'Erreur.')));
    }
  }
}

class AdminCategoriesScreen extends ConsumerWidget {
  const AdminCategoriesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final categories = ref.watch(adminCategoriesProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Catégories')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => showCreateCategoryDialog(context, ref),
        icon: const Icon(Icons.add),
        label: const Text('Nouvelle catégorie'),
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(adminCategoriesProvider),
        child: AsyncValueWidget<List<Category>>(
          value: categories,
          onRetry: () => ref.invalidate(adminCategoriesProvider),
          data: (items) {
            if (items.isEmpty) {
              return const Center(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: Text(
                    "Aucune catégorie pour le moment.\nCréez-en une avant d'ajouter vos premiers produits.",
                    textAlign: TextAlign.center,
                  ),
                ),
              );
            }
            return ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, i) => Card(
                child: ListTile(
                  leading: const Icon(Icons.sell_outlined),
                  title: Text(items[i].nom),
                  subtitle: !items[i].visibleToClient || !items[i].visibleToEmployee
                      ? Text(
                          [
                            if (!items[i].visibleToClient) 'Masqué aux clients',
                            if (!items[i].visibleToEmployee) 'Masqué aux employés',
                          ].join(' · '),
                          style: const TextStyle(color: AppTheme.warning, fontSize: 12),
                        )
                      : null,
                  onTap: () => _showEditCategoryDialog(context, ref, items[i]),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('${items[i].productCount} produit${items[i].productCount == 1 ? '' : 's'}'),
                      IconButton(
                        icon: const Icon(Icons.edit_outlined, size: 20),
                        tooltip: 'Modifier',
                        onPressed: () => _showEditCategoryDialog(context, ref, items[i]),
                      ),
                      IconButton(
                        icon: const Icon(Icons.delete_outline, size: 20),
                        tooltip: 'Supprimer',
                        onPressed: () => _confirmDeleteCategory(context, ref, items[i]),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
