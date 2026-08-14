import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';

const PROMOTION_INCLUDE = { products: true, clients: true } as const;

@Injectable()
export class PromotionsService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreatePromotionDto) {
    return this.prisma.promotion.create({
      data: {
        nom: dto.nom,
        type: dto.type,
        valeur: dto.valeur,
        dateDebut: new Date(dto.dateDebut),
        dateFin: new Date(dto.dateFin),
        products: dto.productIds ? { create: dto.productIds.map((productId) => ({ productId })) } : undefined,
        clients: dto.clientIds ? { create: dto.clientIds.map((clientId) => ({ clientId })) } : undefined,
      },
      include: PROMOTION_INCLUDE,
    });
  }

  findAll() {
    return this.prisma.promotion.findMany({
      include: PROMOTION_INCLUDE,
      orderBy: { dateDebut: 'desc' },
    });
  }

  async setActive(id: string, actif: boolean) {
    const promo = await this.prisma.promotion.findUnique({ where: { id } });
    if (!promo) throw new NotFoundException('Promotion introuvable.');
    return this.prisma.promotion.update({ where: { id }, data: { actif } });
  }

  async remove(id: string) {
    const promo = await this.prisma.promotion.findUnique({ where: { id } });
    if (!promo) throw new NotFoundException('Promotion introuvable.');
    await this.prisma.promotion.delete({ where: { id } });
  }
}
