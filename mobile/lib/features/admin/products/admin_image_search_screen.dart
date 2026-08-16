import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../models/product.dart';
import '../../../services/products_api.dart';
import '../../../services/service_providers.dart';
import 'admin_product_detail_screen.dart';
import 'admin_product_tile.dart';

/// Admin/staff photo search — reused in three places (per the spec's
/// "recherche par photo étendue"): browsing the product list by photo,
/// picking an existing article while building a bon de réception (so the
/// Admin doesn't accidentally create a duplicate product), and a general
/// "what is this" search from the Plus menu. Full admin product shape
/// (prixAchat/marge), so this screen must never be reachable by
/// Client/Employee — see ProductsController.searchByImageAdmin.
///
/// [selectMode] changes what tapping a result does: pop with the picked
/// [AdminProduct] (used as a picker) instead of opening its detail screen.
class AdminImageSearchScreen extends ConsumerStatefulWidget {
  const AdminImageSearchScreen({super.key, this.selectMode = false});
  final bool selectMode;

  @override
  ConsumerState<AdminImageSearchScreen> createState() => _AdminImageSearchScreenState();
}

class _AdminImageSearchScreenState extends ConsumerState<AdminImageSearchScreen> {
  String? _pickedPath;
  bool _loading = false;
  String? _error;
  List<AdminImageSearchResult>? _results;

  Future<void> _pick(ImageSource source) async {
    final picked = await ImagePicker().pickImage(source: source, imageQuality: 85, maxWidth: 1200);
    if (picked == null) return;

    setState(() {
      _pickedPath = picked.path;
      _loading = true;
      _error = null;
      _results = null;
    });

    try {
      final results = await ref.read(productsApiProvider).searchByImageAdmin(picked.path);
      setState(() => _results = results);
    } catch (e) {
      setState(() => _error = e is ApiException ? e.message : 'Erreur de recherche.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Recherche par photo')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _pick(ImageSource.camera),
                    icon: const Icon(Icons.photo_camera_outlined),
                    label: const Text('Caméra'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _pick(ImageSource.gallery),
                    icon: const Icon(Icons.photo_library_outlined),
                    label: const Text('Galerie'),
                  ),
                ),
              ],
            ),
          ),
          if (_pickedPath != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: Image.file(File(_pickedPath!), height: 140, fit: BoxFit.cover),
              ),
            ),
          const SizedBox(height: 12),
          if (_loading) const Expanded(child: Center(child: CircularProgressIndicator())),
          if (_error != null) Expanded(child: Center(child: Text(_error!, style: const TextStyle(color: AppTheme.danger)))),
          if (!_loading && _results != null)
            Expanded(
              child: _results!.isEmpty
                  ? const Center(child: Text('Aucun produit similaire trouvé.'))
                  : ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: _results!.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 10),
                      itemBuilder: (context, i) {
                        final r = _results![i];
                        return Stack(
                          children: [
                            AdminProductTile(
                              product: r.product,
                              onTap: () {
                                if (widget.selectMode) {
                                  Navigator.of(context).pop(r.product);
                                } else {
                                  Navigator.of(context)
                                      .push(MaterialPageRoute(builder: (_) => AdminProductDetailScreen(productId: r.product.id)));
                                }
                              },
                            ),
                            Positioned(
                              top: 4,
                              right: 4,
                              child: Chip(
                                label: Text('${r.matchScore}%'),
                                backgroundColor: AppTheme.primary.withValues(alpha: 0.1),
                                visualDensity: VisualDensity.compact,
                                materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                              ),
                            ),
                          ],
                        );
                      },
                    ),
            ),
        ],
      ),
    );
  }
}
