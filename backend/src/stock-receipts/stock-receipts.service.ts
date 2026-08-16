import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SequencesService } from '../common/sequences/sequences.service';
import { runOrExplainForeignKeyError } from '../common/prisma-errors.util';
import { CreateStockReceiptDto } from './dto/create-stock-receipt.dto';
import { toStockReceiptDTO } from './dto/stock-receipt-response.dto';

const RECEIPT_INCLUDE = {
  fabricant: true,
  items: { include: { product: { include: { images: true } } } },
} as const;

@Injectable()
export class StockReceiptsService {
  constructor(
    private prisma: PrismaService,
    private sequences: SequencesService,
  ) {}

  async create(dto: CreateStockReceiptDto) {
    const fabricant = await this.prisma.fabricant.findUnique({ where: { id: dto.fabricantId } });
    if (!fabricant) throw new NotFoundException('Fabricant introuvable.');

    const products = await this.prisma.product.findMany({
      where: { id: { in: dto.items.map((i) => i.productId) } },
    });
    if (products.length !== dto.items.length) {
      throw new BadRequestException('Un ou plusieurs produits sont introuvables.');
    }

    const reference = await this.generateReference();
    let total = new Prisma.Decimal(0);
    let totalAchat = new Prisma.Decimal(0);
    const itemsData = dto.items.map((item) => {
      const quantite = item.cartons * item.unitesParCarton;
      total = total.plus(new Prisma.Decimal(item.prixVente).mul(quantite));
      totalAchat = totalAchat.plus(new Prisma.Decimal(item.prixAchat).mul(quantite));
      return {
        productId: item.productId,
        cartons: item.cartons,
        unitesParCarton: item.unitesParCarton,
        quantite,
        prixAchat: item.prixAchat,
        prixVente: item.prixVente,
      };
    });

    const receipt = await this.prisma.$transaction(async (tx) => {
      const created = await tx.stockReceipt.create({
        data: {
          reference,
          fabricantId: dto.fabricantId,
          notes: dto.notes,
          total,
          totalAchat,
          items: { create: itemsData },
        },
      });

      for (const item of itemsData) {
        await tx.product.update({ where: { id: item.productId }, data: { stockReel: { increment: item.quantite } } });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: 'ENTREE',
            quantite: item.quantite,
            stockReceiptId: created.id,
            motif: `Réception ${reference} — ${fabricant.nom}`,
          },
        });
      }

      return created;
    });

    return this.findOne(receipt.id);
  }

  async findAll() {
    const receipts = await this.prisma.stockReceipt.findMany({
      where: { deletedAt: null },
      include: RECEIPT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return receipts.map(toStockReceiptDTO);
  }

  async findOne(id: string) {
    const receipt = await this.prisma.stockReceipt.findUnique({ where: { id }, include: RECEIPT_INCLUDE });
    if (!receipt || receipt.deletedAt) throw new NotFoundException('Bon de réception introuvable.');
    return toStockReceiptDTO(receipt);
  }

  // ── Corbeille ────────────────────────────────────────────────────────

  async findTrash() {
    const receipts = await this.prisma.stockReceipt.findMany({
      where: { deletedAt: { not: null } },
      include: RECEIPT_INCLUDE,
      orderBy: { deletedAt: 'desc' },
    });
    return receipts.map(toStockReceiptDTO);
  }

  // Moves to the corbeille and undoes the stock this receipt had added — if
  // some of that stock has since been sold, stockReel can end up below the
  // amount this receipt contributed, which is an accurate signal to
  // recount, not an error, so it's allowed to go negative rather than blocked.
  async remove(id: string) {
    const receipt = await this.getActiveWithItems(id);
    await this.prisma.$transaction(async (tx) => {
      for (const item of receipt.items) {
        await tx.product.update({ where: { id: item.productId }, data: { stockReel: { decrement: item.quantite } } });
      }
      await tx.stockReceipt.update({ where: { id }, data: { deletedAt: new Date() } });
    });
  }

  // Restores from the corbeille and re-applies the stock it had added —
  // symmetric with `remove`, safe because nothing else can touch a
  // trashed receipt's items while it sits in the corbeille.
  async restore(id: string) {
    const receipt = await this.prisma.stockReceipt.findUnique({ where: { id }, include: { items: true } });
    if (!receipt || !receipt.deletedAt) throw new NotFoundException('Bon de réception introuvable dans la corbeille.');

    await this.prisma.$transaction(async (tx) => {
      for (const item of receipt.items) {
        await tx.product.update({ where: { id: item.productId }, data: { stockReel: { increment: item.quantite } } });
      }
      await tx.stockReceipt.update({ where: { id }, data: { deletedAt: null } });
    });
  }

  async permanentDelete(id: string) {
    const receipt = await this.prisma.stockReceipt.findUnique({ where: { id } });
    if (!receipt || !receipt.deletedAt) throw new NotFoundException('Bon de réception introuvable dans la corbeille.');

    await runOrExplainForeignKeyError(
      () => this.prisma.stockReceipt.delete({ where: { id } }),
      'Impossible de supprimer définitivement : des paiements sont encore enregistrés sur ce bon.',
    );
  }

  private async getActiveWithItems(id: string) {
    const receipt = await this.prisma.stockReceipt.findUnique({ where: { id }, include: { items: true } });
    if (!receipt || receipt.deletedAt) throw new NotFoundException('Bon de réception introuvable.');
    return receipt;
  }

  /** Human-readable, sequential, unique per year: BR-2026-0001, BR-2026-0002, ... */
  private async generateReference(): Promise<string> {
    const year = new Date().getFullYear();
    const n = await this.sequences.next(`BR-${year}`);
    return `BR-${year}-${String(n).padStart(4, '0')}`;
  }
}
