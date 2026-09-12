import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { TrashService } from '../common/services/trash.service';
import { PricingService, VisiblePrice } from '../pricing/pricing.service';
import { UpsertProductDto } from './dto/upsert-product.dto';
import { SetPriceDto } from './dto/set-price.dto';
import { AddImageDto } from './dto/add-image.dto';

export interface ProductListFilters {
  categoryId?: string;
  search?: string;
  isNew?: boolean;
  isFeatured?: boolean;
  isSeasonal?: boolean;
  onSale?: boolean;
  availability?: 'in_stock' | 'out_of_stock';
  sort?: 'priority' | 'newest' | 'name_asc' | 'name_desc';
  page?: number;
  pageSize?: number;
}

const DEFAULT_PAGE_SIZE = 24;

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly trash: TrashService,
    private readonly pricing: PricingService,
  ) {}

  private priorityScore(product: {
    manualPriority: number | null;
    isNew: boolean;
    isFeatured: boolean;
    isSeasonal: boolean;
    seasonStart: Date | null;
    seasonEnd: Date | null;
    hasActivePromotion: boolean;
    createdAt: Date;
  }): number {
    if (product.manualPriority != null) return 100_000 + product.manualPriority;

    let score = 0;
    if (product.hasActivePromotion) score += 5000;
    if (product.isNew) score += 3000;
    const now = new Date();
    const inSeason =
      product.isSeasonal &&
      (!product.seasonStart || product.seasonStart <= now) &&
      (!product.seasonEnd || product.seasonEnd >= now);
    if (inSeason) score += 2000;
    if (product.isFeatured) score += 1000;
    // plus récent = légèrement prioritaire au sein d'un même palier
    score += Math.min(999, Math.floor(product.createdAt.getTime() / (1000 * 60 * 60 * 24)) % 1000) / 1000;
    return score;
  }

  async list(filters: ProductListFilters, permissions: string[] | null) {
    const page = filters.page ?? 1;
    const pageSize = Math.min(filters.pageSize ?? DEFAULT_PAGE_SIZE, 100);

    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      isActive: true,
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.isNew !== undefined ? { isNew: filters.isNew } : {}),
      ...(filters.isFeatured !== undefined ? { isFeatured: filters.isFeatured } : {}),
      ...(filters.isSeasonal !== undefined ? { isSeasonal: filters.isSeasonal } : {}),
      ...(filters.availability === 'in_stock' ? { currentStock: { gt: 0 } } : {}),
      ...(filters.availability === 'out_of_stock' ? { currentStock: { lte: 0 } } : {}),
      ...(filters.search
        ? {
            OR: [
              { nameFr: { contains: filters.search, mode: 'insensitive' } },
              { nameAr: { contains: filters.search, mode: 'insensitive' } },
              { nameEn: { contains: filters.search, mode: 'insensitive' } },
              { sku: { contains: filters.search, mode: 'insensitive' } },
              { barcode: { contains: filters.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, products] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: {
          category: {
            select: {
              id: true,
              slug: true,
              nameFr: true,
              nameAr: true,
              nameEn: true,
              parent: { select: { id: true, nameFr: true, nameAr: true, nameEn: true } },
            },
          },
          packagingUnit: true,
          images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
          promotions: {
            where: { isActive: true, startDate: { lte: new Date() }, endDate: { gte: new Date() } },
            take: 1,
          },
        },
      }),
    ]);

    const productIds = products.map((p) => p.id);
    const priceMap = await this.pricing.resolveVisiblePricesForMany(productIds, permissions);

    let items = products.map((p) => ({
      ...this.toPublicShape(p, priceMap.get(p.id) ?? []),
      _priority: this.priorityScore({ ...p, hasActivePromotion: p.promotions.length > 0 }),
    }));

    if (filters.onSale) items = items.filter((p) => p.hasPromotion);

    const sort = filters.sort ?? 'priority';
    items.sort((a, b) => {
      if (sort === 'priority') return b._priority - a._priority;
      if (sort === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sort === 'name_asc') return a.nameFr.localeCompare(b.nameFr);
      if (sort === 'name_desc') return b.nameFr.localeCompare(a.nameFr);
      return 0;
    });

    const start = (page - 1) * pageSize;
    const paged = items.slice(start, start + pageSize).map(({ _priority, ...rest }) => rest);

    return { items: paged, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async getById(id: string, permissions: string[] | null) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: {
        category: { include: { parent: true } },
        packagingUnit: true,
        images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
        promotions: {
          where: { isActive: true, startDate: { lte: new Date() }, endDate: { gte: new Date() } },
        },
      },
    });
    if (!product) throw new NotFoundException('Produit introuvable');

    const prices = await this.pricing.resolveVisiblePrices(id, permissions);
    return this.toPublicShape(product, prices);
  }

  /** Vue interne complète (coûts, stock exact, historique) — réservée aux permissions adéquates. */
  async getFullById(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: {
        category: true,
        packagingUnit: true,
        images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
        prices: { include: { priceTierType: true } },
        promotions: { include: { priceTierType: true } },
      },
    });
    if (!product) throw new NotFoundException('Produit introuvable');
    return product;
  }

  private toPublicShape(
    product: {
      id: string;
      sku: string;
      barcode: string | null;
      nameFr: string;
      nameAr: string | null;
      nameEn: string | null;
      descriptionFr: string | null;
      descriptionAr: string | null;
      descriptionEn: string | null;
      attributes: Prisma.JsonValue;
      brand: string | null;
      currentStock: number;
      unitsPerPackage: number;
      isNew: boolean;
      isFeatured: boolean;
      isSeasonal: boolean;
      createdAt: Date;
      category: {
        id: string;
        slug: string;
        nameFr: string;
        nameAr: string | null;
        nameEn: string | null;
        parent?: { id: string; nameFr: string; nameAr: string | null; nameEn: string | null } | null;
      };
      packagingUnit: { id: string; key: string; label: string; labelPlural: string };
      images: { id: string; url: string; isPrimary: boolean }[];
    },
    prices: VisiblePrice[],
  ) {
    return {
      id: product.id,
      sku: product.sku,
      barcode: product.barcode,
      nameFr: product.nameFr,
      nameAr: product.nameAr,
      nameEn: product.nameEn,
      descriptionFr: product.descriptionFr,
      descriptionAr: product.descriptionAr,
      descriptionEn: product.descriptionEn,
      attributes: product.attributes,
      brand: product.brand,
      category: product.category,
      packagingUnit: product.packagingUnit,
      unitsPerPackage: product.unitsPerPackage,
      images: product.images,
      isNew: product.isNew,
      isFeatured: product.isFeatured,
      isSeasonal: product.isSeasonal,
      createdAt: product.createdAt,
      availability: product.currentStock > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK',
      prices,
      hasPromotion: prices.some((p) => p.hasPromotion),
    };
  }

  async create(dto: UpsertProductDto, actorId: string) {
    const existing = await this.prisma.product.findUnique({ where: { sku: dto.sku } });
    if (existing) throw new BadRequestException('Ce SKU existe déjà');

    const { prices, ...productData } = dto;

    const product = await this.prisma.product.create({
      data: {
        ...productData,
        attributes: productData.attributes as Prisma.InputJsonValue | undefined,
        seasonStart: dto.seasonStart ? new Date(dto.seasonStart) : undefined,
        seasonEnd: dto.seasonEnd ? new Date(dto.seasonEnd) : undefined,
        prices: prices
          ? { create: prices.map((p) => ({ priceTierTypeId: p.priceTierTypeId, price: p.price })) }
          : undefined,
      },
    });

    if (prices) {
      await this.prisma.priceHistory.createMany({
        data: prices.map((p) => ({
          productId: product.id,
          priceTierTypeId: p.priceTierTypeId,
          newPrice: p.price,
          changedById: actorId,
          reason: 'Création du produit',
        })),
      });
    }

    await this.auditLog.record({ entityType: 'Product', entityId: product.id, action: 'CREATE', actorId });
    return product;
  }

  async update(id: string, dto: UpsertProductDto, actorId: string) {
    const existing = await this.prisma.product.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException('Produit introuvable');

    const { prices: _prices, ...productData } = dto;

    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        ...productData,
        attributes: productData.attributes as Prisma.InputJsonValue | undefined,
        seasonStart: dto.seasonStart ? new Date(dto.seasonStart) : undefined,
        seasonEnd: dto.seasonEnd ? new Date(dto.seasonEnd) : undefined,
      },
    });

    await this.auditLog.record({
      entityType: 'Product',
      entityId: id,
      action: 'UPDATE',
      oldValue: existing,
      newValue: productData,
      actorId,
    });
    return updated;
  }

  async setPrice(productId: string, dto: SetPriceDto, actorId: string) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, deletedAt: null } });
    if (!product) throw new NotFoundException('Produit introuvable');

    const existingPrice = await this.prisma.productPrice.findUnique({
      where: { productId_priceTierTypeId: { productId, priceTierTypeId: dto.priceTierTypeId } },
    });

    await this.prisma.productPrice.upsert({
      where: { productId_priceTierTypeId: { productId, priceTierTypeId: dto.priceTierTypeId } },
      create: { productId, priceTierTypeId: dto.priceTierTypeId, price: dto.price },
      update: { price: dto.price },
    });

    await this.prisma.priceHistory.create({
      data: {
        productId,
        priceTierTypeId: dto.priceTierTypeId,
        oldPrice: existingPrice?.price,
        newPrice: dto.price,
        changedById: actorId,
        reason: dto.reason,
      },
    });

    return this.getFullById(productId);
  }

  async priceHistory(productId: string) {
    return this.prisma.priceHistory.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      include: { priceTierType: true },
    });
  }

  async addImage(productId: string, dto: AddImageDto) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, deletedAt: null } });
    if (!product) throw new NotFoundException('Produit introuvable');

    if (dto.isPrimary) {
      await this.prisma.productImage.updateMany({ where: { productId }, data: { isPrimary: false } });
    }

    const count = await this.prisma.productImage.count({ where: { productId } });
    return this.prisma.productImage.create({
      data: { productId, url: dto.url, isPrimary: dto.isPrimary ?? count === 0, sortOrder: count },
    });
  }

  async removeImage(imageId: string) {
    await this.prisma.productImage.delete({ where: { id: imageId } });
    return { id: imageId };
  }

  async remove(id: string, actorId: string, reason?: string) {
    const product = await this.prisma.product.findFirst({ where: { id, deletedAt: null } });
    if (!product) throw new NotFoundException('Produit introuvable');

    await this.prisma.product.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.trash.moveToTrash({
      entityType: 'Product',
      entityId: id,
      snapshot: product as unknown as Record<string, unknown>,
      deletedById: actorId,
      reason,
    });
    return { id };
  }
}
