import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../services/service_providers.dart';

final _promotionsProvider = FutureProvider.autoDispose<List<dynamic>>((ref) => ref.watch(promotionsApiProvider).list());

class AdminPromotionsScreen extends ConsumerWidget {
  const AdminPromotionsScreen({super.key});

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
              return Card(
                child: ListTile(
                  title: Text(p['nom'] as String),
                  subtitle: Text(
                    p['type'] == 'POURCENTAGE' ? '-${p['valeur']}%' : '-${p['valeur']} DA',
                  ),
                  trailing: Switch(
                    value: actif,
                    onChanged: (v) async {
                      await ref.read(promotionsApiProvider).setActive(p['id'] as String, v);
                      ref.invalidate(_promotionsProvider);
                    },
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

  Future<void> _pickDate(bool isDebut) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: isDebut ? _debut : _fin,
      firstDate: DateTime.now().subtract(const Duration(days: 1)),
      lastDate: DateTime.now().add(const Duration(days: 365 * 2)),
    );
    if (picked != null) setState(() => isDebut ? _debut = picked : _fin = picked);
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
      });
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      setState(() => _error = e is ApiException ? e.message : 'Erreur.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
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
            subtitle: Text('${_debut.day}/${_debut.month}/${_debut.year}'),
            trailing: const Icon(Icons.calendar_today, size: 18),
            onTap: () => _pickDate(true),
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Date de fin'),
            subtitle: Text('${_fin.day}/${_fin.month}/${_fin.year}'),
            trailing: const Icon(Icons.calendar_today, size: 18),
            onTap: () => _pickDate(false),
          ),
          const Text(
            "Sans ciblage produit/client, la promotion s'applique à tout le catalogue et tous les clients (le ciblage fin peut être ajouté depuis l'API).",
            style: TextStyle(color: Colors.grey, fontSize: 12),
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
