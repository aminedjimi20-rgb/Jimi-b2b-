import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../models/order.dart';
import '../../../models/product.dart';
import '../../../models/transporteur.dart';
import '../../../services/orders_api.dart';
import '../../../services/service_providers.dart';

final _productsForEditProvider = FutureProvider.autoDispose<List<AdminProduct>>((ref) => ref.watch(productsApiProvider).listAdmin());
final _transporteursForEditProvider = FutureProvider.autoDispose<List<Transporteur>>((ref) => ref.watch(transporteursApiProvider).list());

class _EditLine {
  _EditLine(this.product, this.quantite);
  final AdminProduct product;
  int quantite;
}

/// Admin-only correction of an already-placed order — items/amounts, at ANY
/// status except ANNULEE (reactivate first, see AdminOrderDetailScreen).
/// Every save is recorded in OrderChangeLog (see AdminOrderHistoryScreen).
class AdminOrderEditScreen extends ConsumerStatefulWidget {
  const AdminOrderEditScreen({super.key, required this.order});
  final OrderView order;

  @override
  ConsumerState<AdminOrderEditScreen> createState() => _AdminOrderEditScreenState();
}

class _AdminOrderEditScreenState extends ConsumerState<AdminOrderEditScreen> {
  late final List<_EditLine> _lines = widget.order.items
      .map((i) => _EditLine(
            AdminProduct(
              id: i.productId,
              nom: i.nom,
              code: i.code,
              categoryId: '',
              prixVente: i.prixUnitaire,
              prixAchat: 0,
              marge: 0,
              margePourcentage: 0,
              stockReel: 999999,
              stockMinimum: 0,
              minCommande: 1,
              actif: true,
              estNouveau: false,
              estSaisonnier: false,
              estPromo: false,
              estNouveauPrix: false,
              images: const [],
              priceTiers: const [],
              salePrices: const [],
            ),
            i.quantite,
          ))
      .toList();
  late final _nom = TextEditingController(text: widget.order.nom ?? '');
  late final _adresse = TextEditingController(text: widget.order.adresseLivraison);
  late final _telephone = TextEditingController(text: widget.order.telephoneContact);
  late final _notes = TextEditingController(text: widget.order.notes ?? '');
  late final _fraisLivraison = TextEditingController(text: widget.order.fraisLivraison > 0 ? widget.order.fraisLivraison.toStringAsFixed(0) : '');
  late double? _remisePourcentage = widget.order.remisePourcentage;
  late String? _transporteurId = widget.order.transporteurId;
  late String? _destination = widget.order.destination;
  bool _saving = false;
  String? _error;

  double get _subtotal => _lines.fold(0.0, (sum, l) => sum + l.product.prixVente * l.quantite);
  double get _fraisLivraisonValue => double.tryParse(_fraisLivraison.text.replaceAll(',', '.')) ?? 0;
  double get _total {
    final remise = _remisePourcentage;
    final apresRemise = (remise == null || remise <= 0) ? _subtotal : _subtotal * (100 - remise) / 100;
    return apresRemise + _fraisLivraisonValue;
  }

  Future<void> _pickProduct() async {
    final products = await ref.read(_productsForEditProvider.future);
    if (!mounted) return;
    final selected = await showModalBottomSheet<AdminProduct>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _EditProductPickerSheet(products: products),
    );
    if (selected == null) return;
    setState(() {
      _EditLine? existing;
      for (final l in _lines) {
        if (l.product.id == selected.id) existing = l;
      }
      if (existing != null) {
        existing.quantite++;
      } else {
        _lines.add(_EditLine(selected, selected.minCommande > 0 ? selected.minCommande : 1));
      }
    });
  }

  Future<void> _save() async {
    if (_lines.isEmpty) {
      setState(() => _error = 'La commande doit contenir au moins un produit.');
      return;
    }
    if (_telephone.text.trim().isEmpty || _adresse.text.trim().isEmpty) {
      setState(() => _error = 'Adresse et téléphone requis.');
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      await ref.read(ordersApiProvider).adminEdit(
            widget.order.id,
            items: _lines.map((l) => OrderItemInput(productId: l.product.id, quantite: l.quantite)).toList(),
            adresseLivraison: _adresse.text.trim(),
            telephoneContact: _telephone.text.trim(),
            nom: _nom.text.trim().isEmpty ? null : _nom.text.trim(),
            remisePourcentage: _remisePourcentage,
            fraisLivraison: _fraisLivraisonValue,
            transporteurId: _transporteurId,
            destination: _destination,
            notes: _notes.text.trim().isEmpty ? null : _notes.text.trim(),
          );
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      setState(() => _error = e is ApiException ? e.message : 'Erreur lors de la modification.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  void dispose() {
    _nom.dispose();
    _adresse.dispose();
    _telephone.dispose();
    _notes.dispose();
    _fraisLivraison.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final transporteurs = ref.watch(_transporteursForEditProvider);

    return Scaffold(
      appBar: AppBar(title: Text('Modifier ${widget.order.reference}')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: AppTheme.warning.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)),
            child: const Text(
              'Toute modification recalcule automatiquement le stock et sera visible dans l\'historique de la commande.',
              style: TextStyle(fontSize: 13),
            ),
          ),
          const SizedBox(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Produits', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
              TextButton.icon(onPressed: _pickProduct, icon: const Icon(Icons.add), label: const Text('Ajouter')),
            ],
          ),
          if (_lines.isEmpty)
            const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Text('Aucun produit — la commande doit en garder au moins un.'))
          else
            ..._lines.map(
              (line) => Card(
                child: ListTile(
                  title: Text(line.product.nom),
                  subtitle: Text(formatMoney(line.product.prixVente)),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        icon: const Icon(Icons.remove_circle_outline),
                        onPressed: () => setState(() {
                          if (line.quantite > 1) {
                            line.quantite--;
                          } else {
                            _lines.remove(line);
                          }
                        }),
                      ),
                      Text('${line.quantite}', style: const TextStyle(fontWeight: FontWeight.bold)),
                      IconButton(icon: const Icon(Icons.add_circle_outline), onPressed: () => setState(() => line.quantite++)),
                    ],
                  ),
                ),
              ),
            ),
          const SizedBox(height: 16),
          TextField(
            controller: TextEditingController(text: _remisePourcentage?.toString() ?? ''),
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(labelText: 'Remise (%, optionnel)', isDense: true),
            onChanged: (v) => _remisePourcentage = double.tryParse(v),
          ),
          const SizedBox(height: 12),
          transporteurs.when(
            data: (list) => DropdownButtonFormField<String?>(
              initialValue: _transporteurId,
              decoration: const InputDecoration(labelText: 'Transporteur (optionnel)', isDense: true),
              items: [
                const DropdownMenuItem(value: null, child: Text('Aucun')),
                for (final t in list) DropdownMenuItem(value: t.id, child: Text(t.nom)),
              ],
              onChanged: (v) => setState(() => _transporteurId = v),
            ),
            loading: () => const SizedBox.shrink(),
            error: (_, __) => const SizedBox.shrink(),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: TextEditingController(text: _destination ?? ''),
            decoration: const InputDecoration(labelText: 'Destination (optionnel)', isDense: true),
            onChanged: (v) => _destination = v.trim().isEmpty ? null : v.trim(),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _fraisLivraison,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(labelText: 'Frais de livraison (optionnel)', isDense: true),
            onChanged: (_) => setState(() {}),
          ),
          const Divider(height: 32),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Column(
              children: [
                Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [const Text('Sous-total'), Text(formatMoney(_subtotal))]),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Nouveau total', style: TextStyle(fontWeight: FontWeight.bold)),
                    Text(formatMoney(_total), style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primary)),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          TextFormField(controller: _nom, decoration: const InputDecoration(labelText: 'Nom de la commande (optionnel)')),
          const SizedBox(height: 12),
          TextFormField(controller: _telephone, decoration: const InputDecoration(labelText: 'Téléphone')),
          const SizedBox(height: 12),
          TextFormField(controller: _adresse, decoration: const InputDecoration(labelText: 'Adresse')),
          const SizedBox(height: 12),
          TextFormField(controller: _notes, decoration: const InputDecoration(labelText: 'Notes (optionnel)'), maxLines: 2),
          if (_error != null) ...[
            const SizedBox(height: 16),
            Text(_error!, style: const TextStyle(color: AppTheme.danger)),
          ],
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Text('Enregistrer les modifications'),
          ),
        ],
      ),
    );
  }
}

class _EditProductPickerSheet extends StatefulWidget {
  const _EditProductPickerSheet({required this.products});
  final List<AdminProduct> products;

  @override
  State<_EditProductPickerSheet> createState() => _EditProductPickerSheetState();
}

class _EditProductPickerSheetState extends State<_EditProductPickerSheet> {
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
            Text('Choisir un produit', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            TextField(
              decoration: const InputDecoration(hintText: 'Rechercher...', prefixIcon: Icon(Icons.search)),
              onChanged: (v) => setState(() => _query = v.toLowerCase()),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: filtered.isEmpty
                  ? const Center(child: Text('Aucun produit trouvé.'))
                  : ListView.builder(
                      controller: scrollController,
                      itemCount: filtered.length,
                      itemBuilder: (context, i) {
                        final p = filtered[i];
                        return ListTile(
                          title: Text(p.nom),
                          subtitle: Text('${p.code} · ${formatMoney(p.prixVente)}'),
                          onTap: () => Navigator.pop(context, p),
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
