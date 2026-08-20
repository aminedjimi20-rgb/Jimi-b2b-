import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/drafts/form_draft_store.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../models/employee_permissions.dart';
import '../../../models/employee_product.dart';
import '../../../models/fabricant.dart';
import '../../../models/stock_receipt.dart';
import '../../../models/transporteur.dart';
import '../../../services/service_providers.dart';
import '../../../services/stock_receipts_api.dart';
import '../employee_session.dart';
import 'employee_bon_entree_detail_screen.dart';
import 'employee_new_product_screen.dart';
import 'fournisseur_picker_sheet.dart';

/// Each in-progress local brouillon gets its own draft slot (see the
/// matching comment on AdminStockReceiptFormScreen) instead of one shared
/// key, so starting a second bon never silently overwrites a first.
const employeeBonEntreeDraftKeyPrefix = 'employee_bon_entree_form:';

final _transporteursForBonEntreeProvider = FutureProvider.autoDispose<List<Transporteur>>((ref) => ref.watch(transporteursApiProvider).list());

class _BonEntreeLine {
  _BonEntreeLine({required this.productId, required this.nom, this.imageUrl, int? uniteParCarton, String? initialPrixAchat})
      : cartons = TextEditingController(text: '1'),
        unitesParCarton = TextEditingController(text: '${uniteParCarton ?? 1}'),
        prixAchat = TextEditingController(text: initialPrixAchat ?? '0');

  final String productId;
  final String nom;
  final String? imageUrl;
  final TextEditingController cartons;
  final TextEditingController unitesParCarton;
  final TextEditingController prixAchat;

  int get quantite => (int.tryParse(cartons.text) ?? 0) * (int.tryParse(unitesParCarton.text) ?? 0);
  double get sousTotalAchat => quantite * (double.tryParse(prixAchat.text.replaceAll(',', '.')) ?? 0);

  void dispose() {
    cartons.dispose();
    unitesParCarton.dispose();
    prixAchat.dispose();
  }
}

/// "Bon d'entrée" créé par un Employé — reste BROUILLON tant qu'il n'est pas
/// confirmé (voir l'écran détail) : aucun effet sur le stock ni sur le solde
/// fournisseur n'est appliqué ici, seulement lors de la confirmation.
class EmployeeBonEntreeFormScreen extends ConsumerStatefulWidget {
  const EmployeeBonEntreeFormScreen({super.key, this.existing, this.localDraftKey});

  /// Non-null pour modifier un brouillon déjà envoyé au serveur (Phase 38).
  final StockReceiptView? existing;

  /// Non-null pour reprendre directement un brouillon purement local (voir
  /// EmployeeBonEntreeListScreen) — mutuellement exclusif avec [existing].
  final String? localDraftKey;

  @override
  ConsumerState<EmployeeBonEntreeFormScreen> createState() => _EmployeeBonEntreeFormScreenState();
}

class _EmployeeBonEntreeFormScreenState extends ConsumerState<EmployeeBonEntreeFormScreen> {
  Fabricant? _fabricant;
  final List<_BonEntreeLine> _lines = [];
  final _numeroBonFournisseur = TextEditingController();
  final _notes = TextEditingController();
  final _remise = TextEditingController();
  final _destination = TextEditingController();
  final _fraisLivraison = TextEditingController();
  Transporteur? _transporteur;
  bool _livraisonActive = false;
  bool _saving = false;
  String? _error;

  // Local auto-draft only guards a brand-new bon (never yet sent to the
  // server) — resuming an already-saved server BROUILLON loads straight
  // from `existing` below, which is itself durable (see Phase 38). Each
  // brand-new bon gets its own key so a second one never overwrites a
  // first still-unsaved draft.
  late final String _localDraftKey = widget.localDraftKey ?? '$employeeBonEntreeDraftKeyPrefix${const Uuid().v4()}';
  late final FormDraftStore _draftStore = createFormDraftStore(ref, _localDraftKey);
  bool _draftReady = false;

  bool get _isEditing => widget.existing != null;

  double get _totalAchat => _lines.fold(0.0, (sum, l) => sum + l.sousTotalAchat);
  double get _remiseValue => double.tryParse(_remise.text.replaceAll(',', '.')) ?? 0;
  double get _montantRemise => _totalAchat * _remiseValue / 100;
  double get _fraisLivraisonValue => double.tryParse(_fraisLivraison.text.replaceAll(',', '.')) ?? 0;
  double get _totalApresRemise => _totalAchat - _montantRemise + _fraisLivraisonValue;

  Future<void> _loadDraft() async {
    final draft = await _draftStore.load();
    if (!mounted) return;
    if (draft != null) _resumeDraft(draft);
    setState(() => _draftReady = true);
  }

  Map<String, dynamic> _currentDraftData() => {
        'fabricantId': _fabricant?.id,
        'fabricantNom': _fabricant?.nom,
        'numeroBonFournisseur': _numeroBonFournisseur.text,
        'notes': _notes.text,
        'remise': _remise.text,
        'livraisonActive': _livraisonActive,
        'transporteurId': _transporteur?.id,
        'transporteurNom': _transporteur?.nom,
        'destination': _destination.text,
        'fraisLivraison': _fraisLivraison.text,
        'items': _lines
            .map((l) => {
                  'productId': l.productId,
                  'nom': l.nom,
                  'imageUrl': l.imageUrl,
                  'cartons': l.cartons.text,
                  'unitesParCarton': l.unitesParCarton.text,
                  'prixAchat': l.prixAchat.text,
                })
            .toList(),
      };

  void _resumeDraft(Map<String, dynamic> data) {
    final lines = (data['items'] as List<dynamic>? ?? []).map((item) {
      return _BonEntreeLine(
        productId: item['productId'] as String,
        nom: item['nom'] as String,
        imageUrl: item['imageUrl'] as String?,
        initialPrixAchat: item['prixAchat'] as String?,
      )
        ..cartons.text = item['cartons'] as String? ?? '1'
        ..unitesParCarton.text = item['unitesParCarton'] as String? ?? '1';
    }).toList();

    setState(() {
      _fabricant = data['fabricantId'] != null ? Fabricant(id: data['fabricantId'] as String, nom: data['fabricantNom'] as String? ?? '') : null;
      _numeroBonFournisseur.text = data['numeroBonFournisseur'] as String? ?? '';
      _notes.text = data['notes'] as String? ?? '';
      _remise.text = data['remise'] as String? ?? '';
      _livraisonActive = data['livraisonActive'] as bool? ?? false;
      _transporteur = data['transporteurId'] != null ? Transporteur(id: data['transporteurId'] as String, nom: data['transporteurNom'] as String? ?? '') : null;
      _destination.text = data['destination'] as String? ?? '';
      _fraisLivraison.text = data['fraisLivraison'] as String? ?? '';
      for (final l in _lines) {
        l.dispose();
      }
      _lines
        ..clear()
        ..addAll(lines);
    });
  }

  @override
  void initState() {
    super.initState();
    if (!_isEditing) {
      if (widget.localDraftKey != null) {
        _loadDraft();
      } else {
        _draftReady = true;
      }
    }
    final existing = widget.existing;
    if (existing != null) {
      _fabricant = Fabricant(id: existing.fabricantId, nom: existing.fabricantNom);
      _numeroBonFournisseur.text = existing.numeroBonFournisseur ?? '';
      _notes.text = existing.notes ?? '';
      if (existing.remisePourcentage != null && existing.remisePourcentage! > 0) {
        _remise.text = existing.remisePourcentage!.toStringAsFixed(0);
      }
      _destination.text = existing.destination ?? '';
      if (existing.fraisLivraison > 0) _fraisLivraison.text = existing.fraisLivraison.toStringAsFixed(0);
      if (existing.transporteurId != null) {
        _transporteur = Transporteur(id: existing.transporteurId!, nom: existing.transporteurNom ?? '');
      }
      _livraisonActive = existing.transporteurId != null || existing.destination != null || existing.fraisLivraison > 0;
      for (final item in existing.items) {
        _lines.add(_BonEntreeLine(
          productId: item.productId,
          nom: item.nom,
          imageUrl: item.imageUrl,
          uniteParCarton: item.unitesParCarton,
          initialPrixAchat: item.prixAchat.toStringAsFixed(2),
        )
          ..cartons.text = '${item.cartons}');
      }
    }
  }

  Future<void> _pickFabricant() async {
    final permissions = ref.read(employeePermissionsProvider).valueOrNull ?? EmployeePermissions();
    final fabricants = await ref.read(fabricantsApiProvider).listStaff();
    if (!mounted) return;
    final selected = await showModalBottomSheet<Fabricant>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => FournisseurPickerSheet(fabricants: fabricants, canCreer: permissions.canCreerFournisseur),
    );
    if (selected != null) setState(() => _fabricant = selected);
  }

  Future<void> _addExistingArticle() async {
    final selected = await showModalBottomSheet<EmployeeProduct>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => const _ArticleSearchSheet(),
    );
    if (selected == null) return;
    _addLineFromProduct(selected);
  }

  void _addLineFromProduct(EmployeeProduct product) {
    setState(() {
      _lines.add(_BonEntreeLine(productId: product.id, nom: product.nom, imageUrl: product.primaryImageUrl, uniteParCarton: product.uniteParCarton));
    });
  }

  Future<void> _addNewArticle() async {
    final created = await Navigator.of(context).push<EmployeeProduct>(
      MaterialPageRoute(builder: (_) => EmployeeNewProductScreen(initialFabricantId: _fabricant?.id)),
    );
    if (created != null) _addLineFromProduct(created);
  }

  Future<void> _pickTransporteur() async {
    final transporteurs = await ref.read(_transporteursForBonEntreeProvider.future);
    if (!mounted) return;
    final selected = await showModalBottomSheet<Transporteur>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _TransporteurPickerSheet(transporteurs: transporteurs),
    );
    if (selected != null) setState(() => _transporteur = selected);
  }

  Future<void> _submit() async {
    if (_fabricant == null) {
      setState(() => _error = 'Choisissez un fournisseur.');
      return;
    }
    if (_lines.isEmpty) {
      setState(() => _error = 'Ajoutez au moins un article.');
      return;
    }

    final items = <BonEntreeItemInput>[];
    for (final line in _lines) {
      final cartons = int.tryParse(line.cartons.text);
      final unites = int.tryParse(line.unitesParCarton.text);
      final prixAchat = double.tryParse(line.prixAchat.text.replaceAll(',', '.'));
      if (cartons == null || cartons < 1 || unites == null || unites < 1 || prixAchat == null || prixAchat < 0) {
        setState(() => _error = 'Vérifiez les cartons / unités / prix de "${line.nom}".');
        return;
      }
      items.add(BonEntreeItemInput(productId: line.productId, cartons: cartons, unitesParCarton: unites, prixAchat: prixAchat));
    }

    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      final api = ref.read(stockReceiptsApiProvider);
      final receipt = _isEditing
          ? await api.updateDraft(
              widget.existing!.id,
              fabricantId: _fabricant!.id,
              items: items,
              numeroBonFournisseur: _numeroBonFournisseur.text.trim().isEmpty ? null : _numeroBonFournisseur.text.trim(),
              notes: _notes.text.trim().isEmpty ? null : _notes.text.trim(),
              remisePourcentage: _remiseValue > 0 ? _remiseValue : null,
              transporteurId: _livraisonActive ? _transporteur?.id : null,
              destination: _livraisonActive && _destination.text.trim().isNotEmpty ? _destination.text.trim() : null,
              fraisLivraison: _livraisonActive ? _fraisLivraisonValue : null,
            )
          : await api.createDraft(
              fabricantId: _fabricant!.id,
              items: items,
              numeroBonFournisseur: _numeroBonFournisseur.text.trim().isEmpty ? null : _numeroBonFournisseur.text.trim(),
              notes: _notes.text.trim().isEmpty ? null : _notes.text.trim(),
              remisePourcentage: _remiseValue > 0 ? _remiseValue : null,
              transporteurId: _livraisonActive ? _transporteur?.id : null,
              destination: _livraisonActive && _destination.text.trim().isNotEmpty ? _destination.text.trim() : null,
              fraisLivraison: _livraisonActive ? _fraisLivraisonValue : null,
            );
      if (!_isEditing) await _draftStore.clear();
      if (mounted) {
        Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => EmployeeBonEntreeDetailScreen(receiptId: receipt.id)));
      }
    } catch (e) {
      setState(() => _error = e is ApiException ? e.message : 'Erreur lors de l\'enregistrement.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  void dispose() {
    for (final line in _lines) {
      line.dispose();
    }
    _numeroBonFournisseur.dispose();
    _notes.dispose();
    _remise.dispose();
    _destination.dispose();
    _fraisLivraison.dispose();
    _draftStore.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_isEditing && _draftReady) {
      _draftStore.save(_currentDraftData());
    }
    final permissions = ref.watch(employeePermissionsProvider).valueOrNull ?? EmployeePermissions();

    return Scaffold(
      appBar: AppBar(title: Text(_isEditing ? 'Modifier le brouillon' : 'Nouveau bon d\'entrée')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          Text('Fournisseur', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Card(
            child: ListTile(
              leading: const Icon(Icons.factory_outlined),
              title: Text(_fabricant?.nom ?? 'Choisir un fournisseur'),
              trailing: const Icon(Icons.chevron_right),
              onTap: _pickFabricant,
            ),
          ),
          const SizedBox(height: 12),
          TextFormField(controller: _numeroBonFournisseur, decoration: const InputDecoration(labelText: 'N° bon fournisseur (optionnel)')),
          const SizedBox(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Articles', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
              Wrap(
                spacing: 4,
                children: [
                  TextButton.icon(onPressed: _addExistingArticle, icon: const Icon(Icons.search), label: const Text('Ajouter')),
                  if (permissions.canCreerProduit)
                    TextButton.icon(onPressed: _addNewArticle, icon: const Icon(Icons.add_box_outlined), label: const Text('Nouveau')),
                ],
              ),
            ],
          ),
          if (_lines.isEmpty)
            const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Text('Aucun article ajouté.'))
          else
            ..._lines.map((line) => _BonEntreeLineCard(
                  line: line,
                  canModifierPrixAchat: permissions.canModifierPrixAchat,
                  onChanged: () => setState(() {}),
                  onRemove: () => setState(() => _lines.remove(line)),
                )),
          if (_lines.isNotEmpty) ...[
            const SizedBox(height: 12),
            CheckboxListTile(
              value: _livraisonActive,
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
              title: const Text('Livraison'),
              onChanged: (v) => setState(() {
                _livraisonActive = v ?? false;
                if (!_livraisonActive) {
                  _transporteur = null;
                  _destination.clear();
                  _fraisLivraison.clear();
                }
              }),
            ),
            if (_livraisonActive) ...[
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: _pickTransporteur,
                icon: const Icon(Icons.local_shipping_outlined, size: 18),
                label: Text(_transporteur?.nom ?? 'Transporteur (optionnel)', overflow: TextOverflow.ellipsis),
              ),
              const SizedBox(height: 8),
              TextField(controller: _destination, decoration: const InputDecoration(labelText: 'Destination (optionnel)', isDense: true)),
              const SizedBox(height: 8),
              TextField(
                controller: _fraisLivraison,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Frais de livraison (optionnel)', isDense: true),
                onChanged: (_) => setState(() {}),
              ),
            ],
            if (permissions.canModifierPrixAchat) ...[
              const SizedBox(height: 12),
              TextField(
                controller: _remise,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Remise fournisseur (%, optionnel)', isDense: true),
                onChanged: (_) => setState(() {}),
              ),
              const Divider(),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [const Text('Sous-total achat'), Text(formatMoney(_totalAchat))],
                    ),
                    if (_remiseValue > 0)
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [Text('Remise (${_remiseValue.toStringAsFixed(0)}%)'), Text('- ${formatMoney(_montantRemise)}')],
                      ),
                    if (_fraisLivraisonValue > 0)
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [const Text('Frais de livraison'), Text(formatMoney(_fraisLivraisonValue))],
                      ),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Total dû', style: TextStyle(fontWeight: FontWeight.bold)),
                        Text(formatMoney(_totalApresRemise), style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primary)),
                      ],
                    ),
                  ],
                ),
              ),
            ],
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
                : const Text('Enregistrer comme brouillon'),
          ),
        ],
      ),
    );
  }
}

class _BonEntreeLineCard extends StatelessWidget {
  const _BonEntreeLineCard({required this.line, required this.canModifierPrixAchat, required this.onChanged, required this.onRemove});
  final _BonEntreeLine line;
  final bool canModifierPrixAchat;
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
                ClipRRect(
                  borderRadius: BorderRadius.circular(6),
                  child: SizedBox(
                    width: 36,
                    height: 36,
                    child: line.imageUrl != null
                        ? CachedNetworkImage(imageUrl: line.imageUrl!, fit: BoxFit.cover, errorWidget: (_, __, ___) => const Icon(Icons.inventory_2_outlined))
                        : Container(color: Colors.grey.shade100, child: const Icon(Icons.inventory_2_outlined, size: 18)),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(child: Text(line.nom, style: const TextStyle(fontWeight: FontWeight.w600))),
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
            if (canModifierPrixAchat) ...[
              const SizedBox(height: 8),
              TextField(
                controller: line.prixAchat,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Prix achat', isDense: true),
                onChanged: (_) => onChanged(),
              ),
            ],
            const SizedBox(height: 6),
            Align(
              alignment: Alignment.centerRight,
              child: Text(
                canModifierPrixAchat ? 'Qté: ${line.quantite} — achat ${formatMoney(line.sousTotalAchat)}' : 'Qté: ${line.quantite}',
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Recherche-d'abord : ne charge jamais le catalogue complet, seulement les
/// résultats correspondant à ce que l'employé tape (nom/référence/code).
class _ArticleSearchSheet extends ConsumerStatefulWidget {
  const _ArticleSearchSheet();

  @override
  ConsumerState<_ArticleSearchSheet> createState() => _ArticleSearchSheetState();
}

class _ArticleSearchSheetState extends ConsumerState<_ArticleSearchSheet> {
  Timer? _debounce;
  String _query = '';
  List<EmployeeProduct>? _results;
  bool _loading = false;
  String? _error;

  void _onQueryChanged(String value) {
    _debounce?.cancel();
    setState(() {
      _query = value;
      if (value.trim().length < 2) _results = null;
    });
    if (value.trim().length < 2) return;
    _debounce = Timer(const Duration(milliseconds: 400), _runSearch);
  }

  Future<void> _runSearch() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await ref.read(productsApiProvider).searchStaff(_query.trim());
      if (mounted) setState(() => _results = results);
    } catch (e) {
      if (mounted) setState(() => _error = e is ApiException ? e.message : 'Erreur de recherche.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
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
            Text('Chercher un article', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            TextField(
              autofocus: true,
              decoration: const InputDecoration(hintText: 'Nom, référence, code...', prefixIcon: Icon(Icons.search)),
              onChanged: _onQueryChanged,
            ),
            const SizedBox(height: 8),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _error != null
                      ? Center(child: Text(_error!, style: const TextStyle(color: AppTheme.danger)))
                      : _query.trim().length < 2
                          ? const Center(child: Text('Tapez au moins 2 caractères pour chercher.'))
                          : (_results?.isEmpty ?? true)
                              ? const Center(child: Text('Aucun article trouvé.'))
                              : ListView.builder(
                                  controller: scrollController,
                                  itemCount: _results!.length,
                                  itemBuilder: (context, i) {
                                    final p = _results![i];
                                    return ListTile(
                                      leading: ClipRRect(
                                        borderRadius: BorderRadius.circular(6),
                                        child: SizedBox(
                                          width: 40,
                                          height: 40,
                                          child: p.primaryImageUrl != null
                                              ? CachedNetworkImage(imageUrl: p.primaryImageUrl!, fit: BoxFit.cover)
                                              : Container(color: Colors.grey.shade100, child: const Icon(Icons.inventory_2_outlined, size: 18)),
                                        ),
                                      ),
                                      title: Text(p.nom),
                                      subtitle: Text(p.code),
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
                  ? const Center(child: Text('Aucun transporteur.'))
                  : ListView.builder(
                      controller: scrollController,
                      itemCount: transporteurs.length,
                      itemBuilder: (context, i) => ListTile(
                        leading: const Icon(Icons.local_shipping_outlined),
                        title: Text(transporteurs[i].nom),
                        onTap: () => Navigator.pop(context, transporteurs[i]),
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
