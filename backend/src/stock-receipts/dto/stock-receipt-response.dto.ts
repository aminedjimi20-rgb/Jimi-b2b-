import { Employee, Fabricant, Prisma, Product, ProductImage, StockReceipt, StockReceiptItem, Transporteur } from '@prisma/client';
import { clampedRemainder, computePaymentStatus } from '../../common/payment-status.util';

type ItemWithProduct = StockReceiptItem & { product: Product & { images: ProductImage[] } };
type ReceiptWithRelations = StockReceipt & {
  fabricant: Fabricant;
  items: ItemWithProduct[];
  employee?: Pick<Employee, 'nom'> | null;
  transporteur?: Pick<Transporteur, 'nom'> | null;
};

function computeAmounts(receipt: StockReceipt) {
  // totalAchat is the sous-total AVANT remise — le montant réellement dû
  // (base du reste à payer) est calculé ici, après remise, jamais stocké
  // séparément pour éviter toute divergence avec totalAchat/remisePourcentage.
  const montantRemise = receipt.remisePourcentage
    ? receipt.totalAchat.mul(receipt.remisePourcentage).div(100)
    : new Prisma.Decimal(0);
  const totalApresRemise = receipt.totalAchat.minus(montantRemise).plus(receipt.fraisLivraison);
  return { montantRemise, totalApresRemise };
}

export function toStockReceiptDTO(receipt: ReceiptWithRelations) {
  const { montantRemise, totalApresRemise } = computeAmounts(receipt);

  return {
    id: receipt.id,
    reference: receipt.reference,
    status: receipt.status,
    fabricantId: receipt.fabricantId,
    fabricantNom: receipt.fabricant.nom,
    employeeId: receipt.employeeId,
    employeeNom: receipt.employee?.nom ?? null,
    numeroBonFournisseur: receipt.numeroBonFournisseur,
    notes: receipt.notes,
    total: receipt.total,
    totalAchat: receipt.totalAchat,
    remisePourcentage: receipt.remisePourcentage,
    montantRemise,
    transporteurId: receipt.transporteurId,
    transporteurNom: receipt.transporteur?.nom ?? null,
    destination: receipt.destination,
    fraisLivraison: receipt.fraisLivraison,
    totalApresRemise,
    montantPaye: receipt.montantPaye,
    montantRestant: clampedRemainder(totalApresRemise, receipt.montantPaye),
    statutPaiement: computePaymentStatus(receipt.montantPaye, totalApresRemise),
    createdAt: receipt.createdAt,
    items: receipt.items.map((item) => ({
      productId: item.productId,
      nom: item.product.nom,
      code: item.product.code,
      imageUrl: item.product.images.find((i) => i.isPrimary)?.url ?? item.product.images[0]?.url ?? null,
      cartons: item.cartons,
      unitesParCarton: item.unitesParCarton,
      quantite: item.quantite,
      prixAchat: item.prixAchat,
      prixVente: item.prixVente,
      sousTotalAchat: item.prixAchat.mul(item.quantite),
      sousTotal: item.prixVente.mul(item.quantite),
    })),
  };
}

/**
 * Allow-list mapper — an Employee viewing their own bon d'entrée. Same
 * purchase-side numbers (jamais retiré : c'est le but même du bon), mais
 * `prixVente`/`sousTotal`/`total` (vente) sont masqués sauf si l'Admin a
 * accordé canVoirPrixVente — enforced here, not just hidden in the UI.
 */
export function toEmployeeStockReceiptDTO(receipt: ReceiptWithRelations, canVoirPrixVente: boolean) {
  const full = toStockReceiptDTO(receipt);
  return {
    ...full,
    total: canVoirPrixVente ? full.total : null,
    items: full.items.map((item) => ({
      ...item,
      prixVente: canVoirPrixVente ? item.prixVente : null,
      sousTotal: canVoirPrixVente ? item.sousTotal : null,
    })),
  };
}

export type StockReceiptDTO = ReturnType<typeof toStockReceiptDTO>;
