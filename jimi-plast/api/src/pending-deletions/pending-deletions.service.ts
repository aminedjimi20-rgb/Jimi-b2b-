import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Une suppression de ligne de crédit (ajustement/paiement) ou de bon
 * n'efface jamais rien tout de suite : elle crée une demande que l'AUTRE
 * partie (client ↔ personnel) doit approuver. Tant qu'elle n'est pas
 * approuvée, les chiffres (solde, stock) ne bougent pas — et même après
 * approbation, la ligne visée reste affichée (barrée, avec la raison),
 * jamais retirée de l'écran.
 */
@Injectable()
export class PendingDeletionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly notifications: NotificationsService,
  ) {}

  private listStaff() {
    return this.prisma.user.findMany({
      where: { deletedAt: null, role: { key: { in: ['admin', 'employee'] } } },
      select: { id: true },
    });
  }

  private async actorName(actorId?: string | null): Promise<string> {
    if (!actorId) return 'Un utilisateur';
    const actor = await this.prisma.user.findUnique({ where: { id: actorId }, select: { fullName: true } });
    return actor?.fullName ?? 'Un utilisateur';
  }

  private async notifyBoth(customerUserId: string, type: string, title: string, body: string, data: Record<string, unknown> = {}) {
    const staff = await this.listStaff();
    const recipientIds = [customerUserId, ...staff.map((s) => s.id)];
    await Promise.all(
      recipientIds.map((userId) => this.notifications.notify({ type, title, body, data: { ...data, userId } })),
    );
  }

  async requestLedgerEntryDeletion(entryId: string, reason: string, requestedById: string) {
    const entry = await this.prisma.ledgerEntry.findUnique({
      where: { id: entryId },
      include: { customer: { include: { user: { select: { id: true, fullName: true } } } } },
    });
    if (!entry) throw new NotFoundException('Ligne de crédit introuvable');
    if (entry.voidedAt) throw new BadRequestException('Cette ligne est déjà supprimée');

    const existing = await this.prisma.pendingDeletion.findFirst({ where: { ledgerEntryId: entryId, status: 'PENDING' } });
    if (existing) throw new BadRequestException('Une demande de suppression est déjà en attente pour cette ligne');

    const pending = await this.prisma.pendingDeletion.create({
      data: { ledgerEntryId: entryId, customerId: entry.customerId, reason, requestedById },
    });

    const actorName = await this.actorName(requestedById);
    await this.notifyBoth(
      entry.customer.user.id,
      'pending_deletion.requested',
      'Demande de suppression',
      `${actorName} demande la suppression d'une ligne (${entry.type}) : ${reason}. Une approbation est nécessaire.`,
      { pendingDeletionId: pending.id },
    );

    return pending;
  }

  async requestVoucherDeletion(voucherId: string, reason: string, requestedById: string) {
    const voucher = await this.prisma.salesVoucher.findFirst({
      where: { id: voucherId, deletedAt: null },
      include: { customer: { include: { user: { select: { id: true, fullName: true } } } } },
    });
    if (!voucher) throw new NotFoundException('Bon introuvable');

    const existing = await this.prisma.pendingDeletion.findFirst({ where: { salesVoucherId: voucherId, status: 'PENDING' } });
    if (existing) throw new BadRequestException('Une demande de suppression est déjà en attente pour ce bon');

    const pending = await this.prisma.pendingDeletion.create({
      data: { salesVoucherId: voucherId, customerId: voucher.customerId, reason, requestedById },
    });

    const actorName = await this.actorName(requestedById);
    await this.notifyBoth(
      voucher.customer.user.id,
      'pending_deletion.requested',
      'Demande de suppression',
      `${actorName} demande la suppression du bon ${voucher.number ?? ''} : ${reason}. Une approbation est nécessaire.`,
      { pendingDeletionId: pending.id },
    );

    return pending;
  }

  async listMine(userId: string) {
    const customer = await this.prisma.customer.findUnique({ where: { userId } });
    if (!customer) return [];
    return this.prisma.pendingDeletion.findMany({
      where: { customerId: customer.id },
      include: {
        ledgerEntry: true,
        salesVoucher: { select: { id: true, number: true } },
        requestedBy: { select: { fullName: true } },
        respondedBy: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  listAll() {
    return this.prisma.pendingDeletion.findMany({
      include: {
        customer: { include: { user: { select: { fullName: true } } } },
        ledgerEntry: true,
        salesVoucher: { select: { id: true, number: true } },
        requestedBy: { select: { fullName: true } },
        respondedBy: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async respond(id: string, decision: 'APPROVED' | 'REJECTED', responderId: string) {
    const pending = await this.prisma.pendingDeletion.findUnique({
      where: { id },
      include: {
        customer: { include: { user: { select: { id: true, fullName: true } } } },
        ledgerEntry: true,
        salesVoucher: { include: { items: true } },
      },
    });
    if (!pending) throw new NotFoundException('Demande introuvable');
    if (pending.status !== 'PENDING') throw new BadRequestException('Cette demande a déjà une réponse');
    if (pending.requestedById === responderId) {
      throw new ForbiddenException("Vous ne pouvez pas approuver votre propre demande — l'autre partie doit répondre");
    }

    const responder = await this.prisma.user.findUnique({ where: { id: responderId }, select: { role: { select: { key: true } } } });
    const isStaff = responder ? ['admin', 'employee'].includes(responder.role.key) : false;
    const isOwningCustomer = pending.customer.user.id === responderId;
    if (!isStaff && !isOwningCustomer) {
      throw new ForbiddenException("Vous n'êtes pas autorisé à répondre à cette demande");
    }

    if (decision === 'APPROVED') {
      await this.prisma.$transaction(async (tx) => {
        if (pending.ledgerEntry) {
          await tx.ledgerEntry.update({ where: { id: pending.ledgerEntry.id }, data: { voidedAt: new Date() } });
        }

        if (pending.salesVoucher && (pending.salesVoucher.status === 'CONFIRMED' || pending.salesVoucher.status === 'DELIVERED')) {
          const voucher = pending.salesVoucher;
          for (const item of voucher.items) {
            await tx.product.update({ where: { id: item.productId }, data: { currentStock: { increment: item.totalUnits } } });
            await tx.stockMovement.create({
              data: {
                productId: item.productId,
                type: 'ADJUSTMENT',
                quantity: item.totalUnits,
                referenceType: 'SalesVoucher',
                referenceId: voucher.id,
                reason: `Suppression approuvée du bon ${voucher.number ?? ''} : ${pending.reason}`,
                createdById: responderId,
              },
            });
          }

          const subtotal = voucher.items.reduce((s, i) => s + Number(i.lineTotal), 0);
          const total = subtotal - Number(voucher.discount) + Number(voucher.transportCost);
          const netCredit = total - Number(voucher.paidAmount);
          await tx.ledgerEntry.create({
            data: {
              customerId: voucher.customerId,
              type: 'ADJUSTMENT',
              amount: -netCredit,
              reference: voucher.number,
              note: `Suppression approuvée du bon ${voucher.number ?? ''} : ${pending.reason}`,
              createdById: responderId,
            },
          });
        }
      });
    }

    const updated = await this.prisma.pendingDeletion.update({
      where: { id },
      data: { status: decision, respondedById: responderId, respondedAt: new Date() },
    });

    const responderName = await this.actorName(responderId);
    const entityLabel = pending.ledgerEntry ? 'la ligne de crédit' : `le bon ${pending.salesVoucher?.number ?? ''}`;
    await this.auditLog.record({
      entityType: pending.ledgerEntry ? 'LedgerEntry' : 'SalesVoucher',
      entityId: pending.ledgerEntry ? pending.ledgerEntry.id : (pending.salesVoucherId as string),
      action: 'UPDATE',
      field: 'pendingDeletion',
      newValue: decision,
      reason:
        decision === 'APPROVED'
          ? `Suppression approuvée par ${responderName} : ${pending.reason}`
          : `Suppression refusée par ${responderName} : ${pending.reason}`,
      actorId: responderId,
    });

    await this.notifyBoth(
      pending.customer.user.id,
      decision === 'APPROVED' ? 'pending_deletion.approved' : 'pending_deletion.rejected',
      decision === 'APPROVED' ? 'Suppression approuvée' : 'Suppression refusée',
      decision === 'APPROVED'
        ? `${responderName} a approuvé la suppression de ${entityLabel}.`
        : `${responderName} a refusé la suppression de ${entityLabel}.`,
      { pendingDeletionId: id },
    );

    return updated;
  }
}
