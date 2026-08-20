import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/async_value_widget.dart';
import '../admin/orders/admin_create_order_screen.dart';
import '../admin/stock/admin_stock_receipt_form_screen.dart';
import '../client/cart/checkout_screen.dart';
import '../employee/bon_entree/employee_bon_entree_form_screen.dart';
import '../employee/orders/employee_create_order_screen.dart';

class _DraftInfo {
  const _DraftInfo(this.label, this.icon, this.builder);
  final String label;
  final IconData icon;
  final Widget Function(BuildContext context, String formKey) builder;
}

/// Exact-key forms — one shared draft slot per form kind.
const _kExactDraftInfo = <String, _DraftInfo>{
  'admin_create_order': _DraftInfo('Bon de commande (Admin)', Icons.receipt_long_outlined, _adminOrderBuilder),
  'employee_create_order': _DraftInfo('Vente comptoir (Employé)', Icons.point_of_sale_outlined, _employeeOrderBuilder),
  'client_checkout': _DraftInfo('Panier / Commande', Icons.shopping_cart_outlined, _checkoutBuilder),
};

/// "Family" forms — a screen where several unrelated bons can be in
/// progress at once, so each got its own `<prefix><uuid>` key (see
/// AdminStockReceiptFormScreen/EmployeeBonEntreeFormScreen) instead of one
/// shared slot; matched here by prefix rather than exact key.
const _kPrefixDraftInfo = <String, _DraftInfo>{
  adminStockReceiptDraftKeyPrefix: _DraftInfo('Bon de réception (Admin)', Icons.move_to_inbox_outlined, _adminStockReceiptBuilder),
  employeeBonEntreeDraftKeyPrefix: _DraftInfo('Bon d\'entrée (Employé)', Icons.move_to_inbox_outlined, _employeeBonEntreeBuilder),
};

_DraftInfo? _infoFor(String formKey) {
  final exact = _kExactDraftInfo[formKey];
  if (exact != null) return exact;
  for (final entry in _kPrefixDraftInfo.entries) {
    if (formKey.startsWith(entry.key)) return entry.value;
  }
  return null;
}

Widget _adminOrderBuilder(BuildContext context, String formKey) => const AdminCreateOrderScreen();
Widget _adminStockReceiptBuilder(BuildContext context, String formKey) => AdminStockReceiptFormScreen(draftKey: formKey);
Widget _employeeOrderBuilder(BuildContext context, String formKey) => const EmployeeCreateOrderScreen();
Widget _employeeBonEntreeBuilder(BuildContext context, String formKey) => EmployeeBonEntreeFormScreen(localDraftKey: formKey);
Widget _checkoutBuilder(BuildContext context, String formKey) => const CheckoutScreen();

final _draftsProvider = FutureProvider.autoDispose<List<({String formKey, DateTime updatedAt})>>((ref) {
  return ref.watch(appDatabaseProvider).readAllDrafts();
});

/// Every unfinished form draft (bon comptoir, vente comptoir employé, panier
/// client...) in one place — so a half-filled bon is visible without
/// reopening its creation screen first. Tapping "Reprendre" opens that
/// screen, which shows its own resume banner (see FormDraftStore).
class DraftsScreen extends ConsumerWidget {
  const DraftsScreen({super.key});

  Future<void> _discard(BuildContext context, WidgetRef ref, String formKey) async {
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
    ref.invalidate(_draftsProvider);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final drafts = ref.watch(_draftsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Brouillons')),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(_draftsProvider),
        child: AsyncValueWidget<List<({String formKey, DateTime updatedAt})>>(
          value: drafts,
          onRetry: () => ref.invalidate(_draftsProvider),
          data: (items) {
            if (items.isEmpty) {
              return LayoutBuilder(
                builder: (context, constraints) => ListView(
                  children: [
                    SizedBox(
                      height: constraints.maxHeight,
                      child: const Center(child: Text('Aucun brouillon en cours.', textAlign: TextAlign.center)),
                    ),
                  ],
                ),
              );
            }
            return ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, i) {
                final draft = items[i];
                final info = _infoFor(draft.formKey);
                return Card(
                  child: ListTile(
                    leading: Icon(info?.icon ?? Icons.edit_note_outlined, color: AppTheme.primary),
                    title: Text(info?.label ?? draft.formKey),
                    subtitle: Text('Modifié le ${formatDate(draft.updatedAt)}'),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        TextButton(
                          onPressed: info == null
                              ? null
                              : () => Navigator.of(context).push(MaterialPageRoute(builder: (ctx) => info.builder(ctx, draft.formKey))),
                          child: const Text('Reprendre'),
                        ),
                        IconButton(
                          icon: const Icon(Icons.delete_outline, color: AppTheme.danger),
                          tooltip: 'Supprimer',
                          onPressed: () => _discard(context, ref, draft.formKey),
                        ),
                      ],
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
