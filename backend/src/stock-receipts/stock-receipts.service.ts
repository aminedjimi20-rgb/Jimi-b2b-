import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStockReceiptDto } from './dto/create-stock-receipt.dto';
import { toStockReceiptDTO } from './dto/stock-receipt-response.dto';

const RECEIPT_INCLUDE = {
  fabricant: true,
  items: { include: { product: { include: { images: true } } } },
} as const;

@Injectable()
export class StockReceiptsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateStockReceiptDto) {
    const fabricant = await this.prisma.fabricant.findUnique({ where: { id: dto.fabricantId } });
    if (!fabricant) throw new NotFoundException('Fabricant introuvable.');

    const products = await this.prisma.product.findMany({
      where: { id: { in: dto.items.map((i) => i.productId) } },
    });
    if (products.length !== dto.items.length) {
      throw new BadRequestException('Un ou plusieurs produits sont introuvables.');
    }

    const reference = this.generateReference();
    let total = new Prisma.Decimal(0);
    const itemsData = dto.items.map((item) => {
      const quantite = item.cartons * item.unitesParCarton;
      total = total.plus(new Prisma.Decimal(item.prixVente).mul(quantite));
      return {
        productId: item.productId,
        cartons: item.cartons,
        unitesParCarton: item.unitesParCarton,
        quantite,
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
      include: RECEIPT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return receipts.map(toStockReceiptDTO);
  }

  async findOne(id: string) {
    const receipt = await this.prisma.stockReceipt.findUnique({ where: { id }, include: RECEIPT_INCLUDE });
    if (!receipt) throw new NotFoundException('Bon de réception introuvable.');
    return toStockReceiptDTO(receipt);
  }

  private generateReference(): string {
    const year = new Date().getFullYear();
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `BR-${year}-${suffix}`;
  }
}
