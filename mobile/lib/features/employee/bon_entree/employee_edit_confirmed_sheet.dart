import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../models/employee_permissions.dart';
import '../../../models/stock_receipt.dart';
import '../../../services/service_providers.dart';
import '../employee_session.dart';

class _EditLine {
  _EditLine(StockReceiptItemView item)
      : productId = item.productId,
        nom = item.nom,
        prixVente = item.prixVente,
        cartons = TextEditingController(text: '${item.cartons}'),
        unitesParCarton = TextEditingController(text: '${item.unitesParCarton}'),
        prixAchat = TextEditingController(text: item.prixAchat.toStringAsFixed(2));

  final String productId;
  final String nom;
  final double prixVente;
  final TextEditingController cartons;
  final TextEditingController unitesParCarton;
  final TextEditingController prixAchat;

  void dispose() {
    cartons.dispose();
    unitesParCarton.dispose();
    prixAchat.dispose();
  }
}

/// Only reachable when the Admin granted canModifierBonApresConfirmation —
/// re-checked server-side by editConfirmedForEmployee. Adjusts quantities/prix
/// achat of the already-received articles; the backend recalculates the exact
/// stock delta (never a full re-apply) and logs it in the bon's history.
class EmployeeEditConfirmedSheet extends ConsumerStatefulWidget {
  const EmployeeEditConfirmedSheet({super.key, required this.receipt});
  final StockReceiptView receipt;

  @override
  ConsumerState<EmployeeEditConfirmedSheet> createState() => _EmployeeEditConfirmedSheetState();
}

class _EmployeeEditConfirmedSheetState extends ConsumerState<EmployeeEditConfirmedSheet> {
  late final List<_EditLine> _lines = widget.receipt.items.map(_EditLine.new).toList();
  late final _fraisLivraison = TextEditingController(text: widget.receipt.fraisLivraison > 0 ? widget.receipt.fraisLivraison.toStringAsFixed(0) : '');
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    for (final line in _lines) {
      line.dispose();
    }
    _fraisLivraison.dispose();
    super.dispose();
  }

  Future<void> _submit(bool canModifierPrixAchat) async {
    final items = <Map<String, dynamic>>[];
    for (final line in _lines) {
      final cartons = int.tryParse(line.cartons.text);
      final unites = int.tryParse(line.unitesParCarton.text);
      final prixAchat = canModifierPrixAchat ? double.tryParse(line.prixAchat.text.replaceAll(',', '.')) : null;
      if (cartons == null || cartons < 1 || unites == null || unites < 1 || (canModifierPrixAchat && (prixAchat == null || prixAchat < 0))) {
        setState(() => _error = 'Vérifiez les cartons / unités / prix de "${line.nom}".');
        return;
      }
      items.add({
        'productId': line.productId,
        'cartons': cartons,
        'unitesParCarton': unites,
        'prixAchat': canModifierPrixAchat ? prixAchat : 0,
        'prixVente': line.prixVente,
      });
    }

    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      await ref.read(stockReceiptsApiProvider).editConfirmed(widget.receipt.id, {
        'items': items,
        'fraisLivraison': double.tryParse(_fraisLivraison.text.replaceAll(',', '.')) ?? 0,
      });
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      setState(() => _error = e is ApiException ? e.message : 'Erreur lors de la modification.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final permissions = ref.watch(employeePermissionsProvider).valueOrNull ?? EmployeePermissions();

    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) => Padding(
        padding: EdgeInsets.only(left: 16, right: 16, top: 16, bottom: MediaQuery.of(context).viewInsets.bottom + 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Modifier après confirmation', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            Text(
              'Le stock déjà ajouté sera ajusté selon la différence, pas doublé.',
              style: TextStyle(fontSize: 12, color: Colors.grey[600]),
            ),
            const SizedBox(height: 12),
            Expanded(
              child: ListView(
                controller: scrollController,
                children: [
                  for (final line in _lines)
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(line.nom, style: const TextStyle(fontWeight: FontWeight.w600)),
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                Expanded(
                                  child: TextField(
                                    controller: line.cartons,
                                    keyboardType: TextInputType.number,
                                    decoration: const InputDecoration(labelText: 'Cartons', isDense: true),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: TextField(
                                    controller: line.unitesParCarton,
                                    keyboardType: TextInputType.number,
                                    decoration: const InputDecoration(labelText: 'Unités/carton', isDense: true),
                                  ),
                                ),
                              ],
                            ),
                            if (permissions.canModifierPrixAchat) ...[
                              const SizedBox(height: 8),
                              TextField(
                                controller: line.prixAchat,
                                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                decoration: const InputDecoration(labelText: 'Prix achat', isDense: true),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                  TextField(
                    controller: _fraisLivraison,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(labelText: 'Frais de livraison (optionnel)', isDense: true),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Text(_error!, style: const TextStyle(color: AppTheme.danger)),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: _saving ? null : () => _submit(permissions.canModifierPrixAchat),
              child: _saving
                  ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Enregistrer les modifications'),
            ),
          ],
        ),
      ),
    );
  }
}
