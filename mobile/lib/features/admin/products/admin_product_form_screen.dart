import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../models/category.dart';
import '../../../models/fabricant.dart';
import '../../../models/product.dart';
import '../../../services/service_providers.dart';
import '../fabricants/fabricant_dialog.dart';
import '../stock/admin_stock_screen.dart';

final _categoriesProvider = FutureProvider.autoDispose<List<Category>>((ref) => ref.watch(categoriesApiProvider).list());
final _fabricantsProvider = FutureProvider.autoDispose<List<Fabricant>>((ref) => ref.watch(fabricantsApiProvider).list());

/// Create/edit product form — Admin only. `productId` null means "create".
/// `initialCategoryId` pre-selects a category when creating from a category
/// "folder", and `initialFabricantId` when creating a new article from a
/// goods-receipt ("bon de réception") for a given fabricant. Both are
/// ignored in edit mode, where the loaded product's own values win.
class AdminProductFormScreen extends ConsumerStatefulWidget {
  const AdminProductFormScreen({super.key, this.productId, this.initialCategoryId, this.initialFabricantId});

  final String? productId;
  final String? initialCategoryId;
  final String? initialFabricantId;

  @override
  ConsumerState<AdminProductFormScreen> createState() => _AdminProductFormScreenState();
}

class _TierInput {
  _TierInput({this.qteMin = '', this.qteMax = '', this.prix = ''});
  String qteMin;
  String qteMax;
  String prix;
}

class _AdminProductFormScreenState extends ConsumerState<AdminProductFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nom = TextEditingController();
  final _code = TextEditingController();
  final _description = TextEditingController();
  final _taille = TextEditingController();
  final _couleur = TextEditingController();
  final _marque = TextEditingController();
  final _prixAchat = TextEditingController();
  final _prixVente = TextEditingController();
  final _stockReel = TextEditingController(text: '0');
  final _stockMinimum = TextEditingController(text: '0');
  final _minCommande = TextEditingController(text: '1');
  final _uniteParCarton = TextEditingController();

  String? _categoryId;
  String? _fabricantId;
  bool _actif = true;
  bool _loading = false;
  bool _saving = false;
  String? _error;
  final List<String> _newLocalImagePaths = [];
  final List<ProductImage> _existingImages = [];
  final List<_TierInput> _tiers = [];

  AdminProduct? _product;

  bool get _isEdit => widget.productId != null;

  @override
  void initState() {
    super.initState();
    if (_isEdit) {
      _loadProduct();
    } else {
      _categoryId = widget.initialCategoryId;
      _fabricantId = widget.initialFabricantId;
    }
  }

  Future<void> _loadProduct() async {
    setState(() => _loading = true);
    try {
      final p = await ref.read(productsApiProvider).getAdmin(widget.productId!);
      _product = p;
      _nom.text = p.nom;
      _code.text = p.code;
      _description.text = p.description ?? '';
      _taille.text = p.taille ?? '';
      _couleur.text = p.couleur ?? '';
      _marque.text = p.marque ?? '';
      _prixAchat.text = p.prixAchat.toString();
      _prixVente.text = p.prixVente.toString();
      _stockReel.text = p.stockReel.toString();
      _stockMinimum.text = p.stockMinimum.toString();
      _minCommande.text = p.minCommande.toString();
      _uniteParCarton.text = p.uniteParCarton?.toString() ?? '';
      _categoryId = p.categoryId;
      _fabricantId = p.fabricantId;
      _actif = p.actif;
      _existingImages.addAll(p.images);
      _tiers.addAll(p.priceTiers.map((t) => _TierInput(qteMin: '${t.qteMin}', qteMax: t.qteMax?.toString() ?? '', prix: '${t.prix}')));
    } catch (e) {
      _error = e is ApiException ? e.message : 'Erreur de chargement.';
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _adjustStock() async {
    if (_product == null) return;
    final adjusted = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => AdminStockScreen(initialProduct: _product)),
    );
    if (adjusted == true) await _loadProduct();
  }

  Future<void> _pickImage(ImageSource source) async {
    final picked = await ImagePicker().pickImage(source: source, imageQuality: 85, maxWidth: 1600);
    if (picked != null) setState(() => _newLocalImagePaths.add(picked.path));
  }

  Future<void> _openCreateFabricantDialog() async {
    final created = await showCreateFabricantDialog(context, ref);
    if (created != null) {
      ref.invalidate(_fabricantsProvider);
      setState(() => _fabricantId = created.id);
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    if (_categoryId == null) {
      setState(() => _error = 'Veuillez choisir une catégorie.');
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      final uploadsApi = ref.read(uploadsApiProvider);
      final uploadedUrls = <String>[];
      for (final path in _newLocalImagePaths) {
        uploadedUrls.add(await uploadsApi.uploadProductImage(path));
      }

      final tiers = _tiers
          .where((t) => t.qteMin.isNotEmpty && t.prix.isNotEmpty)
          .map((t) => {
                'qteMin': int.parse(t.qteMin),
                if (t.qteMax.isNotEmpty) 'qteMax': int.parse(t.qteMax),
                'prix': double.parse(t.prix),
              })
          .toList();

      final payload = {
        'nom': _nom.text.trim(),
        'code': _code.text.trim(),
        'categoryId': _categoryId,
        'fabricantId': _fabricantId,
        'description': _description.text.trim().isEmpty ? null : _description.text.trim(),
        'taille': _taille.text.trim().isEmpty ? null : _taille.text.trim(),
        'couleur': _couleur.text.trim().isEmpty ? null : _couleur.text.trim(),
        'marque': _marque.text.trim().isEmpty ? null : _marque.text.trim(),
        'prixAchat': double.parse(_prixAchat.text),
        'prixVente': double.parse(_prixVente.text),
        'stockMinimum': int.parse(_stockMinimum.text),
        'minCommande': int.parse(_minCommande.text),
        'uniteParCarton': _uniteParCarton.text.trim().isEmpty ? null : int.tryParse(_uniteParCarton.text.trim()),
        'actif': _actif,
        if (uploadedUrls.isNotEmpty) 'imageUrls': uploadedUrls,
        if (!_isEdit) ...{
          'stockReel': int.parse(_stockReel.text),
          if (tiers.isNotEmpty) 'priceTiers': tiers,
        },
      };

      if (_isEdit) {
        await ref.read(productsApiProvider).update(widget.productId!, payload);
      } else {
        await ref.read(productsApiProvider).create(payload);
      }

      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      setState(() => _error = e is ApiException ? e.message : 'Erreur lors de l\'enregistrement.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  void dispose() {
    for (final c in [
      _nom,
      _code,
      _description,
      _taille,
      _couleur,
      _marque,
      _prixAchat,
      _prixVente,
      _stockReel,
      _stockMinimum,
      _minCommande,
      _uniteParCarton,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final categories = ref.watch(_categoriesProvider);
    final fabricants = ref.watch(_fabricantsProvider);

    return Scaffold(
      appBar: AppBar(title: Text(_isEdit ? 'Modifier le produit' : 'Nouveau produit')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                children: [
                  _ImagesSection(
                    existing: _existingImages,
                    newPaths: _newLocalImagePaths,
                    onPickCamera: () => _pickImage(ImageSource.camera),
                    onPickGallery: () => _pickImage(ImageSource.gallery),
                    onRemoveNew: (i) => setState(() => _newLocalImagePaths.removeAt(i)),
                  ),
                  const SizedBox(height: 20),
                  TextFormField(
                    controller: _nom,
                    decoration: const InputDecoration(labelText: 'Nom du produit'),
                    validator: (v) => (v == null || v.trim().isEmpty) ? 'Champ requis' : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _code,
                    decoration: const InputDecoration(labelText: 'Code produit'),
                    validator: (v) => (v == null || v.trim().isEmpty) ? 'Champ requis' : null,
                  ),
                  const SizedBox(height: 12),
                  categories.when(
                    data: (cats) => DropdownButtonFormField<String>(
                      initialValue: cats.any((c) => c.id == _categoryId) ? _categoryId : null,
                      decoration: const InputDecoration(labelText: 'Catégorie'),
                      items: cats.map((c) => DropdownMenuItem(value: c.id, child: Text(c.nom))).toList(),
                      onChanged: (v) => setState(() => _categoryId = v),
                    ),
                    loading: () => const LinearProgressIndicator(),
                    error: (_, __) => const Text('Impossible de charger les catégories.'),
                  ),
                  const SizedBox(height: 12),
                  fabricants.when(
                    data: (fabs) => Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            initialValue: fabs.any((f) => f.id == _fabricantId) ? _fabricantId : null,
                            decoration: const InputDecoration(labelText: 'Fabricant (optionnel)'),
                            items: fabs.map((f) => DropdownMenuItem(value: f.id, child: Text(f.nom))).toList(),
                            onChanged: (v) => setState(() => _fabricantId = v),
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.add_business_outlined),
                          tooltip: 'Nouveau fabricant',
                          onPressed: _openCreateFabricantDialog,
                        ),
                      ],
                    ),
                    loading: () => const LinearProgressIndicator(),
                    error: (_, __) => const Text('Impossible de charger les fabricants.'),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(child: TextFormField(controller: _taille, decoration: const InputDecoration(labelText: 'Taille'))),
                      const SizedBox(width: 12),
                      Expanded(child: TextFormField(controller: _couleur, decoration: const InputDecoration(labelText: 'Couleur'))),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextFormField(controller: _marque, decoration: const InputDecoration(labelText: 'Marque')),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _description,
                    decoration: const InputDecoration(labelText: 'Description'),
                    maxLines: 3,
                  ),
                  const SizedBox(height: 20),
                  Text('Prix & marge', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: TextFormField(
                          controller: _prixAchat,
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          decoration: const InputDecoration(labelText: 'Prix Achat'),
                          validator: _requiredNumber,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextFormField(
                          controller: _prixVente,
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          decoration: const InputDecoration(labelText: 'Prix Vente'),
                          validator: _requiredNumber,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  Text('Stock', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: TextFormField(
                          controller: _stockReel,
                          enabled: !_isEdit,
                          keyboardType: TextInputType.number,
                          decoration: InputDecoration(
                            labelText: 'Stock initial',
                            helperText: _isEdit ? 'Corrigez une erreur avec le bouton Ajuster' : null,
                            suffixIcon: _isEdit
                                ? IconButton(
                                    icon: const Icon(Icons.tune),
                                    tooltip: 'Ajuster le stock',
                                    onPressed: _adjustStock,
                                  )
                                : null,
                          ),
                          validator: _requiredInt,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextFormField(
                          controller: _stockMinimum,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(labelText: 'Stock minimum'),
                          validator: _requiredInt,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextFormField(
                          controller: _minCommande,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(labelText: 'Minimum de commande'),
                          validator: _requiredInt,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextFormField(
                          controller: _uniteParCarton,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(labelText: 'Unités par carton (optionnel)'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Produit actif (visible dans le catalogue client)'),
                    value: _actif,
                    onChanged: (v) => setState(() => _actif = v),
                  ),
                  if (!_isEdit) ...[
                    const SizedBox(height: 20),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Grille de prix par quantité', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                        TextButton.icon(
                          onPressed: () => setState(() => _tiers.add(_TierInput())),
                          icon: const Icon(Icons.add),
                          label: const Text('Ajouter'),
                        ),
                      ],
                    ),
                    ..._tiers.asMap().entries.map((entry) => _TierRow(
                          tier: entry.value,
                          onChanged: () => setState(() {}),
                          onRemove: () => setState(() => _tiers.removeAt(entry.key)),
                        )),
                  ],
                  if (_error != null) ...[
                    const SizedBox(height: 16),
                    Text(_error!, style: const TextStyle(color: AppTheme.danger)),
                  ],
                  const SizedBox(height: 24),
                  ElevatedButton(
                    onPressed: _saving ? null : _save,
                    child: _saving
                        ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : Text(_isEdit ? 'Enregistrer' : 'Créer le produit'),
                  ),
                ],
              ),
            ),
    );
  }

  String? _requiredNumber(String? v) {
    if (v == null || v.trim().isEmpty) return 'Champ requis';
    if (double.tryParse(v) == null) return 'Nombre invalide';
    return null;
  }

  String? _requiredInt(String? v) {
    if (v == null || v.trim().isEmpty) return 'Champ requis';
    if (int.tryParse(v) == null) return 'Nombre entier invalide';
    return null;
  }
}

class _ImagesSection extends StatelessWidget {
  const _ImagesSection({
    required this.existing,
    required this.newPaths,
    required this.onPickCamera,
    required this.onPickGallery,
    required this.onRemoveNew,
  });

  final List<ProductImage> existing;
  final List<String> newPaths;
  final VoidCallback onPickCamera;
  final VoidCallback onPickGallery;
  final void Function(int index) onRemoveNew;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Photos', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        SizedBox(
          height: 90,
          child: ListView(
            scrollDirection: Axis.horizontal,
            children: [
              for (final img in existing)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: Image.network(img.url, width: 90, height: 90, fit: BoxFit.cover),
                  ),
                ),
              for (final entry in newPaths.asMap().entries)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: Stack(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(10),
                        child: Image.file(File(entry.value), width: 90, height: 90, fit: BoxFit.cover),
                      ),
                      Positioned(
                        right: 2,
                        top: 2,
                        child: GestureDetector(
                          onTap: () => onRemoveNew(entry.key),
                          child: const CircleAvatar(radius: 10, backgroundColor: Colors.black54, child: Icon(Icons.close, size: 12, color: Colors.white)),
                        ),
                      ),
                    ],
                  ),
                ),
              _AddPhotoButton(onCamera: onPickCamera, onGallery: onPickGallery),
            ],
          ),
        ),
      ],
    );
  }
}

class _AddPhotoButton extends StatelessWidget {
  const _AddPhotoButton({required this.onCamera, required this.onGallery});
  final VoidCallback onCamera;
  final VoidCallback onGallery;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(10),
      onTap: () => showModalBottomSheet(
        context: context,
        builder: (ctx) => SafeArea(
          child: Wrap(children: [
            ListTile(leading: const Icon(Icons.photo_camera_outlined), title: const Text('Prendre une photo'), onTap: () { Navigator.pop(ctx); onCamera(); }),
            ListTile(leading: const Icon(Icons.photo_library_outlined), title: const Text('Choisir depuis la galerie'), onTap: () { Navigator.pop(ctx); onGallery(); }),
          ]),
        ),
      ),
      child: Container(
        width: 90,
        height: 90,
        decoration: BoxDecoration(
          border: Border.all(color: Colors.grey.shade300),
          borderRadius: BorderRadius.circular(10),
        ),
        child: const Icon(Icons.add_a_photo_outlined, color: Colors.grey),
      ),
    );
  }
}

class _TierRow extends StatelessWidget {
  const _TierRow({required this.tier, required this.onChanged, required this.onRemove});
  final _TierInput tier;
  final VoidCallback onChanged;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Row(
        children: [
          Expanded(
            child: TextFormField(
              initialValue: tier.qteMin,
              decoration: const InputDecoration(labelText: 'Qté min', isDense: true),
              keyboardType: TextInputType.number,
              onChanged: (v) { tier.qteMin = v; onChanged(); },
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: TextFormField(
              initialValue: tier.qteMax,
              decoration: const InputDecoration(labelText: 'Qté max (vide = illimité)', isDense: true),
              keyboardType: TextInputType.number,
              onChanged: (v) { tier.qteMax = v; onChanged(); },
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: TextFormField(
              initialValue: tier.prix,
              decoration: const InputDecoration(labelText: 'Prix', isDense: true),
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              onChanged: (v) { tier.prix = v; onChanged(); },
            ),
          ),
          IconButton(icon: const Icon(Icons.delete_outline), onPressed: onRemove),
        ],
      ),
    );
  }
}
