import 'package:flutter/material.dart';

/// Sort menu shared by Client/Employee product lists — each role only ever
/// sees the subset of criteria that make sense for what they're allowed to
/// see (never a sort depending on prixAchat/marge/stock exact for these two
/// roles — see backend ProductsService.CLIENT_SORT_OPTIONS/EMPLOYEE_SORT_OPTIONS).
/// `null` means the backend's default order.
class ProductSortMenu extends StatelessWidget {
  const ProductSortMenu({super.key, required this.options, required this.value, required this.onChanged});

  final Map<String, String> options;
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
        for (final entry in options.entries) PopupMenuItem<String?>(value: entry.key, child: Text(entry.value)),
      ],
    );
  }
}

const kClientSortOptions = <String, String>{
  'nom': 'Nom (A-Z)',
  'nomDesc': 'Nom (Z-A)',
  'prix': 'Prix décroissant',
  'prixAsc': 'Prix croissant',
  'nouveautes': 'Nouveaux articles',
  'dernierChangement': 'Dernier changement de prix',
};

const kEmployeeSortOptions = <String, String>{
  'nom': 'Nom (A-Z)',
  'nomDesc': 'Nom (Z-A)',
  'prix': 'Prix décroissant',
  'prixAsc': 'Prix croissant',
  'nouveautes': 'Nouveaux articles',
  'dernierArrivage': 'Dernier arrivage',
  'stock': 'Stock',
};
