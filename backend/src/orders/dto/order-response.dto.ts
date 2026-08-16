import { Client, Employee, Order, OrderItem, Prisma, Product, ProductImage, Transporteur } from '@prisma/client';
import { clampedRemainder, computePaymentStatus } from '../../common/payment-status.util';

type OrderItemWithProduct = OrderItem & {
  product: Pick<Product, 'id' | 'nom' | 'code'> & { images: Pick<ProductImage, 'url' | 'isPrimary'>[] };
};
type OrderWithRelations = Order & {
  items: OrderItemWithProduct[];
  client?: Pick<Client, 'raisonSociale' | 'telephone'>;
  transporteur?: Pick<Transporteur, 'nom'> | null;
  employee?: Pick<Employee, 'nom'> | null;
};

function mapItems(items: OrderItemWithProduct[]) {
  return items.map((item) => ({
    productId: item.productId,
    nom: item.product.nom,
    code: item.product.code,
    imageUrl: item.product.images.find((i) => i.isPrimary)?.url ?? item.product.images[0]?.url ?? null,
    quantite: item.quantite,
    prixUnitaire: item.prixUnitaire,
    sousTotal: item.prixUnitaire.mul(item.quantite),
  }));
}

/** Sum of line totals, independent of remise/fraisLivraison — the "avant remise" line of the bon. */
function computeSousTotal(items: OrderItemWithProduct[]) {
  return items.reduce((sum, item) => sum.plus(item.prixUnitaire.mul(item.quantite)), new Prisma.Decimal(0));
}

/** Admin view — includes the client's identity, contact and every commercial detail. */
export function toAdminOrderDTO(order: OrderWithRelations) {
  return {
    id: order.id,
    reference: order.reference,
    nom: order.nom,
    status: order.status,
    paymentMethod: order.paymentMethod,
    sousTotal: computeSousTotal(order.items),
    remisePourcentage: order.remisePourcentage,
    fraisLivraison: order.fraisLivraison,
    transporteurId: order.transporteurId,
    transporteurNom: order.transporteur?.nom ?? null,
    destination: order.destination,
    total: order.total,
    montantPaye: order.montantPaye,
    montantRestant: clampedRemainder(order.total, order.montantPaye),
    statutPaiement: computePaymentStatus(order.montantPaye, order.total),
    clientId: order.clientId,
    clientNom: order.client?.raisonSociale,
    clientTelephone: order.client?.telephone,
    adresseLivraison: order.adresseLivraison,
    telephoneContact: order.telephoneContact,
    notes: order.notes,
    employeeId: order.employeeId,
    employeeNom: order.employee?.nom ?? null,
    items: mapItems(order.items),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

/** Client view — scoped to their own order, never carries other clients' data (caller already filtered by clientId). */
export function toClientOrderDTO(order: OrderWithRelations) {
  return {
    id: order.id,
    reference: order.reference,
    nom: order.nom,
    status: order.status,
    paymentMethod: order.paymentMethod,
    sousTotal: computeSousTotal(order.items),
    fraisLivraison: order.fraisLivraison,
    transporteurNom: order.transporteur?.nom ?? null,
    destination: order.destination,
    total: order.total,
    montantPaye: order.montantPaye,
    montantRestant: clampedRemainder(order.total, order.montantPaye),
    statutPaiement: computePaymentStatus(order.montantPaye, order.total),
    adresseLivraison: order.adresseLivraison,
    telephoneContact: order.telephoneContact,
    notes: order.notes,
    items: mapItems(order.items),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

const REDACTED = 'Non autorisé';

/**
 * Employee view — enough to prepare/deliver an assigned or self-created
 * order (client identity, items, totals). Deliberately omits
 * remisePourcentage: applying a discount stays an Admin-only decision, an
 * employee never sees or controls it, mirroring the client's own DTO.
 *
 * `permissions` is per-employee (Employee.canSeeClientPhone/Address, set by
 * the Admin) — off by default, so contact details are redacted server-side
 * (never sent at all, not merely hidden in the UI) unless explicitly granted.
 */
export function toEmployeeOrderDTO(
  order: OrderWithRelations,
  permissions: { canSeeClientPhone: boolean; canSeeClientAddress: boolean },
) {
  return {
    id: order.id,
    reference: order.reference,
    nom: order.nom,
    status: order.status,
    paymentMethod: order.paymentMethod,
    sousTotal: computeSousTotal(order.items),
    fraisLivraison: order.fraisLivraison,
    transporteurNom: order.transporteur?.nom ?? null,
    destination: order.destination,
    total: order.total,
    montantPaye: order.montantPaye,
    montantRestant: clampedRemainder(order.total, order.montantPaye),
    statutPaiement: computePaymentStatus(order.montantPaye, order.total),
    clientNom: order.client?.raisonSociale,
    clientTelephone: permissions.canSeeClientPhone ? order.client?.telephone : REDACTED,
    adresseLivraison: permissions.canSeeClientAddress ? order.adresseLivraison : REDACTED,
    telephoneContact: permissions.canSeeClientPhone ? order.telephoneContact : REDACTED,
    notes: order.notes,
    items: mapItems(order.items),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}
