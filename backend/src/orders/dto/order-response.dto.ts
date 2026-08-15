import { Client, Order, OrderItem, Product, ProductImage } from '@prisma/client';

type OrderItemWithProduct = OrderItem & {
  product: Pick<Product, 'id' | 'nom' | 'code'> & { images: Pick<ProductImage, 'url' | 'isPrimary'>[] };
};
type OrderWithRelations = Order & { items: OrderItemWithProduct[]; client?: Pick<Client, 'raisonSociale' | 'telephone'> };

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

/** Admin view — includes the client's identity, contact and every commercial detail. */
export function toAdminOrderDTO(order: OrderWithRelations) {
  return {
    id: order.id,
    reference: order.reference,
    nom: order.nom,
    status: order.status,
    paymentMethod: order.paymentMethod,
    estPayee: order.estPayee,
    remisePourcentage: order.remisePourcentage,
    clientId: order.clientId,
    clientNom: order.client?.raisonSociale,
    clientTelephone: order.client?.telephone,
    adresseLivraison: order.adresseLivraison,
    telephoneContact: order.telephoneContact,
    notes: order.notes,
    total: order.total,
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
    estPayee: order.estPayee,
    adresseLivraison: order.adresseLivraison,
    telephoneContact: order.telephoneContact,
    notes: order.notes,
    total: order.total,
    items: mapItems(order.items),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}
