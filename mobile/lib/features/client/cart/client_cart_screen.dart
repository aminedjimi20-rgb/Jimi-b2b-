import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../client_session.dart';
import 'cart_controller.dart';
import 'checkout_screen.dart';

class ClientCartScreen extends ConsumerWidget {
  const ClientCartScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cart = ref.watch(cartControllerProvider);
    final cartNotifier = ref.read(cartControllerProvider.notifier);
    final orderByCarton = ref.watch(clientProfileProvider).valueOrNull?.orderByCarton ?? false;

    return Scaffold(
      appBar: AppBar(title: const Text('Panier')),
      body: cart.isEmpty
          ? const Center(child: Text('Votre panier est vide.'))
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

                return Card(
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(line.product.nom, style: const TextStyle(fontWeight: FontWeight.w600)),
                              Text(formatMoney(line.product.prix), style: TextStyle(color: Colors.grey[600])),
                              if (usesCartons) Text('($cartons carton${cartons == 1 ? '' : 's'})', style: TextStyle(color: Colors.grey[500], fontSize: 11)),
                            ],
                          ),
                        ),
                        Container(
                          decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade300), borderRadius: BorderRadius.circular(8)),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              IconButton(
                                icon: const Icon(Icons.remove, size: 18),
                                onPressed: () => cartNotifier.updateQuantity(line.product.id, line.quantite - step),
                              ),
                              Text('${line.quantite}', style: const TextStyle(fontWeight: FontWeight.bold)),
                              IconButton(
                                icon: const Icon(Icons.add, size: 18),
                                onPressed: () => cartNotifier.updateQuantity(line.product.id, line.quantite + step),
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.delete_outline, color: AppTheme.danger),
                          onPressed: () => cartNotifier.remove(line.product.id),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
      bottomNavigationBar: cart.isEmpty
          ? null
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Total', style: TextStyle(color: Colors.grey[600])),
                          Text(formatMoney(cartNotifier.total), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                        ],
                      ),
                    ),
                    ElevatedButton(
                      onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const CheckoutScreen())),
                      child: const Text('Commander'),
                    ),
                  ],
                ),
              ),
            ),
    );
  }
}
