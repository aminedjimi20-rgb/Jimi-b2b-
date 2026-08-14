import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/utils/formatters.dart';
import '../../../core/widgets/async_value_widget.dart';
import '../../../models/product.dart';
import '../../../services/service_providers.dart';
import '../cart/cart_controller.dart';
import '../catalog/client_product_detail_screen.dart';

final _favoritesProvider = FutureProvider.autoDispose<List<ClientProduct>>((ref) {
  return ref.watch(favoritesApiProvider).list();
});

class ClientFavoritesScreen extends ConsumerWidget {
  const ClientFavoritesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final favorites = ref.watch(_favoritesProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Mes favoris')),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(_favoritesProvider),
        child: AsyncValueWidget<List<ClientProduct>>(
          value: favorites,
          onRetry: () => ref.invalidate(_favoritesProvider),
          data: (items) {
            if (items.isEmpty) return const Center(child: Text('Aucun produit favori pour le moment.'));
            return ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, i) {
                final p = items[i];
                return Card(
                  child: ListTile(
                    title: Text(p.nom),
                    subtitle: Text('${p.code} · ${formatMoney(p.prix)}'),
                    trailing: IconButton(
                      icon: const Icon(Icons.add_shopping_cart),
                      onPressed: p.disponibilite == 'RUPTURE'
                          ? null
                          : () {
                              ref.read(cartControllerProvider.notifier).add(p);
                              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Ajouté au panier')));
                            },
                    ),
                    onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => ClientProductDetailScreen(productId: p.id))),
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
