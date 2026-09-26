import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { TrashService } from '../common/services/trash.service';
import { PricingService, VisiblePrice } from '../pricing/pricing.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UpsertProductDto } from './dto/upsert-product.dto';
import { SetPriceDto } from './dto/set-price.dto';
import { AddImageDto } from './dto/add-image.dto';
import { UpsertPromotionDto } from './dto/upsert-promotion.dto';

// Champs du formulaire produit qui intéressent les clients (quantité, mise en
// avant, déstockage, saisonnier...) — le reste (SKU, dépôt, coût d'achat,
// fabricant...) est purement interne et ne doit pas les spammer.
const CUSTOMER_NOTIFY_FIELDS: Record<string, string> = {
  currentStock: 'Stock',
  isActive: 'Disponibilité',
  isClearance: 'Déstockage',
  isNew: 'Nouveauté',
  isFeatured: 'Mis en avant',
  isSeasonal: 'Saisonnier',
  seasonStart: 'Début de saison',
  seasonEnd: 'Fin de saison',
  nameFr: 'Nom',
};

function formatCustomerFieldChange(field: string, oldVal: unknown, newVal: unknown): string {
  const label = CUSTOMER_NOTIFY_FIELDS[field] ?? field;
  if (field === 'currentStock') return `${label} : ${oldVal ?? 0} → ${newVal ?? 0}`;
  if (typeof newVal === 'boolean') return `${label} : ${newVal ? 'activé' : 'désactivé'}`;
  if (field === 'seasonStart' || field === 'seasonEnd') {
    return `${label} : ${newVal ? new Date(newVal as string).toLocaleDateString('fr-FR') : '—'}`;
  }
  return `${label} : ${newVal ?? '—'}`;
}

export interface ProductListFilters {
  categoryId?: string;
  manufacturerId?: string;
  search?: string;
  isNew?: boolean;
  isFeatured?: boolean;
  isSeasonal?: boolean;
  isClearance?: boolean;
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
    private readonly notifications: NotificationsService,
  ) {}

  /** Diffuse une notification informative à tous les clients (compte lié — toujours le cas). */
  private async notifyCustomers(type: string, title: string, body: string, data: Record<string, unknown> = {}) {
    const customers = await this.prisma.customer.findMany({ select: { userId: true } });
    const userIds = customers.map((c) => c.userId);
    if (userIds.length === 0) return;
    await this.notifications.notify({ type, title, body, data: { ...data, userIds } });
  }

  private priorityScore(product: {
    manualPriority: number | null;
    isNew: boolean;
    isFeatured: boolean;
    isSeasonal: boolean;
    isClearance: boolean;
    seasonStart: Date | null;
    seasonEnd: Date | null;
    hasActivePromotion: boolean;
    createdAt: Date;
  }): number {
    if (product.manualPriority != null) return 100_000 + product.manualPriority;

    let score = 0;
    if (product.hasActivePromotion) score += 5000;
    if (product.isClearance) score += 4000; // le déstockage doit se voir vite
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
      ...(filters.manufacturerId ? { manufacturerId: filters.manufacturerId } : {}),
      ...(filters.isNew !== undefined ? { isNew: filters.isNew } : {}),
      ...(filters.isFeatured !== undefined ? { isFeatured: filters.isFeatured } : {}),
      ...(filters.isSeasonal !== undefined ? { isSeasonal: filters.isSeasonal } : {}),
      ...(filters.isClearance !== undefined ? { isClearance: filters.isClearance } : {}),
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
          manufacturer: { select: { id: true, name: true } },
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
      ...this.toPublicShape(p, priceMap.get(p.id) ?? [], permissions),
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
        manufacturer: { select: { id: true, name: true } },
        images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
        promotions: {
          where: { isActive: true, startDate: { lte: new Date() }, endDate: { gte: new Date() } },
        },
      },
    });
    if (!product) throw new NotFoundException('Produit introuvable');

    const prices = await this.pricing.resolveVisiblePrices(id, permissions);
    return this.toPublicShape(product, prices, permissions);
  }

  /** Vue interne complète (coûts, stock exact, historique) — réservée aux permissions adéquates. */
  // Une seule requête pour toute la table Produits (admin) — évite le
  // N+1 (un /:id/full par produit) qui devenait lourd passé une centaine
  // de fiches.
  adminList() {
    return this.prisma.product.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        category: true,
        manufacturer: true,
        packagingUnit: true,
        images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
        prices: { include: { priceTierType: true } },
        promotions: { include: { priceTierType: true }, orderBy: { startDate: 'desc' } },
      },
    });
  }

  async getFullById(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: {
        category: true,
        manufacturer: true,
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
      costPrice: Prisma.Decimal | null;
      isNew: boolean;
      isFeatured: boolean;
      isSeasonal: boolean;
      isClearance: boolean;
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
      manufacturer: { id: string; name: string } | null;
      depot: string | null;
    },
    prices: VisiblePrice[],
    permissions: string[] | null,
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
      costPrice: permissions?.includes('costs.view') && product.costPrice != null ? Number(product.costPrice) : null,
      images: product.images,
      isNew: product.isNew,
      isFeatured: product.isFeatured,
      isSeasonal: product.isSeasonal,
      isClearance: product.isClearance,
      createdAt: product.createdAt,
      availability: product.currentStock > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK',
      currentStock: permissions?.includes('stock.manage') ? product.currentStock : null,
      // Fournisseur et emplacement d'entrepôt — informations internes,
      // jamais montrées à un client (même logique que costPrice/currentStock).
      manufacturer: permissions?.includes('suppliers.view') ? product.manufacturer : null,
      depot: permissions?.includes('stock.manage') ? product.depot : null,
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
        manufacturerId: dto.manufacturerId || null,
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

    const { prices: _prices, ...rest } = dto;
    const productData = { ...rest, manufacturerId: dto.manufacturerId || null };

    // Diff champ par champ : le journal doit dire précisément ce qui a changé
    // (et le stock/coût figés ailleurs ne doivent jamais bouger rétroactivement
    // les comptes déjà passés avec les clients ou fabricants).
    const changedFields: string[] = [];
    const oldValues: Record<string, unknown> = {};
    const newValues: Record<string, unknown> = {};
    for (const key of Object.keys(productData)) {
      if (key === 'attributes') continue;
      const oldRaw = (existing as unknown as Record<string, unknown>)[key];
      const newRaw = (productData as unknown as Record<string, unknown>)[key];
      const oldVal = (oldRaw instanceof Prisma.Decimal ? oldRaw.toString() : oldRaw) ?? null;
      const newVal = (newRaw instanceof Prisma.Decimal ? newRaw.toString() : newRaw) ?? null;
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changedFields.push(key);
        oldValues[key] = oldRaw;
        newValues[key] = newRaw;
      }
    }

    const stockDiff = changedFields.includes('currentStock')
      ? Number(productData.currentStock) - existing.currentStock
      : 0;

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.product.update({
        where: { id },
        data: {
          ...productData,
          attributes: productData.attributes as Prisma.InputJsonValue | undefined,
          seasonStart: dto.seasonStart ? new Date(dto.seasonStart) : undefined,
          seasonEnd: dto.seasonEnd ? new Date(dto.seasonEnd) : undefined,
        },
      });

      // Toute correction de stock — même faite depuis la fiche produit plutôt
      // que l'écran d'ajustement dédié — passe par le même journal de mouvements.
      if (stockDiff !== 0) {
        await tx.stockMovement.create({
          data: {
            productId: id,
            type: 'ADJUSTMENT',
            quantity: stockDiff,
            stockAfter: result.currentStock,
            reason: 'Modifié depuis la fiche produit',
            createdById: actorId,
          },
        });
      }

      return result;
    });

    if (changedFields.length > 0) {
      await this.auditLog.record({
        entityType: 'Product',
        entityId: id,
        action: 'UPDATE',
        field: changedFields.join(','),
        oldValue: oldValues,
        newValue: newValues,
        actorId,
      });
    }

    const customerFields = changedFields.filter((f) => f in CUSTOMER_NOTIFY_FIELDS);
    if (customerFields.length > 0) {
      await this.notifyCustomers(
        'product.updated',
        `Produit mis à jour : ${updated.nameFr}`,
        customerFields.map((f) => formatCustomerFieldChange(f, oldValues[f], newValues[f])).join(' · '),
        { productId: id },
      );
    }

    return updated;
  }

  /** Dernier changement connu sur ce produit (champ modifié ou prix), tous journaux confondus. */
  async getLastChange(id: string) {
    const [lastAudit, lastPrice] = await Promise.all([
      this.prisma.auditLog.findFirst({
        where: { entityType: 'Product', entityId: id },
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { fullName: true } } },
      }),
      this.prisma.priceHistory.findFirst({
        where: { productId: id },
        orderBy: { createdAt: 'desc' },
        include: { priceTierType: { select: { label: true } } },
      }),
    ]);

    const candidates: {
      at: Date;
      kind: 'field' | 'price';
      field: string | null;
      label: string | null;
      oldValue: unknown;
      newValue: unknown;
      actorId: string | null;
      actorName: string | null;
    }[] = [];

    if (lastAudit) {
      candidates.push({
        at: lastAudit.createdAt,
        kind: 'field',
        field: lastAudit.field,
        label: null,
        oldValue: lastAudit.oldValue ? JSON.parse(lastAudit.oldValue) : null,
        newValue: lastAudit.newValue ? JSON.parse(lastAudit.newValue) : null,
        actorId: lastAudit.actorId,
        actorName: lastAudit.actor?.fullName ?? null,
      });
    }
    if (lastPrice) {
      candidates.push({
        at: lastPrice.createdAt,
        kind: 'price',
        field: 'price',
        label: lastPrice.priceTierType.label,
        oldValue: lastPrice.oldPrice != null ? Number(lastPrice.oldPrice) : null,
        newValue: Number(lastPrice.newPrice),
        actorId: lastPrice.changedById,
        actorName: null,
      });
    }

    candidates.sort((a, b) => b.at.getTime() - a.at.getTime());
    const top = candidates[0];
    if (!top) return null;

    if (!top.actorName && top.actorId) {
      const actor = await this.prisma.user.findUnique({ where: { id: top.actorId }, select: { fullName: true } });
      top.actorName = actor?.fullName ?? null;
    }
    return top;
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

    const tierType = await this.prisma.priceTierType.findUnique({ where: { id: dto.priceTierTypeId }, select: { label: true } });
    await this.notifyCustomers(
      'product.price_changed',
      `Prix mis à jour : ${product.nameFr}`,
      `${tierType?.label ?? 'Prix'} : ${Number(dto.price).toLocaleString('fr-FR')} DA`,
      { productId },
    );

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

  private formatDiscount(discountType: 'PERCENT' | 'AMOUNT', discountValue: Prisma.Decimal | number): string {
    return discountType === 'PERCENT' ? `-${Number(discountValue)}%` : `-${Number(discountValue).toLocaleString('fr-FR')} DA`;
  }

  async addPromotion(productId: string, dto: UpsertPromotionDto) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, deletedAt: null } });
    if (!product) throw new NotFoundException('Produit introuvable');

    const promotion = await this.prisma.promotion.create({
      data: {
        productId,
        priceTierTypeId: dto.priceTierTypeId,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        isActive: dto.isActive ?? true,
      },
      include: { priceTierType: true },
    });

    await this.notifyCustomers(
      'product.promotion_added',
      `Nouvelle promotion : ${product.nameFr}`,
      `${promotion.priceTierType.label} : ${this.formatDiscount(promotion.discountType, promotion.discountValue)}`,
      { productId },
    );

    return promotion;
  }

  async updatePromotion(promotionId: string, dto: UpsertPromotionDto) {
    const promotion = await this.prisma.promotion.findUnique({ where: { id: promotionId }, include: { product: true } });
    if (!promotion) throw new NotFoundException('Promotion introuvable');

    const updated = await this.prisma.promotion.update({
      where: { id: promotionId },
      data: {
        priceTierTypeId: dto.priceTierTypeId,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        isActive: dto.isActive ?? promotion.isActive,
      },
      include: { priceTierType: true },
    });

    await this.notifyCustomers(
      'product.promotion_updated',
      `Promotion mise à jour : ${promotion.product.nameFr}`,
      `${updated.priceTierType.label} : ${this.formatDiscount(updated.discountType, updated.discountValue)}`,
      { productId: promotion.productId },
    );

    return updated;
  }

  async removePromotion(promotionId: string) {
    const promotion = await this.prisma.promotion.findUnique({ where: { id: promotionId }, include: { product: true } });
    if (!promotion) throw new NotFoundException('Promotion introuvable');

    await this.prisma.promotion.delete({ where: { id: promotionId } });

    await this.notifyCustomers(
      'product.promotion_removed',
      `Promotion supprimée : ${promotion.product.nameFr}`,
      `La promotion sur ${promotion.product.nameFr} a été retirée.`,
      { productId: promotion.productId },
    );

    return { id: promotionId };
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
