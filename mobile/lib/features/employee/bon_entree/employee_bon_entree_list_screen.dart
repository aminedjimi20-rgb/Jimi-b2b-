import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/async_value_widget.dart';
import '../../../models/employee_permissions.dart';
import '../../../models/stock_receipt.dart';
import '../../../services/service_providers.dart';
import '../employee_session.dart';
import 'employee_bon_entree_detail_screen.dart';
import 'employee_bon_entree_form_screen.dart';

final _mineReceiptsProvider = FutureProvider.autoDispose<List<StockReceiptView>>((ref) => ref.watch(stockReceiptsApiProvider).findMine());

typedef _LocalDraftRow = ({String formKey, Map<String, dynamic> data, DateTime updatedAt});

final _localDraftsProvider = FutureProvider.autoDispose<List<_LocalDraftRow>>((ref) {
  return ref.watch(appDatabaseProvider).readDraftsByPrefix(employeeBonEntreeDraftKeyPrefix);
});

/// "Mes bons d'entrée" — only reachable when the Admin granted
/// canCreateBonEntree (checked again server-side on every write). Local
/// brouillons (never yet sent to the server) surface separately from the
/// server-side ones, each keyed individually so starting a second bon can
/// never silently overwrite a first still-unfinished one.
class EmployeeBonEntreeListScreen extends ConsumerWidget {
  const EmployeeBonEntreeListScreen({super.key});

  Future<void> _discardLocalDraft(BuildContext context, WidgetRef ref, String formKey) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Supprimer ce brouillon ?'),
        content: const Text('Le contenu non enregistré sera perdu.'),
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
    await ref.read(appDatabaseProvider).clearDraft(formKey);
    ref.invalidate(_localDraftsProvider);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final receipts = ref.watch(_mineReceiptsProvider);
    final localDrafts = ref.watch(_localDraftsProvider).valueOrNull ?? const <_LocalDraftRow>[];
    final permissions = ref.watch(employeePermissionsProvider).valueOrNull ?? EmployeePermissions();

    return Scaffold(
      appBar: AppBar(title: const Text('Mes bons d\'entrée')),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(_mineReceiptsProvider);
          ref.invalidate(_localDraftsProvider);
        },
        child: AsyncValueWidget<List<StockReceiptView>>(
          value: receipts,
          onRetry: () => ref.invalidate(_mineReceiptsProvider),
          data: (list) {
            if (list.isEmpty && localDrafts.isEmpty) {
              return ListView(
                children: const [
                  Padding(
                    padding: EdgeInsets.all(32),
                    child: Center(child: Text('Aucun bon d\'entrée pour le moment.')),
                  ),
                ],
              );
            }
            return ListView(
              padding: const EdgeInsets.all(12),
              children: [
                if (localDrafts.isNotEmpty) ...[
                  Text('BROUILLONS', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold, color: AppTheme.warning)),
                  const SizedBox(height: 8),
                  for (final draft in localDrafts)
                    _LocalDraftCard(
                      data: draft.data,
                      updatedAt: draft.updatedAt,
                      onTap: () async {
                        await Navigator.of(context).push(MaterialPageRoute(builder: (_) => EmployeeBonEntreeFormScreen(localDraftKey: draft.formKey)));
                        ref.invalidate(_mineReceiptsProvider);
                        ref.invalidate(_localDraftsProvider);
                      },
                      onDiscard: () => _discardLocalDraft(context, ref, draft.formKey),
                    ),
                  const SizedBox(height: 8),
                ],
                for (final r in list)
                  Card(
                    child: ListTile(
                      title: Text(r.reference),
                      subtitle: Text('${r.fabricantNom} · ${formatDate(r.createdAt)}'),
                      trailing: _StatusChip(status: r.status),
                      onTap: () async {
                        await Navigator.of(context).push(MaterialPageRoute(builder: (_) => EmployeeBonEntreeDetailScreen(receiptId: r.id)));
                        ref.invalidate(_mineReceiptsProvider);
                      },
                    ),
                  ),
              ],
            );
          },
        ),
      ),
      floatingActionButton: permissions.canCreateBonEntree
          ? FloatingActionButton.extended(
              onPressed: () async {
                await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const EmployeeBonEntreeFormScreen()));
                ref.invalidate(_mineReceiptsProvider);
                ref.invalidate(_localDraftsProvider);
              },
              icon: const Icon(Icons.add),
              label: const Text('Nouveau bon'),
            )
          : null,
    );
  }
}

class _LocalDraftCard extends StatelessWidget {
  const _LocalDraftCard({required this.data, required this.updatedAt, required this.onTap, required this.onDiscard});
  final Map<String, dynamic> data;
  final DateTime updatedAt;
  final VoidCallback onTap;
  final VoidCallback onDiscard;

  @override
  Widget build(BuildContext context) {
    final fabricantNom = data['fabricantNom'] as String?;
    final items = data['items'] as List<dynamic>? ?? [];
    return Card(
      color: AppTheme.warning.withValues(alpha: 0.06),
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: const Icon(Icons.edit_note_outlined, color: AppTheme.warning),
        title: Text(fabricantNom == null || fabricantNom.isEmpty ? 'Bon d\'entrée brouillon' : 'Bon d\'entrée brouillon · $fabricantNom'),
        subtitle: Text('${items.length} article${items.length == 1 ? '' : 's'} · modifié ${formatDate(updatedAt)}'),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextButton(onPressed: onTap, child: const Text('Continuer')),
            IconButton(icon: const Icon(Icons.delete_outline, color: AppTheme.danger), tooltip: 'Supprimer', onPressed: onDiscard),
          ],
        ),
        onTap: onTap,
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status});
  final String status;

  @override
  Widget build(BuildContext context) {
    final (label, color) = switch (status) {
      'BROUILLON' => ('Brouillon', AppTheme.warning),
      'CONFIRMEE' => ('Confirmé', AppTheme.success),
      _ => ('Annulé', AppTheme.danger),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
      child: Text(label, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w600)),
    );
  }
}
