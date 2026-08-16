import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/async_value_widget.dart';
import '../../../models/product_request.dart';
import '../../../services/service_providers.dart';
import 'client_request_product_screen.dart';

final _myRequestsProvider = FutureProvider.autoDispose<List<ProductRequestView>>((ref) {
  return ref.watch(productRequestsApiProvider).mine();
});

Color _statusColor(String status) {
  switch (status) {
    case 'TRAITEE':
      return AppTheme.success;
    case 'REJETEE':
      return AppTheme.danger;
    default:
      return AppTheme.warning;
  }
}

class ClientMyRequestsScreen extends ConsumerWidget {
  const ClientMyRequestsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final requests = ref.watch(_myRequestsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Mes demandes de produits')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          final sent = await Navigator.of(context).push<bool>(MaterialPageRoute(builder: (_) => const ClientRequestProductScreen()));
          if (sent == true) ref.invalidate(_myRequestsProvider);
        },
        icon: const Icon(Icons.add_a_photo_outlined),
        label: const Text('Nouvelle demande'),
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(_myRequestsProvider),
        child: AsyncValueWidget<List<ProductRequestView>>(
          value: requests,
          onRetry: () => ref.invalidate(_myRequestsProvider),
          data: (items) {
            if (items.isEmpty) {
              return ListView(
                children: const [
                  Padding(
                    padding: EdgeInsets.all(32),
                    child: Text(
                      "Aucune demande pour le moment.\nVous ne trouvez pas un produit ? Envoyez-en une photo.",
                      textAlign: TextAlign.center,
                    ),
                  ),
                ],
              );
            }
            return ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, i) {
                final r = items[i];
                return Card(
                  child: ListTile(
                    leading: ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: CachedNetworkImage(imageUrl: r.imageUrl, width: 48, height: 48, fit: BoxFit.cover),
                    ),
                    title: Text(r.description ?? 'Sans description', maxLines: 1, overflow: TextOverflow.ellipsis),
                    subtitle: Text(
                      formatDate(r.createdAt) + (r.adminNote != null ? '\n${r.adminNote}' : ''),
                    ),
                    isThreeLine: r.adminNote != null,
                    trailing: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(color: _statusColor(r.status).withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
                      child: Text(productRequestStatusLabel(r.status), style: TextStyle(color: _statusColor(r.status), fontSize: 11, fontWeight: FontWeight.w600)),
                    ),
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}
