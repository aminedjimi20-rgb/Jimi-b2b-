import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { UpsertDepotDto } from './dto/upsert-depot.dto';

@Injectable()
export class DepotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  list() {
    return this.prisma.depot.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
  }

  async create(dto: UpsertDepotDto, actorId: string) {
    const existing = await this.prisma.depot.findUnique({ where: { name: dto.name } });
    if (existing) throw new BadRequestException('Ce dépôt existe déjà');

    const depot = await this.prisma.depot.create({ data: dto });
    await this.auditLog.record({ entityType: 'Depot', entityId: depot.id, action: 'CREATE', actorId });
    return depot;
  }

  async update(id: string, dto: UpsertDepotDto, actorId: string) {
    const existing = await this.prisma.depot.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Dépôt introuvable');

    const updated = await this.prisma.depot.update({ where: { id }, data: dto });
    await this.auditLog.record({ entityType: 'Depot', entityId: id, action: 'UPDATE', oldValue: existing, newValue: dto, actorId });
    return updated;
  }

  async remove(id: string, actorId: string) {
    const existing = await this.prisma.depot.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Dépôt introuvable');

    await this.prisma.depot.delete({ where: { id } });
    await this.auditLog.record({ entityType: 'Depot', entityId: id, action: 'DELETE', actorId });
    return { id };
  }
}
