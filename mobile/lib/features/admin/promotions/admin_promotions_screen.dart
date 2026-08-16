import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../services/service_providers.dart';

final _promotionsProvider = FutureProvider.autoDispose<List<dynamic>>((ref) => ref.watch(promotionsApiProvider).list());

class AdminPromotionsScreen extends ConsumerWidget {
  const AdminPromotionsScreen({super.key});

  Future<void> _confirmDelete(BuildContext context, WidgetRef ref, Map<String, dynamic> promo) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Supprimer cette promotion ?'),
        content: Text('"${promo['nom']}" sera supprimée définitivement.'),
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
      await ref.read(promotionsApiProvider).remove(promo['id'] as String);
      ref.invalidate(_promotionsProvider);
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e is ApiException ? e.message : 'Erreur.')));
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final promotions = ref.watch(_promotionsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Promotions')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          final created = await Navigator.of(context).push<bool>(MaterialPageRoute(builder: (_) => const _PromotionFormScreen()));
          if (created == true) ref.invalidate(_promotionsProvider);
        },
        icon: const Icon(Icons.add),
        label: const Text('Nouvelle promo'),
      ),
      body: promotions.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text(e is ApiException ? e.message : 'Erreur.')),
        data: (items) {
          if (items.isEmpty) return const Center(child: Text('Aucune promotion.'));
          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (context, i) {
              final p = items[i] as Map<String, dynamic>;
              final actif = p['actif'] as bool;
              final products = (p['products'] as List<dynamic>? ?? []);
              final clients = (p['clients'] as List<dynamic>? ?? []);
              final dateDebut = DateTime.parse(p['dateDebut'] as String);
              final dateFin = DateTime.parse(p['dateFin'] as String);
              final now = DateTime.now();
              final expired = now.isAfter(dateFin);

              return Card(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(p['nom'] as String, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                          ),
                          Switch(
                            value: actif,
                            onChanged: (v) async {
                              await ref.read(promotionsApiProvider).setActive(p['id'] as String, v);
                              ref.invalidate(_promotionsProvider);
                            },
                          ),
                          IconButton(icon: const Icon(Icons.delete_outline), onPressed: () => _confirmDelete(context, ref, p)),
                        ],
                      ),
                      Text(
                        p['type'] == 'POURCENTAGE' ? '-${p['valeur']}%' : '-${formatMoney(parseAmount(p['valeur']))}',
                        style: const TextStyle(color: AppTheme.primary, fontWeight: FontWeight.w600),
                      ),
                      Text(
                        '${formatDate(dateDebut)} → ${formatDate(dateFin)}${expired ? ' (expirée)' : ''}',
                        style: TextStyle(color: expired ? AppTheme.danger : Colors.grey[600], fontSize: 12),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        products.isEmpty ? 'Tous les produits' : '${products.length} produit(s) ciblé(s)',
                        style: TextStyle(color: Colors.grey[600], fontSize: 12),
                      ),
                      Text(
                        clients.isEmpty ? 'Tous les clients' : '${clients.length} client(s) ciblé(s)',
                        style: TextStyle(color: Colors.grey[600], fontSize: 12),
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

double parseAmount(dynamic v) => v is num ? v.toDouble() : double.parse(v.toString());

class _PromotionFormScreen extends ConsumerStatefulWidget {
  const _PromotionFormScreen();

  @override
  ConsumerState<_PromotionFormScreen> createState() => _PromotionFormScreenState();
}

class _PromotionFormScreenState extends ConsumerState<_PromotionFormScreen> {
  final _nom = TextEditingController();
  final _valeur = TextEditingController();
  String _type = 'POURCENTAGE';
  DateTime _debut = DateTime.now();
  DateTime _fin = DateTime.now().add(const Duration(days: 7));
  bool _saving = false;
  String? _error;

  final Set<String> _selectedProductIds = {};
  final Set<String> _selectedClientIds = {};

  Future<void> _pickDate(bool isDebut) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: isDebut ? _debut : _fin,
      firstDate: DateTime.now().subtract(const Duration(days: 1)),
      lastDate: DateTime.now().add(const Duration(days: 365 * 2)),
    );
    if (picked != null) setState(() => isDebut ? _debut = picked : _fin = picked);
  }

  Future<void> _pickProducts() async {
    final products = await ref.read(productsApiProvider).listAdmin();
    if (!mounted) return;
    final selected = await showModalBottomSheet<Set<String>>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _MultiSelectSheet(
        title: 'Produits ciblés',
        emptyHint: 'Aucun produit sélectionné = toute la promotion s\'applique à tout le catalogue.',
        items: [for (final p in products) (id: p.id, label: p.nom, subtitle: p.code)],
        initialSelected: _selectedProductIds,
      ),
    );
    if (selected != null) setState(() => _selectedProductIds..clear()..addAll(selected));
  }

  Future<void> _pickClients() async {
    final clients = await ref.read(clientsApiProvider).listAdmin();
    if (!mounted) return;
    final selected = await showModalBottomSheet<Set<String>>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _MultiSelectSheet(
        title: 'Clients ciblés',
        emptyHint: 'Aucun client sélectionné = la promotion s\'applique à tous les clients.',
        items: [for (final c in clients) (id: c.id, label: c.raisonSociale, subtitle: c.telephone)],
        initialSelected: _selectedClientIds,
      ),
    );
    if (selected != null) setState(() => _selectedClientIds..clear()..addAll(selected));
  }

  Future<void> _submit() async {
    final valeur = double.tryParse(_valeur.text);
    if (_nom.text.trim().isEmpty || valeur == null) {
      setState(() => _error = 'Veuillez remplir tous les champs.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref.read(promotionsApiProvider).create({
        'nom': _nom.text.trim(),
        'type': _type,
        'valeur': valeur,
        'dateDebut': _debut.toIso8601String(),
        'dateFin': _fin.toIso8601String(),
        if (_selectedProductIds.isNotEmpty) 'productIds': _selectedProductIds.toList(),
        if (_selectedClientIds.isNotEmpty) 'clientIds': _selectedClientIds.toList(),
      });
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      setState(() => _error = e is ApiException ? e.message : 'Erreur.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  void dispose() {
    _nom.dispose();
    _valeur.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Nouvelle promotion')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(controller: _nom, decoration: const InputDecoration(labelText: 'Nom de la promotion')),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _type,
            decoration: const InputDecoration(labelText: 'Type'),
            items: const [
              DropdownMenuItem(value: 'POURCENTAGE', child: Text('Pourcentage (%)')),
              DropdownMenuItem(value: 'MONTANT', child: Text('Montant fixe (DA)')),
            ],
            onChanged: (v) => setState(() => _type = v!),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _valeur,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: InputDecoration(labelText: _type == 'POURCENTAGE' ? 'Valeur (%)' : 'Valeur (DA)'),
          ),
          const SizedBox(height: 12),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Date de début'),
            subtitle: Text(formatDate(_debut)),
            trailing: const Icon(Icons.calendar_today, size: 18),
            onTap: () => _pickDate(true),
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Date de fin'),
            subtitle: Text(formatDate(_fin)),
            trailing: const Icon(Icons.calendar_today, size: 18),
            onTap: () => _pickDate(false),
          ),
          const Divider(height: 24),
          Text('Ciblage (optionnel)', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          const Text(
            "Sans ciblage, la promotion s'applique à tout le catalogue et tous les clients.",
            style: TextStyle(color: Colors.grey, fontSize: 12),
          ),
          Card(
            child: ListTile(
              leading: const Icon(Icons.inventory_2_outlined),
              title: const Text('Produits'),
              subtitle: Text(_selectedProductIds.isEmpty ? 'Tous les produits' : '${_selectedProductIds.length} produit(s) sélectionné(s)'),
              trailing: const Icon(Icons.chevron_right),
              onTap: _pickProducts,
            ),
          ),
          Card(
            child: ListTile(
              leading: const Icon(Icons.people_outline),
              title: const Text('Clients'),
              subtitle: Text(_selectedClientIds.isEmpty ? 'Tous les clients' : '${_selectedClientIds.length} client(s) sélectionné(s)'),
              trailing: const Icon(Icons.chevron_right),
              onTap: _pickClients,
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: const TextStyle(color: AppTheme.danger)),
          ],
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: _saving ? null : _submit,
            child: _saving ? const CircularProgressIndicator(color: Colors.white) : const Text('Créer la promotion'),
          ),
        ],
      ),
    );
  }
}

class _MultiSelectSheet extends StatefulWidget {
  const _MultiSelectSheet({required this.title, required this.emptyHint, required this.items, required this.initialSelected});

  final String title;
  final String emptyHint;
  final List<({String id, String label, String subtitle})> items;
  final Set<String> initialSelected;

  @override
  State<_MultiSelectSheet> createState() => _MultiSelectSheetState();
}

class _MultiSelectSheetState extends State<_MultiSelectSheet> {
  late final Set<String> _selected = {...widget.initialSelected};
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final filtered = _query.isEmpty
        ? widget.items
        : widget.items.where((i) => i.label.toLowerCase().contains(_query) || i.subtitle.toLowerCase().contains(_query)).toList();

    return DraggableScrollableSheet(
      initialChildSize: 0.8,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) => Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(widget.title, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                TextButton(
                  onPressed: () => Navigator.pop(context, _selected),
                  child: const Text('Valider'),
                ),
              ],
            ),
            Text(widget.emptyHint, style: TextStyle(color: Colors.grey[600], fontSize: 12)),
            const SizedBox(height: 8),
            TextField(
              decoration: const InputDecoration(hintText: 'Rechercher...', prefixIcon: Icon(Icons.search)),
              onChanged: (v) => setState(() => _query = v.toLowerCase()),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: filtered.isEmpty
                  ? const Center(child: Text('Aucun résultat.'))
                  : ListView.builder(
                      controller: scrollController,
                      itemCount: filtered.length,
                      itemBuilder: (context, i) {
                        final item = filtered[i];
                        final checked = _selected.contains(item.id);
                        return CheckboxListTile(
                          title: Text(item.label),
                          subtitle: Text(item.subtitle),
                          value: checked,
                          onChanged: (v) => setState(() {
                            if (v == true) {
                              _selected.add(item.id);
                            } else {
                              _selected.remove(item.id);
                            }
                          }),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
