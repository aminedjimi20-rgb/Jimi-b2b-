import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { NumberSequenceService } from '../common/services/number-sequence.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UpsertPurchaseVoucherDto } from './dto/upsert-purchase-voucher.dto';
import { CancelVoucherDto } from '../vouchers/dto/cancel-voucher.dto';

@Injectable()
export class PurchaseVouchersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly numberSequence: NumberSequenceService,
    private readonly notifications: NotificationsService,
  ) {}

  private async debtOf(manufacturerId: string) {
    const agg = await this.prisma.supplierLedgerEntry.aggregate({ where: { manufacturerId, voidedAt: null }, _sum: { amount: true } });
    return Number(agg._sum.amount ?? 0);
  }

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

  // Prévient le personnel ET le fabricant (s'il a son propre compte) à
  // chaque action, pour que chacun voit ce que l'autre a fait.
  private async notifyBoth(manufacturerId: string, type: string, title: string, body: string, data: Record<string, unknown> = {}) {
    const [staff, manufacturer] = await Promise.all([
      this.listStaff(),
      this.prisma.manufacturer.findUnique({ where: { id: manufacturerId }, select: { userId: true } }),
    ]);
    const recipientIds = [...staff.map((s) => s.id), ...(manufacturer?.userId ? [manufacturer.userId] : [])];
    await Promise.all(
      recipientIds.map((userId) => this.notifications.notify({ type, title, body, data: { ...data, userId } })),
    );
  }

  list(filters: { status?: string; manufacturerId?: string }) {
    const where: Prisma.PurchaseVoucherWhereInput = {
      deletedAt: null,
      ...(filters.status ? { status: filters.status as never } : {}),
      ...(filters.manufacturerId ? { manufacturerId: filters.manufacturerId } : {}),
    };
    return this.prisma.purchaseVoucher.findMany({
      where,
      include: {
        manufacturer: true,
        buyer: { select: { fullName: true } },
        items: true,
        pendingDeletions: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string) {
    const voucher = await this.prisma.purchaseVoucher.findFirst({
      where: { id, deletedAt: null },
      include: {
        manufacturer: true,
        buyer: { select: { fullName: true } },
        items: {
          include: {
            product: { include: { images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] } } },
            packagingUnit: true,
          },
        },
        attachments: { orderBy: { createdAt: 'desc' } },
        pendingDeletions: { orderBy: { createdAt: 'desc' }, take: 1, include: { requestedBy: { select: { fullName: true } } } },
      },
    });
    if (!voucher) throw new NotFoundException('Bon d’achat introuvable');
    return voucher;
  }

  history(id: string) {
    return this.auditLog.history('PurchaseVoucher', id);
  }

  async addAttachment(voucherId: string, url: string) {
    const voucher = await this.prisma.purchaseVoucher.findFirst({ where: { id: voucherId, deletedAt: null } });
    if (!voucher) throw new NotFoundException('Bon d’achat introuvable');
    await this.prisma.purchaseVoucherAttachment.create({ data: { voucherId, url } });
    return this.getById(voucherId);
  }

  // La suppression d'une photo laisse toujours une trace (audit + notification
  // aux deux parties) — même logique que pour un bon de vente.
  async removeAttachment(voucherId: string, attachmentId: string, actorId?: string) {
    const attachment = await this.prisma.purchaseVoucherAttachment.findFirst({ where: { id: attachmentId, voucherId } });
    if (!attachment) throw new NotFoundException('Pièce jointe introuvable');
    await this.prisma.purchaseVoucherAttachment.delete({ where: { id: attachmentId } });

    const voucher = await this.prisma.purchaseVoucher.findFirst({ where: { id: voucherId } });
    const actorName = await this.actorName(actorId);
    await this.auditLog.record({
      entityType: 'PurchaseVoucher',
      entityId: voucherId,
      action: 'DELETE',
      field: 'attachment',
      oldValue: attachment.url,
      reason: `Photo supprimée par ${actorName}`,
      actorId,
    });

    const updated = await this.getById(voucherId);
    if (voucher) {
      await this.notifyBoth(
        voucher.manufacturerId,
        'purchase.attachment_removed',
        'Photo supprimée',
        `${actorName} a supprimé une photo jointe au bon ${updated.number ?? ''}.`,
        { purchaseVoucherId: voucherId },
      );
    }

    return updated;
  }

  async createDraft(manufacturerId: string, buyerId: string) {
    const manufacturer = await this.prisma.manufacturer.findFirst({ where: { id: manufacturerId, deletedAt: null } });
    if (!manufacturer) throw new BadRequestException('Fabricant introuvable');

    const voucher = await this.prisma.purchaseVoucher.create({ data: { manufacturerId, buyerId, status: 'DRAFT' } });
    return this.getById(voucher.id);
  }

  async update(id: string, dto: UpsertPurchaseVoucherDto, actorId: string) {
    const voucher = await this.prisma.purchaseVoucher.findFirst({ where: { id, deletedAt: null } });
    if (!voucher) throw new NotFoundException('Bon d’achat introuvable');
    if (voucher.status === 'CANCELLED') throw new BadRequestException('Un bon annulé ne peut pas être modifié');

    if (voucher.status === 'DRAFT') return this.updateDraft(id, dto);
    return this.updateConfirmed(id, dto, actorId, voucher);
  }

  private async updateDraft(id: string, dto: UpsertPurchaseVoucherDto) {
    await this.prisma.$transaction(async (tx) => {
      if (dto.items) {
        await tx.purchaseVoucherItem.deleteMany({ where: { voucherId: id } });
        for (const item of dto.items) {
          const product = await tx.product.findFirst({ where: { id: item.productId, deletedAt: null } });
          if (!product) throw new BadRequestException(`Produit ${item.productId} introuvable`);

          const unitsPerPackage = item.unitsPerPackage && item.unitsPerPackage > 0 ? item.unitsPerPackage : product.unitsPerPackage;
          const totalUnits = item.quantityPackages * unitsPerPackage;
          const actualTotalUnits = item.actualTotalUnits != null && item.actualTotalUnits !== totalUnits ? item.actualTotalUnits : null;
          const billedUnits = actualTotalUnits ?? totalUnits;
          await tx.purchaseVoucherItem.create({
            data: {
              voucherId: id,
              productId: product.id,
              packagingUnitId: product.packagingUnitId,
              quantityPackages: item.quantityPackages,
              unitsPerPackageSnapshot: unitsPerPackage,
              totalUnits,
              actualTotalUnits,
              unitCost: item.unitCost,
              lineTotal: billedUnits * item.unitCost,
            },
          });
        }
      }

      await tx.purchaseVoucher.update({
        where: { id },
        data: {
          manufacturerId: dto.manufacturerId,
          discount: dto.discount,
          transportCost: dto.transportCost,
          paidAmount: dto.paidAmount,
          notes: dto.notes,
        },
      });
    });

    return this.getById(id);
  }

  // Modification après confirmation : chaque changement (produit ajouté,
  // retiré, quantité/coût modifiés) recalcule le stock et la dette, se
  // consigne dans l'historique (immuable) et surligne la ligne concernée —
  // même logique que pour un bon de vente confirmé.
  private async updateConfirmed(
    id: string,
    dto: UpsertPurchaseVoucherDto,
    actorId: string,
    existingVoucher: { manufacturerId: string; paidAmount: Prisma.Decimal; discount: Prisma.Decimal; transportCost: Prisma.Decimal; number: string | null },
  ) {
    const manufacturerId = dto.manufacturerId ?? existingVoucher.manufacturerId;
    const actorName = await this.actorName(actorId);
    const changes: string[] = [];

    // Total avant modification — sert à ne répercuter dans le compte
    // fournisseur que l'écart, une fois les changements appliqués plus bas.
    // Le sous-total sert à exprimer la remise en pourcentage, comme sur le
    // bon lui-même.
    const oldItemsForTotal = await this.prisma.purchaseVoucherItem.findMany({ where: { voucherId: id } });
    const oldSubtotal = oldItemsForTotal.reduce((s, i) => s + Number(i.lineTotal), 0);
    const oldDiscount = Number(existingVoucher.discount);
    const oldTransportCost = Number(existingVoucher.transportCost);
    const oldTotal = oldSubtotal - oldDiscount + oldTransportCost;
    const pct = (amount: number, base: number) => (base > 0 ? Math.round((amount / base) * 1000) / 10 : 0);

    // Réduire ou retirer une ligne sur un bon d'achat déjà confirmé retire
    // du stock la quantité correspondante — sans ceci, ça pouvait passer
    // sous zéro en silence si cette marchandise a déjà été vendue depuis.
    if (dto.items && !dto.force) {
      const existingForCheck = await this.prisma.purchaseVoucherItem.findMany({
        where: { voucherId: id },
        include: { product: { select: { nameFr: true, currentStock: true } } },
      });
      const newByProduct = new Map(dto.items.map((i) => [i.productId, i]));

      const shortfalls = existingForCheck
        .map((old) => {
          const newItem = newByProduct.get(old.productId);
          const newUnitsPerPackage = newItem?.unitsPerPackage && newItem.unitsPerPackage > 0 ? newItem.unitsPerPackage : old.unitsPerPackageSnapshot;
          const newTotalUnits = newItem ? newItem.quantityPackages * newUnitsPerPackage : 0;
          const decrease = old.totalUnits - newTotalUnits;
          if (decrease <= 0 || old.product.currentStock >= decrease) return null;
          return { productId: old.productId, name: old.product.nameFr, available: old.product.currentStock, requested: decrease };
        })
        .filter((s): s is { productId: string; name: string; available: number; requested: number } => s !== null);

      if (shortfalls.length > 0) {
        throw new BadRequestException({
          code: 'INSUFFICIENT_STOCK',
          message: 'Stock insuffisant pour retirer ou réduire un ou plusieurs produits',
          shortfalls,
        });
      }
    }

    await this.prisma.$transaction(async (tx) => {
      if (dto.items) {
        const existingItems = await tx.purchaseVoucherItem.findMany({ where: { voucherId: id }, include: { product: { select: { nameFr: true } } } });
        const existingByProduct = new Map(existingItems.map((i) => [i.productId, i]));
        const newProductIds = new Set(dto.items.map((i) => i.productId));

        for (const old of existingItems) {
          if (!newProductIds.has(old.productId)) {
            const revertedProduct = await tx.product.update({ where: { id: old.productId }, data: { currentStock: { decrement: old.totalUnits } } });
            await tx.stockMovement.create({
              data: {
                productId: old.productId,
                type: 'ADJUSTMENT',
                quantity: -old.totalUnits,
                stockAfter: revertedProduct.currentStock,
                referenceType: 'PurchaseVoucher',
                referenceId: id,
                reason: `Retiré du bon d'achat après confirmation par ${actorName}`,
                createdById: actorId,
              },
            });
            changes.push(`Produit retiré : ${old.product.nameFr} (${old.totalUnits} pièces)`);
          }
        }

        await tx.purchaseVoucherItem.deleteMany({ where: { voucherId: id } });

        for (const item of dto.items) {
          const product = await tx.product.findFirst({ where: { id: item.productId, deletedAt: null } });
          if (!product) throw new BadRequestException(`Produit ${item.productId} introuvable`);

          const unitsPerPackage = item.unitsPerPackage && item.unitsPerPackage > 0 ? item.unitsPerPackage : product.unitsPerPackage;
          const totalUnits = item.quantityPackages * unitsPerPackage;
          const actualTotalUnits = item.actualTotalUnits != null && item.actualTotalUnits !== totalUnits ? item.actualTotalUnits : null;
          const billedUnits = actualTotalUnits ?? totalUnits;
          const old = existingByProduct.get(item.productId);
          // Le stock déplacé suit toujours le nombre nominal de cartons reçus
          // (le carton lui-même a bien été ajouté au stock) — seule la
          // facturation (lineTotal) reflète le nombre réel de pièces dedans.
          const delta = totalUnits - (old?.totalUnits ?? 0);
          const isNew = !old;
          const isChanged =
            !!old &&
            (Number(old.unitCost) !== item.unitCost ||
              (old.actualTotalUnits ?? old.totalUnits) !== billedUnits ||
              old.unitsPerPackageSnapshot !== unitsPerPackage);

          // Le catalogue reflète toujours le dernier coût et conditionnement
          // constatés à l'achat — que le stock bouge ou non (ex: correction
          // de prix ou de pièces/carton sans changement de quantité).
          const updatedProduct = await tx.product.update({
            where: { id: product.id },
            data: {
              costPrice: item.unitCost,
              unitsPerPackage,
              ...(delta !== 0 ? { currentStock: { increment: delta } } : {}),
            },
          });
          if (delta !== 0) {
            await tx.stockMovement.create({
              data: {
                productId: product.id,
                type: 'ADJUSTMENT',
                quantity: delta,
                stockAfter: updatedProduct.currentStock,
                referenceType: 'PurchaseVoucher',
                referenceId: id,
                reason: `Modifié après confirmation par ${actorName}`,
                createdById: actorId,
              },
            });
          }

          if (isNew) changes.push(`Produit ajouté : ${product.nameFr} (${billedUnits} pièces)`);
          else if (isChanged) changes.push(`${product.nameFr} : ${old.actualTotalUnits ?? old.totalUnits} → ${billedUnits} pièces, ${old.unitCost} → ${item.unitCost} DA`);

          await tx.purchaseVoucherItem.create({
            data: {
              voucherId: id,
              productId: product.id,
              packagingUnitId: product.packagingUnitId,
              quantityPackages: item.quantityPackages,
              unitsPerPackageSnapshot: unitsPerPackage,
              totalUnits,
              actualTotalUnits,
              unitCost: item.unitCost,
              lineTotal: billedUnits * item.unitCost,
              modifiedAt: isNew || isChanged ? new Date() : old?.modifiedAt ?? null,
            },
          });
        }
      }

      await tx.purchaseVoucher.update({
        where: { id },
        data: { manufacturerId, discount: dto.discount, transportCost: dto.transportCost, paidAmount: dto.paidAmount, notes: dto.notes },
      });

      // Remise et transport : mêmes changements que les articles ci-dessus —
      // jamais tracés jusqu'ici, ni sur le bon ni chez le fournisseur.
      if (dto.discount != null && dto.discount !== oldDiscount) {
        changes.push(
          `Remise : ${pct(oldDiscount, oldSubtotal)}% (${oldDiscount} DA) → ${pct(dto.discount, oldSubtotal)}% (${dto.discount} DA)`,
        );
      }
      if (dto.transportCost != null && dto.transportCost !== oldTransportCost) {
        changes.push(`Transport : ${oldTransportCost} DA → ${dto.transportCost} DA`);
      }

      // Idem pour le total du bon : ajouter/retirer un article, changer la
      // remise ou le transport modifiait le bon mais jamais ce qu'on doit
      // au fournisseur — le compte restait figé sur le montant de la
      // confirmation initiale. Seul l'écart devient une nouvelle écriture,
      // avec le même détail que l'historique du bon.
      const newItemsForTotal = await tx.purchaseVoucherItem.findMany({ where: { voucherId: id } });
      const newTotal =
        newItemsForTotal.reduce((s, i) => s + Number(i.lineTotal), 0) -
        (dto.discount ?? oldDiscount) +
        (dto.transportCost ?? oldTransportCost);
      const totalDelta = newTotal - oldTotal;
      if (totalDelta !== 0) {
        await tx.supplierLedgerEntry.create({
          data: {
            manufacturerId,
            type: 'PURCHASE_VOUCHER',
            amount: totalDelta,
            reference: existingVoucher.number,
            note: `Ajustement du bon ${existingVoucher.number ?? ''} : ${changes.length > 0 ? changes.join(' ; ') : 'après modification'}`,
            createdById: actorId,
          },
        });
      }

      // Même règle que pour les clients : le montant payé du bon n'est
      // qu'un miroir du compte fournisseur — l'écart entre l'ancien et le
      // nouveau montant devient une nouvelle écriture de paiement, jamais
      // une réécriture de l'historique existant.
      if (dto.paidAmount != null) {
        const delta = Number(dto.paidAmount) - Number(existingVoucher.paidAmount);
        if (delta !== 0) {
          changes.push(`Montant payé : ${existingVoucher.paidAmount} DA → ${dto.paidAmount} DA`);
          await tx.supplierLedgerEntry.create({
            data: {
              manufacturerId,
              type: 'PAYMENT',
              amount: -delta,
              reference: existingVoucher.number,
              note: `Ajustement du montant payé sur le bon ${existingVoucher.number ?? ''} (modifié après confirmation)`,
              createdById: actorId,
            },
          });
        }
      }
    });

    if (changes.length > 0) {
      await this.auditLog.record({
        entityType: 'PurchaseVoucher',
        entityId: id,
        action: 'UPDATE',
        field: 'items',
        reason: `Modifié après confirmation par ${actorName} : ${changes.join(' | ')}`,
        actorId,
      });
      const updated = await this.getById(id);
      await this.notifyBoth(
        manufacturerId,
        'purchase.modified_after_confirm',
        'Bon d’achat modifié',
        `${actorName} a modifié le bon ${updated.number ?? ''} après confirmation : ${changes.join(' | ')}`,
        { purchaseVoucherId: id },
      );
    }

    return this.getById(id);
  }

  private computeTotal(voucher: { items: { lineTotal: Prisma.Decimal }[]; discount: Prisma.Decimal; transportCost: Prisma.Decimal }) {
    const subtotal = voucher.items.reduce((s, i) => s + Number(i.lineTotal), 0);
    return subtotal - Number(voucher.discount) + Number(voucher.transportCost);
  }

  async confirm(id: string, actorId: string) {
    const voucher = await this.getById(id);
    if (voucher.status !== 'DRAFT') throw new BadRequestException('Ce bon a déjà été confirmé');
    if (voucher.items.length === 0) throw new BadRequestException('Le bon ne contient aucun produit');

    const total = this.computeTotal(voucher);
    const previousDebt = await this.debtOf(voucher.manufacturerId);
    const number = await this.numberSequence.next('ACH');
    const actorName = await this.actorName(actorId);

    await this.prisma.$transaction(async (tx) => {
      for (const item of voucher.items) {
        const receivedProduct = await tx.product.update({
          where: { id: item.productId },
          data: { currentStock: { increment: item.totalUnits }, costPrice: item.unitCost, unitsPerPackage: item.unitsPerPackageSnapshot },
        });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: 'PURCHASE',
            quantity: item.totalUnits,
            stockAfter: receivedProduct.currentStock,
            referenceType: 'PurchaseVoucher',
            referenceId: voucher.id,
            createdById: actorId,
          },
        });
      }

      await tx.supplierLedgerEntry.create({
        data: { manufacturerId: voucher.manufacturerId, type: 'PURCHASE_VOUCHER', amount: total, reference: number, createdById: actorId },
      });

      if (Number(voucher.paidAmount) > 0) {
        await tx.supplierLedgerEntry.create({
          data: {
            manufacturerId: voucher.manufacturerId,
            type: 'PAYMENT',
            amount: -Number(voucher.paidAmount),
            reference: number,
            note: 'Paiement à la confirmation',
            createdById: actorId,
          },
        });
      }

      await tx.purchaseVoucher.update({ where: { id }, data: { status: 'CONFIRMED', number, confirmedAt: new Date(), previousDebt } });
    });

    await this.auditLog.record({
      entityType: 'PurchaseVoucher',
      entityId: id,
      action: 'UPDATE',
      field: 'status',
      newValue: 'CONFIRMED',
      reason: `Confirmé par ${actorName}`,
      actorId,
    });
    await this.notifyBoth(
      voucher.manufacturerId,
      'purchase.confirmed',
      'Bon d’achat confirmé',
      `${actorName} a confirmé le bon d'achat ${number}.`,
      { purchaseVoucherId: id },
    );
    return this.getById(id);
  }

  async cancel(id: string, dto: CancelVoucherDto, actorId: string) {
    const voucher = await this.getById(id);
    if (voucher.status === 'CANCELLED') throw new BadRequestException('Ce bon est déjà annulé');

    const wasConfirmed = voucher.status === 'CONFIRMED';
    const actorName = await this.actorName(actorId);

    await this.prisma.$transaction(async (tx) => {
      if (wasConfirmed) {
        for (const item of voucher.items) {
          const revertedProduct = await tx.product.update({ where: { id: item.productId }, data: { currentStock: { decrement: item.totalUnits } } });
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type: 'ADJUSTMENT',
              quantity: -item.totalUnits,
              stockAfter: revertedProduct.currentStock,
              referenceType: 'PurchaseVoucher',
              referenceId: voucher.id,
              reason: `Annulation bon d'achat par ${actorName} : ${dto.reason}`,
              createdById: actorId,
            },
          });
        }

        const total = this.computeTotal(voucher);
        const netDebt = total - Number(voucher.paidAmount);
        await tx.supplierLedgerEntry.create({
          data: {
            manufacturerId: voucher.manufacturerId,
            type: 'ADJUSTMENT',
            amount: -netDebt,
            reference: voucher.number,
            note: `Annulation du bon ${voucher.number} : ${dto.reason}`,
            createdById: actorId,
          },
        });
      }

      await tx.purchaseVoucher.update({ where: { id }, data: { status: 'CANCELLED', cancelReason: dto.reason } });
    });

    await this.auditLog.record({
      entityType: 'PurchaseVoucher',
      entityId: id,
      action: 'UPDATE',
      field: 'status',
      newValue: 'CANCELLED',
      reason: `Annulé par ${actorName} : ${dto.reason}`,
      actorId,
    });
    await this.notifyBoth(
      voucher.manufacturerId,
      'purchase.cancelled',
      'Bon d’achat annulé',
      `${actorName} a annulé le bon ${voucher.number ?? ''} : ${dto.reason}`,
      { purchaseVoucherId: id },
    );
    return this.getById(id);
  }

  // Symétrique de cancel() : réapplique le stock et la dette, sans jamais
  // effacer la trace de l'annulation d'origine — la raison d'annulation
  // reste visible, un nouvel historique consigne le retour en confirmé.
  async revertCancel(id: string, actorId: string) {
    const voucher = await this.getById(id);
    if (voucher.status !== 'CANCELLED') throw new BadRequestException("Seul un bon annulé peut être ré-activé");
    if (!voucher.confirmedAt) throw new BadRequestException("Ce bon n'avait jamais été confirmé");

    const actorName = await this.actorName(actorId);

    await this.prisma.$transaction(async (tx) => {
      for (const item of voucher.items) {
        const revivedProduct = await tx.product.update({ where: { id: item.productId }, data: { currentStock: { increment: item.totalUnits } } });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: 'PURCHASE',
            quantity: item.totalUnits,
            stockAfter: revivedProduct.currentStock,
            referenceType: 'PurchaseVoucher',
            referenceId: voucher.id,
            reason: `Annulation du bon d'achat annulée par ${actorName}`,
            createdById: actorId,
          },
        });
      }

      const total = this.computeTotal(voucher);
      const netDebt = total - Number(voucher.paidAmount);
      await tx.supplierLedgerEntry.create({
        data: {
          manufacturerId: voucher.manufacturerId,
          type: 'ADJUSTMENT',
          amount: netDebt,
          reference: voucher.number,
          note: `Annulation du bon ${voucher.number} annulée par ${actorName} — le bon redevient confirmé`,
          createdById: actorId,
        },
      });

      await tx.purchaseVoucher.update({ where: { id }, data: { status: 'CONFIRMED' } });
    });

    await this.auditLog.record({
      entityType: 'PurchaseVoucher',
      entityId: id,
      action: 'UPDATE',
      field: 'status',
      newValue: 'CONFIRMED',
      reason: `Annulation annulée par ${actorName} — le bon redevient confirmé`,
      actorId,
    });
    await this.notifyBoth(
      voucher.manufacturerId,
      'purchase.cancel_reverted',
      'Annulation annulée',
      `${actorName} a annulé l'annulation du bon ${voucher.number ?? ''} — il redevient confirmé.`,
      { purchaseVoucherId: id },
    );
    return this.getById(id);
  }

  async remove(id: string, actorId: string) {
    const voucher = await this.prisma.purchaseVoucher.findFirst({ where: { id, deletedAt: null } });
    if (!voucher) throw new NotFoundException('Bon d’achat introuvable');
    if (voucher.status !== 'DRAFT') throw new BadRequestException('Seul un brouillon peut être supprimé directement — utilisez la demande de suppression pour un bon confirmé');

    await this.prisma.purchaseVoucher.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.auditLog.record({ entityType: 'PurchaseVoucher', entityId: id, action: 'DELETE', actorId });
    return { id };
  }
}
