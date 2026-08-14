import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/async_value_widget.dart';
import '../../../models/category.dart';
import '../../../models/product.dart';
import '../../../services/service_providers.dart';
import '../cart/cart_controller.dart';
import 'client_product_detail_screen.dart';

final _categoriesProvider = FutureProvider.autoDispose<List<Category>>((ref) => ref.watch(categoriesApiProvider).list());

final _searchQueryProvider = StateProvider.autoDispose<String>((ref) => '');
final _selectedCategoryProvider = StateProvider.autoDispose<String?>((ref) => null);

final _catalogProvider = FutureProvider.autoDispose<List<ClientProduct>>((ref) async {
  final q = ref.watch(_searchQueryProvider);
  final categoryId = ref.watch(_selectedCategoryProvider);
  final result = await ref.watch(productsApiProvider).searchCatalog(q: q, categoryId: categoryId, pageSize: 100);
  return result.items;
});

class ClientCatalogScreen extends ConsumerStatefulWidget {
  const ClientCatalogScreen({super.key});

  @override
  ConsumerState<ClientCatalogScreen> createState() => _ClientCatalogScreenState();
}

class _ClientCatalogScreenState extends ConsumerState<ClientCatalogScreen> {
  final _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final catalog = ref.watch(_catalogProvider);
    final categories = ref.watch(_categoriesProvider);
    final selectedCategory = ref.watch(_selectedCategoryProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Catalogue'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(56),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: TextField(
              controller: _searchController,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                hintText: 'Nom, code, catégorie...',
                hintStyle: const TextStyle(color: Colors.white70),
                prefixIcon: const Icon(Icons.search, color: Colors.white70),
                filled: true,
                fillColor: Colors.white.withValues(alpha: 0.15),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                isDense: true,
              ),
              onChanged: (v) => ref.read(_searchQueryProvider.notifier).state = v,
            ),
          ),
        ),
      ),
      body: Column(
        children: [
          categories.when(
            data: (cats) => SizedBox(
              height: 44,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                children: [
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: const Text('Toutes'),
                      selected: selectedCategory == null,
                      onSelected: (_) => ref.read(_selectedCategoryProvider.notifier).state = null,
                    ),
                  ),
                  ...cats.map((c) => Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: ChoiceChip(
                          label: Text(c.nom),
                          selected: selectedCategory == c.id,
                          onSelected: (_) => ref.read(_selectedCategoryProvider.notifier).state = c.id,
                        ),
                      )),
                ],
              ),
            ),
            loading: () => const SizedBox(height: 44),
            error: (_, __) => const SizedBox.shrink(),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async => ref.invalidate(_catalogProvider),
              child: AsyncValueWidget<List<ClientProduct>>(
                value: catalog,
                onRetry: () => ref.invalidate(_catalogProvider),
                data: (items) {
                  if (items.isEmpty) return const Center(child: Text('Aucun produit trouvé.'));
                  return GridView.builder(
                    padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      mainAxisSpacing: 12,
                      crossAxisSpacing: 12,
                      childAspectRatio: 0.68,
                    ),
                    itemCount: items.length,
                    itemBuilder: (context, i) => _ProductCard(product: items[i]),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ProductCard extends ConsumerWidget {
  const _ProductCard({required this.product});
  final ClientProduct product;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final canOrder = product.disponibilite != 'RUPTURE';

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => ClientProductDetailScreen(productId: product.id))),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: Stack(
                fit: StackFit.expand,
                children: [
                  product.primaryImageUrl != null
                      ? CachedNetworkImage(imageUrl: product.primaryImageUrl!, fit: BoxFit.cover, errorWidget: (_, __, ___) => const _ImagePlaceholder())
                      : const _ImagePlaceholder(),
                  Positioned(
                    top: 6,
                    left: 6,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                      decoration: BoxDecoration(color: stockStatusColor(product.disponibilite), borderRadius: BorderRadius.circular(6)),
                      child: Text(stockStatusLabel(product.disponibilite), style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w600)),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 8, 8, 4),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(product.nom, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                  Text(product.code, style: TextStyle(color: Colors.grey[500], fontSize: 11)),
                  const SizedBox(height: 2),
                  Text(formatMoney(product.prix), style: const TextStyle(color: AppTheme.primary, fontWeight: FontWeight.bold)),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 0, 8, 8),
              child: SizedBox(
                width: double.infinity,
                height: 32,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(padding: EdgeInsets.zero, textStyle: const TextStyle(fontSize: 12)),
                  onPressed: canOrder
                      ? () {
                          ref.read(cartControllerProvider.notifier).add(product);
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('${product.nom} ajouté au panier'), duration: const Duration(seconds: 1)),
                          );
                        }
                      : null,
                  child: Text(canOrder ? 'Ajouter' : 'Indisponible'),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ImagePlaceholder extends StatelessWidget {
  const _ImagePlaceholder();
  @override
  Widget build(BuildContext context) => Container(color: Colors.grey.shade100, child: const Icon(Icons.image_outlined, color: Colors.grey, size: 32));
}
