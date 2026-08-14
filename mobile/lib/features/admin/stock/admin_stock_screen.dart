import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../models/product.dart';
import '../../../services/service_providers.dart';
import '../../../services/stock_api.dart';

final _productsForStockProvider = FutureProvider.autoDispose<List<AdminProduct>>((ref) {
  return ref.watch(productsApiProvider).listAdmin();
});

const _movementTypes = ['ENTREE', 'SORTIE', 'RETOUR', 'AJUSTEMENT'];

String _movementLabel(String type) {
  switch (type) {
    case 'ENTREE':
      return 'Entrée';
    case 'SORTIE':
      return 'Sortie';
    case 'RETOUR':
      return 'Retour';
    case 'AJUSTEMENT':
      return 'Ajustement (recomptage)';
    default:
      return type;
  }
}

class AdminStockScreen extends ConsumerStatefulWidget {
  const AdminStockScreen({super.key});

  @override
  ConsumerState<AdminStockScreen> createState() => _AdminStockScreenState();
}

class _AdminStockScreenState extends ConsumerState<AdminStockScreen> {
  AdminProduct? _selectedProduct;
  String _type = 'ENTREE';
  final _quantite = TextEditingController();
  final _motif = TextEditingController();
  bool _saving = false;
  String? _error;

  Future<void> _submit() async {
    final qty = int.tryParse(_quantite.text);
    if (_selectedProduct == null || qty == null) {
      setState(() => _error = 'Sélectionnez un produit et une quantité valide.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref.read(stockApiProvider).createMovement(
            StockMovementInput(productId: _selectedProduct!.id, type: _type, quantite: qty, motif: _motif.text.trim()),
          );
      ref.invalidate(_productsForStockProvider);
      _quantite.clear();
      _motif.clear();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Mouvement de stock enregistré.')));
      }
    } catch (e) {
      setState(() => _error = e is ApiException ? e.message : 'Erreur.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final products = ref.watch(_productsForStockProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Gestion du stock')),
      body: products.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text(e is ApiException ? e.message : 'Erreur de chargement.')),
        data: (items) {
          final lowStock = items.where((p) => p.stockReel <= p.stockMinimum).toList();

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text('Nouveau mouvement', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      DropdownButtonFormField<AdminProduct>(
                        initialValue: _selectedProduct,
                        decoration: const InputDecoration(labelText: 'Produit'),
                        items: items.map((p) => DropdownMenuItem(value: p, child: Text('${p.nom} (stock: ${p.stockReel})'))).toList(),
                        onChanged: (v) => setState(() => _selectedProduct = v),
                      ),
                      const SizedBox(height: 12),
                      DropdownButtonFormField<String>(
                        initialValue: _type,
                        decoration: const InputDecoration(labelText: 'Type de mouvement'),
                        items: _movementTypes.map((t) => DropdownMenuItem(value: t, child: Text(_movementLabel(t)))).toList(),
                        onChanged: (v) => setState(() => _type = v!),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _quantite,
                        keyboardType: TextInputType.number,
                        decoration: InputDecoration(
                          labelText: _type == 'AJUSTEMENT' ? 'Nouvelle quantité réelle' : 'Quantité',
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(controller: _motif, decoration: const InputDecoration(labelText: 'Motif (optionnel)')),
                      if (_error != null) ...[
                        const SizedBox(height: 12),
                        Text(_error!, style: const TextStyle(color: AppTheme.danger)),
                      ],
                      const SizedBox(height: 16),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: _saving ? null : _submit,
                          child: _saving ? const CircularProgressIndicator(color: Colors.white) : const Text('Enregistrer le mouvement'),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),
              Text('Stock faible (${lowStock.length})', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              if (lowStock.isEmpty)
                const Card(child: Padding(padding: EdgeInsets.all(16), child: Text('Aucun produit en stock faible.')))
              else
                Card(
                  child: Column(
                    children: lowStock
                        .map((p) => ListTile(
                              leading: const Icon(Icons.warning_amber_rounded, color: AppTheme.warning),
                              title: Text(p.nom),
                              trailing: Text('${p.stockReel} / min ${p.stockMinimum}'),
                            ))
                        .toList(),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}
