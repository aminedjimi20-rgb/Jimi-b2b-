import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/widgets/async_value_widget.dart';
import '../../../models/product.dart';
import '../../../services/service_providers.dart';
import 'admin_product_form_screen.dart';
import 'admin_product_tile.dart';

final _categoryProductsProvider = FutureProvider.autoDispose.family<List<AdminProduct>, String>((ref, categoryId) {
  return ref.watch(productsApiProvider).listAdmin(categoryId: categoryId);
});

/// Products belonging to a single category — the "folder" view opened from
/// the Produits screen's category list.
class AdminCategoryProductsScreen extends ConsumerWidget {
  const AdminCategoryProductsScreen({super.key, required this.categoryId, required this.categoryName});

  final String categoryId;
  final String categoryName;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final products = ref.watch(_categoryProductsProvider(categoryId));

    return Scaffold(
      appBar: AppBar(title: Text(categoryName)),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          final created = await Navigator.of(context).push<bool>(
            MaterialPageRoute(builder: (_) => AdminProductFormScreen(initialCategoryId: categoryId)),
          );
          if (created == true) ref.invalidate(_categoryProductsProvider(categoryId));
        },
        icon: const Icon(Icons.add),
        label: const Text('Nouveau produit'),
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(_categoryProductsProvider(categoryId)),
        child: AsyncValueWidget<List<AdminProduct>>(
          value: products,
          onRetry: () => ref.invalidate(_categoryProductsProvider(categoryId)),
          data: (items) {
            if (items.isEmpty) {
              return const Center(child: Text('Aucun produit dans cette catégorie.'));
            }
            return ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, i) {
                final p = items[i];
                return AdminProductTile(
                  product: p,
                  onTap: () async {
                    final updated = await Navigator.of(context).push<bool>(
                      MaterialPageRoute(builder: (_) => AdminProductFormScreen(productId: p.id)),
                    );
                    if (updated == true) ref.invalidate(_categoryProductsProvider(categoryId));
                  },
                );
              },
            );
          },
        ),
      ),
    );
  }
}
