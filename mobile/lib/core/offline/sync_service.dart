import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../services/orders_api.dart';
import '../../services/service_providers.dart';
import '../providers.dart';
import 'app_database.dart';

/// Flushes orders that were created while offline (queued in
/// AppDatabase.pending_orders by CheckoutScreen) as soon as connectivity
/// is back. The server remains the sole source of truth for prices/stock
/// — a queued order is just re-submitted as a normal `POST /orders`, which
/// re-resolves everything at send time (see docs/ARCHITECTURE.md §9).
class SyncService {
  SyncService(this._db, this._ordersApi);

  final AppDatabase _db;
  final OrdersApi _ordersApi;

  bool _syncing = false;

  Future<int> flushPendingOrders() async {
    if (_syncing) return 0;
    _syncing = true;
    var sent = 0;
    try {
      final pending = await _db.readPendingOrders();
      for (final order in pending) {
        try {
          final payload = order.payload;
          await _ordersApi.create(
            items: (payload['items'] as List<dynamic>)
                .map((e) => OrderItemInput(productId: e['productId'] as String, quantite: e['quantite'] as int))
                .toList(),
            paymentMethod: payload['paymentMethod'] as String,
            adresseLivraison: payload['adresseLivraison'] as String,
            telephoneContact: payload['telephoneContact'] as String,
            notes: payload['notes'] as String?,
          );
          await _db.removePendingOrder(order.id);
          sent++;
        } catch (_) {
          // Leave it queued — could be a transient error (stock changed,
          // still offline, server briefly down). Retried on the next sync.
        }
      }
    } finally {
      _syncing = false;
    }
    return sent;
  }
}

final syncServiceProvider = Provider<SyncService>((ref) {
  return SyncService(ref.watch(appDatabaseProvider), ref.watch(ordersApiProvider));
});
