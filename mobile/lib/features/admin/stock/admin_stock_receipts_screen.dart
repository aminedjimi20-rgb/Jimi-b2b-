import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/utils/quick_date_filter.dart';
import '../../../core/widgets/async_value_widget.dart';
import '../../../core/widgets/dated_collapsible_list.dart';
import '../../../core/widgets/quick_date_filter_bar.dart';
import '../../../models/stock_receipt.dart';
import '../../../services/service_providers.dart';
import '../bons_search/admin_bons_search_screen.dart';
import 'admin_stock_receipt_detail_screen.dart';
import 'admin_stock_receipt_form_screen.dart';

enum _SortOption { recent, oldest, amountAsc, amountDesc, fabricantAz, fabricantZa, articleCount }

extension on _SortOption {
  String get label => switch (this) {
        _SortOption.recent => 'Plus récent',
        _SortOption.oldest => 'Plus ancien',
        _SortOption.amountAsc => 'Montant croissant',
        _SortOption.amountDesc => 'Montant décroissant',
        _SortOption.fabricantAz => 'Fournisseur A → Z',
        _SortOption.fabricantZa => 'Fournisseur Z → A',
        _SortOption.articleCount => "Nombre d'articles",
      };

  int compare(StockReceiptView a, StockReceiptView b) => switch (this) {
        _SortOption.recent => b.createdAt.compareTo(a.createdAt),
        _SortOption.oldest => a.createdAt.compareTo(b.createdAt),
        _SortOption.amountAsc => a.totalApresRemise.compareTo(b.totalApresRemise),
        _SortOption.amountDesc => b.totalApresRemise.compareTo(a.totalApresRemise),
        _SortOption.fabricantAz => a.fabricantNom.toLowerCase().compareTo(b.fabricantNom.toLowerCase()),
        _SortOption.fabricantZa => b.fabricantNom.toLowerCase().compareTo(a.fabricantNom.toLowerCase()),
        _SortOption.articleCount => b.items.length.compareTo(a.items.length),
      };
}

final _stockReceiptsProvider = FutureProvider.autoDispose<List<StockReceiptView>>((ref) {
  return ref.watch(stockReceiptsApiProvider).list();
});

typedef _LocalDraftRow = ({String formKey, Map<String, dynamic> data, DateTime updatedAt});

final _localDraftsProvider = FutureProvider.autoDispose<List<_LocalDraftRow>>((ref) {
  return ref.watch(appDatabaseProvider).readDraftsByPrefix(adminStockReceiptDraftKeyPrefix);
});

/// List of past "bons de réception" (goods received from fabricants) — any
/// unfinished brouillon (a local in-progress form, or an Employee's
/// server-side BROUILLON awaiting confirmation, see Phase 38) surfaces in
/// its own section, never mixed with confirmed bons. Confirmed bons group
/// by calendar day: today is open, earlier days collapse into one-line
/// cards so the list stays fast and scannable at any scale (points 51-61).
class AdminStockReceiptsScreen extends ConsumerStatefulWidget {
  const AdminStockReceiptsScreen({super.key});

  @override
  ConsumerState<AdminStockReceiptsScreen> createState() => _AdminStockReceiptsScreenState();
}

class _AdminStockReceiptsScreenState extends ConsumerState<AdminStockReceiptsScreen> {
  bool _searchActive = false;
  String _query = '';
  QuickDateFilter _dateFilter = QuickDateFilter.all;
  DateTimeRange? _customRange;
  _SortOption _sort = _SortOption.recent;
  bool _showAllDays = false;

  bool _matches(StockReceiptView r, String q) {
    if (r.reference.toLowerCase().contains(q)) return true;
    if (r.fabricantNom.toLowerCase().contains(q)) return true;
    if (r.numeroBonFournisseur?.toLowerCase().contains(q) == true) return true;
    return r.items.any((i) => i.nom.toLowerCase().contains(q) || i.code.toLowerCase().contains(q));
  }

  Future<void> _openForm({String? draftKey}) async {
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => AdminStockReceiptFormScreen(draftKey: draftKey)));
    ref.invalidate(_stockReceiptsProvider);
    ref.invalidate(_localDraftsProvider);
  }

  Future<void> _discardLocalDraft(String formKey) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Supprimer ce brouillon ?'),
        content: const Text('Le contenu non enregistré sera perdu.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Annuler')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: AppTheme.danger),
            child: const Text('Supprimer'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await ref.read(appDatabaseProvider).clearDraft(formKey);
    ref.invalidate(_localDraftsProvider);
  }

  @override
  Widget build(BuildContext context) {
    final receiptsAsync = ref.watch(_stockReceiptsProvider);
    final draftsAsync = ref.watch(_localDraftsProvider);

    return Scaffold(
      appBar: AppBar(
        title: _searchActive
            ? TextField(
                autofocus: true,
                style: const TextStyle(color: Colors.white),
                decoration: const InputDecoration(
                  hintText: 'Numéro, fournisseur, article...',
                  hintStyle: TextStyle(color: Colors.white70),
                  border: InputBorder.none,
                ),
                onChanged: (v) => setState(() => _query = v.trim().toLowerCase()),
              )
            : const Text('Réceptions fournisseurs'),
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
              PopupMenuItem(value: 'toggle_old', child: Text(_showAllDays ? 'Masquer les anciens bons' : 'Afficher tous les anciens bons')),
            ],
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openForm,
        icon: const Icon(Icons.add),
        label: const Text('Nouveau bon'),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(_stockReceiptsProvider);
          ref.invalidate(_localDraftsProvider);
        },
        child: AsyncValueWidget<List<StockReceiptView>>(
          value: receiptsAsync,
          onRetry: () => ref.invalidate(_stockReceiptsProvider),
          data: (allItems) {
            final localDrafts = draftsAsync.valueOrNull ?? const <_LocalDraftRow>[];
            final serverBrouillons = allItems.where((r) => r.isBrouillon).toList();
            var confirmed = allItems.where((r) => !r.isBrouillon).toList();

            final range = quickDateRange(_dateFilter, custom: _customRange);
            if (range.from != null) confirmed = confirmed.where((r) => !r.createdAt.toLocal().isBefore(range.from!)).toList();
            if (range.to != null) confirmed = confirmed.where((r) => r.createdAt.toLocal().isBefore(range.to!)).toList();
            if (_query.isNotEmpty) confirmed = confirmed.where((r) => _matches(r, _query)).toList();
            confirmed.sort(_sort.compare);

            final hasBrouillons = localDrafts.isNotEmpty || serverBrouillons.isNotEmpty;
            final isFiltered = _query.isNotEmpty || _dateFilter != QuickDateFilter.all;

            return Column(
              children: [
                QuickDateFilterBar(
                  selected: _dateFilter,
                  customRange: _customRange,
                  onChanged: (f, custom) => setState(() {
                    _dateFilter = f;
                    if (custom != null) _customRange = custom;
                  }),
                ),
                const SizedBox(height: 4),
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
                      Text('${confirmed.length} bon${confirmed.length == 1 ? '' : 's'}', style: TextStyle(color: Colors.grey[600], fontSize: 12)),
                    ],
                  ),
                ),
                Expanded(
                  child: DatedCollapsibleList<StockReceiptView>(
                    items: confirmed,
                    dateOf: (r) => r.createdAt,
                    forceExpandAll: _showAllDays,
                    emptyMessage: isFiltered
                        ? 'Aucun bon ne correspond à votre recherche.'
                        : "Aucun bon de réception pour le moment.\nCréez-en un quand une livraison arrive.",
                    pinnedHeader: !hasBrouillons
                        ? null
                        : _BrouillonsSection(
                            localDrafts: localDrafts,
                            serverBrouillons: serverBrouillons,
                            onOpenDraft: (key) => _openForm(draftKey: key),
                            onDiscardDraft: _discardLocalDraft,
                          ),
                    itemBuilder: (context, r) => Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Card(
                        child: ListTile(
                          leading: const Icon(Icons.inventory_2_outlined),
                          title: Text(r.reference),
                          subtitle: Text('${r.fabricantNom} · ${formatDate(r.createdAt)} · ${r.items.length} article${r.items.length == 1 ? '' : 's'}'),
                          trailing: Text(formatMoney(r.totalApresRemise), style: const TextStyle(fontWeight: FontWeight.bold)),
                          onTap: () async {
                            await Navigator.of(context).push(MaterialPageRoute(builder: (_) => AdminStockReceiptDetailScreen(receiptId: r.id)));
                            ref.invalidate(_stockReceiptsProvider);
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
    );
  }
}

class _BrouillonsSection extends StatelessWidget {
  const _BrouillonsSection({
    required this.localDrafts,
    required this.serverBrouillons,
    required this.onOpenDraft,
    required this.onDiscardDraft,
  });

  final List<_LocalDraftRow> localDrafts;
  final List<StockReceiptView> serverBrouillons;
  final void Function(String formKey) onOpenDraft;
  final void Function(String formKey) onDiscardDraft;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('BROUILLONS', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold, color: AppTheme.warning)),
          const SizedBox(height: 8),
          for (final draft in localDrafts)
            _LocalDraftCard(
              data: draft.data,
              updatedAt: draft.updatedAt,
              onTap: () => onOpenDraft(draft.formKey),
              onDiscard: () => onDiscardDraft(draft.formKey),
            ),
          for (final r in serverBrouillons) _ServerBrouillonCard(receipt: r),
        ],
      ),
    );
  }
}

class _LocalDraftCard extends StatelessWidget {
  const _LocalDraftCard({required this.data, required this.updatedAt, required this.onTap, required this.onDiscard});
  final Map<String, dynamic> data;
  final DateTime updatedAt;
  final VoidCallback onTap;
  final VoidCallback onDiscard;

  @override
  Widget build(BuildContext context) {
    final fabricantNom = data['fabricantNom'] as String?;
    final items = data['items'] as List<dynamic>? ?? [];
    return Card(
      color: AppTheme.warning.withValues(alpha: 0.06),
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: const Icon(Icons.edit_note_outlined, color: AppTheme.warning),
        title: Text(fabricantNom == null || fabricantNom.isEmpty ? 'Bon fournisseur brouillon' : 'Bon fournisseur brouillon · $fabricantNom'),
        subtitle: Text('${items.length} article${items.length == 1 ? '' : 's'} · modifié ${formatDate(updatedAt)}'),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextButton(onPressed: onTap, child: const Text('Continuer')),
            IconButton(icon: const Icon(Icons.delete_outline, color: AppTheme.danger), tooltip: 'Supprimer', onPressed: onDiscard),
          ],
        ),
        onTap: onTap,
      ),
    );
  }
}

class _ServerBrouillonCard extends StatelessWidget {
  const _ServerBrouillonCard({required this.receipt});
  final StockReceiptView receipt;

  @override
  Widget build(BuildContext context) {
    return Card(
      color: AppTheme.warning.withValues(alpha: 0.06),
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: const Icon(Icons.move_to_inbox_outlined, color: AppTheme.warning),
        title: Text('${receipt.reference} · ${receipt.fabricantNom}'),
        subtitle: Text(
          '${receipt.employeeNom != null ? 'Par ${receipt.employeeNom} · ' : ''}${receipt.items.length} article${receipt.items.length == 1 ? '' : 's'} · en attente de confirmation',
        ),
        trailing: const Text('Voir'),
        onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => AdminStockReceiptDetailScreen(receiptId: receipt.id))),
      ),
    );
  }
}
