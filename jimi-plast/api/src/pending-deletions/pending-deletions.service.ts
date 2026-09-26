import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TrashService } from '../common/services/trash.service';

/**
 * Une suppression de ligne de crédit (ajustement/paiement), de bon ou de
 * fiche fabricant s'applique immédiatement (le compte/stock bouge tout de
 * suite) — mais jamais en effaçant l'entité visée : elle reste affichée
 * (barrée, avec la raison), jamais retirée de l'écran. Le client ou le
 * fabricant concerné (et le personnel) reçoit une notification informative
 * dès que c'est fait ; il n'y a plus d'étape "à approuver" pour que ça se
 * reflète sur son compte.
 *
 * Chaque suppression garde tout de même une trace `PendingDeletion` (créée
 * directement au statut APPROVED, auto-répondue par son propre auteur) —
 * ça préserve l'historique/l'affichage barré existants sans y toucher.
 *
 * `respond()` reste en place tel quel pour permettre de résoudre d'anciennes
 * demandes PENDING créées avant ce changement ; plus aucune nouvelle demande
 * n'est créée à l'état PENDING désormais.
 */
@Injectable()
export class PendingDeletionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly notifications: NotificationsService,
    private readonly trash: TrashService,
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

  private async notifyBoth(partyUserId: string, type: string, title: string, body: string, data: Record<string, unknown> = {}) {
    const staff = await this.listStaff();
    const recipientIds = [partyUserId, ...staff.map((s) => s.id)];
    await Promise.all(
      recipientIds.map((userId) => this.notifications.notify({ type, title, body, data: { ...data, userId } })),
    );
  }

  /** Même chose que notifyBoth, mais quand il n'y a personne en face (pas de compte lié) — le personnel seul est informé. */
  private async notifyStaffOnly(type: string, title: string, body: string, data: Record<string, unknown> = {}) {
    const staff = await this.listStaff();
    await Promise.all(staff.map((s) => this.notifications.notify({ type, title, body, data: { ...data, userId: s.id } })));
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

    const now = new Date();
    const [, pending] = await this.prisma.$transaction([
      this.prisma.ledgerEntry.update({ where: { id: entryId }, data: { voidedAt: now } }),
      this.prisma.pendingDeletion.create({
        data: {
          ledgerEntryId: entryId,
          customerId: entry.customerId,
          reason,
          requestedById,
          status: 'APPROVED',
          respondedById: requestedById,
          respondedAt: now,
        },
      }),
    ]);

    await this.auditLog.record({ entityType: 'LedgerEntry', entityId: entryId, action: 'DELETE', reason, actorId: requestedById });

    const actorName = await this.actorName(requestedById);
    await this.notifyBoth(
      entry.customer.user.id,
      'pending_deletion.applied',
      'Suppression effectuée',
      `${actorName} a supprimé une ligne (${entry.type}) : ${reason}.`,
      { pendingDeletionId: pending.id },
    );

    return pending;
  }

  async requestVoucherDeletion(voucherId: string, reason: string, requestedById: string) {
    const voucher = await this.prisma.salesVoucher.findFirst({
      where: { id: voucherId, deletedAt: null },
      include: { customer: { include: { user: { select: { id: true, fullName: true } } } }, items: true },
    });
    if (!voucher) throw new NotFoundException('Bon introuvable');

    const existing = await this.prisma.pendingDeletion.findFirst({ where: { salesVoucherId: voucherId, status: 'PENDING' } });
    if (existing) throw new BadRequestException('Une demande de suppression est déjà en attente pour ce bon');

    const now = new Date();
    const pending = await this.prisma.$transaction(async (tx) => {
      if (voucher.status === 'CONFIRMED' || voucher.status === 'DELIVERED') {
        for (const item of voucher.items) {
          const incremented = await tx.product.update({ where: { id: item.productId }, data: { currentStock: { increment: item.totalUnits } } });
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type: 'ADJUSTMENT',
              quantity: item.totalUnits,
              stockAfter: incremented.currentStock,
              referenceType: 'SalesVoucher',
              referenceId: voucher.id,
              reason: `Suppression du bon ${voucher.number ?? ''} : ${reason}`,
              createdById: requestedById,
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
            note: `Suppression du bon ${voucher.number ?? ''} : ${reason}`,
            createdById: requestedById,
          },
        });
      }

      return tx.pendingDeletion.create({
        data: {
          salesVoucherId: voucherId,
          customerId: voucher.customerId,
          reason,
          requestedById,
          status: 'APPROVED',
          respondedById: requestedById,
          respondedAt: now,
        },
      });
    });

    await this.auditLog.record({ entityType: 'SalesVoucher', entityId: voucherId, action: 'DELETE', reason, actorId: requestedById });

    const actorName = await this.actorName(requestedById);
    await this.notifyBoth(
      voucher.customer.user.id,
      'pending_deletion.applied',
      'Suppression effectuée',
      `${actorName} a supprimé le bon ${voucher.number ?? ''} : ${reason}.`,
      { pendingDeletionId: pending.id },
    );

    return pending;
  }

  async requestPurchaseVoucherDeletion(voucherId: string, reason: string, requestedById: string) {
    const voucher = await this.prisma.purchaseVoucher.findFirst({
      where: { id: voucherId, deletedAt: null },
      include: { manufacturer: { include: { user: { select: { id: true, fullName: true } } } }, items: true },
    });
    if (!voucher) throw new NotFoundException('Bon d’achat introuvable');

    const existing = await this.prisma.pendingDeletion.findFirst({ where: { purchaseVoucherId: voucherId, status: 'PENDING' } });
    if (existing) throw new BadRequestException('Une demande de suppression est déjà en attente pour ce bon');

    const now = new Date();
    const pending = await this.prisma.$transaction(async (tx) => {
      if (voucher.status === 'CONFIRMED') {
        for (const item of voucher.items) {
          const decremented = await tx.product.update({ where: { id: item.productId }, data: { currentStock: { decrement: item.totalUnits } } });
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type: 'ADJUSTMENT',
              quantity: -item.totalUnits,
              stockAfter: decremented.currentStock,
              referenceType: 'PurchaseVoucher',
              referenceId: voucher.id,
              reason: `Suppression du bon ${voucher.number ?? ''} : ${reason}`,
              createdById: requestedById,
            },
          });
        }

        const subtotal = voucher.items.reduce((s, i) => s + Number(i.lineTotal), 0);
        const total = subtotal - Number(voucher.discount) + Number(voucher.transportCost);
        const netDebt = total - Number(voucher.paidAmount);
        await tx.supplierLedgerEntry.create({
          data: {
            manufacturerId: voucher.manufacturerId,
            type: 'ADJUSTMENT',
            amount: -netDebt,
            reference: voucher.number,
            note: `Suppression du bon ${voucher.number ?? ''} : ${reason}`,
            createdById: requestedById,
          },
        });
      }

      return tx.pendingDeletion.create({
        data: {
          purchaseVoucherId: voucherId,
          manufacturerId: voucher.manufacturerId,
          reason,
          requestedById,
          status: 'APPROVED',
          respondedById: requestedById,
          respondedAt: now,
        },
      });
    });

    await this.auditLog.record({ entityType: 'PurchaseVoucher', entityId: voucherId, action: 'DELETE', reason, actorId: requestedById });

    const actorName = await this.actorName(requestedById);
    const body = `${actorName} a supprimé le bon d'achat ${voucher.number ?? ''} : ${reason}.`;
    if (voucher.manufacturer.user) {
      await this.notifyBoth(voucher.manufacturer.user.id, 'pending_deletion.applied', 'Suppression effectuée', body, {
        pendingDeletionId: pending.id,
      });
    } else {
      await this.notifyStaffOnly('pending_deletion.applied', 'Suppression effectuée', body, { pendingDeletionId: pending.id });
    }

    return pending;
  }

  async requestManufacturerDeletion(manufacturerId: string, reason: string, requestedById: string) {
    const manufacturer = await this.prisma.manufacturer.findFirst({
      where: { id: manufacturerId, deletedAt: null },
      include: { user: { select: { id: true, fullName: true } } },
    });
    if (!manufacturer) throw new NotFoundException('Fabricant introuvable');

    const existing = await this.prisma.pendingDeletion.findFirst({
      where: { manufacturerId, supplierLedgerEntryId: null, status: 'PENDING' },
    });
    if (existing) throw new BadRequestException('Une demande de suppression est déjà en attente pour ce fabricant');

    const now = new Date();
    await this.prisma.manufacturer.update({ where: { id: manufacturerId }, data: { deletedAt: now } });
    await this.trash.moveToTrash({
      entityType: 'Manufacturer',
      entityId: manufacturerId,
      snapshot: manufacturer as unknown as Record<string, unknown>,
      deletedById: requestedById,
      reason,
    });

    const pending = await this.prisma.pendingDeletion.create({
      data: { manufacturerId, reason, requestedById, status: 'APPROVED', respondedById: requestedById, respondedAt: now },
    });

    const actorName = await this.actorName(requestedById);
    const body = `${actorName} a supprimé le fabricant ${manufacturer.name} : ${reason}.`;
    if (manufacturer.user) {
      await this.notifyBoth(manufacturer.user.id, 'pending_deletion.applied', 'Suppression effectuée', body, {
        pendingDeletionId: pending.id,
      });
    } else {
      await this.notifyStaffOnly('pending_deletion.applied', 'Suppression effectuée', body, { pendingDeletionId: pending.id });
    }

    return pending;
  }

  async requestSupplierLedgerEntryDeletion(entryId: string, reason: string, requestedById: string) {
    const entry = await this.prisma.supplierLedgerEntry.findUnique({
      where: { id: entryId },
      include: { manufacturer: { include: { user: { select: { id: true, fullName: true } } } } },
    });
    if (!entry) throw new NotFoundException('Ligne introuvable');
    if (entry.voidedAt) throw new BadRequestException('Cette ligne est déjà supprimée');

    const existing = await this.prisma.pendingDeletion.findFirst({ where: { supplierLedgerEntryId: entryId, status: 'PENDING' } });
    if (existing) throw new BadRequestException('Une demande de suppression est déjà en attente pour cette ligne');

    const now = new Date();
    const [, pending] = await this.prisma.$transaction([
      this.prisma.supplierLedgerEntry.update({ where: { id: entryId }, data: { voidedAt: now } }),
      this.prisma.pendingDeletion.create({
        data: {
          supplierLedgerEntryId: entryId,
          manufacturerId: entry.manufacturerId,
          reason,
          requestedById,
          status: 'APPROVED',
          respondedById: requestedById,
          respondedAt: now,
        },
      }),
    ]);

    await this.auditLog.record({ entityType: 'SupplierLedgerEntry', entityId: entryId, action: 'DELETE', reason, actorId: requestedById });

    const actorName = await this.actorName(requestedById);
    const body = `${actorName} a supprimé une ligne (${entry.type}) : ${reason}.`;
    if (entry.manufacturer.user) {
      await this.notifyBoth(entry.manufacturer.user.id, 'pending_deletion.applied', 'Suppression effectuée', body, {
        pendingDeletionId: pending.id,
      });
    } else {
      await this.notifyStaffOnly('pending_deletion.applied', 'Suppression effectuée', body, { pendingDeletionId: pending.id });
    }

    return pending;
  }

  async listMine(userId: string) {
    const [customer, manufacturer] = await Promise.all([
      this.prisma.customer.findUnique({ where: { userId } }),
      this.prisma.manufacturer.findUnique({ where: { userId } }),
    ]);
    if (!customer && !manufacturer) return [];

    return this.prisma.pendingDeletion.findMany({
      where: {
        OR: [
          ...(customer ? [{ customerId: customer.id }] : []),
          ...(manufacturer ? [{ manufacturerId: manufacturer.id }] : []),
        ],
      },
      include: {
        ledgerEntry: true,
        salesVoucher: { select: { id: true, number: true } },
        purchaseVoucher: { select: { id: true, number: true } },
        supplierLedgerEntry: true,
        manufacturer: { select: { id: true, name: true } },
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
        manufacturer: { select: { id: true, name: true } },
        ledgerEntry: true,
        salesVoucher: { select: { id: true, number: true } },
        purchaseVoucher: { select: { id: true, number: true } },
        supplierLedgerEntry: true,
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
        manufacturer: { include: { user: { select: { id: true, fullName: true } } } },
        ledgerEntry: true,
        salesVoucher: { include: { items: true } },
        purchaseVoucher: { include: { items: true } },
        supplierLedgerEntry: true,
      },
    });
    if (!pending) throw new NotFoundException('Demande introuvable');
    if (pending.status !== 'PENDING') throw new BadRequestException('Cette demande a déjà une réponse');
    if (pending.requestedById === responderId) {
      throw new ForbiddenException("Vous ne pouvez pas approuver votre propre demande — l'autre partie doit répondre");
    }

    const partyUserId = pending.customer?.user.id ?? pending.manufacturer?.user?.id;
    if (!partyUserId) throw new NotFoundException('Partie concernée introuvable');

    const responder = await this.prisma.user.findUnique({ where: { id: responderId }, select: { role: { select: { key: true } } } });
    const isStaff = responder ? ['admin', 'employee'].includes(responder.role.key) : false;
    const isOwningParty = partyUserId === responderId;
    if (!isStaff && !isOwningParty) {
      throw new ForbiddenException("Vous n'êtes pas autorisé à répondre à cette demande");
    }

    if (decision === 'APPROVED') {
      await this.prisma.$transaction(async (tx) => {
        if (pending.ledgerEntry) {
          await tx.ledgerEntry.update({ where: { id: pending.ledgerEntry.id }, data: { voidedAt: new Date() } });
        }

        if (pending.supplierLedgerEntry) {
          await tx.supplierLedgerEntry.update({ where: { id: pending.supplierLedgerEntry.id }, data: { voidedAt: new Date() } });
        }

        if (pending.manufacturerId && !pending.supplierLedgerEntryId && !pending.purchaseVoucherId) {
          await tx.manufacturer.update({ where: { id: pending.manufacturerId }, data: { deletedAt: new Date() } });
        }

        if (pending.purchaseVoucher && pending.purchaseVoucher.status === 'CONFIRMED') {
          const voucher = pending.purchaseVoucher;
          for (const item of voucher.items) {
            const decremented = await tx.product.update({ where: { id: item.productId }, data: { currentStock: { decrement: item.totalUnits } } });
            await tx.stockMovement.create({
              data: {
                productId: item.productId,
                type: 'ADJUSTMENT',
                quantity: -item.totalUnits,
                stockAfter: decremented.currentStock,
                referenceType: 'PurchaseVoucher',
                referenceId: voucher.id,
                reason: `Suppression approuvée du bon ${voucher.number ?? ''} : ${pending.reason}`,
                createdById: responderId,
              },
            });
          }

          const subtotal = voucher.items.reduce((s, i) => s + Number(i.lineTotal), 0);
          const total = subtotal - Number(voucher.discount) + Number(voucher.transportCost);
          const netDebt = total - Number(voucher.paidAmount);
          await tx.supplierLedgerEntry.create({
            data: {
              manufacturerId: voucher.manufacturerId,
              type: 'ADJUSTMENT',
              amount: -netDebt,
              reference: voucher.number,
              note: `Suppression approuvée du bon ${voucher.number ?? ''} : ${pending.reason}`,
              createdById: responderId,
            },
          });
        }

        if (pending.salesVoucher && (pending.salesVoucher.status === 'CONFIRMED' || pending.salesVoucher.status === 'DELIVERED')) {
          const voucher = pending.salesVoucher;
          for (const item of voucher.items) {
            const incremented = await tx.product.update({ where: { id: item.productId }, data: { currentStock: { increment: item.totalUnits } } });
            await tx.stockMovement.create({
              data: {
                productId: item.productId,
                type: 'ADJUSTMENT',
                quantity: item.totalUnits,
                stockAfter: incremented.currentStock,
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

      if (pending.manufacturerId && !pending.supplierLedgerEntryId && !pending.purchaseVoucherId && pending.manufacturer) {
        await this.trash.moveToTrash({
          entityType: 'Manufacturer',
          entityId: pending.manufacturerId,
          snapshot: pending.manufacturer as unknown as Record<string, unknown>,
          deletedById: responderId,
          reason: pending.reason,
        });
      }
    }

    const updated = await this.prisma.pendingDeletion.update({
      where: { id },
      data: { status: decision, respondedById: responderId, respondedAt: new Date() },
    });

    const responderName = await this.actorName(responderId);
    const entityLabel = pending.ledgerEntry
      ? 'la ligne de crédit'
      : pending.supplierLedgerEntry
        ? 'la ligne du fabricant'
        : pending.salesVoucher
          ? `le bon ${pending.salesVoucher.number ?? ''}`
          : pending.purchaseVoucher
            ? `le bon d'achat ${pending.purchaseVoucher.number ?? ''}`
            : `le fabricant ${pending.manufacturer?.name ?? ''}`;
    const entityType = pending.ledgerEntry
      ? 'LedgerEntry'
      : pending.supplierLedgerEntry
        ? 'SupplierLedgerEntry'
        : pending.salesVoucher
          ? 'SalesVoucher'
          : pending.purchaseVoucher
            ? 'PurchaseVoucher'
            : 'Manufacturer';
    const entityId =
      pending.ledgerEntryId ?? pending.supplierLedgerEntryId ?? pending.salesVoucherId ?? pending.purchaseVoucherId ?? (pending.manufacturerId as string);
    await this.auditLog.record({
      entityType,
      entityId,
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
      partyUserId,
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
