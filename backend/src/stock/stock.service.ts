import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';

@Injectable()
export class StockService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async createMovement(dto: CreateStockMovementDto) {
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException('Produit introuvable.');

    let newStock: number;
    switch (dto.type) {
      case 'ENTREE':
      case 'RETOUR':
        newStock = product.stockReel + dto.quantite;
        break;
      case 'SORTIE':
        if (dto.quantite > product.stockReel) throw new BadRequestException('Quantité supérieure au stock disponible.');
        newStock = product.stockReel - dto.quantite;
        break;
      case 'AJUSTEMENT':
        newStock = dto.quantite; // absolute recount value
        break;
    }

    await this.prisma.$transaction([
      this.prisma.product.update({ where: { id: dto.productId }, data: { stockReel: newStock } }),
      this.prisma.stockMovement.create({
        data: { productId: dto.productId, type: dto.type, quantite: dto.quantite, motif: dto.motif },
      }),
    ]);

    if (newStock <= product.stockMinimum) {
      await this.notifications.notifyAllAdmins(
        'STOCK_FAIBLE',
        'Stock faible',
        `Stock faible pour "${product.nom}" (${newStock} restant).`,
        { productId: product.id },
      );
    }

    return this.prisma.product.findUnique({ where: { id: dto.productId } });
  }

  async historyForProduct(productId: string) {
    return this.prisma.stockMovement.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      include: { order: { select: { reference: true } } },
    });
  }

  async lowStockProducts() {
    const products = await this.prisma.product.findMany({ where: { actif: true } });
    return products.filter((p) => p.stockReel <= p.stockMinimum);
  }
}
