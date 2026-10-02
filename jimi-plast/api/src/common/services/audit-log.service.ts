import { Injectable } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface RecordChangeInput {
  entityType: string;
  entityId: string;
  action: AuditAction;
  field?: string;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
  actorId?: string | null;
}

/**
 * Point d'entrée unique pour tracer une modification sensible (§14/§85 du
 * cahier des charges). Un service métier appelle record() au lieu d'écrire
 * lui-même dans audit_logs, pour garantir un format homogène partout.
 */
@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordChangeInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        field: input.field,
        oldValue: input.oldValue === undefined ? undefined : JSON.stringify(input.oldValue),
        newValue: input.newValue === undefined ? undefined : JSON.stringify(input.newValue),
        reason: input.reason,
        actorId: input.actorId ?? undefined,
      },
    });
  }

  async history(entityType: string, entityId: string) {
    return this.prisma.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: { id: true, fullName: true, email: true } } },
    });
  }

  /** Page "Historique" : tout ce qui s'est passé dans l'appli, tous types
   * confondus — bornée aux entrées les plus récentes plutôt que paginée,
   * comme le reste des pages de liste de l'appli. */
  async list(params: { q?: string; includeHidden?: boolean } = {}) {
    const { q, includeHidden } = params;
    return this.prisma.auditLog.findMany({
      where: {
        ...(includeHidden ? {} : { hiddenAt: null }),
        ...(q
          ? {
              OR: [
                { entityType: { contains: q, mode: 'insensitive' } },
                { field: { contains: q, mode: 'insensitive' } },
                { reason: { contains: q, mode: 'insensitive' } },
                { newValue: { contains: q, mode: 'insensitive' } },
                { oldValue: { contains: q, mode: 'insensitive' } },
                { actor: { fullName: { contains: q, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: { actor: { select: { id: true, fullName: true } } },
    });
  }

  async setHidden(id: string, hidden: boolean) {
    return this.prisma.auditLog.update({ where: { id }, data: { hiddenAt: hidden ? new Date() : null } });
  }
}
