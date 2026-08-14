import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/async_value_widget.dart';
import '../../models/app_notification.dart';
import '../../services/service_providers.dart';

final notificationsProvider = FutureProvider.autoDispose<List<AppNotification>>((ref) {
  return ref.watch(notificationsApiProvider).list();
});

IconData _iconFor(String type) {
  switch (type) {
    case 'NOUVELLE_COMMANDE':
      return Icons.receipt_long;
    case 'STATUT_COMMANDE':
      return Icons.local_shipping_outlined;
    case 'STOCK_FAIBLE':
      return Icons.warning_amber_rounded;
    case 'PROMOTION':
      return Icons.local_offer_outlined;
    default:
      return Icons.notifications_outlined;
  }
}

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifications = ref.watch(notificationsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          IconButton(
            icon: const Icon(Icons.done_all),
            tooltip: 'Tout marquer comme lu',
            onPressed: () async {
              await ref.read(notificationsApiProvider).markAllRead();
              ref.invalidate(notificationsProvider);
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(notificationsProvider),
        child: AsyncValueWidget<List<AppNotification>>(
          value: notifications,
          onRetry: () => ref.invalidate(notificationsProvider),
          data: (items) {
            if (items.isEmpty) return const Center(child: Text('Aucune notification.'));
            return ListView.separated(
              itemCount: items.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (context, i) {
                final n = items[i];
                return ListTile(
                  tileColor: n.lu ? null : AppTheme.primary.withValues(alpha: 0.04),
                  leading: Icon(_iconFor(n.type), color: n.lu ? Colors.grey : AppTheme.primary),
                  title: Text(n.titre, style: TextStyle(fontWeight: n.lu ? FontWeight.normal : FontWeight.bold)),
                  subtitle: Text('${n.message}\n${formatDate(n.createdAt)}'),
                  isThreeLine: true,
                  onTap: () async {
                    if (!n.lu) {
                      await ref.read(notificationsApiProvider).markRead(n.id);
                      ref.invalidate(notificationsProvider);
                    }
                  },
                );
              },
            );
          },
        ),
      ),
    );
  }
}
