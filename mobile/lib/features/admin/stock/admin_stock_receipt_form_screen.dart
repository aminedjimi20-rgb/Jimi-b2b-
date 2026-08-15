import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../models/fabricant.dart';
import '../../../models/product.dart';
import '../../../services/stock_receipts_api.dart';
import '../../../services/service_providers.dart';
import '../fabricants/fabricant_dialog.dart';
import '../products/admin_product_form_screen.dart';
import '../products/admin_product_tile.dart';
import 'admin_stock_receipt_detail_screen.dart';

final _fabricantsForReceiptProvider = FutureProvider.autoDispose<List<Fabricant>>((ref) => ref.watch(fabricantsApiProvider).list());
final _productsForReceiptProvider = FutureProvider.autoDispose<List<AdminProduct>>((ref) => ref.watch(productsApiProvider).listAdmin());

class _ReceiptLine {
  _ReceiptLine(AdminProduct product)
      : product = product,
        cartons = TextEditingController(text: '1'),
        unitesParCarton = TextEditingController(text: '${product.uniteParCarton ?? 1}'),
        prixAchat = TextEditingController(text: product.prixAchat.toString()),
        prixVente = TextEditingController(text: product.prixVente.toString());

  final AdminProduct product;
  final TextEditingController cartons;
  final TextEditingController unitesParCarton;
  final TextEditingController prixAchat;
  final TextEditingController prixVente;

  int get quantite => (int.tryParse(cartons.text) ?? 0) * (int.tryParse(unitesParCarton.text) ?? 0);
  double get sousTotalAchat => quantite * (double.tryParse(prixAchat.text) ?? 0);
  double get sousTotal => quantite * (double.tryParse(prixVente.text) ?? 0);

  void dispose() {
    cartons.dispose();
    unitesParCarton.dispose();
    prixAchat.dispose();
    prixVente.dispose();
  }
}

/// Bon de réception — logs merchandise arriving from a fabricant (supplier):
/// picks/creates the fabricant, adds existing or brand-new articles with
/// cartons/unités-par-carton, and updates real stock on submit.
class AdminStockReceiptFormScreen extends ConsumerStatefulWidget {
  const AdminStockReceiptFormScreen({super.key});

  @override
  ConsumerState<AdminStockReceiptFormScreen> createState() => _AdminStockReceiptFormScreenState();
}

class _AdminStockReceiptFormScreenState extends ConsumerState<AdminStockReceiptFormScreen> {
  Fabricant? _fabricant;
  final List<_ReceiptLine> _lines = [];
  final _notes = TextEditingController();
  bool _saving = false;
  String? _error;

  double get _total => _lines.fold(0.0, (sum, l) => sum + l.sousTotal);
  double get _totalAchat => _lines.fold(0.0, (sum, l) => sum + l.sousTotalAchat);

  Future<void> _pickFabricant() async {
    final fabricants = await ref.read(_fabricantsForReceiptProvider.future);
    if (!mounted) return;
    final selected = await showModalBottomSheet<Fabricant>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _FabricantPickerSheet(fabricants: fabricants),
    );
    if (selected != null) setState(() => _fabricant = selected);
  }

  Future<void> _addExistingArticle() async {
    final products = await ref.read(_productsForReceiptProvider.future);
    if (!mounted) return;
    final selected = await showModalBottomSheet<AdminProduct>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _ProductPickerSheet(products: products),
    );
    if (selected == null) return;
    setState(() => _lines.add(_ReceiptLine(selected)));
  }

  Future<void> _addNewArticle() async {
    if (_fabricant == null) {
      setState(() => _error = "Choisissez d'abord un fabricant.");
      return;
    }
    final created = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => AdminProductFormScreen(initialFabricantId: _fabricant!.id)),
    );
    if (created == true) {
      ref.invalidate(_productsForReceiptProvider);
      await _addExistingArticle();
    }
  }

  Future<void> _submit() async {
    if (_fabricant == null) {
      setState(() => _error = 'Choisissez un fabricant.');
      return;
    }
    if (_lines.isEmpty) {
      setState(() => _error = 'Ajoutez au moins un article.');
      return;
    }

    final items = <StockReceiptItemInput>[];
    for (final line in _lines) {
      final cartons = int.tryParse(line.cartons.text);
      final unites = int.tryParse(line.unitesParCarton.text);
      final prixAchat = double.tryParse(line.prixAchat.text);
      final prixVente = double.tryParse(line.prixVente.text);
      if (cartons == null || cartons < 1 || unites == null || unites < 1 || prixAchat == null || prixAchat < 0 || prixVente == null || prixVente < 0) {
        setState(() => _error = 'Vérifiez les cartons / unités / prix de "${line.product.nom}".');
        return;
      }
      items.add(StockReceiptItemInput(
        productId: line.product.id,
        cartons: cartons,
        unitesParCarton: unites,
        prixAchat: prixAchat,
        prixVente: prixVente,
      ));
    }

    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      final receipt = await ref.read(stockReceiptsApiProvider).create(
            fabricantId: _fabricant!.id,
            items: items,
            notes: _notes.text.trim().isEmpty ? null : _notes.text.trim(),
          );
      if (mounted) {
        Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => AdminStockReceiptDetailScreen(receiptId: receipt.id)));
      }
    } catch (e) {
      setState(() => _error = e is ApiException ? e.message : 'Erreur lors de la création.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  void dispose() {
    for (final line in _lines) {
      line.dispose();
    }
    _notes.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Bon de réception')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          Text('Fabricant', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Card(
            child: ListTile(
              leading: const Icon(Icons.factory_outlined),
              title: Text(_fabricant?.nom ?? 'Choisir un fabricant'),
              trailing: const Icon(Icons.chevron_right),
              onTap: _pickFabricant,
            ),
          ),
          const SizedBox(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Articles', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
              Wrap(
                spacing: 4,
                children: [
                  TextButton.icon(onPressed: _addExistingArticle, icon: const Icon(Icons.add), label: const Text('Existant')),
                  TextButton.icon(onPressed: _addNewArticle, icon: const Icon(Icons.add_box_outlined), label: const Text('Nouvel article')),
                ],
              ),
            ],
          ),
          if (_lines.isEmpty)
            const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Text('Aucun article ajouté.'))
          else
            ..._lines.map((line) => _ReceiptLineCard(line: line, onChanged: () => setState(() {}), onRemove: () => setState(() => _lines.remove(line)))),
          if (_lines.isNotEmpty) ...[
            const Divider(),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Total achat (ce que ça coûte)'),
                      Text(formatMoney(_totalAchat), style: const TextStyle(fontWeight: FontWeight.w600)),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Total vente', style: TextStyle(fontWeight: FontWeight.bold)),
                      Text(formatMoney(_total), style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primary)),
                    ],
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 16),
          TextFormField(controller: _notes, decoration: const InputDecoration(labelText: 'Notes (optionnel)'), maxLines: 2),
          if (_error != null) ...[
            const SizedBox(height: 16),
            Text(_error!, style: const TextStyle(color: AppTheme.danger)),
          ],
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: _saving ? null : _submit,
            child: _saving
                ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Text('Enregistrer le bon'),
          ),
        ],
      ),
    );
  }
}

class _ReceiptLineCard extends StatelessWidget {
  const _ReceiptLineCard({required this.line, required this.onChanged, required this.onRemove});
  final _ReceiptLine line;
  final VoidCallback onChanged;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(child: Text(line.product.nom, style: const TextStyle(fontWeight: FontWeight.w600))),
                IconButton(icon: const Icon(Icons.delete_outline), onPressed: onRemove),
              ],
            ),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: line.cartons,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Cartons', isDense: true),
                    onChanged: (_) => onChanged(),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: TextField(
                    controller: line.unitesParCarton,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Unités/carton', isDense: true),
                    onChanged: (_) => onChanged(),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: line.prixAchat,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(labelText: 'Prix achat', isDense: true),
                    onChanged: (_) => onChanged(),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: TextField(
                    controller: line.prixVente,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(labelText: 'Prix vente', isDense: true),
                    onChanged: (_) => onChanged(),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Align(
              alignment: Alignment.centerRight,
              child: Text(
                'Qté: ${line.quantite} — achat ${formatMoney(line.sousTotalAchat)} — vente ${formatMoney(line.sousTotal)}',
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FabricantPickerSheet extends ConsumerStatefulWidget {
  const _FabricantPickerSheet({required this.fabricants});
  final List<Fabricant> fabricants;

  @override
  ConsumerState<_FabricantPickerSheet> createState() => _FabricantPickerSheetState();
}

class _FabricantPickerSheetState extends ConsumerState<_FabricantPickerSheet> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final filtered = _query.isEmpty
        ? widget.fabricants
        : widget.fabricants.where((f) => f.nom.toLowerCase().contains(_query)).toList();

    return DraggableScrollableSheet(
      initialChildSize: 0.7,
      minChildSize: 0.4,
      maxChildSize: 0.9,
      expand: false,
      builder: (context, scrollController) => Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Choisir un fabricant', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                TextButton.icon(
                  onPressed: () async {
                    final created = await showCreateFabricantDialog(context, ref);
                    if (created != null && context.mounted) Navigator.pop(context, created);
                  },
                  icon: const Icon(Icons.add),
                  label: const Text('Nouveau'),
                ),
              ],
            ),
            TextField(
              decoration: const InputDecoration(hintText: 'Rechercher...', prefixIcon: Icon(Icons.search)),
              onChanged: (v) => setState(() => _query = v.toLowerCase()),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: filtered.isEmpty
                  ? const Center(child: Text('Aucun fabricant trouvé.'))
                  : ListView.builder(
                      controller: scrollController,
                      itemCount: filtered.length,
                      itemBuilder: (context, i) {
                        final f = filtered[i];
                        return ListTile(
                          leading: const Icon(Icons.factory_outlined),
                          title: Text(f.nom),
                          subtitle: Text('${f.productCount} produit${f.productCount == 1 ? '' : 's'}'),
                          onTap: () => Navigator.pop(context, f),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProductPickerSheet extends StatefulWidget {
  const _ProductPickerSheet({required this.products});
  final List<AdminProduct> products;

  @override
  State<_ProductPickerSheet> createState() => _ProductPickerSheetState();
}

class _ProductPickerSheetState extends State<_ProductPickerSheet> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final filtered = _query.isEmpty
        ? widget.products
        : widget.products.where((p) => p.nom.toLowerCase().contains(_query) || p.code.toLowerCase().contains(_query)).toList();

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
            Text('Choisir un article', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
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
