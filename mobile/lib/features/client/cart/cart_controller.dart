import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../models/product.dart';

class CartLine {
  CartLine({required this.product, required this.quantite});
  final ClientProduct product;
  int quantite;

  double get sousTotal => product.prix * quantite;
}

/// In-memory cart, scoped to the logged-in client's session. Prices shown
/// here are always the ones already resolved by the backend for this
/// client (see ClientProduct.prix) — the cart never recomputes a price
/// itself, and order creation re-resolves prices server-side anyway.
class CartController extends StateNotifier<List<CartLine>> {
  CartController() : super([]);

  void add(ClientProduct product, {int? quantite}) {
    final qty = quantite ?? product.minCommande;
    final index = state.indexWhere((l) => l.product.id == product.id);
    if (index >= 0) {
      final updated = [...state];
      updated[index].quantite += qty;
      state = updated;
    } else {
      state = [...state, CartLine(product: product, quantite: qty)];
    }
  }

  void updateQuantity(String productId, int quantite) {
    if (quantite <= 0) {
      remove(productId);
      return;
    }
    state = [
      for (final line in state)
        if (line.product.id == productId) (CartLine(product: line.product, quantite: quantite)) else line,
    ];
  }

  void remove(String productId) {
    state = state.where((l) => l.product.id != productId).toList();
  }

  void clear() => state = [];

  double get total => state.fold(0, (sum, line) => sum + line.sousTotal);
  int get itemCount => state.fold(0, (sum, line) => sum + line.quantite);
}

final cartControllerProvider = StateNotifierProvider<CartController, List<CartLine>>((ref) => CartController());
