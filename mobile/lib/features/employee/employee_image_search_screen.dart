import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/api/api_exception.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/photo_gallery_viewer.dart';
import '../../services/products_api.dart';
import '../../services/service_providers.dart';
import 'employee_request_product_screen.dart';

/// Employee takes/picks a photo of a product they're holding — same idea as
/// the Client's photo search (see ImageSearchScreen), restricted to the
/// Employee shape (no prixAchat/marge, see EmployeeProduct).
class EmployeeImageSearchScreen extends ConsumerStatefulWidget {
  const EmployeeImageSearchScreen({super.key});

  @override
  ConsumerState<EmployeeImageSearchScreen> createState() => _EmployeeImageSearchScreenState();
}

class _EmployeeImageSearchScreenState extends ConsumerState<EmployeeImageSearchScreen> {
  String? _pickedPath;
  bool _loading = false;
  String? _error;
  List<EmployeeImageSearchResult>? _results;

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
      final results = await ref.read(productsApiProvider).searchByImageStaff(picked.path);
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
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Text('Aucun produit similaire trouvé.', textAlign: TextAlign.center),
                            const SizedBox(height: 16),
                            OutlinedButton.icon(
                              onPressed: () => Navigator.of(context).push(
                                MaterialPageRoute(builder: (_) => EmployeeRequestProductScreen(initialImagePath: _pickedPath)),
                              ),
                              icon: const Icon(Icons.add_a_photo_outlined),
                              label: const Text('Demander ce produit'),
                            ),
                          ],
                        ),
                      ),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: _results!.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 10),
                      itemBuilder: (context, i) {
                        final r = _results![i];
                        return Card(
                          child: ListTile(
                            leading: GestureDetector(
                              onTap: r.product.primaryImageUrl != null
                                  ? () => PhotoGalleryViewer.open(context, r.product.images.map((img) => img.url).toList())
                                  : null,
                              child: r.product.primaryImageUrl != null
                                  ? ClipRRect(
                                      borderRadius: BorderRadius.circular(6),
                                      child: CachedNetworkImage(imageUrl: r.product.primaryImageUrl!, width: 48, height: 48, fit: BoxFit.cover),
                                    )
                                  : const Icon(Icons.image_outlined),
                            ),
                            title: Text(r.product.nom),
                            subtitle: Text('${r.product.code} · ${formatMoney(r.product.prixVente)}'),
                            trailing: Chip(label: Text('${r.matchScore}%'), backgroundColor: AppTheme.primary.withValues(alpha: 0.1)),
                          ),
                        );
                      },
                    ),
            ),
        ],
      ),
    );
  }
}
