import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:share_plus/share_plus.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/async_value_widget.dart';
import '../../../models/order.dart';
import '../../../services/service_providers.dart';

// Mirrors OrdersService.NEXT_STATUS on the backend — used only to decide
// which action buttons to show; the backend re-validates the transition
// regardless, so this is a UX shortcut, not a security boundary.
const _nextStatuses = {
  'EN_ATTENTE': ['CONFIRMEE', 'ANNULEE'],
  'CONFIRMEE': ['PREPARATION', 'ANNULEE'],
  'PREPARATION': ['PRETE', 'ANNULEE'],
  'PRETE': ['EXPEDIEE', 'ANNULEE'],
  'EXPEDIEE': ['LIVREE'],
  'LIVREE': <String>[],
  'ANNULEE': <String>[],
};

final _adminOrderProvider = FutureProvider.autoDispose.family<OrderView, String>((ref, id) {
  return ref.watch(ordersApiProvider).getAdmin(id);
});

class AdminOrderDetailScreen extends ConsumerStatefulWidget {
  const AdminOrderDetailScreen({super.key, required this.orderId});
  final String orderId;

  @override
  ConsumerState<AdminOrderDetailScreen> createState() => _AdminOrderDetailScreenState();
}

class _AdminOrderDetailScreenState extends ConsumerState<AdminOrderDetailScreen> {
  bool _generating = false;
  bool _togglingPayment = false;
  bool _deleting = false;

  Future<void> _updateStatus(String status) async {
    try {
      await ref.read(ordersApiProvider).updateStatus(widget.orderId, status);
      ref.invalidate(_adminOrderProvider(widget.orderId));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e is ApiException ? e.message : 'Erreur.')));
      }
    }
  }

  Future<void> _togglePayment(OrderView o) async {
    setState(() => _togglingPayment = true);
    try {
      await ref.read(ordersApiProvider).updatePayment(widget.orderId, !o.estPayee);
      ref.invalidate(_adminOrderProvider(widget.orderId));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e is ApiException ? e.message : 'Erreur.')));
      }
    } finally {
      if (mounted) setState(() => _togglingPayment = false);
    }
  }

  Future<void> _confirmDelete(OrderView o) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Supprimer cette commande ?'),
        content: Text(
          'La commande ${o.reference} sera supprimée${o.status != 'ANNULEE' && o.status != 'LIVREE' && o.status != 'EXPEDIEE' ? ' et le stock qu\'elle avait retiré sera restitué' : ''}. Cette action est irréversible.',
        ),
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

    setState(() => _deleting = true);
    try {
      await ref.read(ordersApiProvider).remove(o.id);
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        setState(() => _deleting = false);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e is ApiException ? e.message : 'Erreur lors de la suppression.')));
      }
    }
  }

  Future<void> _generateAndSharePdf(OrderView o) async {
    setState(() => _generating = true);
    try {
      final dio = ref.read(dioProvider);
      final images = <String, Uint8List?>{};
      for (final item in o.items) {
        if (item.imageUrl == null) continue;
        try {
          final resp = await dio.get<List<int>>(item.imageUrl!, options: Options(responseType: ResponseType.bytes));
          images[item.productId] = Uint8List.fromList(resp.data!);
        } catch (_) {
          images[item.productId] = null;
        }
      }

      final doc = pw.Document();
      doc.addPage(
        pw.MultiPage(
          build: (context) => [
            pw.Text('JIMI B2B — Bon de commande', style: pw.TextStyle(fontSize: 18, fontWeight: pw.FontWeight.bold)),
            pw.SizedBox(height: 4),
            pw.Text(o.nom != null && o.nom!.isNotEmpty ? '${o.nom} — ${o.reference}' : o.reference),
            pw.SizedBox(height: 8),
            pw.Text('Client: ${o.clientNom ?? '-'}'),
            pw.Text('Téléphone: ${o.telephoneContact}'),
            pw.Text('Adresse: ${o.adresseLivraison}'),
            pw.Text('Date: ${formatDate(o.createdAt)}'),
            pw.Text('Paiement: ${paymentMethodLabel(o.paymentMethod)} — ${o.estPayee ? 'Payée' : 'Non payée'}'),
            if (o.notes != null && o.notes!.isNotEmpty) pw.Text('Notes: ${o.notes}'),
            pw.SizedBox(height: 16),
            pw.Table(
              border: pw.TableBorder.all(color: PdfColors.grey400, width: 0.5),
              columnWidths: const {
                0: pw.FixedColumnWidth(46),
                1: pw.FlexColumnWidth(3),
                2: pw.FlexColumnWidth(1),
                3: pw.FlexColumnWidth(1.4),
                4: pw.FlexColumnWidth(1.4),
              },
              children: [
                pw.TableRow(
                  decoration: const pw.BoxDecoration(color: PdfColors.grey200),
                  children: [
                    _cell(''),
                    _cell('Article', bold: true),
                    _cell('Qté', bold: true),
                    _cell('Prix', bold: true),
                    _cell('Total', bold: true),
                  ],
                ),
                for (final item in o.items)
                  pw.TableRow(
                    children: [
                      pw.Padding(
                        padding: const pw.EdgeInsets.all(4),
                        child: images[item.productId] != null
                            ? pw.Image(pw.MemoryImage(images[item.productId]!), width: 36, height: 36, fit: pw.BoxFit.cover)
                            : pw.SizedBox(width: 36, height: 36),
                      ),
                      _cell('${item.nom}\n${item.code}'),
                      _cell('${item.quantite}'),
                      _cell(formatMoney(item.prixUnitaire)),
                      _cell(formatMoney(item.sousTotal)),
                    ],
                  ),
              ],
            ),
            pw.SizedBox(height: 12),
            pw.Align(
              alignment: pw.Alignment.centerRight,
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.end,
                children: [
                  if (o.remisePourcentage != null && o.remisePourcentage! > 0)
                    pw.Text('Remise: ${o.remisePourcentage}%', style: const pw.TextStyle(fontSize: 11)),
                  pw.Text('Total: ${formatMoney(o.total)}', style: pw.TextStyle(fontSize: 14, fontWeight: pw.FontWeight.bold)),
                ],
              ),
            ),
          ],
        ),
      );

      final bytes = await doc.save();
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/commande-${o.reference}.pdf');
      await file.writeAsBytes(bytes);
      await Share.shareXFiles([XFile(file.path)], text: 'Bon de commande ${o.reference}');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e is ApiException ? e.message : 'Erreur lors de la génération du PDF.')));
      }
    } finally {
      if (mounted) setState(() => _generating = false);
    }
  }

  static pw.Widget _cell(String text, {bool bold = false}) => pw.Padding(
        padding: const pw.EdgeInsets.all(4),
        child: pw.Text(text, style: pw.TextStyle(fontSize: 9, fontWeight: bold ? pw.FontWeight.bold : pw.FontWeight.normal)),
      );

  @override
  Widget build(BuildContext context) {
    final order = ref.watch(_adminOrderProvider(widget.orderId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Détail commande'),
        actions: [
          order.maybeWhen(
            data: (o) => Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  icon: _generating
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.picture_as_pdf_outlined),
                  tooltip: 'Générer le PDF',
                  onPressed: _generating ? null : () => _generateAndSharePdf(o),
                ),
                IconButton(
                  icon: _deleting
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.delete_outline),
                  tooltip: 'Supprimer',
                  onPressed: _deleting ? null : () => _confirmDelete(o),
                ),
              ],
            ),
            orElse: () => const SizedBox.shrink(),
          ),
        ],
      ),
      body: AsyncValueWidget<OrderView>(
        value: order,
        onRetry: () => ref.invalidate(_adminOrderProvider(widget.orderId)),
        data: (o) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      o.nom != null && o.nom!.isNotEmpty ? o.nom! : o.reference,
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
                    ),
                    if (o.nom != null && o.nom!.isNotEmpty) Text(o.reference, style: TextStyle(color: Colors.grey[600])),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        _StatusChip(label: orderStatusLabel(o.status), color: AppTheme.primary),
                        GestureDetector(
                          onTap: _togglingPayment ? null : () => _togglePayment(o),
                          child: _StatusChip(
                            label: _togglingPayment ? '...' : (o.estPayee ? 'Payée' : 'Non payée — toucher pour changer'),
                            color: o.estPayee ? AppTheme.success : AppTheme.danger,
                          ),
                        ),
                      ],
                    ),
                    const Divider(height: 24),
                    _InfoRow(label: 'Client', value: o.clientNom ?? '-'),
                    _InfoRow(label: 'Téléphone', value: o.telephoneContact),
                    _InfoRow(label: 'Adresse', value: o.adresseLivraison),
                    _InfoRow(label: 'Paiement', value: paymentMethodLabel(o.paymentMethod)),
                    _InfoRow(label: 'Date', value: formatDate(o.createdAt)),
                    if (o.remisePourcentage != null && o.remisePourcentage! > 0)
                      _InfoRow(label: 'Remise', value: '${o.remisePourcentage}%'),
                    if (o.notes != null && o.notes!.isNotEmpty) _InfoRow(label: 'Notes', value: o.notes!),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text('Articles', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Card(
              child: Column(
                children: o.items
                    .map((item) => ListTile(
                          title: Text(item.nom),
                          subtitle: Text('${item.code} · Qté: ${item.quantite} × ${formatMoney(item.prixUnitaire)}'),
                          trailing: Text(formatMoney(item.sousTotal), style: const TextStyle(fontWeight: FontWeight.bold)),
                        ))
                    .toList(),
              ),
            ),
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Total', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  Text(formatMoney(o.total), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppTheme.primary)),
                ],
              ),
            ),
            const SizedBox(height: 24),
            if ((_nextStatuses[o.status] ?? []).isNotEmpty) ...[
              Text('Changer le statut', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: (_nextStatuses[o.status] ?? [])
                    .map((s) => s == 'ANNULEE'
                        ? OutlinedButton(
                            style: OutlinedButton.styleFrom(foregroundColor: AppTheme.danger),
                            onPressed: () => _updateStatus(s),
                            child: Text('Annuler'),
                          )
                        : ElevatedButton(onPressed: () => _updateStatus(s), child: Text(orderStatusLabel(s))))
                    .toList(),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 100, child: Text(label, style: TextStyle(color: Colors.grey[600]))),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.label, required this.color});
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
      child: Text(label, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600)),
    );
  }
}
