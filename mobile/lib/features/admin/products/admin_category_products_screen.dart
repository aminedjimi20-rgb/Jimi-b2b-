import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/widgets/async_value_widget.dart';
import '../../../models/product.dart';
import '../../../services/service_providers.dart';
import 'admin_product_detail_screen.dart';
import 'admin_product_form_screen.dart';
import 'admin_product_sort.dart';
import 'admin_product_tile.dart';

final _categorySortProvider = StateProvider.autoDispose<String?>((ref) => null);

final _categoryProductsProvider = FutureProvider.autoDispose.family<List<AdminProduct>, String>((ref, categoryId) {
  final sortBy = ref.watch(_categorySortProvider);
  return ref.watch(productsApiProvider).listAdmin(categoryId: categoryId, sortBy: sortBy);
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
    final sortBy = ref.watch(_categorySortProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(categoryName),
        actions: [
          ProductSortMenuButton(value: sortBy, onChanged: (v) => ref.read(_categorySortProvider.notifier).state = v),
        ],
      ),
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
                    await Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => AdminProductDetailScreen(productId: p.id)),
                    );
                    ref.invalidate(_categoryProductsProvider(categoryId));
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
