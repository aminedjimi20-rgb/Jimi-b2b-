import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { runOrExplainForeignKeyError } from '../common/prisma-errors.util';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { SearchCatalogDto } from './dto/search-catalog.dto';
import { ProductDerivedInfo, toAdminProductDTO, toClientProductDTO, toEmployeeProductDTO } from './dto/product-response.dto';
import { computeImageHash, hammingDistance } from './image-hash.util';
import { computeActivePromoInfo, productHasActivePromo } from '../promotions/active-promotions.util';

const PRODUCT_INCLUDE = {
  images: true,
  priceTiers: true,
  fabricant: true,
  salePrices: { include: { priceCategory: true } },
} as const;

// A dHash is 64 bits; empirically a Hamming distance under ~12 means
// "visually similar enough to be the same or a related product photo".
const IMAGE_SEARCH_MAX_DISTANCE = 16;

export type ProductSortBy = 'nom' | 'stock' | 'prix' | 'dernierChangement' | 'dernierArrivage' | 'nouveautes' | 'saisonnier';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private prisma: PrismaService,
    private pricing: PricingService,
  ) {}

  // ── ADMIN ────────────────────────────────────────────────────────────

  async create(dto: CreateProductDto) {
    const existing = await this.prisma.product.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException('Ce code produit existe déjà.');

    const imageInputs = await this.buildImageCreateInputs(dto.imageUrls ?? [], true);

    const product = await this.prisma.product.create({
      data: {
        nom: dto.nom,
        code: dto.code,
        categoryId: dto.categoryId,
        fabricantId: dto.fabricantId,
        description: dto.description,
        taille: dto.taille,
        couleur: dto.couleur,
        marque: dto.marque,
        prixAchat: dto.prixAchat,
        prixVente: dto.prixVente,
        stockReel: dto.stockReel,
        stockMinimum: dto.stockMinimum,
        minCommande: dto.minCommande,
        uniteParCarton: dto.uniteParCarton,
        actif: dto.actif ?? true,
        estNouveau: dto.estNouveau ?? false,
        estSaisonnier: dto.estSaisonnier ?? false,
        imageHash: imageInputs[0]?.hash,
        images: imageInputs.length ? { create: imageInputs } : undefined,
        priceTiers: dto.priceTiers ? { create: dto.priceTiers } : undefined,
        salePrices: dto.salePrices ? { create: dto.salePrices } : undefined,
      },
      include: PRODUCT_INCLUDE,
    });

    if (dto.stockReel > 0) {
      await this.prisma.stockMovement.create({
        data: { productId: product.id, type: 'ENTREE', quantite: dto.stockReel, motif: 'Stock initial' },
      });
    }

    // Baseline snapshot — every later price edit compares against this.
    await this.prisma.productPriceHistory.create({
      data: { productId: product.id, prixAchat: product.prixAchat, prixVente: product.prixVente },
    });

    return toAdminProductDTO(product, await this.computeDerivedInfo(product.id));
  }

  async update(id: string, dto: UpdateProductDto) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Produit introuvable.');

    if (dto.code && dto.code !== existing.code) {
      const codeTaken = await this.prisma.product.findUnique({ where: { code: dto.code } });
      if (codeTaken) throw new ConflictException('Ce code produit existe déjà.');
    }

    const imageInputs = await this.buildImageCreateInputs(dto.imageUrls ?? [], false);

    const prixAchat = dto.prixAchat ?? existing.prixAchat.toNumber();
    const prixVente = dto.prixVente ?? existing.prixVente.toNumber();
    const priceChanged = dto.prixAchat !== undefined || dto.prixVente !== undefined
      ? !existing.prixAchat.equals(prixAchat) || !existing.prixVente.equals(prixVente)
      : false;

    const product = await this.prisma.product.update({
      where: { id },
      data: {
        nom: dto.nom,
        code: dto.code,
        categoryId: dto.categoryId,
        fabricantId: dto.fabricantId,
        description: dto.description,
        taille: dto.taille,
        couleur: dto.couleur,
        marque: dto.marque,
        prixAchat: dto.prixAchat,
        prixVente: dto.prixVente,
        stockMinimum: dto.stockMinimum,
        minCommande: dto.minCommande,
        uniteParCarton: dto.uniteParCarton,
        actif: dto.actif,
        estNouveau: dto.estNouveau,
        estSaisonnier: dto.estSaisonnier,
        // stockReel is intentionally NOT editable here — it only changes via
        // recorded StockMovement entries (see StockService), so the audit
        // trail always explains every change in real quantity.
        // New photos are appended (not a replace) — removing a photo is a
        // separate explicit action, never implied by an unrelated edit.
        images: imageInputs.length ? { create: imageInputs } : undefined,
        // Present (even empty) replaces the whole list — "Prix de vente 1/2/3...".
        salePrices: dto.salePrices
          ? { deleteMany: {}, create: dto.salePrices }
          : undefined,
      },
      include: PRODUCT_INCLUDE,
    });

    if (priceChanged) {
      await this.prisma.productPriceHistory.create({
        data: { productId: id, prixAchat: product.prixAchat, prixVente: product.prixVente },
      });
    }

    return toAdminProductDTO(product, await this.computeDerivedInfo(id));
  }

  // Moves to the corbeille — independent of `actif` (catalog visibility),
  // which stays untouched so restoring brings the product back exactly as
  // it was, visible or not.
  async remove(id: string) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) throw new NotFoundException('Produit introuvable.');
    await this.prisma.product.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async findAllForAdmin(categoryId?: string, sortBy?: ProductSortBy) {
    const products = await this.prisma.product.findMany({
      where: { deletedAt: null, ...(categoryId ? { categoryId } : {}) },
      include: PRODUCT_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });

    const [lastEntryByProduct, lastPriceChangeByProduct, promoInfo] = await Promise.all([
      this.lastEntryDateByProduct(),
      this.lastPriceChangeByProduct(),
      computeActivePromoInfo(this.prisma),
    ]);

    const withDerived = products.map((product) => ({
      product,
      dto: toAdminProductDTO(product, {
        dernierChangementPrix: lastPriceChangeByProduct.get(product.id) ?? null,
        dernierArrivage: lastEntryByProduct.get(product.id) ?? null,
        estPromo: productHasActivePromo(promoInfo, product.id),
      }),
    }));

    return this.sortProducts(withDerived, sortBy).map((x) => x.dto);
  }

  async findOneForAdmin(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id }, include: PRODUCT_INCLUDE });
    if (!product || product.deletedAt) throw new NotFoundException('Produit introuvable.');
    return toAdminProductDTO(product, await this.computeDerivedInfo(id));
  }

  // ── EMPLOYEE ─────────────────────────────────────────────────────────

  async findAllForEmployee() {
    const products = await this.prisma.product.findMany({
      where: { deletedAt: null, actif: true, category: { visibleToEmployee: true } },
      include: PRODUCT_INCLUDE,
      orderBy: { nom: 'asc' },
    });
    return Promise.all(products.map(async (p) => toEmployeeProductDTO(p, await this.computeDerivedInfo(p.id))));
  }

  async findOneForEmployee(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id }, include: PRODUCT_INCLUDE });
    if (!product || product.deletedAt || !product.actif) throw new NotFoundException('Produit introuvable.');
    return toEmployeeProductDTO(product, await this.computeDerivedInfo(id));
  }

  private sortProducts<T extends { product: { nom: string; stockReel: number; prixVente: Prisma.Decimal; estNouveau: boolean; estSaisonnier: boolean }; dto: { dernierChangementPrix: Date | null; dernierArrivage: Date | null } }>(
    items: T[],
    sortBy?: ProductSortBy,
  ): T[] {
    const byDateDesc = (a: Date | null, b: Date | null) => {
      if (a == null && b == null) return 0;
      if (a == null) return 1;
      if (b == null) return -1;
      return b.getTime() - a.getTime();
    };

    switch (sortBy) {
      case 'nom':
        return [...items].sort((a, b) => a.product.nom.localeCompare(b.product.nom));
      case 'stock':
        return [...items].sort((a, b) => b.product.stockReel - a.product.stockReel);
      case 'prix':
        return [...items].sort((a, b) => b.product.prixVente.comparedTo(a.product.prixVente));
      case 'dernierChangement':
        return [...items].sort((a, b) => byDateDesc(a.dto.dernierChangementPrix, b.dto.dernierChangementPrix));
      case 'dernierArrivage':
        return [...items].sort((a, b) => byDateDesc(a.dto.dernierArrivage, b.dto.dernierArrivage));
      case 'nouveautes':
        return [...items].sort((a, b) => Number(b.product.estNouveau) - Number(a.product.estNouveau));
      case 'saisonnier':
        return [...items].sort((a, b) => Number(b.product.estSaisonnier) - Number(a.product.estSaisonnier));
      default:
        return items;
    }
  }

  private async computeDerivedInfo(productId: string): Promise<ProductDerivedInfo> {
    const [lastEntry, lastPriceChange, promoInfo] = await Promise.all([
      this.prisma.stockMovement.findFirst({ where: { productId, type: 'ENTREE' }, orderBy: { createdAt: 'desc' } }),
      this.prisma.productPriceHistory.findFirst({ where: { productId }, orderBy: { changedAt: 'desc' } }),
      computeActivePromoInfo(this.prisma),
    ]);
    return {
      dernierArrivage: lastEntry?.createdAt ?? null,
      dernierChangementPrix: lastPriceChange?.changedAt ?? null,
      estPromo: productHasActivePromo(promoInfo, productId),
    };
  }

  private async lastEntryDateByProduct(): Promise<Map<string, Date>> {
    const groups = await this.prisma.stockMovement.groupBy({
      by: ['productId'],
      where: { type: 'ENTREE' },
      _max: { createdAt: true },
    });
    return new Map(groups.filter((g) => g._max.createdAt).map((g) => [g.productId, g._max.createdAt!]));
  }

  private async lastPriceChangeByProduct(): Promise<Map<string, Date>> {
    const groups = await this.prisma.productPriceHistory.groupBy({
      by: ['productId'],
      _max: { changedAt: true },
    });
    return new Map(groups.filter((g) => g._max.changedAt).map((g) => [g.productId, g._max.changedAt!]));
  }

  // ── Corbeille ────────────────────────────────────────────────────────

  async findTrash() {
    const products = await this.prisma.product.findMany({
      where: { deletedAt: { not: null } },
      include: PRODUCT_INCLUDE,
      orderBy: { deletedAt: 'desc' },
    });
    return Promise.all(products.map(async (p) => toAdminProductDTO(p, await this.computeDerivedInfo(p.id))));
  }

  async restore(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product || !product.deletedAt) throw new NotFoundException('Produit introuvable dans la corbeille.');
    await this.prisma.product.update({ where: { id }, data: { deletedAt: null } });
  }

  async permanentDelete(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product || !product.deletedAt) throw new NotFoundException('Produit introuvable dans la corbeille.');

    await runOrExplainForeignKeyError(
      () => this.prisma.product.delete({ where: { id } }),
      'Impossible de supprimer définitivement : des commandes ou bons de réception référencent encore ce produit.',
    );
  }

  async setCustomPrice(productId: string, clientId: string, prix: number) {
    await this.assertProductExists(productId);
    return this.prisma.clientProductPrice.upsert({
      where: { clientId_productId: { clientId, productId } },
      create: { clientId, productId, prix },
      update: { prix },
    });
  }

  // ── CLIENT ───────────────────────────────────────────────────────────

  async searchCatalogForClient(clientId: string, query: SearchCatalogDto) {
    const where: Prisma.ProductWhereInput = {
      actif: true,
      deletedAt: null,
      category: { visibleToClient: true },
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.q
        ? {
            OR: [
              { nom: { contains: query.q, mode: 'insensitive' } },
              { code: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const products = await this.prisma.product.findMany({ where, include: PRODUCT_INCLUDE });
    const promoInfo = await computeActivePromoInfo(this.prisma);

    const resolved = await Promise.all(
      products.map(async (product) => {
        const price = await this.pricing.resolvePrice(clientId, product.id, product.minCommande);
        const status = this.pricing.stockStatus(product.stockReel, product.stockMinimum);
        const estPromo = productHasActivePromo(promoInfo, product.id);
        return toClientProductDTO(product, price, status, estPromo);
      }),
    );

    const filtered = resolved.filter((p) => {
      if (query.prixMin != null && p.prix.lessThan(query.prixMin)) return false;
      if (query.prixMax != null && p.prix.greaterThan(query.prixMax)) return false;
      return true;
    });

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const start = (page - 1) * pageSize;

    return {
      items: filtered.slice(start, start + pageSize),
      total: filtered.length,
      page,
      pageSize,
    };
  }

  async getProductForClient(clientId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, actif: true, deletedAt: null },
      include: PRODUCT_INCLUDE,
    });
    if (!product) throw new NotFoundException('Produit introuvable.');

    const price = await this.pricing.resolvePrice(clientId, productId, product.minCommande);
    const status = this.pricing.stockStatus(product.stockReel, product.stockMinimum);
    const promoInfo = await computeActivePromoInfo(this.prisma);
    const estPromo = productHasActivePromo(promoInfo, productId);
    return toClientProductDTO(product, price, status, estPromo);
  }

  /** Client uploads a photo of a product they're holding — matched against stored product photo hashes. */
  async searchByImage(clientId: string, buffer: Buffer) {
    const matches = await this.matchProductsByImage(buffer);
    if (matches.length === 0) return [];

    const products = await this.prisma.product.findMany({
      where: { id: { in: matches.map(([productId]) => productId) } },
      include: PRODUCT_INCLUDE,
    });

    const distanceByProductId = new Map(matches);
    const promoInfo = await computeActivePromoInfo(this.prisma);
    const results = await Promise.all(
      products.map(async (product) => {
        const price = await this.pricing.resolvePrice(clientId, product.id, product.minCommande);
        const status = this.pricing.stockStatus(product.stockReel, product.stockMinimum);
        const distance = distanceByProductId.get(product.id)!;
        const estPromo = productHasActivePromo(promoInfo, product.id);
        return {
          ...toClientProductDTO(product, price, status, estPromo),
          matchScore: Math.round((1 - distance / 64) * 100),
        };
      }),
    );

    return results.sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * Admin/staff variant of searchByImage — same perceptual-hash matching,
   * but the full admin product shape (prixAchat/marge included) since this
   * is used from internal tools: checking whether a product already exists
   * before adding it to a bon de réception, browsing the product list by
   * photo, or a general "what is this" search. Never exposed to Client.
   */
  async searchByImageForAdmin(buffer: Buffer) {
    const matches = await this.matchProductsByImage(buffer);
    if (matches.length === 0) return [];

    const products = await this.prisma.product.findMany({
      where: { id: { in: matches.map(([productId]) => productId) } },
      include: PRODUCT_INCLUDE,
    });

    const distanceByProductId = new Map(matches);
    const promoInfo = await computeActivePromoInfo(this.prisma);
    const results = products.map((product) => {
      const distance = distanceByProductId.get(product.id)!;
      return {
        ...toAdminProductDTO(product, {
          dernierChangementPrix: null,
          dernierArrivage: null,
          estPromo: productHasActivePromo(promoInfo, product.id),
        }),
        matchScore: Math.round((1 - distance / 64) * 100),
      };
    });

    return results.sort((a, b) => b.matchScore - a.matchScore);
  }

  /** Shared core of searchByImage/searchByImageForAdmin — hashes the query photo and returns the best-matching productIds, closest first. */
  private async matchProductsByImage(buffer: Buffer) {
    const queryHash = await computeImageHash(buffer);

    const images = await this.prisma.productImage.findMany({
      where: { hash: { not: null }, product: { actif: true, deletedAt: null } },
      select: { hash: true, productId: true },
    });

    const bestDistanceByProduct = new Map<string, number>();
    for (const img of images) {
      const distance = hammingDistance(queryHash, img.hash!);
      const current = bestDistanceByProduct.get(img.productId);
      if (current === undefined || distance < current) bestDistanceByProduct.set(img.productId, distance);
    }

    return [...bestDistanceByProduct.entries()]
      .filter(([, distance]) => distance <= IMAGE_SEARCH_MAX_DISTANCE)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 10);
  }

  /**
   * Computes a perceptual hash for each newly uploaded image so it can
   * later be matched by ProductsService.searchByImage. Only images that
   * were uploaded through UploadsController (and therefore live under
   * ./uploads/products locally) can be hashed here; an externally hosted
   * URL is stored as-is with no hash (search-by-image just won't match it).
   */
  private async buildImageCreateInputs(urls: string[], primaryFirst: boolean) {
    const inputs = await Promise.all(
      urls.map(async (url, i) => {
        const hash = await this.tryComputeHashForUrl(url);
        return { url, isPrimary: primaryFirst && i === 0, hash };
      }),
    );
    return inputs;
  }

  private async tryComputeHashForUrl(url: string): Promise<string | null> {
    try {
      const pathname = new URL(url, 'http://localhost').pathname;
      const prefix = '/uploads/products/';
      if (!pathname.startsWith(prefix)) return null;

      const filename = pathname.slice(prefix.length);
      const localPath = join(process.cwd(), 'uploads', 'products', filename);
      const buffer = await readFile(localPath);
      return computeImageHash(buffer);
    } catch (error) {
      this.logger.warn(`Impossible de calculer le hash d'image pour ${url}: ${(error as Error).message}`);
      return null;
    }
  }

  private async assertProductExists(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Produit introuvable.');
  }
}
