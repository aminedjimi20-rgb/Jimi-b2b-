import { Client, Order, OrderItem, Prisma, Product, ProductImage, Transporteur } from '@prisma/client';
import { clampedRemainder, computePaymentStatus } from '../../common/payment-status.util';

type OrderItemWithProduct = OrderItem & {
  product: Pick<Product, 'id' | 'nom' | 'code'> & { images: Pick<ProductImage, 'url' | 'isPrimary'>[] };
};
type OrderWithRelations = Order & {
  items: OrderItemWithProduct[];
  client?: Pick<Client, 'raisonSociale' | 'telephone'>;
  transporteur?: Pick<Transporteur, 'nom'> | null;
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
