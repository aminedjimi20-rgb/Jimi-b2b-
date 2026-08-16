import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/photo_gallery_viewer.dart';
import '../client_session.dart';
import 'cart_controller.dart';
import 'checkout_screen.dart';

class ClientCartScreen extends ConsumerWidget {
  const ClientCartScreen({super.key});

  Future<void> _confirmClear(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Vider le panier ?'),
        content: const Text('Tous les articles seront retirés.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Annuler')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: AppTheme.danger),
            child: const Text('Vider'),
          ),
        ],
      ),
    );
    if (confirmed == true) ref.read(cartControllerProvider.notifier).clear();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cart = ref.watch(cartControllerProvider);
    final cartNotifier = ref.read(cartControllerProvider.notifier);
    final orderByCarton = ref.watch(clientProfileProvider).valueOrNull?.orderByCarton ?? false;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Panier'),
        actions: [
          if (cart.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.delete_sweep_outlined),
              tooltip: 'Vider le panier',
              onPressed: () => _confirmClear(context, ref),
            ),
        ],
      ),
      body: cart.isEmpty
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.shopping_cart_outlined, size: 72, color: Colors.grey[350]),
                    const SizedBox(height: 16),
                    Text('Votre panier est vide.', style: TextStyle(color: Colors.grey[600], fontSize: 15)),
                  ],
                ),
              ),
            )
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: cart.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, i) {
                final line = cart[i];
                final uniteParCarton = line.product.uniteParCarton;
                final usesCartons = orderByCarton && uniteParCarton != null && uniteParCarton > 1;
                final step = usesCartons ? uniteParCarton : 1;
                final cartons = usesCartons ? (line.quantite / uniteParCarton).round() : null;
                final imageUrl = line.product.primaryImageUrl;

                return Dismissible(
                  key: ValueKey(line.product.id),
                  direction: DismissDirection.endToStart,
                  onDismissed: (_) => cartNotifier.remove(line.product.id),
                  background: Container(
                    alignment: Alignment.centerRight,
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    decoration: BoxDecoration(color: AppTheme.danger, borderRadius: BorderRadius.circular(12)),
                    child: const Icon(Icons.delete_outline, color: Colors.white),
                  ),
                  child: Card(
                    clipBehavior: Clip.antiAlias,
                    child: Padding(
                      padding: const EdgeInsets.all(10),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          GestureDetector(
                            onTap: imageUrl != null ? () => PhotoGalleryViewer.open(context, [imageUrl]) : null,
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(10),
                              child: SizedBox(
                                width: 60,
                                height: 60,
                                child: imageUrl != null
                                    ? CachedNetworkImage(
                                        imageUrl: imageUrl,
                                        fit: BoxFit.cover,
                                        errorWidget: (_, __, ___) => Container(color: Colors.grey.shade100, child: const Icon(Icons.image_outlined)),
                                      )
                                    : Container(color: Colors.grey.shade100, child: const Icon(Icons.image_outlined)),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(line.product.nom, style: const TextStyle(fontWeight: FontWeight.w600), maxLines: 2, overflow: TextOverflow.ellipsis),
                                const SizedBox(height: 2),
                                Text(formatMoney(line.product.prix), style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                                if (usesCartons)
                                  Padding(
                                    padding: const EdgeInsets.only(top: 2),
                                    child: Text('$cartons carton${cartons == 1 ? '' : 's'}', style: TextStyle(color: Colors.grey[500], fontSize: 11)),
                                  ),
                                const SizedBox(height: 6),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Container(
                                      decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade300), borderRadius: BorderRadius.circular(8)),
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          IconButton(
                                            icon: const Icon(Icons.remove, size: 16),
                                            padding: const EdgeInsets.all(6),
                                            constraints: const BoxConstraints(),
                                            onPressed: () => cartNotifier.updateQuantity(line.product.id, line.quantite - step),
                                          ),
                                          Padding(
                                            padding: const EdgeInsets.symmetric(horizontal: 6),
                                            child: Text('${line.quantite}', style: const TextStyle(fontWeight: FontWeight.bold)),
                                          ),
                                          IconButton(
                                            icon: const Icon(Icons.add, size: 16),
                                            padding: const EdgeInsets.all(6),
                                            constraints: const BoxConstraints(),
                                            onPressed: () => cartNotifier.updateQuantity(line.product.id, line.quantite + step),
                                          ),
                                        ],
                                      ),
                                    ),
                                    Text(formatMoney(line.sousTotal), style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primary)),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
      bottomNavigationBar: cart.isEmpty
          ? null
          : SafeArea(
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Theme.of(context).scaffoldBackgroundColor,
                  boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 8, offset: const Offset(0, -2))],
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Total (${cartNotifier.itemCount} article${cartNotifier.itemCount == 1 ? '' : 's'})',
                              style: TextStyle(color: Colors.grey[600], fontSize: 12)),
                          Text(formatMoney(cartNotifier.total), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                        ],
                      ),
                    ),
                    ElevatedButton.icon(
                      onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const CheckoutScreen())),
                      icon: const Icon(Icons.arrow_forward, size: 18),
                      label: const Text('Commander'),
                    ),
                  ],
                ),
              ),
            ),
    );
  }
}
