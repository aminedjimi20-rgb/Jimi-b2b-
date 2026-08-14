import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { SearchCatalogDto } from './dto/search-catalog.dto';
import { toAdminProductDTO, toClientProductDTO } from './dto/product-response.dto';

const PRODUCT_INCLUDE = { images: true, priceTiers: true } as const;

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private pricing: PricingService,
  ) {}

  // ── ADMIN ────────────────────────────────────────────────────────────

  async create(dto: CreateProductDto) {
    const existing = await this.prisma.product.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException('Ce code produit existe déjà.');

    const product = await this.prisma.product.create({
      data: {
        nom: dto.nom,
        code: dto.code,
        categoryId: dto.categoryId,
        description: dto.description,
        taille: dto.taille,
        couleur: dto.couleur,
        marque: dto.marque,
        prixAchat: dto.prixAchat,
        prixVente: dto.prixVente,
        stockReel: dto.stockReel,
        stockMinimum: dto.stockMinimum,
        minCommande: dto.minCommande,
        actif: dto.actif ?? true,
        images: dto.imageUrls
          ? { create: dto.imageUrls.map((url, i) => ({ url, isPrimary: i === 0 })) }
          : undefined,
        priceTiers: dto.priceTiers ? { create: dto.priceTiers } : undefined,
      },
      include: PRODUCT_INCLUDE,
    });

    if (dto.stockReel > 0) {
      await this.prisma.stockMovement.create({
        data: { productId: product.id, type: 'ENTREE', quantite: dto.stockReel, motif: 'Stock initial' },
      });
    }

    return toAdminProductDTO(product);
  }

  async update(id: string, dto: UpdateProductDto) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Produit introuvable.');

    if (dto.code && dto.code !== existing.code) {
      const codeTaken = await this.prisma.product.findUnique({ where: { code: dto.code } });
      if (codeTaken) throw new ConflictException('Ce code produit existe déjà.');
    }

    const product = await this.prisma.product.update({
      where: { id },
      data: {
        nom: dto.nom,
        code: dto.code,
        categoryId: dto.categoryId,
        description: dto.description,
        taille: dto.taille,
        couleur: dto.couleur,
        marque: dto.marque,
        prixAchat: dto.prixAchat,
        prixVente: dto.prixVente,
        stockMinimum: dto.stockMinimum,
        minCommande: dto.minCommande,
        actif: dto.actif,
        // stockReel is intentionally NOT editable here — it only changes via
        // recorded StockMovement entries (see StockService), so the audit
        // trail always explains every change in real quantity.
        // New photos are appended (not a replace) — removing a photo is a
        // separate explicit action, never implied by an unrelated edit.
        images: dto.imageUrls?.length ? { create: dto.imageUrls.map((url) => ({ url, isPrimary: false })) } : undefined,
      },
      include: PRODUCT_INCLUDE,
    });

    return toAdminProductDTO(product);
  }

  async remove(id: string) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Produit introuvable.');
    await this.prisma.product.update({ where: { id }, data: { actif: false } });
  }

  async findAllForAdmin(categoryId?: string) {
    const products = await this.prisma.product.findMany({
      where: categoryId ? { categoryId } : undefined,
      include: PRODUCT_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });
    return products.map(toAdminProductDTO);
  }

  async findOneForAdmin(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id }, include: PRODUCT_INCLUDE });
    if (!product) throw new NotFoundException('Produit introuvable.');
    return toAdminProductDTO(product);
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

    const resolved = await Promise.all(
      products.map(async (product) => {
        const price = await this.pricing.resolvePrice(clientId, product.id, product.minCommande);
        const status = this.pricing.stockStatus(product.stockReel, product.stockMinimum);
        return toClientProductDTO(product, price, status);
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
      where: { id: productId, actif: true },
      include: PRODUCT_INCLUDE,
    });
    if (!product) throw new NotFoundException('Produit introuvable.');

    const price = await this.pricing.resolvePrice(clientId, productId, product.minCommande);
    const status = this.pricing.stockStatus(product.stockReel, product.stockMinimum);
    return toClientProductDTO(product, price, status);
  }

  private async assertProductExists(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Produit introuvable.');
  }
}
