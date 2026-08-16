import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/drafts/form_draft_store.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/draft_resume_banner.dart';
import '../../../core/widgets/photo_gallery_viewer.dart';
import '../../../models/client.dart';
import '../../../models/employee_product.dart';
import '../../../models/order.dart';
import '../../../models/transporteur.dart';
import '../../../services/orders_api.dart';
import '../../../services/service_providers.dart';
import 'employee_order_detail_screen.dart';

const _draftFormKey = 'employee_create_order';

final _clientsForEmployeeOrderProvider = FutureProvider.autoDispose<List<ClientView>>((ref) => ref.watch(clientsApiProvider).listStaff());
final _productsForEmployeeOrderProvider = FutureProvider.autoDispose<List<EmployeeProduct>>((ref) => ref.watch(productsApiProvider).listStaff());
final _transporteursForEmployeeOrderProvider = FutureProvider.autoDispose<List<Transporteur>>((ref) => ref.watch(transporteursApiProvider).list());

class _OrderLine {
  _OrderLine(this.product, int initialQuantite) : quantite = initialQuantite {
    if (product.uniteParCarton != null && product.uniteParCarton! > 1) {
      final cartons = (initialQuantite / product.uniteParCarton!).ceil();
      cartonsController = TextEditingController(text: '$cartons');
    }
  }

  final EmployeeProduct product;
  int quantite;
  TextEditingController? cartonsController;

  bool get usesCartons => cartonsController != null;

  void updateFromCartons(String text) {
    final cartons = int.tryParse(text) ?? 0;
    quantite = cartons * (product.uniteParCarton ?? 1);
  }

  void dispose() => cartonsController?.dispose();
}

/// On-site order placed by an Employee — same idea as the Admin counter sale,
/// but scoped: no remise field (Admin-only decision), and the resulting order
/// stays EN_ATTENTE until the Admin confirms it (see OrdersService.updateStatus
/// transitions — an employee can never move EN_ATTENTE -> CONFIRMEE).
class EmployeeCreateOrderScreen extends ConsumerStatefulWidget {
  const EmployeeCreateOrderScreen({super.key});

  @override
  ConsumerState<EmployeeCreateOrderScreen> createState() => _EmployeeCreateOrderScreenState();
}

class _EmployeeCreateOrderScreenState extends ConsumerState<EmployeeCreateOrderScreen> {
  ClientView? _client;
  final List<_OrderLine> _lines = [];
  String _paymentMethod = 'ESPECES';
  final _adresse = TextEditingController();
  final _telephone = TextEditingController();
  final _nom = TextEditingController();
  final _notes = TextEditingController();
  final _fraisLivraison = TextEditingController();
  bool _saving = false;
  String? _error;
  Transporteur? _transporteur;
  String? _destination;

  late final FormDraftStore _draftStore = createFormDraftStore(ref, _draftFormKey);
  bool _draftChecked = false;
  Map<String, dynamic>? _pendingDraft;

  @override
  void initState() {
    super.initState();
    _loadDraft();
  }

  Future<void> _loadDraft() async {
    final draft = await _draftStore.load();
    if (!mounted) return;
    setState(() {
      _pendingDraft = draft;
      _draftChecked = true;
    });
  }

  Map<String, dynamic> _currentDraftData() => {
        'clientId': _client?.id,
        'items': _lines.map((l) => {'productId': l.product.id, 'quantite': l.quantite}).toList(),
        'paymentMethod': _paymentMethod,
        'adresseLivraison': _adresse.text,
        'telephoneContact': _telephone.text,
        'nom': _nom.text,
        'notes': _notes.text,
        'fraisLivraison': _fraisLivraison.text,
        'transporteurId': _transporteur?.id,
        'destination': _destination,
      };

  Future<void> _resumeDraft(Map<String, dynamic> data) async {
    final clients = await ref.read(_clientsForEmployeeOrderProvider.future);
    final products = await ref.read(_productsForEmployeeOrderProvider.future);
    final transporteurs = await ref.read(_transporteursForEmployeeOrderProvider.future);
    if (!mounted) return;

    final clientId = data['clientId'] as String?;
    ClientView? client;
    for (final c in clients) {
      if (c.id == clientId) client = c;
    }

    final lines = <_OrderLine>[];
    for (final item in (data['items'] as List<dynamic>? ?? [])) {
      EmployeeProduct? product;
      for (final p in products) {
        if (p.id == item['productId']) product = p;
      }
      if (product != null) lines.add(_OrderLine(product, item['quantite'] as int));
    }

    final transporteurId = data['transporteurId'] as String?;
    Transporteur? transporteur;
    for (final t in transporteurs) {
      if (t.id == transporteurId) transporteur = t;
    }

    setState(() {
      _client = client;
      for (final l in _lines) {
        l.dispose();
      }
      _lines
        ..clear()
        ..addAll(lines);
      _paymentMethod = data['paymentMethod'] as String? ?? _paymentMethod;
      _adresse.text = data['adresseLivraison'] as String? ?? '';
      _telephone.text = data['telephoneContact'] as String? ?? '';
      _nom.text = data['nom'] as String? ?? '';
      _notes.text = data['notes'] as String? ?? '';
      _fraisLivraison.text = data['fraisLivraison'] as String? ?? '';
      _transporteur = transporteur;
      _destination = data['destination'] as String?;
      _pendingDraft = null;
    });
  }

  double get _subtotal => _lines.fold(0.0, (sum, l) => sum + l.product.prixVente * l.quantite);
  double get _fraisLivraisonValue => double.tryParse(_fraisLivraison.text.replaceAll(',', '.')) ?? 0;
  double get _total => _subtotal + _fraisLivraisonValue;

  Future<void> _pickClient() async {
    final clients = await ref.read(_clientsForEmployeeOrderProvider.future);
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
    final products = await ref.read(_productsForEmployeeOrderProvider.future);
    if (!mounted) return;
    final selected = await showModalBottomSheet<EmployeeProduct>(
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

  Future<void> _pickTransporteur() async {
    final transporteurs = await ref.read(_transporteursForEmployeeOrderProvider.future);
    if (!mounted) return;
    final selected = await showModalBottomSheet<Transporteur>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _TransporteurPickerSheet(transporteurs: transporteurs),
    );
    if (selected != null) setState(() => _transporteur = selected);
  }

  Future<void> _pickDestination() async {
    if (_transporteur == null) return;
    final selected = await showModalBottomSheet<DeliveryRate>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _DestinationPickerSheet(rates: _transporteur!.rates),
    );
    if (selected != null) {
      setState(() {
        _destination = selected.destination;
        _fraisLivraison.text = selected.prix.toStringAsFixed(0);
      });
    }
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
      final order = await ref.read(ordersApiProvider).createForEmployee(
            clientId: _client!.id,
            items: _lines.map((l) => OrderItemInput(productId: l.product.id, quantite: l.quantite)).toList(),
            paymentMethod: _paymentMethod,
            adresseLivraison: _adresse.text.trim(),
            telephoneContact: _telephone.text.trim(),
            nom: _nom.text.trim().isEmpty ? null : _nom.text.trim(),
            fraisLivraison: _fraisLivraisonValue > 0 ? _fraisLivraisonValue : null,
            transporteurId: _transporteur?.id,
            destination: _destination,
            notes: _notes.text.trim().isEmpty ? null : _notes.text.trim(),
          );
      await _draftStore.clear();
      if (mounted) {
        Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => EmployeeOrderDetailScreen(orderId: order.id)));
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
    _fraisLivraison.dispose();
    _draftStore.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_draftChecked && _pendingDraft == null) {
      _draftStore.save(_currentDraftData());
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Commande au comptoir')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          if (_pendingDraft != null)
            DraftResumeBanner(
              onResume: () => _resumeDraft(_pendingDraft!),
              onDismiss: () {
                _draftStore.clear();
                setState(() => _pendingDraft = null);
              },
            ),
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
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _pickTransporteur,
                    icon: const Icon(Icons.local_shipping_outlined, size: 18),
                    label: Text(_transporteur?.nom ?? 'Transporteur', overflow: TextOverflow.ellipsis),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _transporteur == null ? null : _pickDestination,
                    icon: const Icon(Icons.place_outlined, size: 18),
                    label: Text(_destination ?? 'Destination', overflow: TextOverflow.ellipsis),
                  ),
                ),
              ],
            ),
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
                  if (_fraisLivraisonValue > 0)
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
    final filtered =
        _query.isEmpty ? widget.clients : widget.clients.where((c) => c.raisonSociale.toLowerCase().contains(_query)).toList();

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
  final List<EmployeeProduct> products;

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
                      itemBuilder: (context, i) => _EmployeeProductTile(product: filtered[i], onTap: () => Navigator.pop(context, filtered[i])),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _EmployeeProductTile extends StatelessWidget {
  const _EmployeeProductTile({required this.product, required this.onTap});
  final EmployeeProduct product;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final lowStock = product.stockReel <= product.stockMinimum;
    final imageUrl = product.primaryImageUrl;

    return Card(
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        leading: GestureDetector(
          onTap: imageUrl != null ? () => PhotoGalleryViewer.open(context, product.images.map((i) => i.url).toList()) : null,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: SizedBox(
              width: 44,
              height: 44,
              child: imageUrl != null
                  ? CachedNetworkImage(
                      imageUrl: imageUrl,
                      fit: BoxFit.cover,
                      errorWidget: (_, __, ___) => Icon(Icons.inventory_2_outlined, color: lowStock ? AppTheme.warning : Colors.grey[600]),
                      placeholder: (_, __) => Icon(Icons.inventory_2_outlined, color: lowStock ? AppTheme.warning : Colors.grey[600]),
                    )
                  : Icon(Icons.inventory_2_outlined, color: lowStock ? AppTheme.warning : Colors.grey[600]),
            ),
          ),
        ),
        title: Text(product.nom, maxLines: 1, overflow: TextOverflow.ellipsis),
        subtitle: Text('${product.code} · Stock: ${product.stockReel}'),
        trailing: Text(formatMoney(product.prixVente), style: const TextStyle(fontWeight: FontWeight.bold)),
        onTap: onTap,
      ),
    );
  }
}

class _TransporteurPickerSheet extends StatelessWidget {
  const _TransporteurPickerSheet({required this.transporteurs});
  final List<Transporteur> transporteurs;

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.6,
      minChildSize: 0.3,
      maxChildSize: 0.9,
      expand: false,
      builder: (context, scrollController) => Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Choisir un transporteur', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            Expanded(
              child: transporteurs.isEmpty
                  ? const Center(child: Text('Aucun transporteur créé.'))
                  : ListView.builder(
                      controller: scrollController,
                      itemCount: transporteurs.length,
                      itemBuilder: (context, i) {
                        final t = transporteurs[i];
                        return ListTile(
                          leading: const Icon(Icons.local_shipping_outlined),
                          title: Text(t.nom),
                          subtitle: Text('${t.rates.length} tarif${t.rates.length == 1 ? '' : 's'}'),
                          onTap: () => Navigator.pop(context, t),
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

class _DestinationPickerSheet extends StatefulWidget {
  const _DestinationPickerSheet({required this.rates});
  final List<DeliveryRate> rates;

  @override
  State<_DestinationPickerSheet> createState() => _DestinationPickerSheetState();
}

class _DestinationPickerSheetState extends State<_DestinationPickerSheet> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final filtered = _query.isEmpty ? widget.rates : widget.rates.where((r) => r.destination.toLowerCase().contains(_query)).toList();

    return DraggableScrollableSheet(
      initialChildSize: 0.6,
      minChildSize: 0.3,
      maxChildSize: 0.9,
      expand: false,
      builder: (context, scrollController) => Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Choisir une destination', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            TextField(
              decoration: const InputDecoration(hintText: 'Rechercher...', prefixIcon: Icon(Icons.search)),
              onChanged: (v) => setState(() => _query = v.toLowerCase()),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: filtered.isEmpty
                  ? const Center(child: Text('Aucun tarif pour ce transporteur.'))
                  : ListView.builder(
                      controller: scrollController,
                      itemCount: filtered.length,
                      itemBuilder: (context, i) {
                        final r = filtered[i];
                        return ListTile(
                          leading: const Icon(Icons.place_outlined),
                          title: Text(r.destination),
                          trailing: Text(formatMoney(r.prix)),
                          onTap: () => Navigator.pop(context, r),
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
