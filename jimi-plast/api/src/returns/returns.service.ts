import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { NumberSequenceService } from '../common/services/number-sequence.service';
import { TrashService } from '../common/services/trash.service';
import { CreateReturnDto, ReturnItemInputDto } from './dto/create-return.dto';
import { ValidateReturnDto } from './dto/validate-return.dto';

const ROLE_TO_TIER_KEY: Record<string, string> = { wholesaler: 'wholesale', retailer: 'retail' };

@Injectable()
export class ReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly numberSequence: NumberSequenceService,
    private readonly trash: TrashService,
  ) {}

  list(filters: { type?: string; status?: string }) {
    return this.prisma.return.findMany({
      where: {
        deletedAt: null,
        ...(filters.type ? { type: filters.type as never } : {}),
        ...(filters.status ? { status: filters.status as never } : {}),
      },
      include: {
        customer: { include: { user: { select: { fullName: true } } } },
        manufacturer: true,
        items: { include: { product: { include: { images: { take: 1 } } } } },
        attachments: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string) {
    const ret = await this.prisma.return.findFirst({
      where: { id, deletedAt: null },
      include: {
        customer: { include: { user: { select: { fullName: true } } } },
        manufacturer: true,
        items: { include: { product: { include: { images: { take: 1 } } }, images: { orderBy: { createdAt: 'desc' } } } },
        attachments: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!ret) throw new NotFoundException('Retour introuvable');
    return ret;
  }

  history(id: string) {
    return this.auditLog.history('Return', id);
  }

  private async priceItems(
    type: 'CUSTOMER' | 'SUPPLIER',
    partyId: string,
    items: ReturnItemInputDto[],
  ): Promise<{ productId: string; quantity: number; reason: string; condition?: 'DAMAGED' | 'DEFECTIVE' | 'OTHER'; unitPrice: number; lineTotal: number }[]> {
    let unitPriceByProduct = new Map<string, number>();

    if (type === 'CUSTOMER') {
      const customer = await this.prisma.customer.findUniqueOrThrow({
        where: { id: partyId },
        include: { user: { include: { role: true } } },
      });
      const tierKey = ROLE_TO_TIER_KEY[customer.user.role.key];
      if (!tierKey) throw new BadRequestException('Niveau de prix introuvable pour ce client');
      const tier = await this.prisma.priceTierType.findUniqueOrThrow({ where: { key: tierKey } });

      const prices = await this.prisma.productPrice.findMany({
        where: { productId: { in: items.map((i) => i.productId) }, priceTierTypeId: tier.id },
      });
      unitPriceByProduct = new Map(prices.map((p) => [p.productId, Number(p.price)]));
    } else {
      const products = await this.prisma.product.findMany({ where: { id: { in: items.map((i) => i.productId) } } });
      unitPriceByProduct = new Map(products.map((p) => [p.id, Number(p.costPrice ?? 0)]));
    }

    // Un prix saisi manuellement (ex: fabricant retournant un article vendu
    // à un ancien tarif) prime toujours sur le prix catalogue recalculé.
    return items.map((i) => {
      const unitPrice = i.unitPrice ?? unitPriceByProduct.get(i.productId) ?? 0;
      return { productId: i.productId, quantity: i.quantity, reason: i.reason, condition: i.condition, unitPrice, lineTotal: unitPrice * i.quantity };
    });
  }

  async create(dto: CreateReturnDto, actorId: string) {
    if (dto.type === 'CUSTOMER' && !dto.customerId) throw new BadRequestException('customerId requis pour un retour client');
    if (dto.type === 'SUPPLIER' && !dto.manufacturerId) throw new BadRequestException('manufacturerId requis pour un retour fabricant');

    const items = await this.priceItems(dto.type, (dto.customerId ?? dto.manufacturerId)!, dto.items);
    const totalValue = items.reduce((s, i) => s + i.lineTotal, 0);

    const ret = await this.prisma.return.create({
      data: {
        type: dto.type,
        customerId: dto.customerId,
        manufacturerId: dto.manufacturerId,
        totalValue,
        createdById: actorId,
        items: { create: items },
      },
    });

    await this.auditLog.record({ entityType: 'Return', entityId: ret.id, action: 'CREATE', actorId });
    return this.getById(ret.id);
  }

  // Ajouter des articles à un retour existant — y compris déjà validé : le
  // client/fabricant a pu revenir avec un autre article après coup. Si le
  // retour est déjà VALIDATED, les mêmes effets comptables que validate()
  // (avoir/ajustement + décrément de stock) sont appliqués immédiatement
  // pour ces nouvelles lignes seulement, avec la même logique par
  // décision/type.
  async addItems(id: string, itemsDto: ReturnItemInputDto[], actorId: string) {
    const ret = await this.getById(id);
    if (ret.status === 'REJECTED') throw new BadRequestException('Ce retour est refusé — impossible d\'y ajouter des articles');

    const partyId = ret.type === 'CUSTOMER' ? ret.customerId : ret.manufacturerId;
    if (!partyId) throw new BadRequestException('Retour sans client/fabricant associé');
    const priced = await this.priceItems(ret.type, partyId, itemsDto);
    const addedTotal = priced.reduce((s, i) => s + i.lineTotal, 0);

    await this.prisma.$transaction(async (tx) => {
      await tx.returnItem.createMany({
        data: priced.map((i) => ({ returnId: id, ...i })),
      });
      await tx.return.update({ where: { id }, data: { totalValue: { increment: addedTotal } } });

      if (ret.status === 'VALIDATED') {
        if (ret.type === 'CUSTOMER' && ret.customerId) {
          if (ret.decision !== 'REPLACEMENT') {
            await tx.ledgerEntry.create({
              data: {
                customerId: ret.customerId,
                type: 'RETURN_CREDIT',
                amount: -addedTotal,
                reference: ret.number,
                note: `Articles ajoutés au retour ${ret.number ?? ''}`,
                createdById: actorId,
              },
            });
          } else {
            for (const item of priced) {
              const decremented = await tx.product.update({ where: { id: item.productId }, data: { currentStock: { decrement: item.quantity } } });
              await tx.stockMovement.create({
                data: {
                  productId: item.productId,
                  type: 'RETURN_CUSTOMER',
                  quantity: -item.quantity,
                  stockAfter: decremented.currentStock,
                  referenceType: 'Return',
                  referenceId: id,
                  reason: `Article ajouté au retour ${ret.number ?? ''}`,
                  createdById: actorId,
                },
              });
            }
          }
        }

        if (ret.type === 'SUPPLIER' && ret.manufacturerId) {
          await tx.supplierLedgerEntry.create({
            data: {
              manufacturerId: ret.manufacturerId,
              type: 'ADJUSTMENT',
              amount: -addedTotal,
              reference: ret.number,
              note: `Articles ajoutés au retour fabricant ${ret.number ?? ''}`,
              createdById: actorId,
            },
          });
          for (const item of priced) {
            const decremented = await tx.product.update({ where: { id: item.productId }, data: { currentStock: { decrement: item.quantity } } });
            await tx.stockMovement.create({
              data: {
                productId: item.productId,
                type: 'RETURN_SUPPLIER',
                quantity: -item.quantity,
                stockAfter: decremented.currentStock,
                referenceType: 'Return',
                referenceId: id,
                reason: `Article ajouté au retour ${ret.number ?? ''}`,
                createdById: actorId,
              },
            });
          }
        }
      }
    });

    await this.auditLog.record({
      entityType: 'Return',
      entityId: id,
      action: 'UPDATE',
      field: 'items',
      newValue: `+${priced.length} article(s)`,
      actorId,
    });
    return this.getById(id);
  }

  // Symétrique de addItems() : retire un article ajouté par erreur, y
  // compris sur un retour déjà validé — l'effet comptable de CET article
  // (avoir/ajustement + stock) est défait sans toucher aux autres lignes,
  // et l'opération reste dans l'historique. Le dernier article d'un retour
  // ne peut pas être retiré isolément — supprimer le retour entier plutôt.
  async removeItem(returnId: string, itemId: string, actorId: string) {
    const ret = await this.getById(returnId);
    const item = ret.items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException('Article introuvable');
    if (ret.items.length === 1) {
      throw new BadRequestException('Impossible de retirer le dernier article — supprimez le retour entier');
    }
    const lineTotal = Number(item.lineTotal);

    await this.prisma.$transaction(async (tx) => {
      if (ret.status === 'VALIDATED') {
        if (ret.type === 'CUSTOMER' && ret.customerId) {
          if (ret.decision !== 'REPLACEMENT') {
            await tx.ledgerEntry.create({
              data: {
                customerId: ret.customerId,
                type: 'RETURN_CREDIT',
                amount: lineTotal,
                reference: ret.number,
                note: `Article retiré du retour ${ret.number ?? ''} : ${item.product.nameFr}`,
                createdById: actorId,
              },
            });
          } else {
            const restored = await tx.product.update({ where: { id: item.productId }, data: { currentStock: { increment: item.quantity } } });
            await tx.stockMovement.create({
              data: {
                productId: item.productId,
                type: 'ADJUSTMENT',
                quantity: item.quantity,
                stockAfter: restored.currentStock,
                referenceType: 'Return',
                referenceId: returnId,
                reason: `Article retiré du retour ${ret.number ?? ''}`,
                createdById: actorId,
              },
            });
          }
        }

        if (ret.type === 'SUPPLIER' && ret.manufacturerId) {
          await tx.supplierLedgerEntry.create({
            data: {
              manufacturerId: ret.manufacturerId,
              type: 'ADJUSTMENT',
              amount: lineTotal,
              reference: ret.number,
              note: `Article retiré du retour ${ret.number ?? ''} : ${item.product.nameFr}`,
              createdById: actorId,
            },
          });
          const restored = await tx.product.update({ where: { id: item.productId }, data: { currentStock: { increment: item.quantity } } });
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type: 'ADJUSTMENT',
              quantity: item.quantity,
              stockAfter: restored.currentStock,
              referenceType: 'Return',
              referenceId: returnId,
              reason: `Article retiré du retour ${ret.number ?? ''}`,
              createdById: actorId,
            },
          });
        }
      }

      await tx.returnItem.delete({ where: { id: itemId } });
      await tx.return.update({ where: { id: returnId }, data: { totalValue: { decrement: lineTotal } } });
    });

    await this.auditLog.record({
      entityType: 'Return',
      entityId: returnId,
      action: 'UPDATE',
      field: 'items',
      reason: `Article retiré : ${item.product.nameFr} (${item.quantity} pièces)`,
      actorId,
    });
    return this.getById(returnId);
  }

  async updateNotes(id: string, notes: string, actorId: string) {
    await this.getById(id);
    await this.prisma.return.update({ where: { id }, data: { notes } });
    await this.auditLog.record({ entityType: 'Return', entityId: id, action: 'UPDATE', field: 'notes', newValue: notes, actorId });
    return this.getById(id);
  }

  // Une suppression après validation défait les effets comptables déjà
  // appliqués (annule les lignes de crédit/ajustement, recrédite le stock)
  // avant de passer le retour en corbeille — jamais de suppression SQL
  // directe (§ règle du projet), toujours restaurable depuis la Corbeille.
  async remove(id: string, reason: string | undefined, actorId: string) {
    const ret = await this.getById(id);

    await this.prisma.$transaction(async (tx) => {
      if (ret.status === 'VALIDATED') {
        if (ret.type === 'CUSTOMER' && ret.customerId) {
          if (ret.decision !== 'REPLACEMENT') {
            await tx.ledgerEntry.updateMany({ where: { customerId: ret.customerId, reference: ret.number }, data: { voidedAt: new Date() } });
          } else {
            for (const item of ret.items) {
              const restored = await tx.product.update({ where: { id: item.productId }, data: { currentStock: { increment: item.quantity } } });
              await tx.stockMovement.create({
                data: {
                  productId: item.productId,
                  type: 'ADJUSTMENT',
                  quantity: item.quantity,
                  stockAfter: restored.currentStock,
                  referenceType: 'Return',
                  referenceId: id,
                  reason: `Suppression du retour ${ret.number ?? ''}`,
                  createdById: actorId,
                },
              });
            }
          }
        }

        if (ret.type === 'SUPPLIER' && ret.manufacturerId) {
          await tx.supplierLedgerEntry.updateMany({ where: { manufacturerId: ret.manufacturerId, reference: ret.number }, data: { voidedAt: new Date() } });
          for (const item of ret.items) {
            const restored = await tx.product.update({ where: { id: item.productId }, data: { currentStock: { increment: item.quantity } } });
            await tx.stockMovement.create({
              data: {
                productId: item.productId,
                type: 'ADJUSTMENT',
                quantity: item.quantity,
                stockAfter: restored.currentStock,
                referenceType: 'Return',
                referenceId: id,
                reason: `Suppression du retour ${ret.number ?? ''}`,
                createdById: actorId,
              },
            });
          }
        }
      }

      await tx.return.update({ where: { id }, data: { deletedAt: new Date() } });
    });

    await this.trash.moveToTrash({ entityType: 'Return', entityId: id, snapshot: ret as never, deletedById: actorId, reason });
    return { id };
  }

  async addAttachment(returnId: string, url: string) {
    const ret = await this.prisma.return.findFirst({ where: { id: returnId, deletedAt: null } });
    if (!ret) throw new NotFoundException('Retour introuvable');
    await this.prisma.returnAttachment.create({ data: { returnId, url } });
    return this.getById(returnId);
  }

  async removeAttachment(returnId: string, attachmentId: string, actorId?: string) {
    const attachment = await this.prisma.returnAttachment.findFirst({ where: { id: attachmentId, returnId } });
    if (!attachment) throw new NotFoundException('Pièce jointe introuvable');
    await this.prisma.returnAttachment.delete({ where: { id: attachmentId } });
    await this.auditLog.record({
      entityType: 'Return',
      entityId: returnId,
      action: 'DELETE',
      field: 'attachment',
      oldValue: attachment.url,
      actorId,
    });
    return this.getById(returnId);
  }

  async addItemImage(returnId: string, itemId: string, url: string) {
    const item = await this.prisma.returnItem.findFirst({ where: { id: itemId, returnId } });
    if (!item) throw new NotFoundException('Article introuvable');
    await this.prisma.returnItemImage.create({ data: { returnItemId: itemId, url } });
    return this.getById(returnId);
  }

  async removeItemImage(returnId: string, itemId: string, imageId: string, actorId?: string) {
    const image = await this.prisma.returnItemImage.findFirst({ where: { id: imageId, returnItemId: itemId } });
    if (!image) throw new NotFoundException('Photo introuvable');
    await this.prisma.returnItemImage.delete({ where: { id: imageId } });
    await this.auditLog.record({
      entityType: 'Return',
      entityId: returnId,
      action: 'DELETE',
      field: 'itemImage',
      oldValue: image.url,
      actorId,
    });
    return this.getById(returnId);
  }

  async validate(id: string, dto: ValidateReturnDto, actorId: string) {
    const ret = await this.getById(id);
    if (ret.status !== 'NEW') throw new BadRequestException('Ce retour a déjà été traité');

    const number = await this.numberSequence.next('RET');

    await this.prisma.$transaction(async (tx) => {
      if (ret.type === 'CUSTOMER' && ret.customerId) {
        if (dto.decision !== 'REPLACEMENT') {
          await tx.ledgerEntry.create({
            data: {
              customerId: ret.customerId,
              type: 'RETURN_CREDIT',
              amount: -Number(ret.totalValue),
              reference: number,
              note: `Retour ${number} (${dto.decision})`,
              createdById: actorId,
            },
          });
        } else {
          for (const item of ret.items) {
            const decremented = await tx.product.update({ where: { id: item.productId }, data: { currentStock: { decrement: item.quantity } } });
            await tx.stockMovement.create({
              data: {
                productId: item.productId,
                type: 'RETURN_CUSTOMER',
                quantity: -item.quantity,
                stockAfter: decremented.currentStock,
                referenceType: 'Return',
                referenceId: ret.id,
                reason: 'Remplacement suite retour client',
                createdById: actorId,
              },
            });
          }
        }
      }

      if (ret.type === 'SUPPLIER' && ret.manufacturerId) {
        await tx.supplierLedgerEntry.create({
          data: {
            manufacturerId: ret.manufacturerId,
            type: 'ADJUSTMENT',
            amount: -Number(ret.totalValue),
            reference: number,
            note: `Retour fabricant ${number}`,
            createdById: actorId,
          },
        });
        for (const item of ret.items) {
          const decremented = await tx.product.update({ where: { id: item.productId }, data: { currentStock: { decrement: item.quantity } } });
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type: 'RETURN_SUPPLIER',
              quantity: -item.quantity,
              stockAfter: decremented.currentStock,
              referenceType: 'Return',
              referenceId: ret.id,
              createdById: actorId,
            },
          });
        }
      }

      await tx.return.update({ where: { id }, data: { status: 'VALIDATED', decision: dto.decision, number, validatedAt: new Date() } });
    });

    await this.auditLog.record({ entityType: 'Return', entityId: id, action: 'UPDATE', field: 'status', newValue: 'VALIDATED', actorId });
    return this.getById(id);
  }

  async reject(id: string, actorId: string) {
    const ret = await this.getById(id);
    if (ret.status !== 'NEW') throw new BadRequestException('Ce retour a déjà été traité');

    await this.prisma.return.update({ where: { id }, data: { status: 'REJECTED' } });
    await this.auditLog.record({ entityType: 'Return', entityId: id, action: 'UPDATE', field: 'status', newValue: 'REJECTED', actorId });
    return this.getById(id);
  }
}
