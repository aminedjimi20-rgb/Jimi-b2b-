import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/utils/formatters.dart';
import '../../../core/widgets/async_value_widget.dart';
import '../../../models/client.dart';
import '../../../services/service_providers.dart';
import 'admin_client_detail_screen.dart';
import 'admin_client_form_screen.dart';

final _adminClientsProvider = FutureProvider.autoDispose<List<ClientView>>((ref) {
  return ref.watch(clientsApiProvider).listAdmin();
});

class AdminClientsScreen extends ConsumerStatefulWidget {
  const AdminClientsScreen({super.key});

  @override
  ConsumerState<AdminClientsScreen> createState() => _AdminClientsScreenState();
}

class _AdminClientsScreenState extends ConsumerState<AdminClientsScreen> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final clients = ref.watch(_adminClientsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Clients'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(56),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: TextField(
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                hintText: 'Rechercher un client...',
                hintStyle: const TextStyle(color: Colors.white70),
                prefixIcon: const Icon(Icons.search, color: Colors.white70),
                filled: true,
                fillColor: Colors.white.withValues(alpha: 0.15),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                isDense: true,
              ),
              onChanged: (v) => setState(() => _query = v.toLowerCase()),
            ),
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          final created = await Navigator.of(context).push<bool>(MaterialPageRoute(builder: (_) => const AdminClientFormScreen()));
          if (created == true) ref.invalidate(_adminClientsProvider);
        },
        icon: const Icon(Icons.person_add_alt),
        label: const Text('Nouveau client'),
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(_adminClientsProvider),
        child: AsyncValueWidget<List<ClientView>>(
          value: clients,
          onRetry: () => ref.invalidate(_adminClientsProvider),
          data: (items) {
            final filtered = _query.isEmpty ? items : items.where((c) => c.raisonSociale.toLowerCase().contains(_query)).toList();
            if (filtered.isEmpty) return const Center(child: Text('Aucun client trouvé.'));

            return ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
              itemCount: filtered.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, i) {
                final c = filtered[i];
                return Card(
                  child: ListTile(
                    leading: CircleAvatar(child: Text(c.raisonSociale.isNotEmpty ? c.raisonSociale[0].toUpperCase() : '?')),
                    title: Text(c.raisonSociale),
                    subtitle: Text(c.telephone),
                    trailing: c.soldeCredit > 0
                        ? Text(formatMoney(c.soldeCredit), style: const TextStyle(color: Colors.red, fontWeight: FontWeight.bold))
                        : (c.status == 'SUSPENDED' ? const Icon(Icons.block, color: Colors.red) : null),
                    onTap: () async {
                      await Navigator.of(context).push(MaterialPageRoute(builder: (_) => AdminClientDetailScreen(clientId: c.id)));
                      ref.invalidate(_adminClientsProvider);
                    },
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
