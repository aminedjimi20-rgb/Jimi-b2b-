import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/widgets/async_value_widget.dart';
import '../../../models/product.dart';
import '../../../services/service_providers.dart';
import '../categories/admin_categories_screen.dart';
import 'admin_category_products_screen.dart';
import 'admin_image_search_screen.dart';
import 'admin_product_detail_screen.dart';
import 'admin_product_form_screen.dart';
import 'admin_product_sort.dart';
import 'admin_product_tile.dart';

final _productSortProvider = StateProvider.autoDispose<String?>((ref) => null);

final _adminProductsProvider = FutureProvider.autoDispose<List<AdminProduct>>((ref) {
  final sortBy = ref.watch(_productSortProvider);
  return ref.watch(productsApiProvider).listAdmin(sortBy: sortBy);
});

class AdminProductsScreen extends ConsumerStatefulWidget {
  const AdminProductsScreen({super.key});

  @override
  ConsumerState<AdminProductsScreen> createState() => _AdminProductsScreenState();
}

class _AdminProductsScreenState extends ConsumerState<AdminProductsScreen> {
  String _query = '';

  Future<void> _openAddMenu() async {
    final choice = await showModalBottomSheet<String>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Wrap(children: [
          ListTile(
            leading: const Icon(Icons.add_box_outlined),
            title: const Text('Nouveau produit'),
            onTap: () => Navigator.pop(ctx, 'product'),
          ),
          ListTile(
            leading: const Icon(Icons.create_new_folder_outlined),
            title: const Text('Nouvelle catégorie (dossier)'),
            onTap: () => Navigator.pop(ctx, 'category'),
          ),
        ]),
      ),
    );

    if (!mounted || choice == null) return;

    if (choice == 'product') {
      final created = await Navigator.of(context).push<bool>(
        MaterialPageRoute(builder: (_) => const AdminProductFormScreen()),
      );
      if (created == true) ref.invalidate(_adminProductsProvider);
    } else if (choice == 'category') {
      final created = await showCreateCategoryDialog(context, ref);
      if (created) ref.invalidate(adminCategoriesProvider);
    }
  }

  @override
  Widget build(BuildContext context) {
    final products = ref.watch(_adminProductsProvider);
    final categories = ref.watch(adminCategoriesProvider);
    final sortBy = ref.watch(_productSortProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Produits'),
        actions: [
          IconButton(
            icon: const Icon(Icons.camera_alt_outlined),
            tooltip: 'Rechercher par photo',
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AdminImageSearchScreen())),
          ),
          ProductSortMenuButton(value: sortBy, onChanged: (v) => ref.read(_productSortProvider.notifier).state = v),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(56),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: TextField(
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                hintText: 'Rechercher un produit...',
                hintStyle: const TextStyle(color: Colors.white70),
                prefixIcon: const Icon(Icons.search, color: Colors.white70),
                filled: true,
                fillColor: Colors.white.withValues(alpha: 0.15),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                isDense: true,
              ),
              onChanged: (v) => setState(() => _query = v.toLowerCase()),
            ),
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openAddMenu,
        icon: const Icon(Icons.add),
        label: const Text('Ajouter'),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(_adminProductsProvider);
          ref.invalidate(adminCategoriesProvider);
        },
        child: AsyncValueWidget<List<AdminProduct>>(
          value: products,
          onRetry: () => ref.invalidate(_adminProductsProvider),
          data: (items) {
            if (_query.isNotEmpty) {
              final filtered = items
                  .where((p) => p.nom.toLowerCase().contains(_query) || p.code.toLowerCase().contains(_query))
                  .toList();
              if (filtered.isEmpty) {
                return const Center(child: Text('Aucun produit trouvé.'));
              }
              return ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
                itemCount: filtered.length,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (context, i) => AdminProductTile(
                  product: filtered[i],
                  onTap: () async {
                    await Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => AdminProductDetailScreen(productId: filtered[i].id)),
                    );
                    ref.invalidate(_adminProductsProvider);
                  },
                ),
              );
            }

            // No search in progress: group products into category "folders".
            return categories.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (_, __) => const Center(child: Text('Impossible de charger les catégories.')),
              data: (cats) {
                if (items.isEmpty) {
                  return const Center(child: Text('Aucun produit trouvé.'));
                }
                final knownIds = cats.map((c) => c.id).toSet();
                final counts = <String, int>{};
                var orphanCount = 0;
                for (final p in items) {
                  if (knownIds.contains(p.categoryId)) {
                    counts[p.categoryId] = (counts[p.categoryId] ?? 0) + 1;
                  } else {
                    orphanCount++;
                  }
                }

                return ListView(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
                  children: [
                    for (final c in cats)
                      _CategoryFolderCard(
                        nom: c.nom,
                        count: counts[c.id] ?? 0,
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => AdminCategoryProductsScreen(categoryId: c.id, categoryName: c.nom)),
                        ),
                      ),
                    if (orphanCount > 0)
                      _CategoryFolderCard(nom: 'Sans catégorie', count: orphanCount, onTap: null),
                  ],
                );
              },
            );
          },
        ),
      ),
    );
  }
}

class _CategoryFolderCard extends StatelessWidget {
  const _CategoryFolderCard({required this.nom, required this.count, required this.onTap});

  final String nom;
  final int count;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        leading: const CircleAvatar(child: Icon(Icons.folder_outlined)),
        title: Text(nom, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text('$count produit${count == 1 ? '' : 's'}'),
        trailing: onTap != null ? const Icon(Icons.chevron_right) : null,
        onTap: onTap,
      ),
    );
  }
}
