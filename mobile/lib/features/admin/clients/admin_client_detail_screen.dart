import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/async_value_widget.dart';
import '../../../models/client.dart';
import '../../../models/product.dart';
import '../../../services/service_providers.dart';

final _adminClientProvider = FutureProvider.autoDispose.family<ClientView, String>((ref, id) {
  return ref.watch(clientsApiProvider).getAdmin(id);
});

class AdminClientDetailScreen extends ConsumerWidget {
  const AdminClientDetailScreen({super.key, required this.clientId});
  final String clientId;

  Future<void> _toggleStatus(BuildContext context, WidgetRef ref, ClientView client) async {
    final newStatus = client.status == 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await ref.read(clientsApiProvider).setStatus(clientId, newStatus);
      ref.invalidate(_adminClientProvider(clientId));
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e is ApiException ? e.message : 'Erreur.')));
      }
    }
  }

  Future<void> _confirmDelete(BuildContext context, WidgetRef ref, ClientView client) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Supprimer ce client ?'),
        content: Text(
          '${client.raisonSociale} sera déplacé vers la corbeille et son compte suspendu. Vous pourrez le restaurer plus tard.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Annuler')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: AppTheme.danger),
            child: const Text('Supprimer'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    try {
      await ref.read(clientsApiProvider).remove(clientId);
      if (context.mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e is ApiException ? e.message : 'Erreur.')));
      }
    }
  }

  Future<void> _openCustomPriceDialog(BuildContext context, WidgetRef ref) async {
    final products = await ref.read(productsApiProvider).listAdmin();
    if (!context.mounted) return;

    AdminProduct? selected;
    final priceController = TextEditingController();

    await showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setState) => AlertDialog(
          title: const Text('Prix personnalisé'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<AdminProduct>(
                initialValue: selected,
                decoration: const InputDecoration(labelText: 'Produit'),
                items: products.map((p) => DropdownMenuItem(value: p, child: Text(p.nom, overflow: TextOverflow.ellipsis))).toList(),
                onChanged: (v) => setState(() => selected = v),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: priceController,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Prix pour ce client'),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Annuler')),
            ElevatedButton(
              onPressed: () async {
                final price = double.tryParse(priceController.text);
                if (selected == null || price == null) return;
                await ref.read(productsApiProvider).setCustomPrice(selected!.id, clientId, price);
                if (ctx.mounted) Navigator.pop(ctx);
              },
              child: const Text('Enregistrer'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _changePriceCategory(BuildContext context, WidgetRef ref, ClientView client) async {
    final categories = await ref.read(priceCategoriesApiProvider).list();
    if (!context.mounted) return;

    String? selectedId = client.priceCategoryId;
    final result = await showDialog<String?>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setState) => AlertDialog(
          title: const Text('Catégorie de prix'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              RadioListTile<String?>(
                title: const Text('Aucune (prix normal)'),
                value: null,
                groupValue: selectedId,
                onChanged: (v) => setState(() => selectedId = v),
              ),
              for (final cat in categories)
                RadioListTile<String?>(
                  title: Text(cat.nom),
                  value: cat.id,
                  groupValue: selectedId,
                  onChanged: (v) => setState(() => selectedId = v),
                ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Annuler')),
            ElevatedButton(onPressed: () => Navigator.pop(ctx, selectedId ?? ''), child: const Text('Enregistrer')),
          ],
        ),
      ),
    );
    if (result == null) return;

    try {
      await ref.read(clientsApiProvider).update(clientId, {'priceCategoryId': result});
      ref.invalidate(_adminClientProvider(clientId));
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e is ApiException ? e.message : 'Erreur.')));
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final client = ref.watch(_adminClientProvider(clientId));

    return Scaffold(
      appBar: AppBar(title: const Text('Fiche client')),
      body: AsyncValueWidget<ClientView>(
        value: client,
        onRetry: () => ref.invalidate(_adminClientProvider(clientId)),
        data: (c) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(child: Text(c.raisonSociale, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold))),
                        Chip(
                          label: Text(c.status == 'ACTIVE' ? 'Actif' : 'Suspendu'),
                          backgroundColor: (c.status == 'ACTIVE' ? AppTheme.success : AppTheme.danger).withValues(alpha: 0.12),
                          labelStyle: TextStyle(color: c.status == 'ACTIVE' ? AppTheme.success : AppTheme.danger),
                        ),
                      ],
                    ),
                    const Divider(height: 24),
                    _Row(label: 'Téléphone', value: c.telephone),
                    if (c.email != null) _Row(label: 'Email', value: c.email!),
                    if (c.ville != null) _Row(label: 'Ville', value: c.ville!),
                    if (c.adresse != null) _Row(label: 'Adresse', value: c.adresse!),
                    _Row(label: 'Limite crédit', value: formatMoney(c.limiteCredit)),
                    _Row(label: 'Solde crédit', value: formatMoney(c.soldeCredit)),
                    _Row(label: 'Catégorie de prix', value: c.priceCategoryNom ?? 'Aucune (prix normal)'),
                    if (c.notesInternes != null && c.notesInternes!.isNotEmpty) _Row(label: 'Notes internes', value: c.notesInternes!),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: () => _changePriceCategory(context, ref, c),
              icon: const Icon(Icons.sell_outlined),
              label: const Text('Changer la catégorie de prix'),
            ),
            const SizedBox(height: 12),
            ElevatedButton.icon(
              onPressed: () => _openCustomPriceDialog(context, ref),
              icon: const Icon(Icons.price_change_outlined),
              label: const Text('Définir un prix personnalisé (par produit)'),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: () => _toggleStatus(context, ref, c),
              style: OutlinedButton.styleFrom(foregroundColor: c.status == 'ACTIVE' ? AppTheme.danger : AppTheme.success),
              icon: Icon(c.status == 'ACTIVE' ? Icons.block : Icons.check_circle_outline),
              label: Text(c.status == 'ACTIVE' ? 'Suspendre ce compte' : 'Réactiver ce compte'),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: () => _confirmDelete(context, ref, c),
              style: OutlinedButton.styleFrom(foregroundColor: AppTheme.danger),
              icon: const Icon(Icons.delete_outline),
              label: const Text('Supprimer ce client'),
            ),
          ],
        ),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          SizedBox(width: 120, child: Text(label, style: TextStyle(color: Colors.grey[600]))),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }
}
