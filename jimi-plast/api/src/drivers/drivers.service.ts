import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { UpsertDriverDto } from './dto/upsert-driver.dto';

@Injectable()
export class DriversService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  list(includeInactive = false) {
    return this.prisma.driver.findMany({
      where: includeInactive ? undefined : { deletedAt: null },
      orderBy: { fullName: 'asc' },
    });
  }

  async create(dto: UpsertDriverDto, actorId: string) {
    const driver = await this.prisma.driver.create({ data: dto });
    await this.auditLog.record({ entityType: 'Driver', entityId: driver.id, action: 'CREATE', actorId });
    return driver;
  }

  async update(id: string, dto: UpsertDriverDto, actorId: string) {
    const existing = await this.prisma.driver.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Livreur introuvable');

    const updated = await this.prisma.driver.update({ where: { id }, data: dto });
    await this.auditLog.record({ entityType: 'Driver', entityId: id, action: 'UPDATE', oldValue: existing, newValue: dto, actorId });
    return updated;
  }

  // Un livreur qui a déjà des livraisons associées n'est jamais supprimé —
  // seulement désactivé (deletedAt), pour ne jamais casser l'historique
  // des courses passées. Il reste visible (barré) dans la liste.
  async remove(id: string, actorId: string) {
    const existing = await this.prisma.driver.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Livreur introuvable');
    if (existing.deletedAt) throw new BadRequestException('Ce livreur est déjà désactivé');

    const updated = await this.prisma.driver.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
    await this.auditLog.record({ entityType: 'Driver', entityId: id, action: 'DELETE', actorId });
    return updated;
  }

  async restore(id: string, actorId: string) {
    const existing = await this.prisma.driver.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Livreur introuvable');

    const updated = await this.prisma.driver.update({ where: { id }, data: { deletedAt: null, isActive: true } });
    await this.auditLog.record({ entityType: 'Driver', entityId: id, action: 'RESTORE', actorId });
    return updated;
  }
}
