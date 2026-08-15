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
                  trailing: Text('${items[i].productCount} produit${items[i].productCount == 1 ? '' : 's'}'),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
