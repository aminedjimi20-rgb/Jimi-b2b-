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
import '../../../models/invoice.dart';
import '../../../models/order.dart';
import '../../../services/service_providers.dart';

final _adminInvoiceProvider = FutureProvider.autoDispose.family<InvoiceView, String>((ref, id) {
  return ref.watch(invoicesApiProvider).getAdmin(id);
});

/// A Facture is a read-only, formalized snapshot of a confirmed Order — no
/// status changes here (those happen on the order itself), just viewing,
/// PDF export, and moving to the corbeille.
class AdminInvoiceDetailScreen extends ConsumerStatefulWidget {
  const AdminInvoiceDetailScreen({super.key, required this.invoiceId});
  final String invoiceId;

  @override
  ConsumerState<AdminInvoiceDetailScreen> createState() => _AdminInvoiceDetailScreenState();
}

class _AdminInvoiceDetailScreenState extends ConsumerState<AdminInvoiceDetailScreen> {
  bool _generating = false;
  bool _deleting = false;

  Future<void> _confirmDelete(InvoiceView inv) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Supprimer cette facture ?'),
        content: Text('La facture ${inv.reference} sera déplacée dans la corbeille.'),
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
      await ref.read(invoicesApiProvider).remove(inv.id);
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        setState(() => _deleting = false);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e is ApiException ? e.message : 'Erreur lors de la suppression.')));
      }
    }
  }

  Future<void> _generateAndSharePdf(InvoiceView inv) async {
    setState(() => _generating = true);
    try {
      final o = inv.order;
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
            pw.Text('JIMI B2B — Facture', style: pw.TextStyle(fontSize: 18, fontWeight: pw.FontWeight.bold)),
            pw.SizedBox(height: 4),
            pw.Text(inv.reference),
            pw.SizedBox(height: 8),
            pw.Text('Commande liée: ${o.reference}'),
            pw.Text('Client: ${o.clientNom ?? '-'}'),
            pw.Text('Téléphone: ${o.telephoneContact}'),
            pw.Text('Adresse: ${o.adresseLivraison}'),
            pw.Text('Date de facturation: ${formatDate(inv.createdAt)}'),
            pw.Text('Paiement: ${paymentMethodLabel(o.paymentMethod)} — ${paymentStatusLabel(o.statutPaiement)}'),
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
                  pw.Text('Sous-total: ${formatMoney(o.sousTotal)}', style: const pw.TextStyle(fontSize: 11)),
                  if (o.remisePourcentage != null && o.remisePourcentage! > 0)
                    pw.Text('Remise: ${o.remisePourcentage}%', style: const pw.TextStyle(fontSize: 11)),
                  if (o.fraisLivraison > 0)
                    pw.Text('Frais de livraison: ${formatMoney(o.fraisLivraison)}', style: const pw.TextStyle(fontSize: 11)),
                  pw.Text('Total: ${formatMoney(inv.total)}', style: pw.TextStyle(fontSize: 14, fontWeight: pw.FontWeight.bold)),
                  pw.Text('Payé: ${formatMoney(o.montantPaye)}', style: const pw.TextStyle(fontSize: 11)),
                  pw.Text('Reste à payer: ${formatMoney(o.montantRestant)}', style: const pw.TextStyle(fontSize: 11)),
                ],
              ),
            ),
          ],
        ),
      );

      final bytes = await doc.save();
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/facture-${inv.reference}.pdf');
      await file.writeAsBytes(bytes);
      await Share.shareXFiles([XFile(file.path)], text: 'Facture ${inv.reference}');
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
    final invoice = ref.watch(_adminInvoiceProvider(widget.invoiceId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Facture'),
        actions: [
          invoice.maybeWhen(
            data: (inv) => Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  icon: _generating
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.picture_as_pdf_outlined),
                  tooltip: 'Générer le PDF',
                  onPressed: _generating ? null : () => _generateAndSharePdf(inv),
                ),
                IconButton(
                  icon: _deleting
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.delete_outline),
                  tooltip: 'Supprimer',
                  onPressed: _deleting ? null : () => _confirmDelete(inv),
                ),
              ],
            ),
            orElse: () => const SizedBox.shrink(),
          ),
        ],
      ),
      body: AsyncValueWidget<InvoiceView>(
        value: invoice,
        onRetry: () => ref.invalidate(_adminInvoiceProvider(widget.invoiceId)),
        data: (inv) {
          final o = inv.order;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(inv.reference, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
                      Text('Commande liée: ${o.reference}', style: TextStyle(color: Colors.grey[600])),
                      const Divider(height: 24),
                      _InfoRow(label: 'Client', value: o.clientNom ?? '-'),
                      _InfoRow(label: 'Téléphone', value: o.telephoneContact),
                      _InfoRow(label: 'Adresse', value: o.adresseLivraison),
                      _InfoRow(label: 'Paiement', value: paymentMethodLabel(o.paymentMethod)),
                      _InfoRow(label: 'Date facture', value: formatDate(inv.createdAt)),
                      _InfoRow(label: 'Statut paiement', value: paymentStatusLabel(o.statutPaiement)),
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
                child: Column(
                  children: [
                    _TotalRow(label: 'Sous-total', value: o.sousTotal),
                    if (o.fraisLivraison > 0) _TotalRow(label: 'Frais de livraison', value: o.fraisLivraison),
                    _TotalRow(label: 'Total', value: inv.total, bold: true, color: AppTheme.primary),
                    _TotalRow(label: 'Payé', value: o.montantPaye, color: AppTheme.success),
                    _TotalRow(label: 'Reste à payer', value: o.montantRestant, color: o.montantRestant > 0 ? AppTheme.danger : AppTheme.success),
                  ],
                ),
              ),
            ],
          );
        },
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
          SizedBox(width: 110, child: Text(label, style: TextStyle(color: Colors.grey[600]))),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }
}

class _TotalRow extends StatelessWidget {
  const _TotalRow({required this.label, required this.value, this.bold = false, this.color});
  final String label;
  final double value;
  final bool bold;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final style = TextStyle(fontWeight: bold ? FontWeight.bold : FontWeight.normal, fontSize: bold ? 16 : 14, color: color);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: style),
          Text(formatMoney(value), style: style),
        ],
      ),
    );
  }
}
