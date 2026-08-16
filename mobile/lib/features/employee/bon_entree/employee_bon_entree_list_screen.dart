import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

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

/// "Mes bons d'entrée" — only reachable when the Admin granted
/// canCreateBonEntree (checked again server-side on every write).
class EmployeeBonEntreeListScreen extends ConsumerWidget {
  const EmployeeBonEntreeListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final receipts = ref.watch(_mineReceiptsProvider);
    final permissions = ref.watch(employeePermissionsProvider).valueOrNull ?? EmployeePermissions();

    return Scaffold(
      appBar: AppBar(title: const Text('Mes bons d\'entrée')),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(_mineReceiptsProvider),
        child: AsyncValueWidget<List<StockReceiptView>>(
          value: receipts,
          onRetry: () => ref.invalidate(_mineReceiptsProvider),
          data: (list) => list.isEmpty
              ? ListView(
                  children: const [
                    Padding(
                      padding: EdgeInsets.all(32),
                      child: Center(child: Text('Aucun bon d\'entrée pour le moment.')),
                    ),
                  ],
                )
              : ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: list.length,
                  itemBuilder: (context, i) {
                    final r = list[i];
                    return Card(
                      child: ListTile(
                        title: Text(r.reference),
                        subtitle: Text('${r.fabricantNom} · ${formatDate(r.createdAt)}'),
                        trailing: _StatusChip(status: r.status),
                        onTap: () async {
                          await Navigator.of(context).push(MaterialPageRoute(builder: (_) => EmployeeBonEntreeDetailScreen(receiptId: r.id)));
                          ref.invalidate(_mineReceiptsProvider);
                        },
                      ),
                    );
                  },
                ),
        ),
      ),
      floatingActionButton: permissions.canCreateBonEntree
          ? FloatingActionButton.extended(
              onPressed: () async {
                await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const EmployeeBonEntreeFormScreen()));
                ref.invalidate(_mineReceiptsProvider);
              },
              icon: const Icon(Icons.add),
              label: const Text('Nouveau bon'),
            )
          : null,
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
