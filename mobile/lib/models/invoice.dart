import 'order.dart';
import 'parsing.dart';

/// A Facture wraps a confirmed Order with its own FAC- numbering series, for
/// accounting purposes — same items/totals/redaction rules as the order
/// it's generated from (see backend InvoiceResponseDto).
class InvoiceView {
  InvoiceView({
    required this.id,
    required this.reference,
    required this.total,
    required this.createdAt,
    required this.order,
  });

  final String id;
  final String reference;
  final double total;
  final DateTime createdAt;
  final OrderView order;

  factory InvoiceView.fromJson(Map<String, dynamic> json) => InvoiceView(
        id: json['id'] as String,
        reference: json['reference'] as String,
        total: parseDecimal(json['total']),
        createdAt: parseDateOrNull(json['createdAt']) ?? DateTime.now(),
        order: OrderView.fromJson(json['order'] as Map<String, dynamic>),
      );
}
