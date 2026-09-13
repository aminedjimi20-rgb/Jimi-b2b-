import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { UpsertDeliveryDto } from './dto/upsert-delivery.dto';

@Injectable()
export class DeliveriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  list(status?: string) {
    return this.prisma.delivery.findMany({
      where: status ? { status: status as never } : undefined,
      include: {
        voucher: { include: { customer: { include: { user: { select: { fullName: true } } } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async upsertForVoucher(voucherId: string, dto: UpsertDeliveryDto, actorId: string) {
    const voucher = await this.prisma.salesVoucher.findFirst({ where: { id: voucherId, deletedAt: null } });
    if (!voucher) throw new NotFoundException('Bon introuvable');

    const existing = await this.prisma.delivery.findUnique({ where: { voucherId } });

    const data = {
      ...dto,
      status: dto.status as never,
      deliveredAt: dto.status === 'DELIVERED' ? new Date() : undefined,
    };

    const delivery = existing
      ? await this.prisma.delivery.update({ where: { voucherId }, data })
      : await this.prisma.delivery.create({ data: { voucherId, ...data } });

    await this.auditLog.record({ entityType: 'Delivery', entityId: delivery.id, action: existing ? 'UPDATE' : 'CREATE', newValue: dto, actorId });
    return delivery;
  }

  async getByVoucher(voucherId: string) {
    return this.prisma.delivery.findUnique({ where: { voucherId } });
  }
}
