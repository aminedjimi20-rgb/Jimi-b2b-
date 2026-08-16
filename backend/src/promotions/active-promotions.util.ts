import { PrismaService } from '../prisma/prisma.service';

export interface ActivePromoInfo {
  allProducts: boolean;
  productIds: Set<string>;
}

/** Active promotions right now — `allProducts: true` means an untargeted (catalog-wide) promo is live. */
export async function computeActivePromoInfo(prisma: PrismaService): Promise<ActivePromoInfo> {
  const now = new Date();
  const activePromotions = await prisma.promotion.findMany({
    where: { actif: true, dateDebut: { lte: now }, dateFin: { gte: now } },
    include: { products: true },
  });

  let allProducts = false;
  const productIds = new Set<string>();
  for (const promo of activePromotions) {
    if (promo.products.length === 0) allProducts = true;
    else for (const pp of promo.products) productIds.add(pp.productId);
  }
  return { allProducts, productIds };
}

export function productHasActivePromo(info: ActivePromoInfo, productId: string): boolean {
  return info.allProducts || info.productIds.has(productId);
}
