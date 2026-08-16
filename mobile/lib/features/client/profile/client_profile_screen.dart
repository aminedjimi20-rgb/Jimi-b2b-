import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_controller.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/async_value_widget.dart';
import '../../../models/client.dart';
import '../../../services/service_providers.dart';
import '../../auth/change_password_screen.dart';
import '../../shared/notifications_screen.dart';
import '../favorites/client_favorites_screen.dart';
import '../orders/client_orders_screen.dart';
import '../product_requests/client_my_requests_screen.dart';

final _myProfileProvider = FutureProvider.autoDispose<ClientView>((ref) => ref.watch(clientsApiProvider).myProfile());

class ClientProfileScreen extends ConsumerWidget {
  const ClientProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(_myProfileProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Mon compte')),
      body: AsyncValueWidget<ClientView>(
        value: profile,
        onRetry: () => ref.invalidate(_myProfileProvider),
        data: (c) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(c.raisonSociale, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    Text(c.telephone, style: TextStyle(color: Colors.grey[600])),
                    if (c.email != null) Text(c.email!, style: TextStyle(color: Colors.grey[600])),
                    if (c.ville != null) Text(c.ville!, style: TextStyle(color: Colors.grey[600])),
                    const Divider(height: 24),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Limite de crédit', style: TextStyle(color: Colors.grey[600])),
                        Text(formatMoney(c.limiteCredit), style: const TextStyle(fontWeight: FontWeight.bold)),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Solde dû', style: TextStyle(color: Colors.grey[600])),
                        Text(formatMoney(c.soldeCredit), style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.warning)),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            Card(
              child: Column(
                children: [
                  ListTile(
                    leading: const Icon(Icons.receipt_long_outlined),
                    title: const Text('Mes commandes'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ClientOrdersScreen())),
                  ),
                  ListTile(
                    leading: const Icon(Icons.favorite_border),
                    title: const Text('Mes favoris'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ClientFavoritesScreen())),
                  ),
                  ListTile(
                    leading: const Icon(Icons.add_a_photo_outlined),
                    title: const Text('Mes demandes de produits'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ClientMyRequestsScreen())),
                  ),
                  ListTile(
                    leading: const Icon(Icons.notifications_outlined),
                    title: const Text('Notifications'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const NotificationsScreen())),
                  ),
                  ListTile(
                    leading: const Icon(Icons.password_outlined),
                    title: const Text('Modifier le mot de passe'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ChangePasswordScreen())),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: () => ref.read(authControllerProvider.notifier).logout(),
              style: OutlinedButton.styleFrom(foregroundColor: AppTheme.danger),
              icon: const Icon(Icons.logout),
              label: const Text('Déconnexion'),
            ),
          ],
        ),
      ),
    );
  }
}
