import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
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
  ) {}

  movements(productId?: string) {
    return this.prisma.stockMovement.findMany({
      where: productId ? { productId } : undefined,
      include: { product: { select: { nameFr: true, sku: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
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

    return { productId: dto.productId, previousStock: product.currentStock, newStock: dto.newQuantity, diff };
  }
}
