import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../models/client.dart';
import '../../../models/order.dart';
import '../../../models/product.dart';
import '../../../services/orders_api.dart';
import '../../../services/service_providers.dart';
import '../products/admin_product_tile.dart';
import 'admin_order_detail_screen.dart';

final _clientsForOrderProvider = FutureProvider.autoDispose<List<ClientView>>((ref) => ref.watch(clientsApiProvider).listAdmin());
final _productsForOrderProvider = FutureProvider.autoDispose<List<AdminProduct>>((ref) => ref.watch(productsApiProvider).listAdmin());

class _OrderLine {
  _OrderLine(this.product, int initialQuantite) : quantite = initialQuantite {
    if (product.uniteParCarton != null && product.uniteParCarton! > 1) {
      final cartons = (initialQuantite / product.uniteParCarton!).ceil();
      cartonsController = TextEditingController(text: '$cartons');
    }
  }

  final AdminProduct product;
  int quantite;
  TextEditingController? cartonsController;

  bool get usesCartons => cartonsController != null;

  void updateFromCartons(String text) {
    final cartons = int.tryParse(text) ?? 0;
    quantite = cartons * (product.uniteParCarton ?? 1);
  }

  void dispose() => cartonsController?.dispose();
}

const _remisePresets = [0.0, 5.0, 10.0];

/// Counter sale — Admin builds an order directly for a walk-in client
/// (clients who come to the store) instead of the client ordering themselves.
/// The resulting order can be viewed/shared as a "bon" from the detail screen.
class AdminCreateOrderScreen extends ConsumerStatefulWidget {
  const AdminCreateOrderScreen({super.key});

  @override
  ConsumerState<AdminCreateOrderScreen> createState() => _AdminCreateOrderScreenState();
}

class _AdminCreateOrderScreenState extends ConsumerState<AdminCreateOrderScreen> {
  ClientView? _client;
  final List<_OrderLine> _lines = [];
  String _paymentMethod = 'ESPECES';
  final _adresse = TextEditingController();
  final _telephone = TextEditingController();
  final _nom = TextEditingController();
  final _notes = TextEditingController();
  final _remiseCustom = TextEditingController();
  final _fraisLivraison = TextEditingController();
  double? _remisePourcentage;
  bool _remiseCustomSelected = false;
  bool _saving = false;
  String? _error;

  double get _subtotal => _lines.fold(0.0, (sum, l) => sum + l.product.prixVente * l.quantite);
  double get _fraisLivraisonValue => double.tryParse(_fraisLivraison.text.replaceAll(',', '.')) ?? 0;
  double get _total {
    final remise = _remisePourcentage;
    final apresRemise = (remise == null || remise <= 0) ? _subtotal : _subtotal * (100 - remise) / 100;
    return apresRemise + _fraisLivraisonValue;
  }

  Future<void> _pickClient() async {
    final clients = await ref.read(_clientsForOrderProvider.future);
    if (!mounted) return;
    final selected = await showModalBottomSheet<ClientView>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _ClientPickerSheet(clients: clients),
    );
    if (selected != null) {
      setState(() {
        _client = selected;
        _adresse.text = selected.adresse ?? '';
        _telephone.text = selected.telephone;
      });
    }
  }

  Future<void> _pickProduct() async {
    final products = await ref.read(_productsForOrderProvider.future);
    if (!mounted) return;
    final selected = await showModalBottomSheet<AdminProduct>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _ProductPickerSheet(products: products),
    );
    if (selected == null) return;
    setState(() {
      _OrderLine? existing;
      for (final l in _lines) {
        if (l.product.id == selected.id) {
          existing = l;
          break;
        }
      }
      if (existing != null) {
        existing.quantite++;
      } else {
        _lines.add(_OrderLine(selected, selected.minCommande > 0 ? selected.minCommande : 1));
      }
    });
  }

  Future<void> _submit() async {
    if (_client == null) {
      setState(() => _error = 'Choisissez un client.');
      return;
    }
    if (_lines.isEmpty) {
      setState(() => _error = 'Ajoutez au moins un produit.');
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
      final order = await ref.read(ordersApiProvider).createForAdmin(
            clientId: _client!.id,
            items: _lines.map((l) => OrderItemInput(productId: l.product.id, quantite: l.quantite)).toList(),
            paymentMethod: _paymentMethod,
            adresseLivraison: _adresse.text.trim(),
            telephoneContact: _telephone.text.trim(),
            nom: _nom.text.trim().isEmpty ? null : _nom.text.trim(),
            remisePourcentage: _remisePourcentage,
            fraisLivraison: _fraisLivraisonValue > 0 ? _fraisLivraisonValue : null,
            notes: _notes.text.trim().isEmpty ? null : _notes.text.trim(),
          );
      if (mounted) {
        Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => AdminOrderDetailScreen(orderId: order.id)));
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
    _adresse.dispose();
    _telephone.dispose();
    _nom.dispose();
    _notes.dispose();
    _remiseCustom.dispose();
    _fraisLivraison.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Commande au comptoir')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          Text('Client', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Card(
            child: ListTile(
              leading: const Icon(Icons.person_outline),
              title: Text(_client?.raisonSociale ?? 'Choisir un client'),
              subtitle: _client != null ? Text(_client!.telephone) : null,
              trailing: const Icon(Icons.chevron_right),
              onTap: _pickClient,
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
            const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Text('Aucun produit ajouté.'))
          else
            ..._lines.map(
              (line) => Card(
                child: ListTile(
                  title: Text(line.product.nom),
                  subtitle: Text(formatMoney(line.product.prixVente)),
                  trailing: line.usesCartons
                      ? SizedBox(
                          width: 130,
                          child: TextField(
                            controller: line.cartonsController,
                            keyboardType: TextInputType.number,
                            textAlign: TextAlign.center,
                            decoration: InputDecoration(
                              isDense: true,
                              labelText: 'Cartons',
                              helperText: '= ${line.quantite} pièces',
                              suffixIcon: IconButton(
                                icon: const Icon(Icons.close, size: 18),
                                onPressed: () => setState(() {
                                  line.dispose();
                                  _lines.remove(line);
                                }),
                              ),
                            ),
                            onChanged: (v) => setState(() => line.updateFromCartons(v)),
                          ),
                        )
                      : Row(
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
                            IconButton(
                              icon: const Icon(Icons.add_circle_outline),
                              onPressed: () => setState(() => line.quantite++),
                            ),
                          ],
                        ),
                ),
              ),
            ),
          if (_lines.isNotEmpty) ...[
            const SizedBox(height: 16),
            Text('Remise', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: [
                for (final preset in _remisePresets)
                  ChoiceChip(
                    label: Text(preset == 0 ? 'Aucune' : '$preset%'),
                    selected: !_remiseCustomSelected && _remisePourcentage == preset,
                    onSelected: (_) => setState(() {
                      _remiseCustomSelected = false;
                      _remisePourcentage = preset == 0 ? null : preset;
                    }),
                  ),
                ChoiceChip(
                  label: const Text('Autre'),
                  selected: _remiseCustomSelected,
                  onSelected: (_) => setState(() => _remiseCustomSelected = true),
                ),
              ],
            ),
            if (_remiseCustomSelected) ...[
              const SizedBox(height: 8),
              TextField(
                controller: _remiseCustom,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Remise personnalisée (%)', isDense: true),
                onChanged: (v) => setState(() => _remisePourcentage = double.tryParse(v)),
              ),
            ],
            const SizedBox(height: 12),
            TextField(
              controller: _fraisLivraison,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(labelText: 'Frais de livraison (optionnel)', isDense: true),
              onChanged: (_) => setState(() {}),
            ),
            const Divider(),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Column(
                children: [
                  if ((_remisePourcentage != null && _remisePourcentage! > 0) || _fraisLivraisonValue > 0)
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Sous-total'),
                        Text(formatMoney(_subtotal)),
                      ],
                    ),
                  if (_fraisLivraisonValue > 0)
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Frais de livraison'),
                        Text(formatMoney(_fraisLivraisonValue)),
                      ],
                    ),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Total estimé', style: TextStyle(fontWeight: FontWeight.bold)),
                      Text(formatMoney(_total), style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primary)),
                    ],
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 20),
          Text('Détails de la commande', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          TextFormField(controller: _nom, decoration: const InputDecoration(labelText: 'Nom de la commande (optionnel)')),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _paymentMethod,
            decoration: const InputDecoration(labelText: 'Méthode de paiement'),
            items: kPaymentMethods.map((m) => DropdownMenuItem(value: m, child: Text(paymentMethodLabel(m)))).toList(),
            onChanged: (v) => setState(() => _paymentMethod = v!),
          ),
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
            onPressed: _saving ? null : _submit,
            child: _saving
                ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Text('Créer la commande'),
          ),
        ],
      ),
    );
  }
}

class _ClientPickerSheet extends StatefulWidget {
  const _ClientPickerSheet({required this.clients});
  final List<ClientView> clients;

  @override
  State<_ClientPickerSheet> createState() => _ClientPickerSheetState();
}

class _ClientPickerSheetState extends State<_ClientPickerSheet> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final filtered = _query.isEmpty
        ? widget.clients
        : widget.clients.where((c) => c.raisonSociale.toLowerCase().contains(_query)).toList();

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
            Text('Choisir un client', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            TextField(
              decoration: const InputDecoration(hintText: 'Rechercher...', prefixIcon: Icon(Icons.search)),
              onChanged: (v) => setState(() => _query = v.toLowerCase()),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: filtered.isEmpty
                  ? const Center(child: Text('Aucun client trouvé.'))
                  : ListView.builder(
                      controller: scrollController,
                      itemCount: filtered.length,
                      itemBuilder: (context, i) {
                        final c = filtered[i];
                        return ListTile(
                          leading: CircleAvatar(child: Text(c.raisonSociale.isNotEmpty ? c.raisonSociale[0].toUpperCase() : '?')),
                          title: Text(c.raisonSociale),
                          subtitle: Text(c.telephone),
                          onTap: () => Navigator.pop(context, c),
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
