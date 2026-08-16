import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/async_value_widget.dart';
import '../../../core/widgets/photo_gallery_viewer.dart';
import '../../../models/product.dart';
import '../../../services/service_providers.dart';
import 'admin_product_form_screen.dart';

final _adminProductDetailProvider = FutureProvider.autoDispose.family<AdminProduct, String>((ref, id) {
  return ref.watch(productsApiProvider).getAdmin(id);
});

/// Fiche produit — vue complète en lecture seule : infos, stock, prix
/// d'achat/vente et marge, prix de vente par catégorie, dates de dernier
/// changement de prix / dernier arrivage, et badges (Nouveau/Saisonnier/
/// Promo/Nouveau prix). La modification se fait via le bouton "Modifier".
class AdminProductDetailScreen extends ConsumerWidget {
  const AdminProductDetailScreen({super.key, required this.productId});
  final String productId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final product = ref.watch(_adminProductDetailProvider(productId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Fiche produit'),
        actions: [
          IconButton(
            icon: const Icon(Icons.edit_outlined),
            tooltip: 'Modifier',
            onPressed: () async {
              final updated = await Navigator.of(context).push<bool>(
                MaterialPageRoute(builder: (_) => AdminProductFormScreen(productId: productId)),
              );
              if (updated == true) ref.invalidate(_adminProductDetailProvider(productId));
            },
          ),
        ],
      ),
      body: AsyncValueWidget<AdminProduct>(
        value: product,
        onRetry: () => ref.invalidate(_adminProductDetailProvider(productId)),
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
                if (!p.actif) const _Badge(label: 'Inactif', color: AppTheme.danger),
                if (p.estNouveau) const _Badge(label: 'Nouveau', color: AppTheme.primary),
                if (p.estSaisonnier) const _Badge(label: 'Saisonnier', color: AppTheme.warning),
                if (p.estPromo) const _Badge(label: 'Promo', color: AppTheme.danger),
                if (p.estNouveauPrix) const _Badge(label: 'Nouveau prix', color: AppTheme.success),
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
                    _InfoRow(label: 'Stock minimum', value: '${p.stockMinimum}'),
                    _InfoRow(label: 'Minimum de commande', value: '${p.minCommande}'),
                    if (p.uniteParCarton != null) _InfoRow(label: 'Unités par carton', value: '${p.uniteParCarton}'),
                    _InfoRow(label: 'Dernier arrivage', value: p.dernierArrivage != null ? formatDate(p.dernierArrivage!) : 'Jamais'),
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
                    Text('Prix & marge', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    _InfoRow(label: 'Prix achat', value: formatMoney(p.prixAchat)),
                    _InfoRow(label: 'Prix vente', value: formatMoney(p.prixVente)),
                    _InfoRow(label: 'Marge', value: '${formatMoney(p.marge)} (${p.margePourcentage.toStringAsFixed(0)}%)'),
                    _InfoRow(
                      label: 'Dernier changement',
                      value: p.dernierChangementPrix != null ? formatDate(p.dernierChangementPrix!) : 'Jamais',
                    ),
                    if (p.priceTiers.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text('Grille par quantité', style: TextStyle(fontWeight: FontWeight.w600, color: Colors.grey[700])),
                      for (final t in p.priceTiers) _InfoRow(label: t.label, value: formatMoney(t.prix)),
                    ],
                  ],
                ),
              ),
            ),
            if (p.salePrices.isNotEmpty) ...[
              const SizedBox(height: 12),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Prix de vente par catégorie', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                      const SizedBox(height: 8),
                      for (final sp in p.salePrices) _InfoRow(label: sp.priceCategoryNom, value: formatMoney(sp.prix)),
                    ],
                  ),
                ),
              ),
            ],
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
