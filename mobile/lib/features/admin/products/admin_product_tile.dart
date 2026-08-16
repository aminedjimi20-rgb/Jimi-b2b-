import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/photo_gallery_viewer.dart';
import '../../../models/product.dart';

/// Product row shared by the flat search results and the per-category lists —
/// shows the product photo when available so items are recognizable at a glance.
class AdminProductTile extends StatelessWidget {
  const AdminProductTile({super.key, required this.product, required this.onTap});

  final AdminProduct product;
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
                      errorWidget: (_, __, ___) => _FallbackIcon(lowStock: lowStock),
                      placeholder: (_, __) => _FallbackIcon(lowStock: lowStock),
                    )
                  : _FallbackIcon(lowStock: lowStock),
            ),
          ),
        ),
        title: Text(product.nom, maxLines: 1, overflow: TextOverflow.ellipsis),
        // Marge/prix d'achat restent Admin-only mais n'apparaissent que sur la
        // fiche produit détaillée — pas sur cette liste, pour ne pas l'afficher
        // "en passant" à quiconque regarde par-dessus l'épaule de l'Admin.
        subtitle: Text('${product.code} · Stock: ${product.stockReel}'),
        trailing: Text(formatMoney(product.prixVente), style: const TextStyle(fontWeight: FontWeight.bold)),
        onTap: onTap,
      ),
    );
  }
}

class _FallbackIcon extends StatelessWidget {
  const _FallbackIcon({required this.lowStock});
  final bool lowStock;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: lowStock ? AppTheme.warning.withValues(alpha: 0.15) : Colors.grey.shade100,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Icon(Icons.inventory_2_outlined, color: lowStock ? AppTheme.warning : Colors.grey[600]),
    );
  }
}
