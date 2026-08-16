import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/async_value_widget.dart';
import '../../../models/order.dart';
import '../../../services/service_providers.dart';
import 'employee_create_order_screen.dart';
import 'employee_order_detail_screen.dart';

final employeeOrdersProvider = FutureProvider.autoDispose<List<OrderView>>((ref) {
  return ref.watch(ordersApiProvider).mineEmployee();
});

// Un bon LIVREE/ANNULEE est "ancien" — masqué par défaut pour garder la
// liste centrée sur ce qui reste à traiter, réactivable d'un clic.
const _kClosedStatuses = {'LIVREE', 'ANNULEE'};
final _hideOldOrdersProvider = StateProvider.autoDispose<bool>((ref) => true);

/// "Mes commandes" — only orders assigned to this employee (auto-assigned on
/// self-created counter sales, or manually assigned by the Admin). Never
/// shows other employees'/clients' orders — the backend already scopes this
/// by employeeId, this is just the corresponding view.
class EmployeeOrdersScreen extends ConsumerWidget {
  const EmployeeOrdersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orders = ref.watch(employeeOrdersProvider);
    final hideOld = ref.watch(_hideOldOrdersProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Mes commandes'),
        actions: [
          IconButton(
            icon: Icon(hideOld ? Icons.visibility_off_outlined : Icons.visibility_outlined),
            tooltip: hideOld ? 'Afficher les anciens bons' : 'Masquer les anciens bons',
            onPressed: () => ref.read(_hideOldOrdersProvider.notifier).state = !hideOld,
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const EmployeeCreateOrderScreen())),
        icon: const Icon(Icons.add),
        label: const Text('Nouvelle commande'),
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(employeeOrdersProvider),
        child: AsyncValueWidget<List<OrderView>>(
          value: orders,
          onRetry: () => ref.invalidate(employeeOrdersProvider),
          data: (allItems) {
            final items = hideOld ? allItems.where((o) => !_kClosedStatuses.contains(o.status)).toList() : allItems;
            if (items.isEmpty) {
              return ListView(
                children: [
                  Padding(
                    padding: const EdgeInsets.all(32),
                    child: Text(
                      hideOld && allItems.isNotEmpty
                          ? 'Aucun bon en cours — les anciens bons sont masqués.'
                          : 'Aucune commande assignée pour le moment.',
                      textAlign: TextAlign.center,
                    ),
                  ),
                ],
              );
            }
            return ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
              children: items
                  .map((o) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: Card(
                          child: ListTile(
                            title: Text(o.nom != null && o.nom!.isNotEmpty ? o.nom! : o.reference, style: const TextStyle(fontWeight: FontWeight.bold)),
                            subtitle: Text('${o.clientNom ?? '-'} · ${formatDate(o.createdAt)}'),
                            trailing: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(formatMoney(o.total), style: const TextStyle(fontWeight: FontWeight.bold)),
                                Container(
                                  margin: const EdgeInsets.only(top: 4),
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(color: AppTheme.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(20)),
                                  child: Text(orderStatusLabel(o.status),
                                      style: const TextStyle(color: AppTheme.primary, fontSize: 11, fontWeight: FontWeight.w600)),
                                ),
                              ],
                            ),
                            onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => EmployeeOrderDetailScreen(orderId: o.id))),
                          ),
                        ),
                      ))
                  .toList(),
            );
          },
        ),
      ),
    );
  }
}
