import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from './audit-log.service';

/**
 * Corbeille générique (§59 du cahier des charges) : toute suppression d'une
 * entité "sensible" passe par softDelete() plutôt qu'un DELETE SQL direct.
 * L'entité elle-même garde un champ deletedAt pour sortir des listes
 * normales ; le TrashItem garde un instantané complet pour pouvoir
 * restaurer même si le modèle évolue entre-temps.
 */
@Injectable()
export class TrashService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async moveToTrash(params: {
    entityType: string;
    entityId: string;
    snapshot: Record<string, unknown>;
    deletedById?: string;
    reason?: string;
  }) {
    const item = await this.prisma.trashItem.create({
      data: {
        entityType: params.entityType,
        entityId: params.entityId,
        snapshot: params.snapshot as any,
        deletedById: params.deletedById,
        reason: params.reason,
      },
    });

    await this.auditLog.record({
      entityType: params.entityType,
      entityId: params.entityId,
      action: 'DELETE',
      reason: params.reason,
      actorId: params.deletedById,
    });

    return item;
  }

  list(entityType?: string) {
    return this.prisma.trashItem.findMany({
      where: { entityType, purgedAt: null, restoredAt: null },
      orderBy: { deletedAt: 'desc' },
    });
  }

  async markRestored(trashItemId: string, actorId?: string) {
    const item = await this.prisma.trashItem.update({
      where: { id: trashItemId },
      data: { restoredAt: new Date() },
    });
    await this.auditLog.record({
      entityType: item.entityType,
      entityId: item.entityId,
      action: 'RESTORE',
      actorId,
    });
    return item;
  }

  async purge(trashItemId: string, actorId?: string) {
    const item = await this.prisma.trashItem.update({
      where: { id: trashItemId },
      data: { purgedAt: new Date() },
    });
    await this.auditLog.record({
      entityType: item.entityType,
      entityId: item.entityId,
      action: 'PURGE',
      actorId,
      reason: 'Suppression définitive depuis la corbeille',
    });
    return item;
  }
}
