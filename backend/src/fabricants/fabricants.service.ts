import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { runOrExplainForeignKeyError } from '../common/prisma-errors.util';
import { clampedRemainder, computePaymentStatus } from '../common/payment-status.util';
import { CreateFabricantDto } from './dto/create-fabricant.dto';

@Injectable()
export class FabricantsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const fabricants = await this.prisma.fabricant.findMany({
      where: { deletedAt: null },
      orderBy: { nom: 'asc' },
      include: { _count: { select: { products: true } } },
    });
    return fabricants.map(({ _count, ...f }) => ({ ...f, productCount: _count.products }));
  }

  /** Full fiche — info, articles associés, bons de réception, paiements, et les totaux dérivés. */
  async findOneForAdmin(id: string) {
    const fabricant = await this.prisma.fabricant.findUnique({
      where: { id },
      include: {
        products: { where: { deletedAt: null }, orderBy: { nom: 'asc' }, include: { images: true } },
        receipts: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!fabricant || fabricant.deletedAt) throw new NotFoundException('Fournisseur introuvable.');

    const totalAchat = fabricant.receipts.reduce((sum, r) => sum.plus(r.totalAchat), new Prisma.Decimal(0));
    const totalPaye = fabricant.receipts.reduce((sum, r) => sum.plus(r.montantPaye), new Prisma.Decimal(0));

    return {
      id: fabricant.id,
      nom: fabricant.nom,
      telephone: fabricant.telephone,
      adresse: fabricant.adresse,
      createdAt: fabricant.createdAt,
      totalAchat,
      totalPaye,
      totalRestant: clampedRemainder(totalAchat, totalPaye),
      products: fabricant.products.map((p) => ({
        id: p.id,
        nom: p.nom,
        code: p.code,
        prixAchat: p.prixAchat,
        prixVente: p.prixVente,
        stockReel: p.stockReel,
        imageUrl: p.images.find((i) => i.isPrimary)?.url ?? p.images[0]?.url ?? null,
      })),
      receipts: fabricant.receipts.map((r) => ({
        id: r.id,
        reference: r.reference,
        createdAt: r.createdAt,
        totalAchat: r.totalAchat,
        montantPaye: r.montantPaye,
        montantRestant: clampedRemainder(r.totalAchat, r.montantPaye),
        statutPaiement: computePaymentStatus(r.montantPaye, r.totalAchat),
      })),
      payments: fabricant.payments.map((p) => ({
        id: p.id,
        montant: p.montant,
        method: p.method,
        stockReceiptId: p.stockReceiptId,
        createdAt: p.createdAt,
      })),
    };
  }

  async create(dto: CreateFabricantDto) {
    return this.prisma.fabricant.create({ data: dto });
  }

  async update(id: string, dto: Partial<CreateFabricantDto>) {
    await this.assertActiveExists(id);
    return this.prisma.fabricant.update({ where: { id }, data: dto });
  }

  /** Associates an existing product with this fournisseur (searched, not browsed from the full catalogue). */
  async associateProduct(fabricantId: string, productId: string) {
    await this.assertActiveExists(fabricantId);
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.deletedAt) throw new NotFoundException('Produit introuvable.');
    await this.prisma.product.update({ where: { id: productId }, data: { fabricantId } });
  }

  async dissociateProduct(fabricantId: string, productId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.fabricantId !== fabricantId) {
      throw new NotFoundException("Ce produit n'est pas associé à ce fournisseur.");
    }
    await this.prisma.product.update({ where: { id: productId }, data: { fabricantId: null } });
  }

  // ── Corbeille ────────────────────────────────────────────────────────

  async findTrash() {
    const fabricants = await this.prisma.fabricant.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
      include: { _count: { select: { products: true } } },
    });
    return fabricants.map(({ _count, ...f }) => ({ ...f, productCount: _count.products }));
  }

  async remove(id: string) {
    await this.assertActiveExists(id);
    await this.prisma.fabricant.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async restore(id: string) {
    const fabricant = await this.prisma.fabricant.findUnique({ where: { id } });
    if (!fabricant || !fabricant.deletedAt) throw new NotFoundException('Fabricant introuvable dans la corbeille.');
    await this.prisma.fabricant.update({ where: { id }, data: { deletedAt: null } });
  }

  async permanentDelete(id: string) {
    const fabricant = await this.prisma.fabricant.findUnique({ where: { id } });
    if (!fabricant || !fabricant.deletedAt) throw new NotFoundException('Fabricant introuvable dans la corbeille.');

    await runOrExplainForeignKeyError(
      () => this.prisma.fabricant.delete({ where: { id } }),
      'Impossible de supprimer définitivement : des bons de réception ou des produits sont encore liés à ce fournisseur.',
    );
  }

  private async assertActiveExists(id: string) {
    const fabricant = await this.prisma.fabricant.findUnique({ where: { id } });
    if (!fabricant || fabricant.deletedAt) throw new NotFoundException('Fabricant introuvable.');
  }
}
