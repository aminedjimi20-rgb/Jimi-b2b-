import { Fabricant, Prisma, Product, ProductImage, StockReceipt, StockReceiptItem } from '@prisma/client';
import { clampedRemainder, computePaymentStatus } from '../../common/payment-status.util';

type ItemWithProduct = StockReceiptItem & { product: Product & { images: ProductImage[] } };
type ReceiptWithRelations = StockReceipt & { fabricant: Fabricant; items: ItemWithProduct[] };

export function toStockReceiptDTO(receipt: ReceiptWithRelations) {
  // totalAchat is the sous-total AVANT remise — le montant réellement dû
  // (base du reste à payer) est calculé ici, après remise, jamais stocké
  // séparément pour éviter toute divergence avec totalAchat/remisePourcentage.
  const montantRemise = receipt.remisePourcentage
    ? receipt.totalAchat.mul(receipt.remisePourcentage).div(100)
    : new Prisma.Decimal(0);
  const totalApresRemise = receipt.totalAchat.minus(montantRemise);

  return {
    id: receipt.id,
    reference: receipt.reference,
    fabricantId: receipt.fabricantId,
    fabricantNom: receipt.fabricant.nom,
    notes: receipt.notes,
    total: receipt.total,
    totalAchat: receipt.totalAchat,
    remisePourcentage: receipt.remisePourcentage,
    montantRemise,
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

export type StockReceiptDTO = ReturnType<typeof toStockReceiptDTO>;
