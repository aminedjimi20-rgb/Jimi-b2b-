import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { NumberSequenceService } from '../common/services/number-sequence.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UpsertVoucherDto } from './dto/upsert-voucher.dto';
import { CancelVoucherDto } from './dto/cancel-voucher.dto';

const ROLE_TO_TIER_KEY: Record<string, string> = {
  wholesaler: 'wholesale',
  retailer: 'retail',
};

export interface VoucherListFilters {
  status?: string;
  customerId?: string;
  hidden?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

@Injectable()
export class VouchersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly numberSequence: NumberSequenceService,
    private readonly notifications: NotificationsService,
  ) {}

  private async balanceOf(customerId: string): Promise<number> {
    const agg = await this.prisma.ledgerEntry.aggregate({ where: { customerId }, _sum: { amount: true } });
    return Number(agg._sum.amount ?? 0);
  }

  async list(filters: VoucherListFilters) {
    const where: Prisma.SalesVoucherWhereInput = {
      deletedAt: null,
      hidden: filters.hidden ?? false,
      ...(filters.status ? { status: filters.status as never } : {}),
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
      ...(filters.dateFrom || filters.dateTo
        ? {
            createdAt: {
              ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
              ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
            },
          }
        : {}),
    };

    return this.prisma.salesVoucher.findMany({
      where,
      include: {
        customer: { include: { user: { select: { fullName: true } } } },
        seller: { select: { fullName: true } },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string) {
    const voucher = await this.prisma.salesVoucher.findFirst({
      where: { id, deletedAt: null },
      include: {
        customer: { include: { user: { select: { id: true, fullName: true, phone: true } } } },
        seller: { select: { fullName: true } },
        items: { include: { product: true, priceTierType: true, packagingUnit: true } },
      },
    });
    if (!voucher) throw new NotFoundException('Bon introuvable');
    return voucher;
  }

  async createDraft(customerId: string, sellerId: string) {
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, deletedAt: null } });
    if (!customer) throw new BadRequestException('Client introuvable');

    const voucher = await this.prisma.salesVoucher.create({
      data: { customerId, sellerId, status: 'DRAFT' },
    });
    return this.getById(voucher.id);
  }

  /** Bon de commande de l'espace client — un client ne voit et ne modifie que ses propres bons. */
  async listMine(userId: string) {
    const customer = await this.prisma.customer.findUnique({ where: { userId } });
    if (!customer) return [];
    return this.list({ customerId: customer.id, hidden: false });
  }

  async getOrCreateOwnDraft(userId: string) {
    const customer = await this.prisma.customer.findUnique({ where: { userId }, include: { user: { select: { fullName: true } } } });
    if (!customer) throw new NotFoundException('Aucun dossier client associé à ce compte');

    const existingDraft = await this.prisma.salesVoucher.findFirst({
      where: { customerId: customer.id, status: 'DRAFT', deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (existingDraft) return this.getById(existingDraft.id);

    const voucher = await this.prisma.salesVoucher.create({
      data: { customerId: customer.id, sellerId: userId, status: 'DRAFT' },
    });

    await this.notifications.notify({
      type: 'order.draft_started',
      title: 'Nouvelle commande en préparation',
      body: `${customer.user.fullName} prépare une commande depuis le catalogue`,
      data: { voucherId: voucher.id },
    });

    return this.getById(voucher.id);
  }

  private async assertOwnVoucher(userId: string, id: string) {
    const voucher = await this.prisma.salesVoucher.findFirst({
      where: { id, deletedAt: null },
      include: { customer: true },
    });
    if (!voucher || voucher.customer.userId !== userId) throw new NotFoundException('Bon introuvable');
    return voucher;
  }

  async getMineById(userId: string, id: string) {
    await this.assertOwnVoucher(userId, id);
    return this.getById(id);
  }

  async updateMine(userId: string, id: string, dto: UpsertVoucherDto) {
    await this.assertOwnVoucher(userId, id);
    const { customerId: _customerId, ...rest } = dto;
    return this.update(id, rest, userId);
  }

  private async resolveTierForCustomer(customerId: string) {
    const customer = await this.prisma.customer.findUniqueOrThrow({
      where: { id: customerId },
      include: { user: { include: { role: true } } },
    });
    const tierKey = ROLE_TO_TIER_KEY[customer.user.role.key];
    if (!tierKey) {
      throw new BadRequestException(
        `Impossible de déterminer le niveau de prix pour le rôle "${customer.user.role.key}"`,
      );
    }
    const tier = await this.prisma.priceTierType.findUniqueOrThrow({ where: { key: tierKey } });
    return tier;
  }

  async update(id: string, dto: UpsertVoucherDto, actorId: string) {
    const voucher = await this.prisma.salesVoucher.findFirst({ where: { id, deletedAt: null } });
    if (!voucher) throw new NotFoundException('Bon introuvable');
    if (voucher.status !== 'DRAFT') {
      throw new BadRequestException('Seul un brouillon peut être modifié librement');
    }

    const customerId = dto.customerId ?? voucher.customerId;

    await this.prisma.$transaction(async (tx) => {
      if (dto.items) {
        const tier = await this.resolveTierForCustomer(customerId);

        await tx.salesVoucherItem.deleteMany({ where: { voucherId: id } });

        for (const item of dto.items) {
          const product = await tx.product.findFirst({ where: { id: item.productId, deletedAt: null } });
          if (!product) throw new BadRequestException(`Produit ${item.productId} introuvable`);

          const price = await tx.productPrice.findUnique({
            where: { productId_priceTierTypeId: { productId: product.id, priceTierTypeId: tier.id } },
          });
          if (!price) throw new BadRequestException(`Aucun prix "${tier.label}" défini pour ${product.nameFr}`);

          const totalUnits = item.quantityPackages * product.unitsPerPackage;
          const unitPrice = Number(price.price);

          await tx.salesVoucherItem.create({
            data: {
              voucherId: id,
              productId: product.id,
              priceTierTypeId: tier.id,
              packagingUnitId: product.packagingUnitId,
              quantityPackages: item.quantityPackages,
              unitsPerPackageSnapshot: product.unitsPerPackage,
              totalUnits,
              unitPrice,
              lineTotal: totalUnits * unitPrice,
            },
          });
        }
      }

      await tx.salesVoucher.update({
        where: { id },
        data: {
          customerId,
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
    const subtotal = voucher.items.reduce((sum, i) => sum + Number(i.lineTotal), 0);
    return subtotal - Number(voucher.discount) + Number(voucher.transportCost);
  }

  async confirm(id: string, actorId: string) {
    const voucher = await this.getById(id);
    if (voucher.status !== 'DRAFT') throw new BadRequestException('Ce bon a déjà été confirmé');
    if (voucher.items.length === 0) throw new BadRequestException('Le bon ne contient aucun produit');

    for (const item of voucher.items) {
      if (item.product.currentStock < item.totalUnits) {
        throw new BadRequestException(
          `Stock insuffisant pour ${item.product.nameFr} (disponible: ${item.product.currentStock}, demandé: ${item.totalUnits})`,
        );
      }
    }

    const total = this.computeTotal(voucher);
    const previousCredit = await this.balanceOf(voucher.customerId);
    const number = await this.numberSequence.next('BL');

    await this.prisma.$transaction(async (tx) => {
      for (const item of voucher.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { currentStock: { decrement: item.totalUnits } },
        });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: 'SALE',
            quantity: -item.totalUnits,
            referenceType: 'SalesVoucher',
            referenceId: voucher.id,
            createdById: actorId,
          },
        });
        // Fige le coût au moment de la vente : si le coût catalogue change plus
        // tard (nouvel achat, correction), la marge de ce bon ne doit pas bouger.
        await tx.salesVoucherItem.update({
          where: { id: item.id },
          data: { costPriceSnapshot: item.product.costPrice },
        });
      }

      await tx.ledgerEntry.create({
        data: {
          customerId: voucher.customerId,
          type: 'SALE_VOUCHER',
          amount: total,
          reference: number,
          createdById: actorId,
        },
      });

      if (Number(voucher.paidAmount) > 0) {
        await tx.ledgerEntry.create({
          data: {
            customerId: voucher.customerId,
            type: 'PAYMENT',
            amount: -Number(voucher.paidAmount),
            reference: number,
            note: 'Paiement à la confirmation du bon',
            createdById: actorId,
          },
        });
      }

      await tx.salesVoucher.update({
        where: { id },
        data: { status: 'CONFIRMED', number, confirmedAt: new Date(), previousCredit },
      });
    });

    await this.auditLog.record({ entityType: 'SalesVoucher', entityId: id, action: 'UPDATE', field: 'status', newValue: 'CONFIRMED', actorId });
    await this.notifications.notify({
      type: 'order.confirmed',
      title: 'Bon confirmé',
      body: `Bon ${number} confirmé — total ${total} DA`,
      data: { voucherId: id, userId: voucher.customer.user.id },
    });

    return this.getById(id);
  }

  async deliver(id: string, actorId: string) {
    const voucher = await this.prisma.salesVoucher.findFirst({ where: { id, deletedAt: null } });
    if (!voucher) throw new NotFoundException('Bon introuvable');
    if (voucher.status !== 'CONFIRMED') throw new BadRequestException('Seul un bon confirmé peut être livré');

    await this.prisma.salesVoucher.update({ where: { id }, data: { status: 'DELIVERED', deliveredAt: new Date() } });
    await this.auditLog.record({ entityType: 'SalesVoucher', entityId: id, action: 'UPDATE', field: 'status', newValue: 'DELIVERED', actorId });
    return this.getById(id);
  }

  async cancel(id: string, dto: CancelVoucherDto, actorId: string) {
    const voucher = await this.getById(id);
    if (voucher.status === 'CANCELLED') throw new BadRequestException('Ce bon est déjà annulé');
    if (voucher.status === 'DELIVERED') {
      throw new BadRequestException('Un bon déjà livré ne peut plus être annulé — utilisez un retour');
    }

    const wasConfirmed = voucher.status === 'CONFIRMED';

    await this.prisma.$transaction(async (tx) => {
      if (wasConfirmed) {
        for (const item of voucher.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { currentStock: { increment: item.totalUnits } },
          });
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type: 'SALE_CANCEL',
              quantity: item.totalUnits,
              referenceType: 'SalesVoucher',
              referenceId: voucher.id,
              reason: dto.reason,
              createdById: actorId,
            },
          });
        }

        const total = this.computeTotal(voucher);
        const netCredit = total - Number(voucher.paidAmount);
        await tx.ledgerEntry.create({
          data: {
            customerId: voucher.customerId,
            type: 'ADJUSTMENT',
            amount: -netCredit,
            reference: voucher.number,
            note: `Annulation du bon ${voucher.number} : ${dto.reason}`,
            createdById: actorId,
          },
        });
      }

      await tx.salesVoucher.update({
        where: { id },
        data: { status: 'CANCELLED', cancelReason: dto.reason },
      });
    });

    await this.auditLog.record({
      entityType: 'SalesVoucher',
      entityId: id,
      action: 'UPDATE',
      field: 'status',
      newValue: 'CANCELLED',
      reason: dto.reason,
      actorId,
    });

    return this.getById(id);
  }

  async setHidden(id: string, hidden: boolean, actorId: string) {
    const voucher = await this.prisma.salesVoucher.findFirst({ where: { id, deletedAt: null } });
    if (!voucher) throw new NotFoundException('Bon introuvable');

    await this.prisma.salesVoucher.update({ where: { id }, data: { hidden } });
    await this.auditLog.record({
      entityType: 'SalesVoucher',
      entityId: id,
      action: 'UPDATE',
      field: 'hidden',
      newValue: hidden,
      actorId,
    });
    return { id, hidden };
  }

  async remove(id: string, actorId: string) {
    const voucher = await this.prisma.salesVoucher.findFirst({ where: { id, deletedAt: null } });
    if (!voucher) throw new NotFoundException('Bon introuvable');
    if (voucher.status !== 'DRAFT') {
      throw new ForbiddenException('Seul un brouillon peut être supprimé directement — annulez un bon confirmé');
    }

    await this.prisma.salesVoucher.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.auditLog.record({ entityType: 'SalesVoucher', entityId: id, action: 'DELETE', actorId });
    return { id };
  }
}
