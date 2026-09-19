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

  async getById(id: string) {
    const driver = await this.prisma.driver.findUnique({ where: { id } });
    if (!driver) throw new NotFoundException('Livreur introuvable');
    return driver;
  }

  // Historique complet des courses (y compris annulées, affichées barrées
  // côté front) — pour que le livreur retrouve tout ce qui a été fait avec
  // lui, indépendamment de la période choisie pour le compte.
  async getDeliveries(id: string, from?: Date, to?: Date) {
    await this.getById(id);
    return this.prisma.delivery.findMany({
      where: {
        driverId: id,
        ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      },
      include: {
        salesVoucher: { select: { number: true, customer: { include: { user: { select: { fullName: true } } } } } },
        purchaseVoucher: { select: { number: true, manufacturer: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Compte du livreur sur une période : ce qu'on lui doit pour les courses
  // effectuées, hors courses annulées (rien n'est dû pour celles-ci). Sans
  // suivi de paiement pour l'instant, la période se lit isolément — pas de
  // solde reporté d'avant le "from", juste le total dû pour la période.
  async getSituation(id: string, from?: Date, to?: Date) {
    const driver = await this.getById(id);
    const deliveries = await this.prisma.delivery.findMany({
      where: {
        driverId: id,
        status: { not: 'CANCELLED' },
        ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      },
      include: {
        salesVoucher: { select: { number: true, customer: { include: { user: { select: { fullName: true } } } } } },
        purchaseVoucher: { select: { number: true, manufacturer: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });

    let running = 0;
    const entries = deliveries.map((d) => {
      running += Number(d.cost);
      const label = d.salesVoucherId
        ? `Bon de vente ${d.salesVoucher?.number ?? ''}`
        : d.purchaseVoucherId
          ? `Bon d'achat ${d.purchaseVoucher?.number ?? ''}`
          : 'Course';
      const party = d.salesVoucher?.customer?.user.fullName ?? d.purchaseVoucher?.manufacturer?.name ?? d.address ?? null;
      return {
        id: d.id,
        createdAt: d.createdAt,
        typeLabel: label,
        note: party,
        amount: Number(d.cost),
        balanceAfter: running,
      };
    });

    return {
      driver,
      from: from ?? null,
      to: to ?? null,
      totalDeliveries: entries.length,
      totalCost: running,
      entries,
    };
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
