import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../models/fabricant.dart';
import '../../../services/service_providers.dart';

/// Fournisseur picker for the Employee's bon d'entrée (Phase 38) — "+ Nouveau"
/// only shown when the Admin granted canCreerFournisseur (server re-checks anyway).
class FournisseurPickerSheet extends ConsumerStatefulWidget {
  const FournisseurPickerSheet({super.key, required this.fabricants, required this.canCreer});
  final List<Fabricant> fabricants;
  final bool canCreer;

  @override
  ConsumerState<FournisseurPickerSheet> createState() => _FournisseurPickerSheetState();
}

class _FournisseurPickerSheetState extends ConsumerState<FournisseurPickerSheet> {
  String _query = '';
  bool _creating = false;

  Future<void> _createNew() async {
    final controller = TextEditingController();
    String? error;
    final nom = await showDialog<String>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setState) => AlertDialog(
          title: const Text('Nouveau fournisseur'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(controller: controller, autofocus: true, decoration: const InputDecoration(labelText: 'Nom du fournisseur')),
              if (error != null) ...[
                const SizedBox(height: 8),
                Text(error!, style: const TextStyle(color: AppTheme.danger)),
              ],
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Annuler')),
            ElevatedButton(
              onPressed: () {
                if (controller.text.trim().isEmpty) {
                  setState(() => error = 'Le nom est requis.');
                  return;
                }
                Navigator.pop(ctx, controller.text.trim());
              },
              child: const Text('Créer'),
            ),
          ],
        ),
      ),
    );
    if (nom == null || nom.isEmpty) return;

    setState(() => _creating = true);
    try {
      final created = await ref.read(fabricantsApiProvider).createStaff(nom);
      if (mounted) Navigator.pop(context, created);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e is ApiException ? e.message : 'Erreur.')));
      }
    } finally {
      if (mounted) setState(() => _creating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _query.isEmpty ? widget.fabricants : widget.fabricants.where((f) => f.nom.toLowerCase().contains(_query)).toList();

    return DraggableScrollableSheet(
      initialChildSize: 0.7,
      minChildSize: 0.4,
      maxChildSize: 0.9,
      expand: false,
      builder: (context, scrollController) => Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Choisir un fournisseur', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                if (widget.canCreer)
                  TextButton.icon(
                    onPressed: _creating ? null : _createNew,
                    icon: _creating ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.add),
                    label: const Text('Nouveau'),
                  ),
              ],
            ),
            TextField(
              decoration: const InputDecoration(hintText: 'Rechercher...', prefixIcon: Icon(Icons.search)),
              onChanged: (v) => setState(() => _query = v.toLowerCase()),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: filtered.isEmpty
                  ? const Center(child: Text('Aucun fournisseur trouvé.'))
                  : ListView.builder(
                      controller: scrollController,
                      itemCount: filtered.length,
                      itemBuilder: (context, i) {
                        final f = filtered[i];
                        return ListTile(
                          leading: const Icon(Icons.factory_outlined),
                          title: Text(f.nom),
                          onTap: () => Navigator.pop(context, f),
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
