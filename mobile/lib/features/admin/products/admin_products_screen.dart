import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/async_value_widget.dart';
import '../../../models/product.dart';
import '../../../services/service_providers.dart';
import 'admin_product_form_screen.dart';

final _adminProductsProvider = FutureProvider.autoDispose<List<AdminProduct>>((ref) {
  return ref.watch(productsApiProvider).listAdmin();
});

class AdminProductsScreen extends ConsumerStatefulWidget {
  const AdminProductsScreen({super.key});

  @override
  ConsumerState<AdminProductsScreen> createState() => _AdminProductsScreenState();
}

class _AdminProductsScreenState extends ConsumerState<AdminProductsScreen> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final products = ref.watch(_adminProductsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Produits'),
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
        onPressed: () async {
          final created = await Navigator.of(context).push<bool>(
            MaterialPageRoute(builder: (_) => const AdminProductFormScreen()),
          );
          if (created == true) ref.invalidate(_adminProductsProvider);
        },
        icon: const Icon(Icons.add),
        label: const Text('Nouveau produit'),
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(_adminProductsProvider),
        child: AsyncValueWidget<List<AdminProduct>>(
          value: products,
          onRetry: () => ref.invalidate(_adminProductsProvider),
          data: (items) {
            final filtered = _query.isEmpty
                ? items
                : items.where((p) => p.nom.toLowerCase().contains(_query) || p.code.toLowerCase().contains(_query)).toList();

            if (filtered.isEmpty) {
              return const Center(child: Text('Aucun produit trouvé.'));
            }

            return ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
              itemCount: filtered.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, i) {
                final p = filtered[i];
                return Card(
                  child: ListTile(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    leading: CircleAvatar(
                      backgroundColor: p.stockReel <= p.stockMinimum ? AppTheme.warning.withValues(alpha: 0.15) : Colors.grey.shade100,
                      child: Icon(Icons.inventory_2_outlined, color: p.stockReel <= p.stockMinimum ? AppTheme.warning : Colors.grey[600]),
                    ),
                    title: Text(p.nom, maxLines: 1, overflow: TextOverflow.ellipsis),
                    subtitle: Text('${p.code} · Stock: ${p.stockReel} · Marge: ${p.margePourcentage.toStringAsFixed(0)}%'),
                    trailing: Text(formatMoney(p.prixVente), style: const TextStyle(fontWeight: FontWeight.bold)),
                    onTap: () async {
                      final updated = await Navigator.of(context).push<bool>(
                        MaterialPageRoute(builder: (_) => AdminProductFormScreen(productId: p.id)),
                      );
                      if (updated == true) ref.invalidate(_adminProductsProvider);
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
