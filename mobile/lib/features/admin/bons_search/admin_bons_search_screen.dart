import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/async_value_widget.dart';
import '../../../models/order.dart';
import '../../../models/stock_receipt.dart';
import '../../../services/service_providers.dart';
import '../orders/admin_order_detail_screen.dart';
import '../stock/admin_stock_receipt_detail_screen.dart';

enum _BonType { commande, reception }

/// One row of the merged, searchable "bons" history — wraps either an
/// [OrderView] (bon de commande) or a [StockReceiptView] (bon de
/// réception) behind a single shape so both can be searched, sorted and
/// rendered together.
class _Bon {
  _Bon.fromOrder(OrderView o)
      : type = _BonType.commande,
        id = o.id,
        reference = o.reference,
        title = o.nom != null && o.nom!.isNotEmpty ? o.nom! : o.reference,
        counterparty = o.clientNom ?? '-',
        total = o.total,
        createdAt = o.createdAt;

  _Bon.fromReceipt(StockReceiptView r)
      : type = _BonType.reception,
        id = r.id,
        reference = r.reference,
        title = r.reference,
        counterparty = r.fabricantNom,
        total = r.total,
        createdAt = r.createdAt;

  final _BonType type;
  final String id;
  final String reference;
  final String title;
  final String counterparty;
  final double total;
  final DateTime createdAt;

  bool matches(String query) =>
      reference.toLowerCase().contains(query) || title.toLowerCase().contains(query) || counterparty.toLowerCase().contains(query);
}

final _allBonsProvider = FutureProvider.autoDispose<List<_Bon>>((ref) async {
  final orders = await ref.watch(ordersApiProvider).listAdmin();
  final receipts = await ref.watch(stockReceiptsApiProvider).list();
  final bons = [...orders.map(_Bon.fromOrder), ...receipts.map(_Bon.fromReceipt)];
  bons.sort((a, b) => b.createdAt.compareTo(a.createdAt));
  return bons;
});

/// Search across both bon types at once — a client remembering "some order
/// from last week" or a fabricant's reception doesn't need to know which
/// list it's in; this searches commandes and réceptions together by
/// référence/nom/contrepartie and routes to the right detail screen.
class AdminBonsSearchScreen extends ConsumerStatefulWidget {
  const AdminBonsSearchScreen({super.key});

  @override
  ConsumerState<AdminBonsSearchScreen> createState() => _AdminBonsSearchScreenState();
}

class _AdminBonsSearchScreenState extends ConsumerState<AdminBonsSearchScreen> {
  String _query = '';
  _BonType? _typeFilter;

  @override
  Widget build(BuildContext context) {
    final bons = ref.watch(_allBonsProvider);

    return Scaffold(
      appBar: AppBar(
        title: TextField(
          autofocus: true,
          style: const TextStyle(color: Colors.white),
          decoration: const InputDecoration(
            hintText: 'Rechercher un bon (référence, nom, client, fournisseur...)',
            hintStyle: TextStyle(color: Colors.white70),
            border: InputBorder.none,
          ),
          onChanged: (v) => setState(() => _query = v.trim().toLowerCase()),
        ),
      ),
      body: Column(
        children: [
          SizedBox(
            height: 48,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              children: [
                _TypeChip(label: 'Tous', selected: _typeFilter == null, onTap: () => setState(() => _typeFilter = null)),
                _TypeChip(
                  label: 'Commandes',
                  selected: _typeFilter == _BonType.commande,
                  onTap: () => setState(() => _typeFilter = _BonType.commande),
                ),
                _TypeChip(
                  label: 'Réceptions',
                  selected: _typeFilter == _BonType.reception,
                  onTap: () => setState(() => _typeFilter = _BonType.reception),
                ),
              ],
            ),
          ),
          Expanded(
            child: AsyncValueWidget<List<_Bon>>(
              value: bons,
              onRetry: () => ref.invalidate(_allBonsProvider),
              data: (items) {
                var filtered = _typeFilter == null ? items : items.where((b) => b.type == _typeFilter).toList();
                if (_query.isNotEmpty) filtered = filtered.where((b) => b.matches(_query)).toList();

                if (filtered.isEmpty) {
                  return Center(
                    child: Text(
                      _query.isEmpty ? 'Tapez pour rechercher un bon.' : 'Aucun bon trouvé pour "$_query".',
                      textAlign: TextAlign.center,
                    ),
                  );
                }

                return ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: filtered.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, i) {
                    final b = filtered[i];
                    final isCommande = b.type == _BonType.commande;
                    return Card(
                      child: ListTile(
                        leading: CircleAvatar(
                          backgroundColor: (isCommande ? AppTheme.primary : AppTheme.warning).withValues(alpha: 0.12),
                          child: Icon(isCommande ? Icons.receipt_long_outlined : Icons.local_shipping_outlined,
                              color: isCommande ? AppTheme.primary : AppTheme.warning, size: 20),
                        ),
                        title: Text(b.title, maxLines: 1, overflow: TextOverflow.ellipsis),
                        subtitle: Text('${b.counterparty} · ${formatDate(b.createdAt)}'),
                        trailing: Text(formatMoney(b.total), style: const TextStyle(fontWeight: FontWeight.bold)),
                        onTap: () {
                          if (isCommande) {
                            Navigator.of(context).push(MaterialPageRoute(builder: (_) => AdminOrderDetailScreen(orderId: b.id)));
                          } else {
                            Navigator.of(context).push(MaterialPageRoute(builder: (_) => AdminStockReceiptDetailScreen(receiptId: b.id)));
                          }
                        },
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _TypeChip extends StatelessWidget {
  const _TypeChip({required this.label, required this.selected, required this.onTap});
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(label: Text(label), selected: selected, onSelected: (_) => onTap()),
    );
  }
}
