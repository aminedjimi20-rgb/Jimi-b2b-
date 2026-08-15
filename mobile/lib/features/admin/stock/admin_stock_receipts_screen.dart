import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/utils/formatters.dart';
import '../../../core/widgets/async_value_widget.dart';
import '../../../models/stock_receipt.dart';
import '../../../services/service_providers.dart';
import 'admin_stock_receipt_detail_screen.dart';
import 'admin_stock_receipt_form_screen.dart';

final _stockReceiptsProvider = FutureProvider.autoDispose<List<StockReceiptView>>((ref) {
  return ref.watch(stockReceiptsApiProvider).list();
});

/// List of past "bons de réception" (goods received from fabricants).
class AdminStockReceiptsScreen extends ConsumerWidget {
  const AdminStockReceiptsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final receipts = ref.watch(_stockReceiptsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Réceptions fournisseurs')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AdminStockReceiptFormScreen()));
          ref.invalidate(_stockReceiptsProvider);
        },
        icon: const Icon(Icons.add),
        label: const Text('Nouveau bon'),
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(_stockReceiptsProvider),
        child: AsyncValueWidget<List<StockReceiptView>>(
          value: receipts,
          onRetry: () => ref.invalidate(_stockReceiptsProvider),
          data: (items) {
            if (items.isEmpty) {
              return const Center(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: Text(
                    "Aucun bon de réception pour le moment.\nCréez-en un quand une livraison arrive.",
                    textAlign: TextAlign.center,
                  ),
                ),
              );
            }
            return ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, i) {
                final r = items[i];
                return Card(
                  child: ListTile(
                    leading: const Icon(Icons.inventory_2_outlined),
                    title: Text(r.reference),
                    subtitle: Text('${r.fabricantNom} · ${formatDate(r.createdAt)} · ${r.items.length} article${r.items.length == 1 ? '' : 's'}'),
                    trailing: Text(formatMoney(r.total), style: const TextStyle(fontWeight: FontWeight.bold)),
                    onTap: () async {
                      await Navigator.of(context).push(MaterialPageRoute(builder: (_) => AdminStockReceiptDetailScreen(receiptId: r.id)));
                      ref.invalidate(_stockReceiptsProvider);
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
