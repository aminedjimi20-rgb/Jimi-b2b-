import { Client, Employee, Invoice, Order, OrderItem, Product, ProductImage, Transporteur } from '@prisma/client';
import { toAdminOrderDTO, toClientOrderDTO } from '../../orders/dto/order-response.dto';

type OrderItemWithProduct = OrderItem & {
  product: Pick<Product, 'id' | 'nom' | 'code'> & { images: Pick<ProductImage, 'url' | 'isPrimary'>[] };
};
type OrderWithRelations = Order & {
  items: OrderItemWithProduct[];
  client?: Pick<Client, 'raisonSociale' | 'telephone'>;
  transporteur?: Pick<Transporteur, 'nom'> | null;
  employee?: Pick<Employee, 'nom'> | null;
};
export type InvoiceWithOrder = Invoice & { order: OrderWithRelations };

/**
 * A Facture wraps a confirmed Order with its own FAC- numbering series, for
 * accounting purposes. Reuses the existing role-scoped Order DTOs instead of
 * re-implementing item mapping/redaction — an invoice never exposes more
 * than the underlying order already does for that role.
 */
export function toAdminInvoiceDTO(invoice: InvoiceWithOrder) {
  return {
    id: invoice.id,
    reference: invoice.reference,
    total: invoice.total,
    createdAt: invoice.createdAt,
    order: toAdminOrderDTO(invoice.order),
  };
}

export function toClientInvoiceDTO(invoice: InvoiceWithOrder) {
  return {
    id: invoice.id,
    reference: invoice.reference,
    total: invoice.total,
    createdAt: invoice.createdAt,
    order: toClientOrderDTO(invoice.order),
  };
}
