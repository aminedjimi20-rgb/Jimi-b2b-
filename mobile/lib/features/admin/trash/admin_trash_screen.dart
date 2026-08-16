import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/async_value_widget.dart';
import '../../../models/category.dart';
import '../../../models/client.dart';
import '../../../models/fabricant.dart';
import '../../../models/order.dart';
import '../../../models/product.dart';
import '../../../models/stock_receipt.dart';
import '../../../models/transporteur.dart';
import '../../../services/service_providers.dart';

final _productsTrashProvider = FutureProvider.autoDispose<List<AdminProduct>>((ref) => ref.watch(productsApiProvider).trash());
final _clientsTrashProvider = FutureProvider.autoDispose<List<ClientView>>((ref) => ref.watch(clientsApiProvider).trash());
final _fabricantsTrashProvider = FutureProvider.autoDispose<List<Fabricant>>((ref) => ref.watch(fabricantsApiProvider).trash());
final _categoriesTrashProvider = FutureProvider.autoDispose<List<Category>>((ref) => ref.watch(categoriesApiProvider).trash());
final _ordersTrashProvider = FutureProvider.autoDispose<List<OrderView>>((ref) => ref.watch(ordersApiProvider).trash());
final _receiptsTrashProvider = FutureProvider.autoDispose<List<StockReceiptView>>((ref) => ref.watch(stockReceiptsApiProvider).trash());
final _transporteursTrashProvider = FutureProvider.autoDispose<List<Transporteur>>((ref) => ref.watch(transporteursApiProvider).trash());

/// Corbeille — items moved here by "Supprimer" across the app can be
/// restored or erased for good, one tab per entity type.
class AdminTrashScreen extends StatelessWidget {
  const AdminTrashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 7,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Corbeille'),
          bottom: const TabBar(
            isScrollable: true,
            tabs: [
              Tab(text: 'Produits'),
              Tab(text: 'Clients'),
              Tab(text: 'Fournisseurs'),
              Tab(text: 'Catégories'),
              Tab(text: 'Commandes'),
              Tab(text: 'Bons réception'),
              Tab(text: 'Transporteurs'),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            _TrashList<AdminProduct>(
              provider: _productsTrashProvider,
              idOf: (p) => p.id,
              titleOf: (p) => p.nom,
              subtitleOf: (p) => '${p.code} · ${formatMoney(p.prixVente)}',
              onRestore: (ref, id) => ref.read(productsApiProvider).restore(id),
              onPermanentDelete: (ref, id) => ref.read(productsApiProvider).permanentDelete(id),
              entityLabel: 'ce produit',
              emptyText: 'Corbeille des produits vide.',
            ),
            _TrashList<ClientView>(
              provider: _clientsTrashProvider,
              idOf: (c) => c.id,
              titleOf: (c) => c.raisonSociale,
              subtitleOf: (c) => c.telephone,
              onRestore: (ref, id) => ref.read(clientsApiProvider).restore(id),
              onPermanentDelete: (ref, id) => ref.read(clientsApiProvider).permanentDelete(id),
              entityLabel: 'ce client',
              emptyText: 'Corbeille des clients vide.',
            ),
            _TrashList<Fabricant>(
              provider: _fabricantsTrashProvider,
              idOf: (f) => f.id,
              titleOf: (f) => f.nom,
              subtitleOf: (f) => f.telephone ?? f.adresse ?? '—',
              onRestore: (ref, id) => ref.read(fabricantsApiProvider).restore(id),
              onPermanentDelete: (ref, id) => ref.read(fabricantsApiProvider).permanentDelete(id),
              entityLabel: 'ce fournisseur',
              emptyText: 'Corbeille des fournisseurs vide.',
            ),
            _TrashList<Category>(
              provider: _categoriesTrashProvider,
              idOf: (c) => c.id,
              titleOf: (c) => c.nom,
              subtitleOf: (c) => '${c.productCount} produit${c.productCount == 1 ? '' : 's'}',
              onRestore: (ref, id) => ref.read(categoriesApiProvider).restore(id),
              onPermanentDelete: (ref, id) => ref.read(categoriesApiProvider).permanentDelete(id),
              entityLabel: 'cette catégorie',
              emptyText: 'Corbeille des catégories vide.',
            ),
            _TrashList<OrderView>(
              provider: _ordersTrashProvider,
              idOf: (o) => o.id,
              titleOf: (o) => (o.nom != null && o.nom!.isNotEmpty) ? '${o.nom} (${o.reference})' : o.reference,
              subtitleOf: (o) => '${o.clientNom ?? '-'} · ${formatDate(o.createdAt)} · ${formatMoney(o.total)}',
              onRestore: (ref, id) => ref.read(ordersApiProvider).restore(id),
              onPermanentDelete: (ref, id) => ref.read(ordersApiProvider).permanentDelete(id),
              entityLabel: 'cette commande',
              emptyText: 'Corbeille des commandes vide.',
            ),
            _TrashList<StockReceiptView>(
              provider: _receiptsTrashProvider,
              idOf: (r) => r.id,
              titleOf: (r) => r.reference,
              subtitleOf: (r) => '${r.fabricantNom} · ${formatDate(r.createdAt)} · ${formatMoney(r.total)}',
              onRestore: (ref, id) => ref.read(stockReceiptsApiProvider).restore(id),
              onPermanentDelete: (ref, id) => ref.read(stockReceiptsApiProvider).permanentDelete(id),
              entityLabel: 'ce bon de réception',
              emptyText: 'Corbeille des bons de réception vide.',
            ),
            _TrashList<Transporteur>(
              provider: _transporteursTrashProvider,
              idOf: (t) => t.id,
              titleOf: (t) => t.nom,
              subtitleOf: (t) => '${t.rates.length} tarif${t.rates.length == 1 ? '' : 's'}',
              onRestore: (ref, id) => ref.read(transporteursApiProvider).restore(id),
              onPermanentDelete: (ref, id) => ref.read(transporteursApiProvider).permanentDelete(id),
              entityLabel: 'ce transporteur',
              emptyText: 'Corbeille des transporteurs vide.',
            ),
          ],
        ),
      ),
    );
  }
}

class _TrashList<T> extends ConsumerWidget {
  const _TrashList({
    required this.provider,
    required this.idOf,
    required this.titleOf,
    required this.subtitleOf,
    required this.onRestore,
    required this.onPermanentDelete,
    required this.entityLabel,
    required this.emptyText,
  });

  final AutoDisposeFutureProvider<List<T>> provider;
  final String Function(T) idOf;
  final String Function(T) titleOf;
  final String Function(T) subtitleOf;
  final Future<void> Function(WidgetRef ref, String id) onRestore;
  final Future<void> Function(WidgetRef ref, String id) onPermanentDelete;
  final String entityLabel;
  final String emptyText;

  Future<void> _restore(BuildContext context, WidgetRef ref, String id) async {
    try {
      await onRestore(ref, id);
      ref.invalidate(provider);
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e is ApiException ? e.message : 'Erreur.')));
      }
    }
  }

  Future<void> _confirmPermanentDelete(BuildContext context, WidgetRef ref, String id) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Supprimer définitivement ?'),
        content: Text('$entityLabel sera effacé pour toujours. Cette action ne peut pas être annulée.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Annuler')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: AppTheme.danger),
            child: const Text('Supprimer définitivement'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    try {
      await onPermanentDelete(ref, id);
      ref.invalidate(provider);
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e is ApiException ? e.message : 'Erreur.')));
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final items = ref.watch(provider);

    return RefreshIndicator(
      onRefresh: () async => ref.invalidate(provider),
      child: AsyncValueWidget<List<T>>(
        value: items,
        onRetry: () => ref.invalidate(provider),
        data: (list) {
          if (list.isEmpty) {
            return LayoutBuilder(
              builder: (context, constraints) => ListView(
                children: [
                  SizedBox(
                    height: constraints.maxHeight,
                    child: Center(child: Text(emptyText, textAlign: TextAlign.center)),
                  ),
                ],
              ),
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: list.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, i) {
              final item = list[i];
              final id = idOf(item);
              return Card(
                child: ListTile(
                  title: Text(titleOf(item), maxLines: 1, overflow: TextOverflow.ellipsis),
                  subtitle: Text(subtitleOf(item)),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        icon: const Icon(Icons.restore),
                        tooltip: 'Restaurer',
                        onPressed: () => _restore(context, ref, id),
                      ),
                      IconButton(
                        icon: const Icon(Icons.delete_forever, color: AppTheme.danger),
                        tooltip: 'Supprimer définitivement',
                        onPressed: () => _confirmPermanentDelete(context, ref, id),
                      ),
                    ],
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
