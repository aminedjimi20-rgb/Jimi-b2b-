import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { VouchersService } from '../vouchers/vouchers.service';
import { PurchaseVouchersService } from '../purchase-vouchers/purchase-vouchers.service';
import { CancelDeliveryDto, CreateStandaloneDeliveryDto, UpsertDeliveryDto } from './dto/upsert-delivery.dto';

const DELIVERY_EXPENSE_CATEGORY = 'Livraison';

@Injectable()
export class DeliveriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly vouchersService: VouchersService,
    private readonly purchaseVouchersService: PurchaseVouchersService,
  ) {}

  list() {
    return this.prisma.delivery.findMany({
      include: {
        driver: true,
        salesVoucher: { include: { customer: { include: { user: { select: { fullName: true } } } } } },
        purchaseVoucher: { include: { manufacturer: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async resolveDriverFields(dto: UpsertDeliveryDto) {
    if (!dto.driverId) return {};
    // Le nom/téléphone/véhicule sont figés au moment de l'affectation — un
    // livreur modifié ou désactivé plus tard ne doit jamais changer
    // rétroactivement une course déjà passée.
    const driver = await this.prisma.driver.findUnique({ where: { id: dto.driverId } });
    if (!driver) return {};
    return {
      driverName: dto.driverName ?? driver.fullName,
      driverPhone: dto.driverPhone ?? driver.phone,
      vehicle: dto.vehicle ?? driver.vehicle,
      driverPhotoUrl: dto.driverPhotoUrl ?? driver.photoUrl,
    };
  }

  async upsertForVoucher(type: 'sales' | 'purchase', voucherId: string, dto: UpsertDeliveryDto, actorId: string) {
    if (type === 'sales') {
      const voucher = await this.prisma.salesVoucher.findFirst({ where: { id: voucherId, deletedAt: null } });
      if (!voucher) throw new NotFoundException('Bon introuvable');
    } else {
      const voucher = await this.prisma.purchaseVoucher.findFirst({ where: { id: voucherId, deletedAt: null } });
      if (!voucher) throw new NotFoundException('Bon introuvable');
    }

    const key = type === 'sales' ? { salesVoucherId: voucherId } : { purchaseVoucherId: voucherId };
    const existing = await this.prisma.delivery.findFirst({ where: key });
    const driverFields = await this.resolveDriverFields(dto);

    const data = {
      ...dto,
      ...driverFields,
      status: dto.status as never,
      deliveredAt: dto.status === 'DELIVERED' ? new Date() : undefined,
    };

    const delivery = existing
      ? await this.prisma.delivery.update({ where: { id: existing.id }, data })
      : await this.prisma.delivery.create({ data: { ...key, ...data, createdById: actorId } });

    // Le coût facturé à la partie (client/fabricant) sur la livraison EST le
    // transport du bon — synchronisé côté serveur pour que ça reste vrai
    // quel que soit l'écran d'où la livraison a été modifiée (Transport ou
    // la fiche du bon elle-même), et qu'il entre bien dans le total. Passe
    // par le service du bon (pas une écriture Prisma directe) pour qu'un
    // bon déjà confirmé répercute l'écart dans le compte du client/
    // fabricant et dans son propre historique, exactement comme une
    // modification de transport faite depuis la fiche du bon elle-même.
    if (type === 'sales') {
      await this.vouchersService.update(voucherId, { transportCost: Number(delivery.billedToCustomer) }, actorId);
    } else {
      await this.purchaseVouchersService.update(voucherId, { transportCost: Number(delivery.billedToManufacturer) }, actorId);
    }

    await this.auditLog.record({ entityType: 'Delivery', entityId: delivery.id, action: existing ? 'UPDATE' : 'CREATE', newValue: dto, actorId });
    return delivery;
  }

  async getByVoucher(type: 'sales' | 'purchase', voucherId: string) {
    return this.prisma.delivery.findFirst({
      where: type === 'sales' ? { salesVoucherId: voucherId } : { purchaseVoucherId: voucherId },
      include: { driver: true },
    });
  }

  // Course sans bon (transport interne, dépannage...) : ne touche jamais le
  // compte d'un client/fabricant — son coût devient directement une dépense
  // générale (Frais), tracée par le lien Expense.deliveryId.
  async createStandalone(dto: CreateStandaloneDeliveryDto, actorId: string) {
    const driverFields = await this.resolveDriverFields(dto);

    const delivery = await this.prisma.delivery.create({
      data: {
        driverId: dto.driverId,
        address: dto.address,
        wilaya: dto.wilaya,
        status: (dto.status as never) ?? 'TO_PREPARE',
        cost: dto.cost ?? 0,
        notes: dto.notes,
        createdById: actorId,
        ...driverFields,
      },
    });

    if (Number(dto.cost) > 0) {
      let categoryId = dto.categoryId;
      if (!categoryId) {
        const category = await this.prisma.expenseCategory.upsert({
          where: { name: DELIVERY_EXPENSE_CATEGORY },
          create: { name: DELIVERY_EXPENSE_CATEGORY },
          update: {},
        });
        categoryId = category.id;
      }
      await this.prisma.expense.create({
        data: {
          categoryId,
          amount: dto.cost!,
          notes: `Course sans bon${dto.address ? ` — ${dto.address}` : ''}`,
          deliveryId: delivery.id,
          createdById: actorId,
        },
      });
    }

    await this.auditLog.record({ entityType: 'Delivery', entityId: delivery.id, action: 'CREATE', newValue: dto, actorId });
    return delivery;
  }

  // Modifier une course sans bon déjà créée — coût/statut/livreur... Si le
  // coût change, la dépense générale liée est ajustée pour rester exacte
  // dans la Situation (jamais un second Expense créé pour la même course).
  async updateStandalone(id: string, dto: UpsertDeliveryDto, actorId: string) {
    const existing = await this.prisma.delivery.findFirst({ where: { id, salesVoucherId: null, purchaseVoucherId: null } });
    if (!existing) throw new NotFoundException('Livraison introuvable');

    const driverFields = await this.resolveDriverFields(dto);
    const delivery = await this.prisma.delivery.update({
      where: { id },
      data: {
        ...dto,
        ...driverFields,
        status: dto.status as never,
        deliveredAt: dto.status === 'DELIVERED' ? new Date() : undefined,
      },
    });

    if (dto.cost != null) {
      const linkedExpense = await this.prisma.expense.findUnique({ where: { deliveryId: id } });
      if (linkedExpense) {
        await this.prisma.expense.update({ where: { id: linkedExpense.id }, data: { amount: dto.cost } });
      } else if (Number(dto.cost) > 0) {
        const category = await this.prisma.expenseCategory.upsert({
          where: { name: DELIVERY_EXPENSE_CATEGORY },
          create: { name: DELIVERY_EXPENSE_CATEGORY },
          update: {},
        });
        await this.prisma.expense.create({
          data: { categoryId: category.id, amount: dto.cost, notes: 'Course sans bon', deliveryId: id, createdById: actorId },
        });
      }
    }

    await this.auditLog.record({ entityType: 'Delivery', entityId: id, action: 'UPDATE', newValue: dto, actorId });
    return delivery;
  }

  async cancel(id: string, dto: CancelDeliveryDto, actorId: string) {
    const delivery = await this.prisma.delivery.findUnique({ where: { id } });
    if (!delivery) throw new NotFoundException('Livraison introuvable');

    await this.prisma.$transaction(async (tx) => {
      await tx.delivery.update({ where: { id }, data: { status: 'CANCELLED', cancelReason: dto.reason } });
      // La course n'a pas eu lieu — la dépense générale qu'elle avait
      // générée (le cas échéant) n'a plus lieu d'être.
      await tx.expense.updateMany({ where: { deliveryId: id, deletedAt: null }, data: { deletedAt: new Date() } });
      // Idem pour le transport facturé sur le bon lié — plus de livraison,
      // plus de frais de transport dans son total.
      if (delivery.salesVoucherId) {
        await tx.salesVoucher.update({ where: { id: delivery.salesVoucherId }, data: { transportCost: 0 } });
      }
      if (delivery.purchaseVoucherId) {
        await tx.purchaseVoucher.update({ where: { id: delivery.purchaseVoucherId }, data: { transportCost: 0 } });
      }
    });

    await this.auditLog.record({ entityType: 'Delivery', entityId: id, action: 'UPDATE', field: 'status', newValue: 'CANCELLED', reason: dto.reason, actorId });
    return this.prisma.delivery.findUnique({ where: { id } });
  }
}
