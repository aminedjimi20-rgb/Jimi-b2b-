import 'package:flutter/material.dart';

import 'clients/admin_clients_screen.dart';
import 'more/admin_more_screen.dart';
import 'orders/admin_orders_screen.dart';
import 'products/admin_products_screen.dart';
import 'stock/admin_stock_receipts_screen.dart';

/// First tab is "Réception" (bons fournisseurs), not the stats Dashboard —
/// revenue/margin figures shouldn't be the first thing on screen when
/// opening the app; the Dashboard now lives under Plus > Statistiques.
class AdminShell extends StatefulWidget {
  const AdminShell({super.key});

  @override
  State<AdminShell> createState() => _AdminShellState();
}

class _AdminShellState extends State<AdminShell> {
  int _index = 0;

  static const _tabs = [
    AdminStockReceiptsScreen(),
    AdminProductsScreen(),
    AdminOrdersScreen(),
    AdminClientsScreen(),
    AdminMoreScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _index, children: _tabs),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.move_to_inbox_outlined), selectedIcon: Icon(Icons.move_to_inbox), label: 'Réception'),
          NavigationDestination(icon: Icon(Icons.inventory_2_outlined), selectedIcon: Icon(Icons.inventory_2), label: 'Produits'),
          NavigationDestination(icon: Icon(Icons.receipt_long_outlined), selectedIcon: Icon(Icons.receipt_long), label: 'Commandes'),
          NavigationDestination(icon: Icon(Icons.people_outline), selectedIcon: Icon(Icons.people), label: 'Clients'),
          NavigationDestination(icon: Icon(Icons.more_horiz), selectedIcon: Icon(Icons.more_horiz), label: 'Plus'),
        ],
      ),
    );
  }
}
