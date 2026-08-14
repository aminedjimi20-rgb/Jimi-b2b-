import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/async_value_widget.dart';
import '../../../models/product.dart';
import '../../../services/service_providers.dart';
import '../cart/cart_controller.dart';

final _productDetailProvider = FutureProvider.autoDispose.family<ClientProduct, String>((ref, id) {
  return ref.watch(productsApiProvider).getForClient(id);
});

final _favoriteIdsProvider = FutureProvider.autoDispose<Set<String>>((ref) async {
  final favorites = await ref.watch(favoritesApiProvider).list();
  return favorites.map((f) => f.id).toSet();
});

class ClientProductDetailScreen extends ConsumerStatefulWidget {
  const ClientProductDetailScreen({super.key, required this.productId});
  final String productId;

  @override
  ConsumerState<ClientProductDetailScreen> createState() => _ClientProductDetailScreenState();
}

class _ClientProductDetailScreenState extends ConsumerState<ClientProductDetailScreen> {
  int _quantite = 1;
  bool _initialized = false;

  @override
  Widget build(BuildContext context) {
    final product = ref.watch(_productDetailProvider(widget.productId));
    final favorites = ref.watch(_favoriteIdsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Détail produit'),
        actions: [
          favorites.maybeWhen(
            data: (ids) {
              final isFav = ids.contains(widget.productId);
              return IconButton(
                icon: Icon(isFav ? Icons.favorite : Icons.favorite_border, color: isFav ? AppTheme.danger : Colors.white),
                onPressed: () async {
                  final api = ref.read(favoritesApiProvider);
                  if (isFav) {
                    await api.remove(widget.productId);
                  } else {
                    await api.add(widget.productId);
                  }
                  ref.invalidate(_favoriteIdsProvider);
                },
              );
            },
            orElse: () => const SizedBox.shrink(),
          ),
        ],
      ),
      body: AsyncValueWidget<ClientProduct>(
        value: product,
        onRetry: () => ref.invalidate(_productDetailProvider(widget.productId)),
        data: (p) {
          if (!_initialized) {
            _quantite = p.minCommande;
            _initialized = true;
          }
          final canOrder = p.disponibilite != 'RUPTURE';

          return Column(
            children: [
              Expanded(
                child: ListView(
                  children: [
                    AspectRatio(
                      aspectRatio: 1.2,
                      child: p.primaryImageUrl != null
                          ? CachedNetworkImage(imageUrl: p.primaryImageUrl!, fit: BoxFit.cover)
                          : Container(color: Colors.grey.shade100, child: const Icon(Icons.image_outlined, size: 64, color: Colors.grey)),
                    ),
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(child: Text(p.nom, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold))),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(color: stockStatusColor(p.disponibilite).withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)),
                                child: Text(stockStatusLabel(p.disponibilite), style: TextStyle(color: stockStatusColor(p.disponibilite), fontWeight: FontWeight.w600)),
                              ),
                            ],
                          ),
                          Text('Code: ${p.code}', style: TextStyle(color: Colors.grey[600])),
                          if (p.taille != null || p.couleur != null || p.marque != null)
                            Padding(
                              padding: const EdgeInsets.only(top: 4),
                              child: Text(
                                [if (p.marque != null) p.marque, if (p.taille != null) 'Taille: ${p.taille}', if (p.couleur != null) 'Couleur: ${p.couleur}']
                                    .join(' · '),
                                style: TextStyle(color: Colors.grey[600]),
                              ),
                            ),
                          const SizedBox(height: 12),
                          Text(formatMoney(p.prix), style: Theme.of(context).textTheme.headlineSmall?.copyWith(color: AppTheme.primary, fontWeight: FontWeight.bold)),
                          Text('Minimum de commande: ${p.minCommande}', style: TextStyle(color: Colors.grey[600], fontSize: 12)),
                          if (p.description != null && p.description!.isNotEmpty) ...[
                            const SizedBox(height: 16),
                            Text(p.description!),
                          ],
                          if (p.grilleQuantite.isNotEmpty) ...[
                            const SizedBox(height: 20),
                            Text('Prix par quantité', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold)),
                            const SizedBox(height: 8),
                            Card(
                              child: Column(
                                children: p.grilleQuantite
                                    .map((t) => ListTile(dense: true, title: Text(t.label), trailing: Text(formatMoney(t.prix))))
                                    .toList(),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              SafeArea(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      _QuantityStepper(
                        value: _quantite,
                        min: p.minCommande,
                        onChanged: (v) => setState(() => _quantite = v),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: canOrder
                              ? () {
                                  ref.read(cartControllerProvider.notifier).add(p, quantite: _quantite);
                                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Ajouté au panier')));
                                }
                              : null,
                          icon: const Icon(Icons.add_shopping_cart),
                          label: const Text('Ajouter au panier'),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _QuantityStepper extends StatelessWidget {
  const _QuantityStepper({required this.value, required this.min, required this.onChanged});
  final int value;
  final int min;
  final void Function(int) onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade300), borderRadius: BorderRadius.circular(10)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          IconButton(icon: const Icon(Icons.remove), onPressed: value > min ? () => onChanged(value - 1) : null),
          SizedBox(width: 32, child: Text('$value', textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.bold))),
          IconButton(icon: const Icon(Icons.add), onPressed: () => onChanged(value + 1)),
        ],
      ),
    );
  }
}
