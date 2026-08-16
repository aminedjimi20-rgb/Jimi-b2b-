import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../models/category.dart';
import '../../../models/employee_permissions.dart';
import '../../../services/service_providers.dart';
import '../employee_session.dart';

final _categoriesForNewProductProvider = FutureProvider.autoDispose<List<Category>>((ref) => ref.watch(categoriesApiProvider).list());

/// "+ Nouvel article" inline creation, requires canCreerProduit (checked
/// server-side too). Created with stockReel=0 — the actual stock is added
/// only once the bon d'entrée that references it is confirmed (Phase 38),
/// never here, to avoid double-counting.
class EmployeeNewProductScreen extends ConsumerStatefulWidget {
  const EmployeeNewProductScreen({super.key, this.initialFabricantId});
  final String? initialFabricantId;

  @override
  ConsumerState<EmployeeNewProductScreen> createState() => _EmployeeNewProductScreenState();
}

class _EmployeeNewProductScreenState extends ConsumerState<EmployeeNewProductScreen> {
  final _nom = TextEditingController();
  final _code = TextEditingController();
  final _taille = TextEditingController();
  final _couleur = TextEditingController();
  final _marque = TextEditingController();
  final _uniteParCarton = TextEditingController();
  final _prixVente = TextEditingController();
  final _prixAchat = TextEditingController();
  String? _categoryId;
  String? _imagePath;
  String? _uploadedImageUrl;
  bool _saving = false;
  bool _uploading = false;
  String? _error;

  Future<void> _pickPhoto(ImageSource source) async {
    final picked = await ImagePicker().pickImage(source: source, imageQuality: 85, maxWidth: 1200);
    if (picked == null) return;
    setState(() {
      _imagePath = picked.path;
      _uploading = true;
    });
    try {
      final url = await ref.read(uploadsApiProvider).uploadProductImage(picked.path);
      setState(() => _uploadedImageUrl = url);
    } catch (e) {
      setState(() => _error = e is ApiException ? e.message : "Erreur lors de l'envoi de la photo.");
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _submit(bool canModifierPrixAchat) async {
    if (_nom.text.trim().isEmpty || _code.text.trim().isEmpty || _categoryId == null) {
      setState(() => _error = 'Nom, code et catégorie sont requis.');
      return;
    }
    final prixVente = double.tryParse(_prixVente.text.replaceAll(',', '.'));
    if (prixVente == null || prixVente < 0) {
      setState(() => _error = 'Prix de vente invalide.');
      return;
    }
    final prixAchat = canModifierPrixAchat ? (double.tryParse(_prixAchat.text.replaceAll(',', '.')) ?? 0) : 0;

    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      final product = await ref.read(productsApiProvider).createStaff({
        'nom': _nom.text.trim(),
        'code': _code.text.trim(),
        'categoryId': _categoryId,
        if (widget.initialFabricantId != null) 'fabricantId': widget.initialFabricantId,
        if (_taille.text.trim().isNotEmpty) 'taille': _taille.text.trim(),
        if (_couleur.text.trim().isNotEmpty) 'couleur': _couleur.text.trim(),
        if (_marque.text.trim().isNotEmpty) 'marque': _marque.text.trim(),
        'prixAchat': prixAchat,
        'prixVente': prixVente,
        'stockReel': 0,
        'stockMinimum': 0,
        'minCommande': 1,
        if (_uniteParCarton.text.trim().isNotEmpty) 'uniteParCarton': int.tryParse(_uniteParCarton.text.trim()),
        'estNouveau': true,
        if (_uploadedImageUrl != null) 'imageUrls': [_uploadedImageUrl],
      });
      if (mounted) Navigator.of(context).pop(product);
    } catch (e) {
      setState(() => _error = e is ApiException ? e.message : 'Erreur lors de la création.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  void dispose() {
    _nom.dispose();
    _code.dispose();
    _taille.dispose();
    _couleur.dispose();
    _marque.dispose();
    _uniteParCarton.dispose();
    _prixVente.dispose();
    _prixAchat.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final permissions = ref.watch(employeePermissionsProvider).valueOrNull ?? EmployeePermissions();
    final categories = ref.watch(_categoriesForNewProductProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Nouvel article')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Center(
            child: GestureDetector(
              onTap: () => showModalBottomSheet(
                context: context,
                builder: (ctx) => SafeArea(
                  child: Wrap(
                    children: [
                      ListTile(
                        leading: const Icon(Icons.photo_camera_outlined),
                        title: const Text('Caméra'),
                        onTap: () {
                          Navigator.pop(ctx);
                          _pickPhoto(ImageSource.camera);
                        },
                      ),
                      ListTile(
                        leading: const Icon(Icons.photo_library_outlined),
                        title: const Text('Galerie'),
                        onTap: () {
                          Navigator.pop(ctx);
                          _pickPhoto(ImageSource.gallery);
                        },
                      ),
                    ],
                  ),
                ),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: SizedBox(
                  width: 120,
                  height: 120,
                  child: _imagePath != null
                      ? Image.file(File(_imagePath!), fit: BoxFit.cover)
                      : Container(
                          color: Colors.grey.shade100,
                          child: _uploading
                              ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
                              : const Icon(Icons.add_a_photo_outlined, size: 32),
                        ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 20),
          TextFormField(controller: _nom, decoration: const InputDecoration(labelText: 'Nom du produit')),
          const SizedBox(height: 12),
          TextFormField(controller: _code, decoration: const InputDecoration(labelText: 'Code')),
          const SizedBox(height: 12),
          categories.when(
            data: (list) => DropdownButtonFormField<String>(
              initialValue: _categoryId,
              decoration: const InputDecoration(labelText: 'Catégorie'),
              items: list.map((c) => DropdownMenuItem(value: c.id, child: Text(c.nom))).toList(),
              onChanged: (v) => setState(() => _categoryId = v),
            ),
            loading: () => const LinearProgressIndicator(),
            error: (_, __) => const Text('Impossible de charger les catégories.'),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: TextFormField(controller: _taille, decoration: const InputDecoration(labelText: 'Taille (optionnel)'))),
              const SizedBox(width: 8),
              Expanded(child: TextFormField(controller: _couleur, decoration: const InputDecoration(labelText: 'Couleur (optionnel)'))),
            ],
          ),
          const SizedBox(height: 12),
          TextFormField(controller: _marque, decoration: const InputDecoration(labelText: 'Marque (optionnel)')),
          const SizedBox(height: 12),
          TextFormField(
            controller: _uniteParCarton,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Unités par carton (optionnel)'),
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _prixVente,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(labelText: 'Prix de vente'),
          ),
          if (permissions.canModifierPrixAchat) ...[
            const SizedBox(height: 12),
            TextFormField(
              controller: _prixAchat,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(labelText: 'Prix d\'achat', helperText: 'Sera ajusté après la remise fournisseur, si applicable.'),
            ),
          ],
          if (_error != null) ...[
            const SizedBox(height: 16),
            Text(_error!, style: const TextStyle(color: AppTheme.danger)),
          ],
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: _saving || _uploading ? null : () => _submit(permissions.canModifierPrixAchat),
            child: _saving
                ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Text('Créer et ajouter au bon'),
          ),
        ],
      ),
    );
  }
}
