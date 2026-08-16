import 'dart:io';
import 'dart:typed_data';

import 'package:cached_network_image/cached_network_image.dart';
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
import '../../../core/widgets/photo_gallery_viewer.dart';
import '../../../models/order.dart';
import '../../../models/stock_receipt.dart';
import '../../../services/service_providers.dart';

final _receiptProvider = FutureProvider.autoDispose.family<StockReceiptView, String>((ref, id) {
  return ref.watch(stockReceiptsApiProvider).getOne(id);
});

/// Shows a "bon de réception" and can turn it into a shareable PDF — one row
/// per article with its photo, cartons/unités, quantité, prix vente and total.
class AdminStockReceiptDetailScreen extends ConsumerStatefulWidget {
  const AdminStockReceiptDetailScreen({super.key, required this.receiptId});
  final String receiptId;

  @override
  ConsumerState<AdminStockReceiptDetailScreen> createState() => _AdminStockReceiptDetailScreenState();
}

class _AdminStockReceiptDetailScreenState extends ConsumerState<AdminStockReceiptDetailScreen> {
  bool _generating = false;
  bool _deleting = false;
  bool _recordingPayment = false;

  Future<void> _recordPayment(StockReceiptView r) async {
    final result = await showDialog<_ReceiptPaymentInput>(
      context: context,
      builder: (ctx) => _RecordReceiptPaymentDialog(maxMontant: r.montantRestant),
    );
    if (result == null) return;

    setState(() => _recordingPayment = true);
    try {
      await ref.read(paymentsApiProvider).create(
            fabricantId: r.fabricantId,
            stockReceiptId: r.id,
            montant: result.montant,
            method: result.method,
          );
      ref.invalidate(_receiptProvider(widget.receiptId));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e is ApiException ? e.message : 'Erreur.')));
      }
    } finally {
      if (mounted) setState(() => _recordingPayment = false);
    }
  }

  Future<void> _confirmDelete(StockReceiptView receipt) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Supprimer ce bon ?'),
        content: Text(
          'Le bon ${receipt.reference} sera supprimé et le stock qu\'il avait ajouté (${receipt.items.fold(0, (s, i) => s + i.quantite)} pièces) sera retiré. Cette action est irréversible.',
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
      await ref.read(stockReceiptsApiProvider).remove(receipt.id);
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        setState(() => _deleting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e is ApiException ? e.message : 'Erreur lors de la suppression.')),
        );
      }
    }
  }

  Future<void> _generateAndSharePdf(StockReceiptView receipt) async {
    setState(() => _generating = true);
    try {
      final dio = ref.read(dioProvider);
      final images = <String, Uint8List?>{};
      for (final item in receipt.items) {
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
            pw.Text('JIMI B2B — Bon de réception', style: pw.TextStyle(fontSize: 18, fontWeight: pw.FontWeight.bold)),
            pw.SizedBox(height: 4),
            pw.Text(receipt.reference),
            pw.SizedBox(height: 8),
            pw.Text('Fabricant: ${receipt.fabricantNom}'),
            pw.Text('Date: ${formatDate(receipt.createdAt)}'),
            if (receipt.notes != null && receipt.notes!.isNotEmpty) pw.Text('Notes: ${receipt.notes}'),
            pw.SizedBox(height: 16),
            pw.Table(
              border: pw.TableBorder.all(color: PdfColors.grey400, width: 0.5),
              columnWidths: const {
                0: pw.FixedColumnWidth(46),
                1: pw.FlexColumnWidth(3),
                2: pw.FlexColumnWidth(1.6),
                3: pw.FlexColumnWidth(1),
                4: pw.FlexColumnWidth(1.4),
                5: pw.FlexColumnWidth(1.4),
              },
              children: [
                pw.TableRow(
                  decoration: const pw.BoxDecoration(color: PdfColors.grey200),
                  children: [
                    _cell(''),
                    _cell('Article', bold: true),
                    _cell('Cartons', bold: true),
                    _cell('Qté', bold: true),
                    _cell('Prix achat', bold: true),
                    _cell('Total', bold: true),
                  ],
                ),
                for (final item in receipt.items)
                  pw.TableRow(
                    children: [
                      pw.Padding(
                        padding: const pw.EdgeInsets.all(4),
                        child: images[item.productId] != null
                            ? pw.Image(pw.MemoryImage(images[item.productId]!), width: 36, height: 36, fit: pw.BoxFit.cover)
                            : pw.SizedBox(width: 36, height: 36),
                      ),
                      _cell('${item.nom}\n${item.code}'),
                      _cell('${item.cartons} x ${item.unitesParCarton}'),
                      _cell('${item.quantite}'),
                      _cell(formatMoney(item.prixAchat)),
                      _cell(formatMoney(item.sousTotalAchat)),
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
                  pw.Text('Total achat: ${formatMoney(receipt.totalAchat)}', style: pw.TextStyle(fontSize: 14, fontWeight: pw.FontWeight.bold)),
                  pw.SizedBox(height: 4),
                  pw.Text('Payé: ${formatMoney(receipt.montantPaye)}', style: const pw.TextStyle(fontSize: 11)),
                  pw.Text('Reste à payer: ${formatMoney(receipt.montantRestant)}', style: const pw.TextStyle(fontSize: 11)),
                ],
              ),
            ),
          ],
        ),
      );

      final bytes = await doc.save();
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/bon-reception-${receipt.reference}.pdf');
      await file.writeAsBytes(bytes);
      await Share.shareXFiles([XFile(file.path)], text: 'Bon de réception ${receipt.reference}');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e is ApiException ? e.message : 'Erreur lors de la génération du PDF.')),
        );
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
    final receipt = ref.watch(_receiptProvider(widget.receiptId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Bon de réception'),
        actions: [
          receipt.maybeWhen(
            data: (r) => Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  icon: _generating
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.picture_as_pdf_outlined),
                  tooltip: 'Générer le PDF',
                  onPressed: _generating ? null : () => _generateAndSharePdf(r),
                ),
                IconButton(
                  icon: _deleting
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.delete_outline),
                  tooltip: 'Supprimer',
                  onPressed: _deleting ? null : () => _confirmDelete(r),
                ),
              ],
            ),
            orElse: () => const SizedBox.shrink(),
          ),
        ],
      ),
      body: AsyncValueWidget<StockReceiptView>(
        value: receipt,
        onRetry: () => ref.invalidate(_receiptProvider(widget.receiptId)),
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
                    _StatusChip(
                      label: paymentStatusLabel(r.statutPaiement),
                      color: r.statutPaiement == 'PAYE'
                          ? AppTheme.success
                          : r.statutPaiement == 'PARTIEL'
                              ? AppTheme.warning
                              : AppTheme.danger,
                    ),
                    const SizedBox(height: 8),
                    Text('Fabricant: ${r.fabricantNom}'),
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
                          leading: GestureDetector(
                            onTap: item.imageUrl != null ? () => PhotoGalleryViewer.open(context, [item.imageUrl!]) : null,
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: SizedBox(
                                width: 44,
                                height: 44,
                                child: item.imageUrl != null
                                    ? CachedNetworkImage(
                                        imageUrl: item.imageUrl!,
                                        fit: BoxFit.cover,
                                        errorWidget: (_, __, ___) => const Icon(Icons.inventory_2_outlined),
                                      )
                                    : const Icon(Icons.inventory_2_outlined),
                              ),
                            ),
                          ),
                          title: Text(item.nom),
                          subtitle: Text('${item.cartons} cartons x ${item.unitesParCarton} = ${item.quantite} · ${formatMoney(item.prixVente)}'),
                          trailing: Text(formatMoney(item.sousTotal), style: const TextStyle(fontWeight: FontWeight.bold)),
                        ))
                    .toList(),
              ),
            ),
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Column(
                children: [
                  // Un bon fournisseur concerne uniquement l'achat/réception — jamais de "Total vente" ici.
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Total achat', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                      Text(formatMoney(r.totalAchat), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppTheme.primary)),
                    ],
                  ),
                  const Divider(height: 20),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Payé au fournisseur'),
                      Text(formatMoney(r.montantPaye), style: const TextStyle(color: AppTheme.success)),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Reste à payer'),
                      Text(
                        formatMoney(r.montantRestant),
                        style: TextStyle(color: r.montantRestant > 0 ? AppTheme.danger : AppTheme.success, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            if (r.montantRestant > 0) ...[
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: _recordingPayment ? null : () => _recordPayment(r),
                  icon: _recordingPayment
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.payments_outlined),
                  label: const Text('Enregistrer un paiement au fournisseur'),
                ),
              ),
            ],
          ],
        ),
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

class _ReceiptPaymentInput {
  _ReceiptPaymentInput(this.montant, this.method);
  final double montant;
  final String method;
}

class _RecordReceiptPaymentDialog extends StatefulWidget {
  const _RecordReceiptPaymentDialog({required this.maxMontant});
  final double maxMontant;

  @override
  State<_RecordReceiptPaymentDialog> createState() => _RecordReceiptPaymentDialogState();
}

class _RecordReceiptPaymentDialogState extends State<_RecordReceiptPaymentDialog> {
  late final TextEditingController _montant = TextEditingController(text: widget.maxMontant.toStringAsFixed(0));
  String _method = 'ESPECES';
  String? _error;

  @override
  void dispose() {
    _montant.dispose();
    super.dispose();
  }

  void _submit() {
    final value = double.tryParse(_montant.text.replaceAll(',', '.'));
    if (value == null || value <= 0) {
      setState(() => _error = 'Montant invalide.');
      return;
    }
    Navigator.pop(context, _ReceiptPaymentInput(value, _method));
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Enregistrer un paiement'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('Reste à payer: ${formatMoney(widget.maxMontant)}', style: TextStyle(color: Colors.grey[600])),
          const SizedBox(height: 12),
          TextField(
            controller: _montant,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: InputDecoration(labelText: 'Montant versé', errorText: _error),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _method,
            decoration: const InputDecoration(labelText: 'Méthode'),
            items: kPaymentMethods.map((m) => DropdownMenuItem(value: m, child: Text(paymentMethodLabel(m)))).toList(),
            onChanged: (v) => setState(() => _method = v!),
          ),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Annuler')),
        ElevatedButton(onPressed: _submit, child: const Text('Enregistrer')),
      ],
    );
  }
}
