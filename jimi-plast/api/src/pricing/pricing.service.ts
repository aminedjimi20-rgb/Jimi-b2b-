import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface VisiblePrice {
  tierKey: string;
  label: string;
  price: number;
  originalPrice?: number;
  hasPromotion: boolean;
}

/**
 * Résout, pour un produit et un ensemble de permissions données, les prix
 * réellement visibles — jamais calculé côté client. Un visiteur non connecté
 * (permissions = null) ne voit aucun prix : la tarification B2B reste privée
 * tant que le compte n'est pas validé (§32 du cahier des charges).
 */
@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveVisiblePrices(productId: string, permissions: string[] | null): Promise<VisiblePrice[]> {
    if (!permissions || permissions.length === 0) return [];

    const tiers = await this.prisma.priceTierType.findMany({
      where: { permissionKey: { in: permissions } },
      orderBy: { sortOrder: 'asc' },
    });
    if (tiers.length === 0) return [];

    const [prices, promotions] = await Promise.all([
      this.prisma.productPrice.findMany({
        where: { productId, priceTierTypeId: { in: tiers.map((t) => t.id) } },
      }),
      this.prisma.promotion.findMany({
        where: {
          productId,
          priceTierTypeId: { in: tiers.map((t) => t.id) },
          isActive: true,
          startDate: { lte: new Date() },
          endDate: { gte: new Date() },
        },
      }),
    ]);

    const priceByTier = new Map(prices.map((p) => [p.priceTierTypeId, Number(p.price)]));
    const promoByTier = new Map(promotions.map((p) => [p.priceTierTypeId, p]));

    const result: VisiblePrice[] = [];
    for (const tier of tiers) {
      const base = priceByTier.get(tier.id);
      if (base === undefined) continue;

      const promo = promoByTier.get(tier.id);
      let finalPrice = base;
      let hasPromotion = false;
      if (promo) {
        hasPromotion = true;
        finalPrice =
          promo.discountType === 'PERCENT'
            ? base * (1 - Number(promo.discountValue) / 100)
            : Math.max(0, base - Number(promo.discountValue));
      }

      result.push({
        tierKey: tier.key,
        label: tier.label,
        price: Math.round(finalPrice * 100) / 100,
        originalPrice: hasPromotion ? base : undefined,
        hasPromotion,
      });
    }
    return result;
  }

  async resolveVisiblePricesForMany(
    productIds: string[],
    permissions: string[] | null,
  ): Promise<Map<string, VisiblePrice[]>> {
    const map = new Map<string, VisiblePrice[]>();
    if (!permissions || permissions.length === 0 || productIds.length === 0) return map;

    const tiers = await this.prisma.priceTierType.findMany({
      where: { permissionKey: { in: permissions } },
    });
    if (tiers.length === 0) return map;
    const tierIds = tiers.map((t) => t.id);

    const [prices, promotions] = await Promise.all([
      this.prisma.productPrice.findMany({
        where: { productId: { in: productIds }, priceTierTypeId: { in: tierIds } },
      }),
      this.prisma.promotion.findMany({
        where: {
          productId: { in: productIds },
          priceTierTypeId: { in: tierIds },
          isActive: true,
          startDate: { lte: new Date() },
          endDate: { gte: new Date() },
        },
      }),
    ]);

    const tierById = new Map(tiers.map((t) => [t.id, t]));
    const promoKey = (productId: string, tierId: string) => `${productId}:${tierId}`;
    const promoByProductTier = new Map(promotions.map((p) => [promoKey(p.productId, p.priceTierTypeId), p]));

    for (const price of prices) {
      const tier = tierById.get(price.priceTierTypeId)!;
      const promo = promoByProductTier.get(promoKey(price.productId, price.priceTierTypeId));
      const base = Number(price.price);
      let finalPrice = base;
      let hasPromotion = false;
      if (promo) {
        hasPromotion = true;
        finalPrice =
          promo.discountType === 'PERCENT'
            ? base * (1 - Number(promo.discountValue) / 100)
            : Math.max(0, base - Number(promo.discountValue));
      }

      const entry: VisiblePrice = {
        tierKey: tier.key,
        label: tier.label,
        price: Math.round(finalPrice * 100) / 100,
        originalPrice: hasPromotion ? base : undefined,
        hasPromotion,
      };

      if (!map.has(price.productId)) map.set(price.productId, []);
      map.get(price.productId)!.push(entry);
    }

    return map;
  }
}
