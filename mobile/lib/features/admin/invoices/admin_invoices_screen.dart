import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/async_value_widget.dart';
import '../../../models/invoice.dart';
import '../../../models/order.dart';
import '../../../services/service_providers.dart';
import 'admin_invoice_detail_screen.dart';

final _adminInvoicesProvider = FutureProvider.autoDispose<List<InvoiceView>>((ref) => ref.watch(invoicesApiProvider).listAdmin());

/// The dedicated accounting ledger — every Facture generated from a
/// confirmed order, independent of the FAC- 1:1 link that lives on the
/// order itself (see the "Générer facture" button on AdminOrderDetailScreen).
class AdminInvoicesScreen extends ConsumerWidget {
  const AdminInvoicesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final invoices = ref.watch(_adminInvoicesProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Factures')),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(_adminInvoicesProvider),
        child: AsyncValueWidget<List<InvoiceView>>(
          value: invoices,
          onRetry: () => ref.invalidate(_adminInvoicesProvider),
          data: (items) {
            if (items.isEmpty) {
              return LayoutBuilder(
                builder: (context, constraints) => ListView(
                  children: [
                    SizedBox(
                      height: constraints.maxHeight,
                      child: const Center(child: Text('Aucune facture générée.')),
                    ),
                  ],
                ),
              );
            }
            return ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, i) {
                final inv = items[i];
                final o = inv.order;
                return Card(
                  child: ListTile(
                    leading: const Icon(Icons.receipt_long_outlined, color: AppTheme.primary),
                    title: Text(inv.reference),
                    subtitle: Text('${o.clientNom ?? '-'} · ${formatDate(inv.createdAt)}'),
                    trailing: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(formatMoney(inv.total), style: const TextStyle(fontWeight: FontWeight.bold)),
                        Text(paymentStatusLabel(o.statutPaiement), style: TextStyle(fontSize: 11, color: Colors.grey[600])),
                      ],
                    ),
                    onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => AdminInvoiceDetailScreen(invoiceId: inv.id))),
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
