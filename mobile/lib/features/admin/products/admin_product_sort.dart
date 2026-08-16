import 'package:flutter/material.dart';

const Map<String, String> kProductSortOptions = {
  'nom': 'Nom (A-Z)',
  'nomDesc': 'Nom (Z-A)',
  'stock': 'Stock (décroissant)',
  'prix': 'Prix (décroissant)',
  'prixAsc': 'Prix (croissant)',
  'dernierChangement': 'Dernier changement de prix',
  'dernierArrivage': 'Dernier arrivage',
  'nouveautes': 'Nouveautés',
  'saisonnier': 'Saisonnier',
};

/// Sort menu shared by the products list and the per-category "folder" view —
/// `null` means the backend's default order (dernière modification).
class ProductSortMenuButton extends StatelessWidget {
  const ProductSortMenuButton({super.key, required this.value, required this.onChanged});

  final String? value;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<String?>(
      icon: const Icon(Icons.sort),
      tooltip: 'Trier',
      initialValue: value,
      onSelected: onChanged,
      itemBuilder: (context) => [
        const PopupMenuItem<String?>(value: null, child: Text('Par défaut')),
        for (final entry in kProductSortOptions.entries) PopupMenuItem<String?>(value: entry.key, child: Text(entry.value)),
      ],
    );
  }
}
