import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/async_value_widget.dart';
import '../../../models/employee_permissions.dart';
import '../../../models/order.dart' show kPaymentMethods, paymentMethodLabel;
import '../../../models/stock_receipt.dart';
import '../../../services/service_providers.dart';
import '../employee_session.dart';
import 'employee_bon_entree_form_screen.dart';
import 'employee_edit_confirmed_sheet.dart';

final _mineReceiptProvider = FutureProvider.autoDispose.family<StockReceiptView, String>((ref, id) {
  return ref.watch(stockReceiptsApiProvider).findMineOne(id);
});

/// Detail of a bon d'entrée created by the Employee — shows the BROUILLON →
/// CONFIRMÉE lifecycle and the actions available at each stage. Stock and the
/// fournisseur balance are only ever touched by [confirmDraft] (see
/// StockReceiptsService.confirm on the backend, the single place this happens).
class EmployeeBonEntreeDetailScreen extends ConsumerStatefulWidget {
  const EmployeeBonEntreeDetailScreen({super.key, required this.receiptId});
  final String receiptId;

  @override
  ConsumerState<EmployeeBonEntreeDetailScreen> createState() => _EmployeeBonEntreeDetailScreenState();
}

class _EmployeeBonEntreeDetailScreenState extends ConsumerState<EmployeeBonEntreeDetailScreen> {
  bool _busy = false;

  Future<void> _confirm(StockReceiptView r) async {
    final result = await showDialog<_ConfirmPaymentResult>(
      context: context,
      builder: (ctx) => _ConfirmPaymentDialog(montantDu: r.totalApresRemise),
    );
    if (result == null) return;

    setState(() => _busy = true);
    try {
      await ref.read(stockReceiptsApiProvider).confirmDraft(
            r.id,
            montantPaye: result.montant > 0 ? result.montant : null,
            method: result.montant > 0 ? result.method : null,
          );
      ref.invalidate(_mineReceiptProvider(widget.receiptId));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e is ApiException ? e.message : 'Erreur lors de la confirmation.')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _cancel(StockReceiptView r) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Annuler ce brouillon ?'),
        content: const Text('Ce brouillon sera supprimé. Comme il n\'a jamais été confirmé, aucun stock n\'a été ajouté.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Non')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: AppTheme.danger),
            child: const Text('Annuler le brouillon'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _busy = true);
    try {
      await ref.read(stockReceiptsApiProvider).cancelDraft(r.id);
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        setState(() => _busy = false);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e is ApiException ? e.message : 'Erreur.')));
      }
    }
  }

  Future<void> _editConfirmed(StockReceiptView r) async {
    final changed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => EmployeeEditConfirmedSheet(receipt: r),
    );
    if (changed == true) ref.invalidate(_mineReceiptProvider(widget.receiptId));
  }

  @override
  Widget build(BuildContext context) {
    final receipt = ref.watch(_mineReceiptProvider(widget.receiptId));
    final permissions = ref.watch(employeePermissionsProvider).valueOrNull ?? EmployeePermissions();

    return Scaffold(
      appBar: AppBar(title: const Text('Bon d\'entrée')),
      body: AsyncValueWidget<StockReceiptView>(
        value: receipt,
        onRetry: () => ref.invalidate(_mineReceiptProvider(widget.receiptId)),
        data: (r) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(r.reference, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    _StatusChip(status: r.status),
                    const SizedBox(height: 8),
                    Text('Fournisseur: ${r.fabricantNom}'),
                    if (r.numeroBonFournisseur != null && r.numeroBonFournisseur!.isNotEmpty) Text('N° bon fournisseur: ${r.numeroBonFournisseur}'),
                    Text('Date: ${formatDate(r.createdAt)}'),
                    if (r.notes != null && r.notes!.isNotEmpty) Text('Notes: ${r.notes}'),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text('Articles', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Card(
              child: Column(
                children: r.items
                    .map((item) => ListTile(
                          leading: ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: SizedBox(
                              width: 44,
                              height: 44,
                              child: item.imageUrl != null
                                  ? CachedNetworkImage(imageUrl: item.imageUrl!, fit: BoxFit.cover, errorWidget: (_, __, ___) => const Icon(Icons.inventory_2_outlined))
                                  : const Icon(Icons.inventory_2_outlined),
                            ),
                          ),
                          title: Text(item.nom),
                          subtitle: Text('${item.cartons} cartons x ${item.unitesParCarton} = ${item.quantite}'),
                          trailing: permissions.canModifierPrixAchat ? Text(formatMoney(item.sousTotalAchat), style: const TextStyle(fontWeight: FontWeight.bold)) : null,
                        ))
                    .toList(),
              ),
            ),
            if (permissions.canModifierPrixAchat) ...[
              const SizedBox(height: 12),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Column(
                  children: [
                    Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [const Text('Sous-total achat'), Text(formatMoney(r.totalAchat))]),
                    if (r.remisePourcentage != null && r.remisePourcentage! > 0)
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [Text('Remise (${r.remisePourcentage!.toStringAsFixed(0)}%)'), Text('- ${formatMoney(r.montantRemise)}')],
                      ),
                    if (r.fraisLivraison > 0)
                      Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [const Text('Frais de livraison'), Text(formatMoney(r.fraisLivraison))]),
                    const Divider(),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Total dû', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                        Text(formatMoney(r.totalApresRemise), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppTheme.primary)),
                      ],
                    ),
                  ],
                ),
              ),
            ],
            if (r.status == 'CONFIRMEE') ...[
              const SizedBox(height: 12),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Column(
                  children: [
                    Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [const Text('Payé au fournisseur'), Text(formatMoney(r.montantPaye), style: const TextStyle(color: AppTheme.success))]),
                    const SizedBox(height: 4),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Reste à payer'),
                        Text(formatMoney(r.montantRestant), style: TextStyle(color: r.montantRestant > 0 ? AppTheme.danger : AppTheme.success, fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 24),
            if (r.isBrouillon) ...[
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _busy
                          ? null
                          : () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => EmployeeBonEntreeFormScreen(existing: r))).then((_) {
                                ref.invalidate(_mineReceiptProvider(widget.receiptId));
                              }),
                      icon: const Icon(Icons.edit_outlined),
                      label: const Text('Modifier'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _busy ? null : () => _cancel(r),
                      style: OutlinedButton.styleFrom(foregroundColor: AppTheme.danger),
                      icon: const Icon(Icons.delete_outline),
                      label: const Text('Annuler'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              ElevatedButton.icon(
                onPressed: _busy ? null : () => _confirm(r),
                icon: _busy ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.check_circle_outline),
                label: const Text('Confirmer le bon (ajoute le stock)'),
              ),
            ] else if (r.status == 'CONFIRMEE' && permissions.canModifierBonApresConfirmation) ...[
              OutlinedButton.icon(
                onPressed: _busy ? null : () => _editConfirmed(r),
                icon: const Icon(Icons.edit_outlined),
                label: const Text('Modifier après confirmation'),
              ),
            ],
          ],
        ),
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
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
      child: Text(label, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600)),
    );
  }
}

class _ConfirmPaymentResult {
  _ConfirmPaymentResult(this.montant, this.method);
  final double montant;
  final String method;
}

class _ConfirmPaymentDialog extends StatefulWidget {
  const _ConfirmPaymentDialog({required this.montantDu});
  final double montantDu;

  @override
  State<_ConfirmPaymentDialog> createState() => _ConfirmPaymentDialogState();
}

class _ConfirmPaymentDialogState extends State<_ConfirmPaymentDialog> {
  String _statut = 'NON_PAYE';
  late final TextEditingController _montant = TextEditingController();
  String _method = 'ESPECES';
  String? _error;

  @override
  void dispose() {
    _montant.dispose();
    super.dispose();
  }

  void _submit() {
    double montant = 0;
    if (_statut == 'PAYE') {
      montant = widget.montantDu;
    } else if (_statut == 'PARTIEL') {
      final value = double.tryParse(_montant.text.replaceAll(',', '.'));
      if (value == null || value <= 0 || value >= widget.montantDu) {
        setState(() => _error = 'Montant invalide.');
        return;
      }
      montant = value;
    }
    Navigator.pop(context, _ConfirmPaymentResult(montant, _method));
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Confirmer le bon d\'entrée'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (widget.montantDu > 0) Text('Montant dû au fournisseur: ${formatMoney(widget.montantDu)}', style: TextStyle(color: Colors.grey[600])),
          const SizedBox(height: 12),
          RadioListTile<String>(
            contentPadding: EdgeInsets.zero,
            value: 'NON_PAYE',
            groupValue: _statut,
            title: const Text('Non payé'),
            onChanged: (v) => setState(() => _statut = v!),
          ),
          RadioListTile<String>(
            contentPadding: EdgeInsets.zero,
            value: 'PARTIEL',
            groupValue: _statut,
            title: const Text('Partiellement payé'),
            onChanged: (v) => setState(() => _statut = v!),
          ),
          RadioListTile<String>(
            contentPadding: EdgeInsets.zero,
            value: 'PAYE',
            groupValue: _statut,
            title: const Text('Payé'),
            onChanged: (v) => setState(() => _statut = v!),
          ),
          if (_statut == 'PARTIEL') ...[
            const SizedBox(height: 8),
            TextField(
              controller: _montant,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: InputDecoration(labelText: 'Montant versé', errorText: _error),
            ),
          ],
          if (_statut != 'NON_PAYE') ...[
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _method,
              decoration: const InputDecoration(labelText: 'Méthode'),
              items: kPaymentMethods.map((m) => DropdownMenuItem(value: m, child: Text(paymentMethodLabel(m)))).toList(),
              onChanged: (v) => setState(() => _method = v!),
            ),
          ],
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Annuler')),
        ElevatedButton(onPressed: _submit, child: const Text('Confirmer')),
      ],
    );
  }
}
