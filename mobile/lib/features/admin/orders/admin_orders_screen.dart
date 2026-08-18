import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/utils/quick_date_filter.dart';
import '../../../core/widgets/async_value_widget.dart';
import '../../../core/widgets/dated_collapsible_list.dart';
import '../../../core/widgets/quick_date_filter_bar.dart';
import '../../../models/order.dart';
import '../../../services/service_providers.dart';
import '../bons_search/admin_bons_search_screen.dart';
import 'admin_create_order_screen.dart';
import 'admin_order_detail_screen.dart';

final _statusFilterProvider = StateProvider.autoDispose<String?>((ref) => null);

final _adminOrdersProvider = FutureProvider.autoDispose<List<OrderView>>((ref) {
  final status = ref.watch(_statusFilterProvider);
  return ref.watch(ordersApiProvider).listAdmin(status: status);
});

enum _SortOption { recent, oldest, amountAsc, amountDesc, clientAz, clientZa, itemCount }

extension on _SortOption {
  String get label => switch (this) {
        _SortOption.recent => 'Plus récent',
        _SortOption.oldest => 'Plus ancien',
        _SortOption.amountAsc => 'Montant croissant',
        _SortOption.amountDesc => 'Montant décroissant',
        _SortOption.clientAz => 'Client A → Z',
        _SortOption.clientZa => 'Client Z → A',
        _SortOption.itemCount => "Nombre d'articles",
      };

  int compare(OrderView a, OrderView b) => switch (this) {
        _SortOption.recent => b.createdAt.compareTo(a.createdAt),
        _SortOption.oldest => a.createdAt.compareTo(b.createdAt),
        _SortOption.amountAsc => a.total.compareTo(b.total),
        _SortOption.amountDesc => b.total.compareTo(a.total),
        _SortOption.clientAz => (a.clientNom ?? '').toLowerCase().compareTo((b.clientNom ?? '').toLowerCase()),
        _SortOption.clientZa => (b.clientNom ?? '').toLowerCase().compareTo((a.clientNom ?? '').toLowerCase()),
        _SortOption.itemCount => b.items.length.compareTo(a.items.length),
      };
}

/// Same "never dump the whole history on screen" logic as
/// AdminStockReceiptsScreen (spec point 60): today's commandes are open,
/// earlier days collapse into one-line cards, and search/period/tri filters
/// live in the list itself instead of a separate screen.
class AdminOrdersScreen extends ConsumerStatefulWidget {
  const AdminOrdersScreen({super.key});

  @override
  ConsumerState<AdminOrdersScreen> createState() => _AdminOrdersScreenState();
}

class _AdminOrdersScreenState extends ConsumerState<AdminOrdersScreen> {
  bool _searchActive = false;
  String _query = '';
  QuickDateFilter _dateFilter = QuickDateFilter.all;
  DateTimeRange? _customRange;
  _SortOption _sort = _SortOption.recent;
  bool _showAllDays = false;

  bool _matches(OrderView o, String q) {
    if (o.reference.toLowerCase().contains(q)) return true;
    if ((o.nom ?? '').toLowerCase().contains(q)) return true;
    if ((o.clientNom ?? '').toLowerCase().contains(q)) return true;
    if (o.telephoneContact.toLowerCase().contains(q)) return true;
    if (o.total.toStringAsFixed(0).contains(q)) return true;
    return o.items.any((i) => i.nom.toLowerCase().contains(q) || i.code.toLowerCase().contains(q));
  }

  @override
  Widget build(BuildContext context) {
    final orders = ref.watch(_adminOrdersProvider);
    final selectedStatus = ref.watch(_statusFilterProvider);

    return Scaffold(
      appBar: AppBar(
        title: _searchActive
            ? TextField(
                autofocus: true,
                style: const TextStyle(color: Colors.white),
                decoration: const InputDecoration(
                  hintText: 'Numéro, client, produit, montant...',
                  hintStyle: TextStyle(color: Colors.white70),
                  border: InputBorder.none,
                ),
                onChanged: (v) => setState(() => _query = v.trim().toLowerCase()),
              )
            : const Text('Commandes'),
        actions: [
          IconButton(
            icon: Icon(_searchActive ? Icons.close : Icons.search),
            tooltip: _searchActive ? 'Fermer la recherche' : 'Rechercher dans cette liste',
            onPressed: () => setState(() {
              _searchActive = !_searchActive;
              if (!_searchActive) _query = '';
            }),
          ),
          PopupMenuButton<String>(
            onSelected: (v) {
              if (v == 'global') {
                Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AdminBonsSearchScreen()));
              } else if (v == 'toggle_old') {
                setState(() => _showAllDays = !_showAllDays);
              }
            },
            itemBuilder: (context) => [
              const PopupMenuItem(value: 'global', child: Text('Recherche globale (bons + commandes)')),
              PopupMenuItem(value: 'toggle_old', child: Text(_showAllDays ? 'Masquer les anciennes commandes' : 'Afficher toutes les anciennes commandes')),
            ],
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AdminCreateOrderScreen()));
          ref.invalidate(_adminOrdersProvider);
        },
        icon: const Icon(Icons.point_of_sale_outlined),
        label: const Text('Commande comptoir'),
      ),
      body: Column(
        children: [
          SizedBox(
            height: 48,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              children: [
                _FilterChip(label: 'Toutes', selected: selectedStatus == null, onTap: () => ref.read(_statusFilterProvider.notifier).state = null),
                ...kOrderStatuses.map((s) => _FilterChip(
                      label: orderStatusLabel(s),
                      selected: selectedStatus == s,
                      onTap: () => ref.read(_statusFilterProvider.notifier).state = s,
                    )),
              ],
            ),
          ),
          QuickDateFilterBar(
            selected: _dateFilter,
            customRange: _customRange,
            onChanged: (f, custom) => setState(() {
              _dateFilter = f;
              if (custom != null) _customRange = custom;
            }),
          ),
          const SizedBox(height: 4),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async => ref.invalidate(_adminOrdersProvider),
              child: AsyncValueWidget<List<OrderView>>(
                value: orders,
                onRetry: () => ref.invalidate(_adminOrdersProvider),
                data: (items) {
                  var filtered = items;
                  final range = quickDateRange(_dateFilter, custom: _customRange);
                  if (range.from != null) filtered = filtered.where((o) => !o.createdAt.toLocal().isBefore(range.from!)).toList();
                  if (range.to != null) filtered = filtered.where((o) => o.createdAt.toLocal().isBefore(range.to!)).toList();
                  if (_query.isNotEmpty) filtered = filtered.where((o) => _matches(o, _query)).toList();
                  filtered = [...filtered]..sort(_sort.compare);

                  final isFiltered = _query.isNotEmpty || _dateFilter != QuickDateFilter.all;

                  return Column(
                    children: [
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        child: Row(
                          children: [
                            Expanded(
                              child: DropdownButtonHideUnderline(
                                child: DropdownButton<_SortOption>(
                                  isDense: true,
                                  value: _sort,
                                  items: _SortOption.values
                                      .map((s) => DropdownMenuItem(value: s, child: Text(s.label, style: const TextStyle(fontSize: 13))))
                                      .toList(),
                                  onChanged: (v) => setState(() => _sort = v!),
                                ),
                              ),
                            ),
                            Text('${filtered.length} commande${filtered.length == 1 ? '' : 's'}', style: TextStyle(color: Colors.grey[600], fontSize: 12)),
                          ],
                        ),
                      ),
                      Expanded(
                        child: DatedCollapsibleList<OrderView>(
                          items: filtered,
                          dateOf: (o) => o.createdAt,
                          forceExpandAll: _showAllDays,
                          emptyMessage: isFiltered ? 'Aucune commande ne correspond à votre recherche.' : 'Aucune commande.',
                          itemBuilder: (context, o) => Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: Card(
                              child: ListTile(
                                title: Text(
                                  o.nom != null && o.nom!.isNotEmpty ? '${o.nom} (${o.reference})' : o.reference,
                                  style: const TextStyle(fontWeight: FontWeight.bold),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                subtitle: Text('${o.clientNom ?? ''} · ${o.items.length} article${o.items.length == 1 ? '' : 's'}'),
                                trailing: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Text(formatMoney(o.total), style: const TextStyle(fontWeight: FontWeight.bold)),
                                    Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        _PaymentBadge(status: o.statutPaiement),
                                        const SizedBox(width: 4),
                                        _StatusBadge(status: o.status),
                                      ],
                                    ),
                                  ],
                                ),
                                onTap: () async {
                                  await Navigator.of(context).push(MaterialPageRoute(builder: (_) => AdminOrderDetailScreen(orderId: o.id)));
                                  ref.invalidate(_adminOrdersProvider);
                                },
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
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

class _FilterChip extends StatelessWidget {
  const _FilterChip({required this.label, required this.selected, required this.onTap});
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

class _PaymentBadge extends StatelessWidget {
  const _PaymentBadge({required this.status});
  final String status;

  Color get _color {
    switch (status) {
      case 'PAYE':
        return AppTheme.success;
      case 'PARTIEL':
        return AppTheme.warning;
      default:
        return AppTheme.danger;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 4),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: _color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
      child: Text(paymentStatusLabel(status), style: TextStyle(color: _color, fontSize: 11, fontWeight: FontWeight.w600)),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.status});
  final String status;

  Color get _color {
    switch (status) {
      case 'LIVREE':
        return AppTheme.success;
      case 'ANNULEE':
        return AppTheme.danger;
      case 'EN_ATTENTE':
        return AppTheme.warning;
      default:
        return AppTheme.primary;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 4),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: _color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
      child: Text(orderStatusLabel(status), style: TextStyle(color: _color, fontSize: 11, fontWeight: FontWeight.w600)),
    );
  }
}
