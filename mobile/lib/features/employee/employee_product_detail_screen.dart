import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/async_value_widget.dart';
import '../../core/widgets/photo_gallery_viewer.dart';
import '../../models/employee_product.dart';
import '../../services/service_providers.dart';

final _employeeProductDetailProvider = FutureProvider.autoDispose.family<EmployeeProduct, String>((ref, id) {
  return ref.watch(productsApiProvider).getStaff(id);
});

/// Fiche produit read-only pour l'Employé — jamais prixAchat/marge (voir
/// EmployeeProduct), accessible via le bouton "Détails" d'un article de bon
/// ou depuis la liste produits.
class EmployeeProductDetailScreen extends ConsumerWidget {
  const EmployeeProductDetailScreen({super.key, required this.productId});
  final String productId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final product = ref.watch(_employeeProductDetailProvider(productId));

    return Scaffold(
      appBar: AppBar(title: const Text('Fiche produit')),
      body: AsyncValueWidget<EmployeeProduct>(
        value: product,
        onRetry: () => ref.invalidate(_employeeProductDetailProvider(productId)),
        data: (p) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (p.images.isNotEmpty)
              SizedBox(
                height: 140,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: p.images.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 8),
                  itemBuilder: (context, i) => GestureDetector(
                    onTap: () => PhotoGalleryViewer.open(context, p.images.map((img) => img.url).toList(), initialIndex: i),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(10),
                      child: CachedNetworkImage(imageUrl: p.images[i].url, width: 140, height: 140, fit: BoxFit.cover),
                    ),
                  ),
                ),
              ),
            const SizedBox(height: 16),
            Text(p.nom, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
            Text(p.code, style: TextStyle(color: Colors.grey[600])),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                if (p.estNouveau) const _Badge(label: 'Nouveau', color: AppTheme.primary),
                if (p.estSaisonnier) const _Badge(label: 'Saisonnier', color: AppTheme.warning),
                if (p.estPromo) const _Badge(label: 'Promo', color: AppTheme.danger),
                if (p.stockReel <= p.stockMinimum) const _Badge(label: 'Stock faible', color: AppTheme.warning),
              ],
            ),
            const Divider(height: 32),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Informations', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    _InfoRow(label: 'Fournisseur', value: p.fabricantNom ?? '-'),
                    if (p.taille != null && p.taille!.isNotEmpty) _InfoRow(label: 'Taille', value: p.taille!),
                    if (p.couleur != null && p.couleur!.isNotEmpty) _InfoRow(label: 'Couleur', value: p.couleur!),
                    if (p.marque != null && p.marque!.isNotEmpty) _InfoRow(label: 'Marque', value: p.marque!),
                    if (p.description != null && p.description!.isNotEmpty) _InfoRow(label: 'Description', value: p.description!),
                    _InfoRow(label: 'Prix vente', value: formatMoney(p.prixVente)),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Stock', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    _InfoRow(label: 'Stock réel', value: '${p.stockReel}'),
                    if (p.uniteParCarton != null) _InfoRow(label: 'Unités par carton', value: '${p.uniteParCarton}'),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 140, child: Text(label, style: TextStyle(color: Colors.grey[600]))),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge({required this.label, required this.color});
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
      child: Text(label, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600)),
    );
  }
}
