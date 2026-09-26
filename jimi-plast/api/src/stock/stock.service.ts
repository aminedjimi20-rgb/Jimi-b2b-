import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';

/**
 * Journal des mouvements de stock (§19 du cahier des charges) : chaque
 * variation — vente, achat, correction d'inventaire — passe par ce même
 * historique, quelle que soit son origine.
 */
@Injectable()
export class StockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly notifications: NotificationsService,
  ) {}

  async movements(productId?: string) {
    const movements = await this.prisma.stockMovement.findMany({
      where: productId ? { productId } : undefined,
      include: { product: { select: { nameFr: true, sku: true, unitsPerPackage: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const salesIds = [...new Set(movements.filter((m) => m.referenceType === 'SalesVoucher').map((m) => m.referenceId!))];
    const purchaseIds = [...new Set(movements.filter((m) => m.referenceType === 'PurchaseVoucher').map((m) => m.referenceId!))];
    const returnIds = [...new Set(movements.filter((m) => m.referenceType === 'Return').map((m) => m.referenceId!))];

    const [salesVouchers, purchaseVouchers, returns] = await Promise.all([
      salesIds.length
        ? this.prisma.salesVoucher.findMany({
            where: { id: { in: salesIds } },
            select: { id: true, number: true, customer: { select: { user: { select: { fullName: true } } } } },
          })
        : Promise.resolve([]),
      purchaseIds.length
        ? this.prisma.purchaseVoucher.findMany({
            where: { id: { in: purchaseIds } },
            select: { id: true, number: true, manufacturer: { select: { name: true } } },
          })
        : Promise.resolve([]),
      returnIds.length
        ? this.prisma.return.findMany({
            where: { id: { in: returnIds } },
            select: {
              id: true,
              number: true,
              customer: { select: { user: { select: { fullName: true } } } },
              manufacturer: { select: { name: true } },
            },
          })
        : Promise.resolve([]),
    ]);

    const salesMap = new Map(salesVouchers.map((v) => [v.id, v]));
    const purchaseMap = new Map(purchaseVouchers.map((v) => [v.id, v]));
    const returnMap = new Map(returns.map((r) => [r.id, r]));

    return movements.map((m) => {
      let voucherNumber: string | null = null;
      let partyName: string | null = null;
      if (m.referenceType === 'SalesVoucher' && m.referenceId) {
        const v = salesMap.get(m.referenceId);
        voucherNumber = v?.number ?? null;
        partyName = v?.customer.user.fullName ?? null;
      } else if (m.referenceType === 'PurchaseVoucher' && m.referenceId) {
        const v = purchaseMap.get(m.referenceId);
        voucherNumber = v?.number ?? null;
        partyName = v?.manufacturer.name ?? null;
      } else if (m.referenceType === 'Return' && m.referenceId) {
        const r = returnMap.get(m.referenceId);
        voucherNumber = r?.number ?? null;
        partyName = r?.customer?.user.fullName ?? r?.manufacturer?.name ?? null;
      }
      return { ...m, voucherNumber, partyName };
    });
  }

  async lowStockAlerts() {
    const products = await this.prisma.product.findMany({
      where: { deletedAt: null, isActive: true },
    });
    return products.filter((p) => p.currentStock <= p.stockMin);
  }

  async adjust(dto: AdjustStockDto, actorId: string) {
    const product = await this.prisma.product.findFirst({ where: { id: dto.productId, deletedAt: null } });
    if (!product) throw new NotFoundException('Produit introuvable');

    const diff = dto.newQuantity - product.currentStock;
    if (diff === 0) throw new BadRequestException('La quantité est identique au stock actuel');

    await this.prisma.$transaction([
      this.prisma.product.update({ where: { id: dto.productId }, data: { currentStock: dto.newQuantity } }),
      this.prisma.stockMovement.create({
        data: {
          productId: dto.productId,
          type: 'ADJUSTMENT',
          quantity: diff,
          stockAfter: dto.newQuantity,
          reason: dto.reason,
          createdById: actorId,
        },
      }),
    ]);

    await this.auditLog.record({
      entityType: 'Product',
      entityId: dto.productId,
      action: 'UPDATE',
      field: 'currentStock',
      oldValue: product.currentStock,
      newValue: dto.newQuantity,
      reason: dto.reason,
      actorId,
    });

    await this.notifyCustomersOfStockChange(product.nameFr, dto.productId, product.currentStock, dto.newQuantity);

    return { productId: dto.productId, previousStock: product.currentStock, newStock: dto.newQuantity, diff };
  }

  /** Diffuse une notification informative à tous les clients (compte lié — toujours le cas). */
  private async notifyCustomersOfStockChange(productName: string, productId: string, oldStock: number, newStock: number) {
    const customers = await this.prisma.customer.findMany({ select: { userId: true } });
    const userIds = customers.map((c) => c.userId);
    if (userIds.length === 0) return;
    await this.notifications.notify({
      type: 'product.updated',
      title: `Produit mis à jour : ${productName}`,
      body: `Stock : ${oldStock} → ${newStock}`,
      data: { productId, userIds },
    });
  }
}
