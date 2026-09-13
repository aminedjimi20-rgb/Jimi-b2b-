import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { NumberSequenceService } from '../common/services/number-sequence.service';
import { CreateReturnDto } from './dto/create-return.dto';
import { ValidateReturnDto } from './dto/validate-return.dto';

const ROLE_TO_TIER_KEY: Record<string, string> = { wholesaler: 'wholesale', retailer: 'retail' };

@Injectable()
export class ReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly numberSequence: NumberSequenceService,
  ) {}

  list(filters: { type?: string; status?: string }) {
    return this.prisma.return.findMany({
      where: {
        deletedAt: null,
        ...(filters.type ? { type: filters.type as never } : {}),
        ...(filters.status ? { status: filters.status as never } : {}),
      },
      include: {
        customer: { include: { user: { select: { fullName: true } } } },
        manufacturer: true,
        items: { include: { product: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string) {
    const ret = await this.prisma.return.findFirst({
      where: { id, deletedAt: null },
      include: {
        customer: { include: { user: { select: { fullName: true } } } },
        manufacturer: true,
        items: { include: { product: true } },
      },
    });
    if (!ret) throw new NotFoundException('Retour introuvable');
    return ret;
  }

  async create(dto: CreateReturnDto, actorId: string) {
    if (dto.type === 'CUSTOMER' && !dto.customerId) throw new BadRequestException('customerId requis pour un retour client');
    if (dto.type === 'SUPPLIER' && !dto.manufacturerId) throw new BadRequestException('manufacturerId requis pour un retour fabricant');

    let unitPriceByProduct = new Map<string, number>();

    if (dto.type === 'CUSTOMER') {
      const customer = await this.prisma.customer.findUniqueOrThrow({
        where: { id: dto.customerId },
        include: { user: { include: { role: true } } },
      });
      const tierKey = ROLE_TO_TIER_KEY[customer.user.role.key];
      if (!tierKey) throw new BadRequestException('Niveau de prix introuvable pour ce client');
      const tier = await this.prisma.priceTierType.findUniqueOrThrow({ where: { key: tierKey } });

      const prices = await this.prisma.productPrice.findMany({
        where: { productId: { in: dto.items.map((i) => i.productId) }, priceTierTypeId: tier.id },
      });
      unitPriceByProduct = new Map(prices.map((p) => [p.productId, Number(p.price)]));
    } else {
      const products = await this.prisma.product.findMany({ where: { id: { in: dto.items.map((i) => i.productId) } } });
      unitPriceByProduct = new Map(products.map((p) => [p.id, Number(p.costPrice ?? 0)]));
    }

    const items = dto.items.map((i) => {
      const unitPrice = unitPriceByProduct.get(i.productId) ?? 0;
      return { ...i, unitPrice, lineTotal: unitPrice * i.quantity };
    });
    const totalValue = items.reduce((s, i) => s + i.lineTotal, 0);

    const ret = await this.prisma.return.create({
      data: {
        type: dto.type,
        customerId: dto.customerId,
        manufacturerId: dto.manufacturerId,
        totalValue,
        createdById: actorId,
        items: { create: items },
      },
    });

    return this.getById(ret.id);
  }

  async validate(id: string, dto: ValidateReturnDto, actorId: string) {
    const ret = await this.getById(id);
    if (ret.status !== 'NEW') throw new BadRequestException('Ce retour a déjà été traité');

    const number = await this.numberSequence.next('RET');

    await this.prisma.$transaction(async (tx) => {
      if (ret.type === 'CUSTOMER' && ret.customerId) {
        if (dto.decision !== 'REPLACEMENT') {
          await tx.ledgerEntry.create({
            data: {
              customerId: ret.customerId,
              type: 'RETURN_CREDIT',
              amount: -Number(ret.totalValue),
              reference: number,
              note: `Retour ${number} (${dto.decision})`,
              createdById: actorId,
            },
          });
        } else {
          for (const item of ret.items) {
            await tx.product.update({ where: { id: item.productId }, data: { currentStock: { decrement: item.quantity } } });
            await tx.stockMovement.create({
              data: {
                productId: item.productId,
                type: 'RETURN_CUSTOMER',
                quantity: -item.quantity,
                referenceType: 'Return',
                referenceId: ret.id,
                reason: 'Remplacement suite retour client',
                createdById: actorId,
              },
            });
          }
        }
      }

      if (ret.type === 'SUPPLIER' && ret.manufacturerId) {
        await tx.supplierLedgerEntry.create({
          data: {
            manufacturerId: ret.manufacturerId,
            type: 'ADJUSTMENT',
            amount: -Number(ret.totalValue),
            reference: number,
            note: `Retour fabricant ${number}`,
            createdById: actorId,
          },
        });
        for (const item of ret.items) {
          await tx.product.update({ where: { id: item.productId }, data: { currentStock: { decrement: item.quantity } } });
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type: 'RETURN_SUPPLIER',
              quantity: -item.quantity,
              referenceType: 'Return',
              referenceId: ret.id,
              createdById: actorId,
            },
          });
        }
      }

      await tx.return.update({ where: { id }, data: { status: 'VALIDATED', decision: dto.decision, number, validatedAt: new Date() } });
    });

    await this.auditLog.record({ entityType: 'Return', entityId: id, action: 'UPDATE', field: 'status', newValue: 'VALIDATED', actorId });
    return this.getById(id);
  }

  async reject(id: string, actorId: string) {
    const ret = await this.getById(id);
    if (ret.status !== 'NEW') throw new BadRequestException('Ce retour a déjà été traité');

    await this.prisma.return.update({ where: { id }, data: { status: 'REJECTED' } });
    await this.auditLog.record({ entityType: 'Return', entityId: id, action: 'UPDATE', field: 'status', newValue: 'REJECTED', actorId });
    return this.getById(id);
  }
}
