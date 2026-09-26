import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { NumberSequenceService } from '../common/services/number-sequence.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UpsertVoucherDto } from './dto/upsert-voucher.dto';
import { CancelVoucherDto } from './dto/cancel-voucher.dto';

const ROLE_TO_TIER_KEY: Record<string, string> = {
  wholesaler: 'wholesale',
  retailer: 'retail',
};

export interface VoucherListFilters {
  status?: string;
  customerId?: string;
  hidden?: boolean;
  dateFrom?: string;
  dateTo?: string;
  depot?: string;
}

@Injectable()
export class VouchersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly numberSequence: NumberSequenceService,
    private readonly notifications: NotificationsService,
  ) {}

  private async balanceOf(customerId: string): Promise<number> {
    const agg = await this.prisma.ledgerEntry.aggregate({ where: { customerId, voidedAt: null }, _sum: { amount: true } });
    return Number(agg._sum.amount ?? 0);
  }

  async list(filters: VoucherListFilters) {
    const where: Prisma.SalesVoucherWhereInput = {
      deletedAt: null,
      hidden: filters.hidden ?? false,
      ...(filters.status ? { status: filters.status as never } : {}),
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
      ...(filters.depot ? { depot: filters.depot } : {}),
      ...(filters.dateFrom || filters.dateTo
        ? {
            createdAt: {
              ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
              ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
            },
          }
        : {}),
    };

    return this.prisma.salesVoucher.findMany({
      where,
      include: {
        customer: { include: { user: { select: { fullName: true } } } },
        seller: { select: { fullName: true } },
        items: true,
        pendingDeletions: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string) {
    const voucher = await this.prisma.salesVoucher.findFirst({
      where: { id, deletedAt: null },
      include: {
        customer: { include: { user: { select: { id: true, fullName: true, phone: true } } } },
        seller: { select: { fullName: true } },
        items: {
          include: {
            product: { include: { images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] } } },
            priceTierType: true,
            packagingUnit: true,
          },
        },
        attachments: { orderBy: { createdAt: 'desc' } },
        pendingDeletions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { requestedBy: { select: { fullName: true } } },
        },
      },
    });
    if (!voucher) throw new NotFoundException('Bon introuvable');
    return voucher;
  }

  async addAttachment(voucherId: string, url: string) {
    const voucher = await this.prisma.salesVoucher.findFirst({ where: { id: voucherId, deletedAt: null } });
    if (!voucher) throw new NotFoundException('Bon introuvable');
    await this.prisma.voucherAttachment.create({ data: { voucherId, url } });
    return this.getById(voucherId);
  }

  // La suppression d'une photo laisse toujours une trace (audit + notification
  // aux deux parties) — impossible de savoir sinon qui a retiré quoi.
  async removeAttachment(voucherId: string, attachmentId: string, actorId?: string) {
    const attachment = await this.prisma.voucherAttachment.findFirst({ where: { id: attachmentId, voucherId } });
    if (!attachment) throw new NotFoundException('Pièce jointe introuvable');
    await this.prisma.voucherAttachment.delete({ where: { id: attachmentId } });

    const actorName = await this.actorName(actorId);
    await this.auditLog.record({
      entityType: 'SalesVoucher',
      entityId: voucherId,
      action: 'DELETE',
      field: 'attachment',
      oldValue: attachment.url,
      reason: `Photo supprimée par ${actorName}`,
      actorId,
    });

    const updated = await this.getById(voucherId);
    await this.notifyBoth(
      updated.customer.user.id,
      'order.attachment_removed',
      'Photo supprimée',
      `${actorName} a supprimé une photo jointe au bon ${updated.number ?? ''}.`,
      { voucherId },
    );

    return updated;
  }

  async addAttachmentMine(userId: string, voucherId: string, url: string) {
    await this.assertOwnVoucher(userId, voucherId);
    return this.addAttachment(voucherId, url);
  }

  async removeAttachmentMine(userId: string, voucherId: string, attachmentId: string) {
    await this.assertOwnVoucher(userId, voucherId);
    return this.removeAttachment(voucherId, attachmentId, userId);
  }

  /** Personnel pouvant être désigné responsable du chargement d'un bon (admin + employés). */
  listStaff() {
    return this.prisma.user.findMany({
      where: { deletedAt: null, role: { key: { in: ['admin', 'employee'] } } },
      select: { id: true, fullName: true },
      orderBy: { fullName: 'asc' },
    });
  }

  private async actorName(actorId?: string | null): Promise<string> {
    if (!actorId) return 'Un utilisateur';
    const actor = await this.prisma.user.findUnique({ where: { id: actorId }, select: { fullName: true } });
    return actor?.fullName ?? 'Un utilisateur';
  }

  /**
   * Prévient les deux parties d'un événement sur le bon — le client ET le
   * personnel (admin + employés) — quelle que soit celle qui a déclenché
   * l'action, pour que chacun voie ce que l'autre a fait.
   */
  private async notifyBoth(customerUserId: string, type: string, title: string, body: string, data: Record<string, unknown> = {}) {
    const staff = await this.listStaff();
    const recipientIds = [customerUserId, ...staff.map((s) => s.id)];
    await Promise.all(
      recipientIds.map((userId) => this.notifications.notify({ type, title, body, data: { ...data, userId } })),
    );
  }

  /** Historique immuable des événements du bon (confirmation, modification, annulation...). */
  history(id: string) {
    return this.auditLog.history('SalesVoucher', id);
  }

  async setLoadedBy(voucherId: string, loadedById: string | null) {
    const voucher = await this.prisma.salesVoucher.findFirst({ where: { id: voucherId, deletedAt: null } });
    if (!voucher) throw new NotFoundException('Bon introuvable');
    await this.prisma.salesVoucher.update({ where: { id: voucherId }, data: { loadedById } });
    return this.getById(voucherId);
  }

  async setDepot(voucherId: string, depot: string | null) {
    const voucher = await this.prisma.salesVoucher.findFirst({ where: { id: voucherId, deletedAt: null } });
    if (!voucher) throw new NotFoundException('Bon introuvable');
    await this.prisma.salesVoucher.update({ where: { id: voucherId }, data: { depot } });
    return this.getById(voucherId);
  }

  /** Coché par la personne qui charge le camion — checklist anti-oubli, indépendante du statut du bon. */
  async setItemLoaded(voucherId: string, itemId: string, loaded: boolean) {
    const item = await this.prisma.salesVoucherItem.findFirst({ where: { id: itemId, voucherId } });
    if (!item) throw new NotFoundException('Ligne du bon introuvable');
    await this.prisma.salesVoucherItem.update({ where: { id: itemId }, data: { isLoaded: loaded } });
    return this.getById(voucherId);
  }

  async createDraft(customerId: string, sellerId: string) {
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, deletedAt: null } });
    if (!customer) throw new BadRequestException('Client introuvable');

    const voucher = await this.prisma.salesVoucher.create({
      data: { customerId, sellerId, status: 'DRAFT' },
    });
    return this.getById(voucher.id);
  }

  /** Bon de commande de l'espace client — un client ne voit et ne modifie que ses propres bons. */
  async listMine(userId: string) {
    const customer = await this.prisma.customer.findUnique({ where: { userId } });
    if (!customer) return [];
    return this.list({ customerId: customer.id, hidden: false });
  }

  async getOrCreateOwnDraft(userId: string) {
    const customer = await this.prisma.customer.findUnique({ where: { userId }, include: { user: { select: { fullName: true } } } });
    if (!customer) throw new NotFoundException('Aucun dossier client associé à ce compte');

    const existingDraft = await this.prisma.salesVoucher.findFirst({
      where: { customerId: customer.id, status: 'DRAFT', deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (existingDraft) return this.getById(existingDraft.id);

    const voucher = await this.prisma.salesVoucher.create({
      data: { customerId: customer.id, sellerId: userId, status: 'DRAFT' },
    });

    await this.notifications.notify({
      type: 'order.draft_started',
      title: 'Nouvelle commande en préparation',
      body: `${customer.user.fullName} prépare une commande depuis le catalogue`,
      data: { voucherId: voucher.id },
    });

    return this.getById(voucher.id);
  }

  private async assertOwnVoucher(userId: string, id: string) {
    const voucher = await this.prisma.salesVoucher.findFirst({
      where: { id, deletedAt: null },
      include: { customer: true },
    });
    if (!voucher || voucher.customer.userId !== userId) throw new NotFoundException('Bon introuvable');
    return voucher;
  }

  async getMineById(userId: string, id: string) {
    await this.assertOwnVoucher(userId, id);
    return this.getById(id);
  }

  async updateMine(userId: string, id: string, dto: UpsertVoucherDto) {
    const voucher = await this.assertOwnVoucher(userId, id);
    if (voucher.status !== 'DRAFT') throw new BadRequestException('Seul un brouillon peut être modifié librement');
    const { customerId: _customerId, ...rest } = dto;
    return this.updateDraft(id, rest, voucher.customerId);
  }

  private async resolveTierForCustomer(customerId: string) {
    const customer = await this.prisma.customer.findUniqueOrThrow({
      where: { id: customerId },
      include: { user: { include: { role: true } } },
    });
    const tierKey = ROLE_TO_TIER_KEY[customer.user.role.key];
    if (!tierKey) {
      throw new BadRequestException(
        `Impossible de déterminer le niveau de prix pour le rôle "${customer.user.role.key}"`,
      );
    }
    const tier = await this.prisma.priceTierType.findUniqueOrThrow({ where: { key: tierKey } });
    return tier;
  }

  /**
   * Point d'entrée unique pour "Modifier" : un brouillon se modifie
   * librement (comme avant), un bon confirmé/livré se modifie avec un
   * historique et un ajustement de stock (voir updateConfirmed), un bon
   * annulé ne se modifie plus du tout (il faut d'abord le réactiver).
   */
  async update(id: string, dto: UpsertVoucherDto, actorId: string) {
    const voucher = await this.prisma.salesVoucher.findFirst({ where: { id, deletedAt: null } });
    if (!voucher) throw new NotFoundException('Bon introuvable');
    if (voucher.status === 'CANCELLED') {
      throw new BadRequestException('Un bon annulé ne peut pas être modifié — réactivez-le d\'abord');
    }
    if (voucher.status === 'DRAFT') {
      return this.updateDraft(id, dto, dto.customerId ?? voucher.customerId);
    }
    return this.updateConfirmed(id, dto, actorId, voucher);
  }

  private async updateDraft(id: string, dto: UpsertVoucherDto, customerId: string) {
    await this.prisma.$transaction(async (tx) => {
      if (dto.items) {
        const tier = await this.resolveTierForCustomer(customerId);

        await tx.salesVoucherItem.deleteMany({ where: { voucherId: id } });

        for (const item of dto.items) {
          const product = await tx.product.findFirst({ where: { id: item.productId, deletedAt: null } });
          if (!product) throw new BadRequestException(`Produit ${item.productId} introuvable`);

          const price = await tx.productPrice.findUnique({
            where: { productId_priceTierTypeId: { productId: product.id, priceTierTypeId: tier.id } },
          });
          if (!price) throw new BadRequestException(`Aucun prix "${tier.label}" défini pour ${product.nameFr}`);

          const totalUnits = item.quantityPackages * product.unitsPerPackage;
          const unitPrice = Number(price.price);
          const actualTotalUnits =
            item.actualTotalUnits != null && item.actualTotalUnits !== totalUnits ? item.actualTotalUnits : null;
          const billedUnits = actualTotalUnits ?? totalUnits;

          await tx.salesVoucherItem.create({
            data: {
              voucherId: id,
              productId: product.id,
              priceTierTypeId: tier.id,
              packagingUnitId: product.packagingUnitId,
              quantityPackages: item.quantityPackages,
              unitsPerPackageSnapshot: product.unitsPerPackage,
              totalUnits,
              actualTotalUnits,
              unitPrice,
              lineTotal: billedUnits * unitPrice,
            },
          });
        }
      }

      await tx.salesVoucher.update({
        where: { id },
        data: {
          customerId,
          discount: dto.discount,
          transportCost: dto.transportCost,
          paidAmount: dto.paidAmount,
          notes: dto.notes,
        },
      });
    });

    return this.getById(id);
  }

  /**
   * Modifier un bon déjà confirmé (ou livré) : contrairement au brouillon,
   * le stock a déjà été décrémenté à la confirmation, donc chaque
   * changement de quantité (ajout, retrait, produit en plus ou en moins)
   * doit ajuster le stock du delta exact plutôt que tout recalculer à
   * l'aveugle. Chaque changement réel est journalisé (AuditLog, immuable)
   * et notifié au client ET au personnel, et la ligne touchée est marquée
   * (modifiedAt) pour être surlignée dans la liste.
   */
  private async updateConfirmed(
    id: string,
    dto: UpsertVoucherDto,
    actorId: string,
    existingVoucher: { customerId: string; paidAmount: Prisma.Decimal; discount: Prisma.Decimal; transportCost: Prisma.Decimal; number: string | null },
  ) {
    const customerId = dto.customerId ?? existingVoucher.customerId;
    const actorName = await this.actorName(actorId);
    const changes: string[] = [];

    // Total avant modification (articles + remise + transport actuels) —
    // sert à ne répercuter dans le compte client que l'écart, une fois les
    // changements appliqués plus bas. Le sous-total sert à exprimer la
    // remise en pourcentage dans l'historique, comme sur le bon lui-même.
    const oldItemsForTotal = await this.prisma.salesVoucherItem.findMany({ where: { voucherId: id } });
    const oldSubtotal = oldItemsForTotal.reduce((s, i) => s + Number(i.lineTotal), 0);
    const oldDiscount = Number(existingVoucher.discount);
    const oldTransportCost = Number(existingVoucher.transportCost);
    const oldTotal = oldSubtotal - oldDiscount + oldTransportCost;
    const pct = (amount: number, base: number) => (base > 0 ? Math.round((amount / base) * 1000) / 10 : 0);

    // Même garde-fou qu'à la confirmation initiale : augmenter une quantité
    // sur un bon déjà confirmé décrémente le stock sans le recalcul complet
    // du confirm() — sans ceci, le stock pouvait passer sous zéro en
    // silence. On avertit et on laisse forcer, plutôt que de bloquer (la
    // marchandise peut être en route, pas encore saisie en achat).
    if (dto.items && !dto.force) {
      const existingForCheck = await this.prisma.salesVoucherItem.findMany({ where: { voucherId: id } });
      const existingByProductForCheck = new Map(existingForCheck.map((i) => [i.productId, i]));
      const products = await this.prisma.product.findMany({ where: { id: { in: dto.items.map((i) => i.productId) } } });
      const productById = new Map(products.map((p) => [p.id, p]));

      const shortfalls = dto.items
        .map((item) => {
          const product = productById.get(item.productId);
          if (!product) return null;
          const old = existingByProductForCheck.get(item.productId);
          const delta = item.quantityPackages * product.unitsPerPackage - (old?.totalUnits ?? 0);
          if (delta <= 0 || product.currentStock >= delta) return null;
          return { productId: item.productId, name: product.nameFr, available: product.currentStock, requested: delta };
        })
        .filter((s): s is { productId: string; name: string; available: number; requested: number } => s !== null);

      if (shortfalls.length > 0) {
        throw new BadRequestException({
          code: 'INSUFFICIENT_STOCK',
          message: 'Stock insuffisant pour un ou plusieurs produits',
          shortfalls,
        });
      }
    }

    await this.prisma.$transaction(async (tx) => {
      if (dto.items) {
        const tier = await this.resolveTierForCustomer(customerId);
        const existingItems = await tx.salesVoucherItem.findMany({
          where: { voucherId: id },
          include: { product: { select: { nameFr: true } } },
        });
        const existingByProduct = new Map(existingItems.map((i) => [i.productId, i]));
        const newProductIds = new Set(dto.items.map((i) => i.productId));

        for (const old of existingItems) {
          if (!newProductIds.has(old.productId)) {
            const oldBilled = old.actualTotalUnits ?? old.totalUnits;
            const revertedProduct = await tx.product.update({ where: { id: old.productId }, data: { currentStock: { increment: old.totalUnits } } });
            await tx.stockMovement.create({
              data: {
                productId: old.productId,
                type: 'ADJUSTMENT',
                quantity: old.totalUnits,
                stockAfter: revertedProduct.currentStock,
                referenceType: 'SalesVoucher',
                referenceId: id,
                reason: `Retiré du bon après confirmation par ${actorName}`,
                createdById: actorId,
              },
            });
            changes.push(`Produit retiré : ${old.product.nameFr} (${oldBilled} pièces)`);
          }
        }

        await tx.salesVoucherItem.deleteMany({ where: { voucherId: id } });

        for (const item of dto.items) {
          const product = await tx.product.findFirst({ where: { id: item.productId, deletedAt: null } });
          if (!product) throw new BadRequestException(`Produit ${item.productId} introuvable`);

          const price = await tx.productPrice.findUnique({
            where: { productId_priceTierTypeId: { productId: product.id, priceTierTypeId: tier.id } },
          });
          if (!price) throw new BadRequestException(`Aucun prix "${tier.label}" défini pour ${product.nameFr}`);

          const totalUnits = item.quantityPackages * product.unitsPerPackage;
          const unitPrice = Number(price.price);
          const actualTotalUnits =
            item.actualTotalUnits != null && item.actualTotalUnits !== totalUnits ? item.actualTotalUnits : null;
          const billedUnits = actualTotalUnits ?? totalUnits;

          const old = existingByProduct.get(item.productId);
          const delta = totalUnits - (old?.totalUnits ?? 0);
          const isNew = !old;
          const isChanged = !!old && (old.actualTotalUnits ?? old.totalUnits) !== billedUnits;

          if (delta !== 0) {
            const adjustedProduct = await tx.product.update({ where: { id: product.id }, data: { currentStock: { decrement: delta } } });
            await tx.stockMovement.create({
              data: {
                productId: product.id,
                type: 'ADJUSTMENT',
                quantity: -delta,
                stockAfter: adjustedProduct.currentStock,
                referenceType: 'SalesVoucher',
                referenceId: id,
                reason: `Modifié après confirmation par ${actorName}`,
                createdById: actorId,
              },
            });
          }

          if (isNew) changes.push(`Produit ajouté : ${product.nameFr} (${billedUnits} pièces)`);
          else if (isChanged) changes.push(`${product.nameFr} : ${old.actualTotalUnits ?? old.totalUnits} → ${billedUnits} pièces`);

          await tx.salesVoucherItem.create({
            data: {
              voucherId: id,
              productId: product.id,
              priceTierTypeId: tier.id,
              packagingUnitId: product.packagingUnitId,
              quantityPackages: item.quantityPackages,
              unitsPerPackageSnapshot: product.unitsPerPackage,
              totalUnits,
              actualTotalUnits,
              unitPrice,
              lineTotal: billedUnits * unitPrice,
              modifiedAt: isNew || isChanged ? new Date() : old?.modifiedAt ?? null,
            },
          });
        }
      }

      await tx.salesVoucher.update({
        where: { id },
        data: {
          customerId,
          discount: dto.discount,
          transportCost: dto.transportCost,
          paidAmount: dto.paidAmount,
          notes: dto.notes,
        },
      });

      // Remise et transport : mêmes changements que les articles ci-dessus —
      // jamais tracés jusqu'ici, ni sur le bon ni chez le client. La remise
      // se décrit en pourcentage (comme le pense l'utilisateur), le montant
      // exact restant entre parenthèses.
      if (dto.discount != null && dto.discount !== oldDiscount) {
        changes.push(
          `Remise : ${pct(oldDiscount, oldSubtotal)}% (${oldDiscount} DA) → ${pct(dto.discount, oldSubtotal)}% (${dto.discount} DA)`,
        );
      }
      if (dto.transportCost != null && dto.transportCost !== oldTransportCost) {
        changes.push(`Transport : ${oldTransportCost} DA → ${dto.transportCost} DA`);
      }

      // Idem pour le total du bon lui-même : ajouter/retirer un article,
      // changer la remise ou le transport modifiait le bon mais jamais ce
      // que le client doit — le compte client restait figé sur le montant
      // de la confirmation initiale. Seul l'écart de total devient une
      // nouvelle écriture "Bon de vente" (jamais de réécriture), avec le
      // même détail que l'historique du bon pour qu'on sache pourquoi.
      const newItemsForTotal = await tx.salesVoucherItem.findMany({ where: { voucherId: id } });
      const newTotal =
        newItemsForTotal.reduce((s, i) => s + Number(i.lineTotal), 0) -
        (dto.discount ?? oldDiscount) +
        (dto.transportCost ?? oldTransportCost);
      const totalDelta = newTotal - oldTotal;
      if (totalDelta !== 0) {
        await tx.ledgerEntry.create({
          data: {
            customerId,
            type: 'SALE_VOUCHER',
            amount: totalDelta,
            reference: existingVoucher.number,
            note: `Ajustement du bon ${existingVoucher.number ?? ''} : ${changes.length > 0 ? changes.join(' ; ') : 'après modification'}`,
            createdById: actorId,
          },
        });
      }

      // Le montant payé du bon n'est qu'un miroir du compte client — sans
      // ceci, le modifier après confirmation changeait le bon mais jamais
      // le solde/l'historique du client (ni le sien). On ne réécrit jamais
      // une écriture existante (§ pattern réversion) : seul l'écart se
      // traduit en une nouvelle écriture de paiement.
      if (dto.paidAmount != null) {
        const delta = Number(dto.paidAmount) - Number(existingVoucher.paidAmount);
        if (delta !== 0) {
          changes.push(`Montant payé : ${existingVoucher.paidAmount} DA → ${dto.paidAmount} DA`);
          await tx.ledgerEntry.create({
            data: {
              customerId,
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
        entityType: 'SalesVoucher',
        entityId: id,
        action: 'UPDATE',
        field: 'items',
        reason: `Modifié après confirmation par ${actorName} : ${changes.join(' | ')}`,
        actorId,
      });

      const updated = await this.getById(id);
      await this.notifyBoth(
        updated.customer.user.id,
        'order.modified_after_confirm',
        'Bon modifié',
        `${actorName} a modifié le bon ${updated.number ?? ''} après confirmation : ${changes.join(' | ')}`,
        { voucherId: id },
      );
    }

    return this.getById(id);
  }

  private computeTotal(voucher: { items: { lineTotal: Prisma.Decimal }[]; discount: Prisma.Decimal; transportCost: Prisma.Decimal }) {
    const subtotal = voucher.items.reduce((sum, i) => sum + Number(i.lineTotal), 0);
    return subtotal - Number(voucher.discount) + Number(voucher.transportCost);
  }

  async confirm(id: string, actorId: string, force = false) {
    const voucher = await this.getById(id);
    if (voucher.status !== 'DRAFT') throw new BadRequestException('Ce bon a déjà été confirmé');
    if (voucher.items.length === 0) throw new BadRequestException('Le bon ne contient aucun produit');

    // Le stock peut ne pas encore refléter une réception réelle (marchandise
    // pas encore saisie) — on laisse la main à l'utilisateur pour confirmer
    // malgré tout (le stock devient négatif) plutôt que de bloquer la vente.
    const shortfalls = voucher.items
      .filter((item) => item.product.currentStock < item.totalUnits)
      .map((item) => ({
        productId: item.productId,
        name: item.product.nameFr,
        available: item.product.currentStock,
        requested: item.totalUnits,
      }));

    if (shortfalls.length > 0 && !force) {
      throw new BadRequestException({
        code: 'INSUFFICIENT_STOCK',
        message: 'Stock insuffisant pour un ou plusieurs produits',
        shortfalls,
      });
    }

    const total = this.computeTotal(voucher);
    const previousCredit = await this.balanceOf(voucher.customerId);
    const number = await this.numberSequence.next('BL');

    await this.prisma.$transaction(async (tx) => {
      for (const item of voucher.items) {
        const soldProduct = await tx.product.update({
          where: { id: item.productId },
          data: { currentStock: { decrement: item.totalUnits } },
        });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: 'SALE',
            quantity: -item.totalUnits,
            stockAfter: soldProduct.currentStock,
            referenceType: 'SalesVoucher',
            referenceId: voucher.id,
            createdById: actorId,
          },
        });
        // Fige le coût au moment de la vente : si le coût catalogue change plus
        // tard (nouvel achat, correction), la marge de ce bon ne doit pas bouger.
        await tx.salesVoucherItem.update({
          where: { id: item.id },
          data: { costPriceSnapshot: item.product.costPrice },
        });
      }

      await tx.ledgerEntry.create({
        data: {
          customerId: voucher.customerId,
          type: 'SALE_VOUCHER',
          amount: total,
          reference: number,
          createdById: actorId,
        },
      });

      if (Number(voucher.paidAmount) > 0) {
        await tx.ledgerEntry.create({
          data: {
            customerId: voucher.customerId,
            type: 'PAYMENT',
            amount: -Number(voucher.paidAmount),
            reference: number,
            note: 'Paiement à la confirmation du bon',
            createdById: actorId,
          },
        });
      }

      await tx.salesVoucher.update({
        where: { id },
        data: { status: 'CONFIRMED', number, confirmedAt: new Date(), previousCredit },
      });
    });

    await this.auditLog.record({ entityType: 'SalesVoucher', entityId: id, action: 'UPDATE', field: 'status', newValue: 'CONFIRMED', actorId });
    await this.notifications.notify({
      type: 'order.confirmed',
      title: 'Bon confirmé',
      body: `Bon ${number} confirmé — total ${total} DA`,
      data: { voucherId: id, userId: voucher.customer.user.id },
    });

    return this.getById(id);
  }

  async deliver(id: string, actorId: string) {
    const voucher = await this.prisma.salesVoucher.findFirst({ where: { id, deletedAt: null } });
    if (!voucher) throw new NotFoundException('Bon introuvable');
    if (voucher.status !== 'CONFIRMED') throw new BadRequestException('Seul un bon confirmé peut être livré');

    await this.prisma.salesVoucher.update({ where: { id }, data: { status: 'DELIVERED', deliveredAt: new Date() } });
    const actorName = await this.actorName(actorId);
    await this.auditLog.record({
      entityType: 'SalesVoucher',
      entityId: id,
      action: 'UPDATE',
      field: 'status',
      newValue: 'DELIVERED',
      reason: `Marqué comme livré par ${actorName}`,
      actorId,
    });

    const updated = await this.getById(id);
    await this.notifyBoth(
      updated.customer.user.id,
      'order.delivered',
      'Bon livré',
      `${actorName} a marqué le bon ${updated.number ?? ''} comme livré.`,
      { voucherId: id },
    );

    return updated;
  }

  async cancel(id: string, dto: CancelVoucherDto, actorId: string) {
    const voucher = await this.getById(id);
    if (voucher.status === 'CANCELLED') throw new BadRequestException('Ce bon est déjà annulé');
    if (voucher.status === 'DELIVERED') {
      throw new BadRequestException('Un bon déjà livré ne peut plus être annulé — utilisez un retour');
    }

    const wasConfirmed = voucher.status === 'CONFIRMED';

    await this.prisma.$transaction(async (tx) => {
      if (wasConfirmed) {
        for (const item of voucher.items) {
          const restoredProduct = await tx.product.update({
            where: { id: item.productId },
            data: { currentStock: { increment: item.totalUnits } },
          });
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type: 'SALE_CANCEL',
              quantity: item.totalUnits,
              stockAfter: restoredProduct.currentStock,
              referenceType: 'SalesVoucher',
              referenceId: voucher.id,
              reason: dto.reason,
              createdById: actorId,
            },
          });
        }

        const total = this.computeTotal(voucher);
        const netCredit = total - Number(voucher.paidAmount);
        await tx.ledgerEntry.create({
          data: {
            customerId: voucher.customerId,
            type: 'ADJUSTMENT',
            amount: -netCredit,
            reference: voucher.number,
            note: `Annulation du bon ${voucher.number} : ${dto.reason}`,
            createdById: actorId,
          },
        });
      }

      await tx.salesVoucher.update({
        where: { id },
        data: { status: 'CANCELLED', cancelReason: dto.reason },
      });
    });

    const actorName = await this.actorName(actorId);
    await this.auditLog.record({
      entityType: 'SalesVoucher',
      entityId: id,
      action: 'UPDATE',
      field: 'status',
      newValue: 'CANCELLED',
      reason: `Annulé par ${actorName} : ${dto.reason}`,
      actorId,
    });

    const updated = await this.getById(id);
    await this.notifyBoth(
      updated.customer.user.id,
      'order.cancelled',
      'Bon annulé',
      `${actorName} a annulé le bon ${updated.number ?? ''} : ${dto.reason}`,
      { voucherId: id },
    );

    return updated;
  }

  /**
   * Réactive un bon annulé — remet le stock et le crédit client dans l'état
   * "confirmé" (inverse exact de cancel()). Ne supprime jamais la trace de
   * l'annulation d'origine, qui reste dans l'historique : on ajoute
   * simplement un nouvel événement "annulation annulée" par-dessus.
   */
  async revertCancel(id: string, actorId: string) {
    const voucher = await this.getById(id);
    if (voucher.status !== 'CANCELLED') throw new BadRequestException('Seul un bon annulé peut être réactivé');
    if (!voucher.confirmedAt) throw new BadRequestException("Ce bon n'avait jamais été confirmé");

    const actorName = await this.actorName(actorId);

    await this.prisma.$transaction(async (tx) => {
      for (const item of voucher.items) {
        const revivedProduct = await tx.product.update({ where: { id: item.productId }, data: { currentStock: { decrement: item.totalUnits } } });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: 'SALE',
            quantity: -item.totalUnits,
            stockAfter: revivedProduct.currentStock,
            referenceType: 'SalesVoucher',
            referenceId: id,
            reason: `Annulation du bon annulée par ${actorName}`,
            createdById: actorId,
          },
        });
      }

      const total = this.computeTotal(voucher);
      const netCredit = total - Number(voucher.paidAmount);
      await tx.ledgerEntry.create({
        data: {
          customerId: voucher.customerId,
          type: 'ADJUSTMENT',
          amount: netCredit,
          reference: voucher.number,
          note: `Annulation du bon ${voucher.number} annulée par ${actorName}`,
          createdById: actorId,
        },
      });

      await tx.salesVoucher.update({ where: { id }, data: { status: 'CONFIRMED' } });
    });

    await this.auditLog.record({
      entityType: 'SalesVoucher',
      entityId: id,
      action: 'UPDATE',
      field: 'status',
      newValue: 'CONFIRMED',
      reason: `Annulation annulée par ${actorName} — le bon redevient confirmé`,
      actorId,
    });

    const updated = await this.getById(id);
    await this.notifyBoth(
      updated.customer.user.id,
      'order.cancel_reverted',
      "Annulation annulée",
      `${actorName} a annulé l'annulation du bon ${updated.number ?? ''} — il redevient confirmé.`,
      { voucherId: id },
    );

    return updated;
  }

  async setHidden(id: string, hidden: boolean, actorId: string) {
    const voucher = await this.prisma.salesVoucher.findFirst({ where: { id, deletedAt: null } });
    if (!voucher) throw new NotFoundException('Bon introuvable');

    await this.prisma.salesVoucher.update({ where: { id }, data: { hidden } });
    await this.auditLog.record({
      entityType: 'SalesVoucher',
      entityId: id,
      action: 'UPDATE',
      field: 'hidden',
      newValue: hidden,
      actorId,
    });
    return { id, hidden };
  }

  async remove(id: string, actorId: string) {
    const voucher = await this.prisma.salesVoucher.findFirst({ where: { id, deletedAt: null } });
    if (!voucher) throw new NotFoundException('Bon introuvable');
    if (voucher.status !== 'DRAFT') {
      throw new ForbiddenException('Seul un brouillon peut être supprimé directement — annulez un bon confirmé');
    }

    await this.prisma.salesVoucher.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.auditLog.record({ entityType: 'SalesVoucher', entityId: id, action: 'DELETE', actorId });
    return { id };
  }
}
