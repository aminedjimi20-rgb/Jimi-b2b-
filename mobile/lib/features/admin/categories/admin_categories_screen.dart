import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../models/category.dart';
import '../../../services/service_providers.dart';

final _categoriesProvider = FutureProvider.autoDispose<List<Category>>((ref) => ref.watch(categoriesApiProvider).list());

class AdminCategoriesScreen extends ConsumerWidget {
  const AdminCategoriesScreen({super.key});

  Future<void> _createCategory(BuildContext context, WidgetRef ref) async {
    final controller = TextEditingController();
    String? error;

    final created = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setState) => AlertDialog(
          title: const Text('Nouvelle catégorie'),
          content: TextField(
            controller: controller,
            autofocus: true,
            decoration: InputDecoration(
              labelText: 'Nom de la catégorie',
              errorText: error,
            ),
            onSubmitted: (_) => Navigator.of(ctx).pop(true),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Annuler')),
            TextButton(
              onPressed: () {
                if (controller.text.trim().isEmpty) {
                  setState(() => error = 'Champ requis');
                  return;
                }
                Navigator.of(ctx).pop(true);
              },
              child: const Text('Confirmer'),
            ),
          ],
        ),
      ),
    );

    if (created != true || controller.text.trim().isEmpty) return;

    try {
      await ref.read(categoriesApiProvider).create(controller.text.trim());
      ref.invalidate(_categoriesProvider);
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e is ApiException ? e.message : 'Erreur lors de la création.')),
        );
      }
    }
  }

  Future<void> _deleteCategory(BuildContext context, WidgetRef ref, Category category) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Supprimer la catégorie'),
        content: Text('Supprimer "${category.nom}" ?'),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Annuler')),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Supprimer', style: TextStyle(color: AppTheme.danger)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    try {
      await ref.read(categoriesApiProvider).remove(category.id);
      ref.invalidate(_categoriesProvider);
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e is ApiException ? e.message : 'Erreur lors de la suppression.')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final categories = ref.watch(_categoriesProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Catégories')),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _createCategory(context, ref),
        child: const Icon(Icons.add),
      ),
      body: categories.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text(e is ApiException ? e.message : 'Erreur de chargement.')),
        data: (items) {
          if (items.isEmpty) return const Center(child: Text('Aucune catégorie. Appuyez sur + pour en créer une.'));
          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (context, i) {
              final c = items[i];
              return Card(
                child: ListTile(
                  leading: const Icon(Icons.category_outlined),
                  title: Text(c.nom),
                  trailing: IconButton(
                    icon: const Icon(Icons.delete_outline, color: AppTheme.danger),
                    onPressed: () => _deleteCategory(context, ref, c),
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
