import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { toClientProductDTO } from '../products/dto/product-response.dto';
import { computeActivePromoInfo, productHasActivePromo } from '../promotions/active-promotions.util';

const PRODUCT_INCLUDE = { images: true, priceTiers: true } as const;

@Injectable()
export class FavoritesService {
  constructor(
    private prisma: PrismaService,
    private pricing: PricingService,
  ) {}

  async add(clientId: string, productId: string) {
    await this.prisma.favorite.upsert({
      where: { clientId_productId: { clientId, productId } },
      create: { clientId, productId },
      update: {},
    });
  }

  async remove(clientId: string, productId: string) {
    await this.prisma.favorite.deleteMany({ where: { clientId, productId } });
  }

  async list(clientId: string) {
    const favorites = await this.prisma.favorite.findMany({
      where: { clientId },
      include: { product: { include: PRODUCT_INCLUDE } },
      orderBy: { createdAt: 'desc' },
    });

    const promoInfo = await computeActivePromoInfo(this.prisma);

    return Promise.all(
      favorites.map(async ({ product }) => {
        const price = await this.pricing.resolvePrice(clientId, product.id, product.minCommande);
        const status = this.pricing.stockStatus(product.stockReel, product.stockMinimum);
        const estPromo = productHasActivePromo(promoInfo, product.id);
        return toClientProductDTO(product, price, status, estPromo);
      }),
    );
  }
}
