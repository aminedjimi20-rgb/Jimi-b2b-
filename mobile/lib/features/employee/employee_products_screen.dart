import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/async_value_widget.dart';
import '../../core/widgets/photo_gallery_viewer.dart';
import '../../core/widgets/product_sort_menu.dart';
import '../../models/employee_product.dart';
import '../../services/service_providers.dart';

final _employeeSortByProvider = StateProvider.autoDispose<String?>((ref) => null);

final employeeProductsProvider = FutureProvider.autoDispose<List<EmployeeProduct>>((ref) {
  final sortBy = ref.watch(_employeeSortByProvider);
  return ref.watch(productsApiProvider).listStaff(sortBy: sortBy);
});

/// Read-only catalog — helps an employee check stock/price while preparing
/// or selling at the counter. Never shows prixAchat/marge (see EmployeeProduct).
class EmployeeProductsScreen extends ConsumerStatefulWidget {
  const EmployeeProductsScreen({super.key});

  @override
  ConsumerState<EmployeeProductsScreen> createState() => _EmployeeProductsScreenState();
}

class _EmployeeProductsScreenState extends ConsumerState<EmployeeProductsScreen> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final products = ref.watch(employeeProductsProvider);
    final sortBy = ref.watch(_employeeSortByProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Produits'),
        actions: [
          ProductSortMenu(
            options: kEmployeeSortOptions,
            value: sortBy,
            onChanged: (v) => ref.read(_employeeSortByProvider.notifier).state = v,
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(56),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: TextField(
              decoration: const InputDecoration(hintText: 'Rechercher...', prefixIcon: Icon(Icons.search), isDense: true),
              onChanged: (v) => setState(() => _query = v.toLowerCase()),
            ),
          ),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(employeeProductsProvider),
        child: AsyncValueWidget<List<EmployeeProduct>>(
          value: products,
          onRetry: () => ref.invalidate(employeeProductsProvider),
          data: (items) {
            final filtered = _query.isEmpty
                ? items
                : items.where((p) => p.nom.toLowerCase().contains(_query) || p.code.toLowerCase().contains(_query)).toList();
            if (filtered.isEmpty) {
              return ListView(children: const [Padding(padding: EdgeInsets.all(32), child: Text('Aucun produit trouvé.'))]);
            }
            return ListView.builder(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
              itemCount: filtered.length,
              itemBuilder: (context, i) {
                final p = filtered[i];
                final lowStock = p.stockReel <= p.stockMinimum;
                return Card(
                  child: ListTile(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    leading: GestureDetector(
                      onTap: p.primaryImageUrl != null ? () => PhotoGalleryViewer.open(context, p.images.map((i) => i.url).toList()) : null,
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: SizedBox(
                          width: 44,
                          height: 44,
                          child: p.primaryImageUrl != null
                              ? CachedNetworkImage(
                                  imageUrl: p.primaryImageUrl!,
                                  fit: BoxFit.cover,
                                  errorWidget: (_, __, ___) => Icon(Icons.inventory_2_outlined, color: lowStock ? AppTheme.warning : Colors.grey[600]),
                                  placeholder: (_, __) => Icon(Icons.inventory_2_outlined, color: lowStock ? AppTheme.warning : Colors.grey[600]),
                                )
                              : Icon(Icons.inventory_2_outlined, color: lowStock ? AppTheme.warning : Colors.grey[600]),
                        ),
                      ),
                    ),
                    title: Text(p.nom, maxLines: 1, overflow: TextOverflow.ellipsis),
                    subtitle: Text('${p.code} · Stock: ${p.stockReel}', style: TextStyle(color: lowStock ? AppTheme.warning : null)),
                    trailing: Text(formatMoney(p.prixVente), style: const TextStyle(fontWeight: FontWeight.bold)),
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
