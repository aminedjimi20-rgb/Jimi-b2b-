import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePriceCategoryDto } from './dto/create-price-category.dto';

/**
 * Small admin-managed list (e.g. "Gros", "Détail", "VIP") — a client is
 * assigned one, and each product can carry a price for it (ProductSalePrice),
 * auto-applied at order time by PricingService. Deleting a category is safe:
 * its ProductSalePrice rows cascade away and assigned clients just fall back
 * to the product's normal prixVente (Client.priceCategoryId → SET NULL).
 */
@Injectable()
export class PriceCategoriesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.priceCategory.findMany({ orderBy: { nom: 'asc' } });
  }

  async create(dto: CreatePriceCategoryDto) {
    const existing = await this.prisma.priceCategory.findUnique({ where: { nom: dto.nom } });
    if (existing) throw new ConflictException('Cette catégorie de prix existe déjà.');
    return this.prisma.priceCategory.create({ data: { nom: dto.nom } });
  }

  async rename(id: string, nom: string) {
    await this.assertExists(id);
    return this.prisma.priceCategory.update({ where: { id }, data: { nom } });
  }

  async remove(id: string) {
    await this.assertExists(id);
    await this.prisma.priceCategory.delete({ where: { id } });
  }

  private async assertExists(id: string) {
    const category = await this.prisma.priceCategory.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Catégorie de prix introuvable.');
  }
}
