import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_exception.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/async_value_widget.dart';
import '../../models/app_notification.dart';
import '../../services/service_providers.dart';

final _notificationsTrashProvider = FutureProvider.autoDispose<List<AppNotification>>((ref) {
  return ref.watch(notificationsApiProvider).trash();
});

/// Corbeille des notifications — available to every role (not just Admin),
/// same reversible pattern as the rest of the app: restore or erase for good.
class NotificationsTrashScreen extends ConsumerWidget {
  const NotificationsTrashScreen({super.key});

  Future<void> _restore(BuildContext context, WidgetRef ref, String id) async {
    try {
      await ref.read(notificationsApiProvider).restore(id);
      ref.invalidate(_notificationsTrashProvider);
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e is ApiException ? e.message : 'Erreur.')));
      }
    }
  }

  Future<void> _confirmPermanentDelete(BuildContext context, WidgetRef ref, String id) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Supprimer définitivement ?'),
        content: const Text('Cette notification sera effacée pour toujours. Cette action ne peut pas être annulée.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Annuler')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: AppTheme.danger),
            child: const Text('Supprimer définitivement'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    try {
      await ref.read(notificationsApiProvider).permanentDelete(id);
      ref.invalidate(_notificationsTrashProvider);
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e is ApiException ? e.message : 'Erreur.')));
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final items = ref.watch(_notificationsTrashProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Corbeille des notifications')),
      body: AsyncValueWidget<List<AppNotification>>(
        value: items,
        onRetry: () => ref.invalidate(_notificationsTrashProvider),
        data: (list) {
          if (list.isEmpty) return const Center(child: Text('Corbeille des notifications vide.'));
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: list.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, i) {
              final n = list[i];
              return Card(
                child: ListTile(
                  title: Text(n.titre, maxLines: 1, overflow: TextOverflow.ellipsis),
                  subtitle: Text('${n.message}\n${formatDate(n.createdAt)}'),
                  isThreeLine: true,
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(icon: const Icon(Icons.restore), tooltip: 'Restaurer', onPressed: () => _restore(context, ref, n.id)),
                      IconButton(
                        icon: const Icon(Icons.delete_forever, color: AppTheme.danger),
                        tooltip: 'Supprimer définitivement',
                        onPressed: () => _confirmPermanentDelete(context, ref, n.id),
                      ),
                    ],
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
