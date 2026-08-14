import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type PriceSource = 'PROMOTION' | 'PERSONNALISE' | 'PALIER' | 'NORMAL';

export interface ResolvedPrice {
  prix: Prisma.Decimal;
  source: PriceSource;
}

/**
 * Single source of truth for "what price does this client pay for this
 * product at this quantity, right now". Used by the catalog listing, the
 * cart, and order creation — so a price can never be computed differently
 * (or supplied directly by the client app) in different parts of the API.
 *
 * Resolution order (see docs/ARCHITECTURE.md §5):
 *   1. Active promotion targeting this client + product (or untargeted / global)
 *   2. Client-specific custom price
 *   3. Quantity price tier
 *   4. Normal sale price
 */
@Injectable()
export class PricingService {
  constructor(private prisma: PrismaService) {}

  async resolvePrice(clientId: string, productId: string, quantite: number): Promise<ResolvedPrice> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, prixVente: true },
    });
    if (!product) throw new NotFoundException('Produit introuvable.');

    const now = new Date();

    const promotion = await this.prisma.promotion.findFirst({
      where: {
        actif: true,
        dateDebut: { lte: now },
        dateFin: { gte: now },
        OR: [
          { products: { some: { productId } } },
          { products: { none: {} } }, // untargeted promotion = applies to whole catalog
        ],
        AND: [
          {
            OR: [{ clients: { some: { clientId } } }, { clients: { none: {} } }],
          },
        ],
      },
      orderBy: { valeur: 'desc' }, // best discount wins if several match
    });

    if (promotion) {
      const base = product.prixVente;
      const prix =
        promotion.type === 'POURCENTAGE'
          ? base.minus(base.mul(promotion.valeur).div(100))
          : base.minus(promotion.valeur);
      return { prix: prix.lessThan(0) ? new Prisma.Decimal(0) : prix, source: 'PROMOTION' };
    }

    const customPrice = await this.prisma.clientProductPrice.findUnique({
      where: { clientId_productId: { clientId, productId } },
    });
    if (customPrice) return { prix: customPrice.prix, source: 'PERSONNALISE' };

    const tier = await this.prisma.priceTier.findFirst({
      where: {
        productId,
        qteMin: { lte: quantite },
        OR: [{ qteMax: null }, { qteMax: { gte: quantite } }],
      },
      orderBy: { qteMin: 'desc' },
    });
    if (tier) return { prix: tier.prix, source: 'PALIER' };

    return { prix: product.prixVente, source: 'NORMAL' };
  }

  /** Derived stock status shown to clients — the real quantity never leaves the backend. */
  stockStatus(stockReel: number, stockMinimum: number): 'DISPONIBLE' | 'STOCK_LIMITE' | 'RUPTURE' {
    if (stockReel <= 0) return 'RUPTURE';
    if (stockReel <= stockMinimum) return 'STOCK_LIMITE';
    return 'DISPONIBLE';
  }
}
