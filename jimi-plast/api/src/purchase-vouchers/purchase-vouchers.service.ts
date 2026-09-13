import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { NumberSequenceService } from '../common/services/number-sequence.service';
import { UpsertPurchaseVoucherDto } from './dto/upsert-purchase-voucher.dto';
import { CancelVoucherDto } from '../vouchers/dto/cancel-voucher.dto';

@Injectable()
export class PurchaseVouchersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly numberSequence: NumberSequenceService,
  ) {}

  private async debtOf(manufacturerId: string) {
    const agg = await this.prisma.supplierLedgerEntry.aggregate({ where: { manufacturerId }, _sum: { amount: true } });
    return Number(agg._sum.amount ?? 0);
  }

  list(filters: { status?: string; manufacturerId?: string }) {
    const where: Prisma.PurchaseVoucherWhereInput = {
      deletedAt: null,
      ...(filters.status ? { status: filters.status as never } : {}),
      ...(filters.manufacturerId ? { manufacturerId: filters.manufacturerId } : {}),
    };
    return this.prisma.purchaseVoucher.findMany({
      where,
      include: { manufacturer: true, buyer: { select: { fullName: true } }, items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string) {
    const voucher = await this.prisma.purchaseVoucher.findFirst({
      where: { id, deletedAt: null },
      include: {
        manufacturer: true,
        buyer: { select: { fullName: true } },
        items: { include: { product: true, packagingUnit: true } },
      },
    });
    if (!voucher) throw new NotFoundException('Bon d’achat introuvable');
    return voucher;
  }

  async createDraft(manufacturerId: string, buyerId: string) {
    const manufacturer = await this.prisma.manufacturer.findFirst({ where: { id: manufacturerId, deletedAt: null } });
    if (!manufacturer) throw new BadRequestException('Fabricant introuvable');

    const voucher = await this.prisma.purchaseVoucher.create({ data: { manufacturerId, buyerId, status: 'DRAFT' } });
    return this.getById(voucher.id);
  }

  async update(id: string, dto: UpsertPurchaseVoucherDto, actorId: string) {
    const voucher = await this.prisma.purchaseVoucher.findFirst({ where: { id, deletedAt: null } });
    if (!voucher) throw new NotFoundException('Bon d’achat introuvable');
    if (voucher.status !== 'DRAFT') throw new BadRequestException('Seul un brouillon peut être modifié');

    await this.prisma.$transaction(async (tx) => {
      if (dto.items) {
        await tx.purchaseVoucherItem.deleteMany({ where: { voucherId: id } });
        for (const item of dto.items) {
          const product = await tx.product.findFirst({ where: { id: item.productId, deletedAt: null } });
          if (!product) throw new BadRequestException(`Produit ${item.productId} introuvable`);

          const totalUnits = item.quantityPackages * product.unitsPerPackage;
          await tx.purchaseVoucherItem.create({
            data: {
              voucherId: id,
              productId: product.id,
              packagingUnitId: product.packagingUnitId,
              quantityPackages: item.quantityPackages,
              unitsPerPackageSnapshot: product.unitsPerPackage,
              totalUnits,
              unitCost: item.unitCost,
              lineTotal: totalUnits * item.unitCost,
            },
          });
        }
      }

      await tx.purchaseVoucher.update({
        where: { id },
        data: {
          manufacturerId: dto.manufacturerId,
          discount: dto.discount,
          transportCost: dto.transportCost,
          paidAmount: dto.paidAmount,
          notes: dto.notes,
        },
      });
    });

    return this.getById(id);
  }

  private computeTotal(voucher: { items: { lineTotal: Prisma.Decimal }[]; discount: Prisma.Decimal; transportCost: Prisma.Decimal }) {
    const subtotal = voucher.items.reduce((s, i) => s + Number(i.lineTotal), 0);
    return subtotal - Number(voucher.discount) + Number(voucher.transportCost);
  }

  async confirm(id: string, actorId: string) {
    const voucher = await this.getById(id);
    if (voucher.status !== 'DRAFT') throw new BadRequestException('Ce bon a déjà été confirmé');
    if (voucher.items.length === 0) throw new BadRequestException('Le bon ne contient aucun produit');

    const total = this.computeTotal(voucher);
    const previousDebt = await this.debtOf(voucher.manufacturerId);
    const number = await this.numberSequence.next('ACH');

    await this.prisma.$transaction(async (tx) => {
      for (const item of voucher.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { currentStock: { increment: item.totalUnits }, costPrice: item.unitCost },
        });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: 'PURCHASE',
            quantity: item.totalUnits,
            referenceType: 'PurchaseVoucher',
            referenceId: voucher.id,
            createdById: actorId,
          },
        });
      }

      await tx.supplierLedgerEntry.create({
        data: { manufacturerId: voucher.manufacturerId, type: 'PURCHASE_VOUCHER', amount: total, reference: number, createdById: actorId },
      });

      if (Number(voucher.paidAmount) > 0) {
        await tx.supplierLedgerEntry.create({
          data: {
            manufacturerId: voucher.manufacturerId,
            type: 'PAYMENT',
            amount: -Number(voucher.paidAmount),
            reference: number,
            note: 'Paiement à la confirmation',
            createdById: actorId,
          },
        });
      }

      await tx.purchaseVoucher.update({ where: { id }, data: { status: 'CONFIRMED', number, confirmedAt: new Date(), previousDebt } });
    });

    await this.auditLog.record({ entityType: 'PurchaseVoucher', entityId: id, action: 'UPDATE', field: 'status', newValue: 'CONFIRMED', actorId });
    return this.getById(id);
  }

  async cancel(id: string, dto: CancelVoucherDto, actorId: string) {
    const voucher = await this.getById(id);
    if (voucher.status === 'CANCELLED') throw new BadRequestException('Ce bon est déjà annulé');

    const wasConfirmed = voucher.status === 'CONFIRMED';

    await this.prisma.$transaction(async (tx) => {
      if (wasConfirmed) {
        for (const item of voucher.items) {
          await tx.product.update({ where: { id: item.productId }, data: { currentStock: { decrement: item.totalUnits } } });
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type: 'ADJUSTMENT',
              quantity: -item.totalUnits,
              referenceType: 'PurchaseVoucher',
              referenceId: voucher.id,
              reason: `Annulation bon d'achat : ${dto.reason}`,
              createdById: actorId,
            },
          });
        }

        const total = this.computeTotal(voucher);
        const netDebt = total - Number(voucher.paidAmount);
        await tx.supplierLedgerEntry.create({
          data: {
            manufacturerId: voucher.manufacturerId,
            type: 'ADJUSTMENT',
            amount: -netDebt,
            reference: voucher.number,
            note: `Annulation du bon ${voucher.number} : ${dto.reason}`,
            createdById: actorId,
          },
        });
      }

      await tx.purchaseVoucher.update({ where: { id }, data: { status: 'CANCELLED', cancelReason: dto.reason } });
    });

    await this.auditLog.record({ entityType: 'PurchaseVoucher', entityId: id, action: 'UPDATE', field: 'status', newValue: 'CANCELLED', reason: dto.reason, actorId });
    return this.getById(id);
  }

  async remove(id: string, actorId: string) {
    const voucher = await this.prisma.purchaseVoucher.findFirst({ where: { id, deletedAt: null } });
    if (!voucher) throw new NotFoundException('Bon d’achat introuvable');
    if (voucher.status !== 'DRAFT') throw new BadRequestException('Seul un brouillon peut être supprimé');

    await this.prisma.purchaseVoucher.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.auditLog.record({ entityType: 'PurchaseVoucher', entityId: id, action: 'DELETE', actorId });
    return { id };
  }
}
