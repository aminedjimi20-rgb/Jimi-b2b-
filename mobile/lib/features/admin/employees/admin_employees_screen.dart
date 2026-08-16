import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../models/employee.dart';
import '../../../services/service_providers.dart';

final adminEmployeesProvider = FutureProvider.autoDispose<List<EmployeeView>>((ref) {
  return ref.watch(employeesApiProvider).listAdmin();
});

Future<EmployeeView?> _showCreateEmployeeDialog(BuildContext context, WidgetRef ref) async {
  final nomController = TextEditingController();
  final phoneController = TextEditingController();
  final passwordController = TextEditingController();

  final confirmed = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('Nouvel employé'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(controller: nomController, decoration: const InputDecoration(labelText: 'Nom')),
          const SizedBox(height: 12),
          TextField(controller: phoneController, decoration: const InputDecoration(labelText: 'Téléphone (identifiant de connexion)')),
          const SizedBox(height: 12),
          TextField(controller: passwordController, obscureText: true, decoration: const InputDecoration(labelText: 'Mot de passe')),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Annuler')),
        ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Créer')),
      ],
    ),
  );
  if (confirmed != true) return null;

  if (nomController.text.trim().isEmpty || phoneController.text.trim().isEmpty || passwordController.text.length < 6) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Nom, téléphone et mot de passe (6+ caractères) requis.')));
    }
    return null;
  }

  try {
    return await ref.read(employeesApiProvider).create({
      'nom': nomController.text.trim(),
      'phone': phoneController.text.trim(),
      'password': passwordController.text,
    });
  } catch (e) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e is ApiException ? e.message : 'Erreur.')));
    }
    return null;
  }
}

/// Employés — accès restreint : préparent des commandes assignées ou en
/// créent au comptoir (validées ensuite par l'Admin), jamais de prix d'achat/marge.
class AdminEmployeesScreen extends ConsumerWidget {
  const AdminEmployeesScreen({super.key});

  Future<void> _confirmDelete(BuildContext context, WidgetRef ref, EmployeeView e) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Supprimer cet employé ?'),
        content: Text('"${e.nom}" sera déplacé vers la corbeille et son compte suspendu.'),
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
      await ref.read(employeesApiProvider).remove(e.id);
      ref.invalidate(adminEmployeesProvider);
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e is ApiException ? e.message : 'Erreur.')));
      }
    }
  }

  Future<void> _showPermissionsDialog(BuildContext context, WidgetRef ref, EmployeeView e) async {
    bool canSeeClientPhone = e.canSeeClientPhone;
    bool canSeeClientAddress = e.canSeeClientAddress;
    bool canCreateBonEntree = e.canCreateBonEntree;
    bool canModifierPrixAchat = e.canModifierPrixAchat;
    bool canVoirPrixVente = e.canVoirPrixVente;
    bool canCreerProduit = e.canCreerProduit;
    bool canCreerFournisseur = e.canCreerFournisseur;
    bool canModifierProduit = e.canModifierProduit;
    bool canModifierBonApresConfirmation = e.canModifierBonApresConfirmation;

    final saved = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: Text('Permissions — ${e.nom}'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Par défaut, un employé ne voit jamais le téléphone ni l\'adresse du client sur un bon.',
                  style: TextStyle(fontSize: 13),
                ),
                const SizedBox(height: 8),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Voir le téléphone du client'),
                  value: canSeeClientPhone,
                  onChanged: (v) => setDialogState(() => canSeeClientPhone = v),
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Voir l\'adresse du client'),
                  value: canSeeClientAddress,
                  onChanged: (v) => setDialogState(() => canSeeClientAddress = v),
                ),
                const Divider(),
                Text('Bon d\'entrée (réception fournisseur)', style: Theme.of(context).textTheme.labelLarge),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Créer un bon d\'entrée'),
                  value: canCreateBonEntree,
                  onChanged: (v) => setDialogState(() => canCreateBonEntree = v),
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Modifier le prix d\'achat'),
                  value: canModifierPrixAchat,
                  onChanged: (v) => setDialogState(() => canModifierPrixAchat = v),
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Voir le prix de vente'),
                  value: canVoirPrixVente,
                  onChanged: (v) => setDialogState(() => canVoirPrixVente = v),
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Créer un nouveau produit'),
                  value: canCreerProduit,
                  onChanged: (v) => setDialogState(() => canCreerProduit = v),
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Créer un nouveau fournisseur'),
                  value: canCreerFournisseur,
                  onChanged: (v) => setDialogState(() => canCreerFournisseur = v),
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Modifier un produit existant'),
                  value: canModifierProduit,
                  onChanged: (v) => setDialogState(() => canModifierProduit = v),
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Modifier un bon après confirmation'),
                  value: canModifierBonApresConfirmation,
                  onChanged: (v) => setDialogState(() => canModifierBonApresConfirmation = v),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Annuler')),
            ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Enregistrer')),
          ],
        ),
      ),
    );

    if (saved == true) {
      await ref.read(employeesApiProvider).updatePermissions(e.id, {
        'canSeeClientPhone': canSeeClientPhone,
        'canSeeClientAddress': canSeeClientAddress,
        'canCreateBonEntree': canCreateBonEntree,
        'canModifierPrixAchat': canModifierPrixAchat,
        'canVoirPrixVente': canVoirPrixVente,
        'canCreerProduit': canCreerProduit,
        'canCreerFournisseur': canCreerFournisseur,
        'canModifierProduit': canModifierProduit,
        'canModifierBonApresConfirmation': canModifierBonApresConfirmation,
      });
      ref.invalidate(adminEmployeesProvider);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final employees = ref.watch(adminEmployeesProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Employés')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          final created = await _showCreateEmployeeDialog(context, ref);
          if (created != null) ref.invalidate(adminEmployeesProvider);
        },
        icon: const Icon(Icons.badge_outlined),
        label: const Text('Nouvel employé'),
      ),
      body: employees.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text(e is ApiException ? e.message : 'Erreur.')),
        data: (items) {
          if (items.isEmpty) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text('Aucun employé pour le moment.', textAlign: TextAlign.center),
              ),
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, i) {
              final e = items[i];
              return Card(
                child: ListTile(
                  leading: const Icon(Icons.badge_outlined),
                  title: Text(e.nom),
                  subtitle: Text(e.phone ?? '-'),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        icon: const Icon(Icons.privacy_tip_outlined),
                        tooltip: 'Permissions',
                        onPressed: () => _showPermissionsDialog(context, ref, e),
                      ),
                      Switch(
                        value: e.status == 'ACTIVE',
                        onChanged: (v) async {
                          await ref.read(employeesApiProvider).setStatus(e.id, v ? 'ACTIVE' : 'SUSPENDED');
                          ref.invalidate(adminEmployeesProvider);
                        },
                      ),
                      IconButton(icon: const Icon(Icons.delete_outline), onPressed: () => _confirmDelete(context, ref, e)),
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
