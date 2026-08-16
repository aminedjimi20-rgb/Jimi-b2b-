import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/async_value_widget.dart';
import '../../../models/fabricant.dart';
import '../../../models/order.dart';
import '../../../models/product.dart';
import '../../../services/service_providers.dart';
import '../products/admin_product_tile.dart';
import '../stock/admin_stock_receipt_detail_screen.dart';

final _fabricantDetailProvider = FutureProvider.autoDispose.family<FabricantDetail, String>((ref, id) {
  return ref.watch(fabricantsApiProvider).getOne(id);
});

/// Fiche fournisseur complète — infos, articles associés (recherche +
/// association, pas tout le catalogue), bons de réception et historique
/// des paiements, avec les totaux acheté/payé/reste toujours dérivés.
class AdminFabricantDetailScreen extends ConsumerStatefulWidget {
  const AdminFabricantDetailScreen({super.key, required this.fabricantId});
  final String fabricantId;

  @override
  ConsumerState<AdminFabricantDetailScreen> createState() => _AdminFabricantDetailScreenState();
}

class _AdminFabricantDetailScreenState extends ConsumerState<AdminFabricantDetailScreen> {
  bool _deleting = false;

  void _invalidate() => ref.invalidate(_fabricantDetailProvider(widget.fabricantId));

  Future<void> _confirmDelete(FabricantDetail f) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Supprimer ce fournisseur ?'),
        content: Text('"${f.nom}" sera déplacé vers la corbeille. Vous pourrez le restaurer plus tard.'),
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

    setState(() => _deleting = true);
    try {
      await ref.read(fabricantsApiProvider).remove(f.id);
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        setState(() => _deleting = false);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e is ApiException ? e.message : 'Erreur.')));
      }
    }
  }

  Future<void> _editFabricant(FabricantDetail f) async {
    final nom = TextEditingController(text: f.nom);
    final telephone = TextEditingController(text: f.telephone ?? '');
    final adresse = TextEditingController(text: f.adresse ?? '');
    final email = TextEditingController(text: f.email ?? '');
    final notes = TextEditingController(text: f.notesInternes ?? '');
    String? error;

    final saved = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('Modifier le fournisseur'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(controller: nom, decoration: const InputDecoration(labelText: 'Nom')),
                const SizedBox(height: 12),
                TextField(controller: telephone, decoration: const InputDecoration(labelText: 'Téléphone')),
                const SizedBox(height: 12),
                TextField(controller: adresse, decoration: const InputDecoration(labelText: 'Adresse')),
                const SizedBox(height: 12),
                TextField(controller: email, decoration: const InputDecoration(labelText: 'Email')),
                const SizedBox(height: 12),
                TextField(controller: notes, decoration: const InputDecoration(labelText: 'Notes internes'), maxLines: 3),
                if (error != null) ...[
                  const SizedBox(height: 8),
                  Text(error!, style: const TextStyle(color: AppTheme.danger)),
                ],
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Annuler')),
            ElevatedButton(
              onPressed: () async {
                if (nom.text.trim().isEmpty) {
                  setDialogState(() => error = 'Le nom est requis.');
                  return;
                }
                try {
                  await ref.read(fabricantsApiProvider).update(
                        f.id,
                        nom: nom.text.trim(),
                        telephone: telephone.text.trim(),
                        adresse: adresse.text.trim(),
                        email: email.text.trim(),
                        notesInternes: notes.text.trim(),
                      );
                  if (ctx.mounted) Navigator.pop(ctx, true);
                } catch (e) {
                  setDialogState(() => error = e is ApiException ? e.message : 'Erreur.');
                }
              },
              child: const Text('Enregistrer'),
            ),
          ],
        ),
      ),
    );

    if (saved == true) _invalidate();
  }

  Future<void> _addProduct(FabricantDetail f) async {
    final products = await ref.read(productsApiProvider).listAdmin();
    if (!mounted) return;
    final linkedIds = f.products.map((p) => p.id).toSet();
    final selected = await showModalBottomSheet<AdminProduct>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _ProductAssociationPickerSheet(products: products, alreadyLinkedIds: linkedIds),
    );
    if (selected == null) return;

    try {
      await ref.read(fabricantsApiProvider).associateProduct(f.id, selected.id);
      _invalidate();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e is ApiException ? e.message : 'Erreur.')));
      }
    }
  }

  Future<void> _removeProduct(FabricantDetail f, FabricantProduct p) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Retirer cet article ?'),
        content: Text('"${p.nom}" ne sera plus associé à ce fournisseur. Le produit lui-même n\'est pas supprimé.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Annuler')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Retirer')),
        ],
      ),
    );
    if (confirmed != true) return;

    try {
      await ref.read(fabricantsApiProvider).dissociateProduct(f.id, p.id);
      _invalidate();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e is ApiException ? e.message : 'Erreur.')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final detail = ref.watch(_fabricantDetailProvider(widget.fabricantId));

    return DefaultTabController(
      length: 3,
      child: Scaffold(
        appBar: AppBar(
          title: Text(detail.valueOrNull?.nom ?? 'Fournisseur'),
          actions: [
            detail.maybeWhen(
              data: (f) => Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(icon: const Icon(Icons.edit_outlined), tooltip: 'Modifier', onPressed: () => _editFabricant(f)),
                  IconButton(
                    icon: _deleting
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Icon(Icons.delete_outline),
                    tooltip: 'Supprimer',
                    onPressed: _deleting ? null : () => _confirmDelete(f),
                  ),
                ],
              ),
              orElse: () => const SizedBox.shrink(),
            ),
          ],
          bottom: const TabBar(tabs: [Tab(text: 'Articles'), Tab(text: 'Bons'), Tab(text: 'Paiements')]),
        ),
        body: AsyncValueWidget<FabricantDetail>(
          value: detail,
          onRetry: _invalidate,
          data: (f) => Column(
            children: [
              _FabricantSummaryCard(fabricant: f),
              Expanded(
                child: TabBarView(
                  children: [
                    _ArticlesTab(fabricant: f, onAdd: () => _addProduct(f), onRemove: (p) => _removeProduct(f, p)),
                    _ReceiptsTab(fabricant: f),
                    _PaymentsTab(fabricant: f),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FabricantSummaryCard extends StatelessWidget {
  const _FabricantSummaryCard({required this.fabricant});
  final FabricantDetail fabricant;

  @override
  Widget build(BuildContext context) {
    final contact = [fabricant.telephone, fabricant.adresse, fabricant.email].where((s) => s != null && s.isNotEmpty).join(' · ');
    return Card(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (contact.isNotEmpty) Text(contact, style: TextStyle(color: Colors.grey[600])),
            if (contact.isNotEmpty) const SizedBox(height: 8),
            Row(
              children: [
                Expanded(child: _StatTile(label: 'Total achat', value: fabricant.totalAchat)),
                Expanded(child: _StatTile(label: 'Payé', value: fabricant.totalPaye, color: AppTheme.success)),
                Expanded(
                  child: _StatTile(
                    label: 'Reste',
                    value: fabricant.totalRestant,
                    color: fabricant.totalRestant > 0 ? AppTheme.danger : AppTheme.success,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({required this.label, required this.value, this.color});
  final String label;
  final double value;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(label, style: TextStyle(fontSize: 11, color: Colors.grey[600])),
        const SizedBox(height: 2),
        Text(formatMoney(value), style: TextStyle(fontWeight: FontWeight.bold, color: color)),
      ],
    );
  }
}

class _ArticlesTab extends StatelessWidget {
  const _ArticlesTab({required this.fabricant, required this.onAdd, required this.onRemove});
  final FabricantDetail fabricant;
  final VoidCallback onAdd;
  final void Function(FabricantProduct) onRemove;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
          child: Align(
            alignment: Alignment.centerRight,
            child: TextButton.icon(onPressed: onAdd, icon: const Icon(Icons.add), label: const Text('Associer un article')),
          ),
        ),
        Expanded(
          child: fabricant.products.isEmpty
              ? const Center(child: Padding(padding: EdgeInsets.all(24), child: Text('Aucun article associé.', textAlign: TextAlign.center)))
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                  itemCount: fabricant.products.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, i) {
                    final p = fabricant.products[i];
                    return Card(
                      child: ListTile(
                        leading: ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: SizedBox(
                            width: 40,
                            height: 40,
                            child: p.imageUrl != null
                                ? CachedNetworkImage(
                                    imageUrl: p.imageUrl!,
                                    fit: BoxFit.cover,
                                    errorWidget: (_, __, ___) => const Icon(Icons.inventory_2_outlined),
                                  )
                                : const Icon(Icons.inventory_2_outlined),
                          ),
                        ),
                        title: Text(p.nom, maxLines: 1, overflow: TextOverflow.ellipsis),
                        subtitle: Text('${p.code} · Stock: ${p.stockReel} · ${formatMoney(p.prixVente)}'),
                        trailing: IconButton(icon: const Icon(Icons.link_off), tooltip: 'Retirer', onPressed: () => onRemove(p)),
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }
}

class _ReceiptsTab extends StatelessWidget {
  const _ReceiptsTab({required this.fabricant});
  final FabricantDetail fabricant;

  @override
  Widget build(BuildContext context) {
    if (fabricant.receipts.isEmpty) {
      return const Center(child: Padding(padding: EdgeInsets.all(24), child: Text('Aucun bon de réception.', textAlign: TextAlign.center)));
    }
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: fabricant.receipts.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, i) {
        final r = fabricant.receipts[i];
        return Card(
          child: ListTile(
            title: Text(r.reference, style: const TextStyle(fontWeight: FontWeight.bold)),
            subtitle: Text(formatDate(r.createdAt)),
            trailing: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(formatMoney(r.totalAchat), style: const TextStyle(fontWeight: FontWeight.bold)),
                _PaymentStatusBadge(status: r.statutPaiement),
              ],
            ),
            onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => AdminStockReceiptDetailScreen(receiptId: r.id))),
          ),
        );
      },
    );
  }
}

class _PaymentsTab extends StatelessWidget {
  const _PaymentsTab({required this.fabricant});
  final FabricantDetail fabricant;

  @override
  Widget build(BuildContext context) {
    if (fabricant.payments.isEmpty) {
      return const Center(child: Padding(padding: EdgeInsets.all(24), child: Text('Aucun paiement enregistré.', textAlign: TextAlign.center)));
    }
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: fabricant.payments.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, i) {
        final p = fabricant.payments[i];
        return Card(
          child: ListTile(
            leading: const Icon(Icons.payments_outlined),
            title: Text(formatMoney(p.montant), style: const TextStyle(fontWeight: FontWeight.bold)),
            subtitle: Text('${paymentMethodLabel(p.method)} · ${formatDate(p.createdAt)}'),
          ),
        );
      },
    );
  }
}

class _PaymentStatusBadge extends StatelessWidget {
  const _PaymentStatusBadge({required this.status});
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

class _ProductAssociationPickerSheet extends StatefulWidget {
  const _ProductAssociationPickerSheet({required this.products, required this.alreadyLinkedIds});
  final List<AdminProduct> products;
  final Set<String> alreadyLinkedIds;

  @override
  State<_ProductAssociationPickerSheet> createState() => _ProductAssociationPickerSheetState();
}

class _ProductAssociationPickerSheetState extends State<_ProductAssociationPickerSheet> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final available = widget.products.where((p) => !widget.alreadyLinkedIds.contains(p.id));
    final filtered = _query.isEmpty
        ? available.toList()
        : available.where((p) => p.nom.toLowerCase().contains(_query) || p.code.toLowerCase().contains(_query)).toList();

    return DraggableScrollableSheet(
      initialChildSize: 0.75,
      minChildSize: 0.4,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) => Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Associer un article', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            TextField(
              decoration: const InputDecoration(hintText: 'Rechercher...', prefixIcon: Icon(Icons.search)),
              onChanged: (v) => setState(() => _query = v.toLowerCase()),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: filtered.isEmpty
                  ? const Center(child: Text('Aucun article trouvé.'))
                  : ListView.builder(
                      controller: scrollController,
                      itemCount: filtered.length,
                      itemBuilder: (context, i) => AdminProductTile(
                        product: filtered[i],
                        onTap: () => Navigator.pop(context, filtered[i]),
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
