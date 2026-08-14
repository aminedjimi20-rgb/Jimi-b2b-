import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatusValue } from './dto/update-order-status.dto';
import { toAdminOrderDTO, toClientOrderDTO } from './dto/order-response.dto';

const ORDER_INCLUDE = {
  items: { include: { product: { select: { id: true, nom: true, code: true } } } },
  client: { select: { raisonSociale: true, telephone: true } },
} as const;

// Allowed forward transitions. ANNULEE is reachable from any state before EXPEDIEE.
const NEXT_STATUS: Record<OrderStatus, OrderStatus[]> = {
  EN_ATTENTE: ['CONFIRMEE', 'ANNULEE'],
  CONFIRMEE: ['PREPARATION', 'ANNULEE'],
  PREPARATION: ['PRETE', 'ANNULEE'],
  PRETE: ['EXPEDIEE', 'ANNULEE'],
  EXPEDIEE: ['LIVREE'],
  LIVREE: [],
  ANNULEE: [],
};

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private pricing: PricingService,
    private notifications: NotificationsService,
  ) {}

  // ── CLIENT ───────────────────────────────────────────────────────────

  async createForClient(clientId: string, dto: CreateOrderDto) {
    const order = await this.prisma.$transaction(async (tx) => {
      const client = await tx.client.findUnique({ where: { id: clientId } });
      if (!client) throw new NotFoundException('Client introuvable.');

      let total = new Prisma.Decimal(0);
      const itemsData: { productId: string; quantite: number; prixUnitaire: Prisma.Decimal }[] = [];

      for (const line of dto.items) {
        const product = await tx.product.findUnique({ where: { id: line.productId } });
        if (!product || !product.actif) {
          throw new BadRequestException(`Produit introuvable ou indisponible: ${line.productId}`);
        }
        if (line.quantite < product.minCommande) {
          throw new BadRequestException(
            `Quantité minimale pour "${product.nom}" est ${product.minCommande}.`,
          );
        }
        if (product.stockReel < line.quantite) {
          throw new BadRequestException(`Stock insuffisant pour "${product.nom}".`);
        }

        const resolved = await this.pricing.resolvePrice(clientId, product.id, line.quantite);
        total = total.plus(resolved.prix.mul(line.quantite));
        itemsData.push({ productId: product.id, quantite: line.quantite, prixUnitaire: resolved.prix });
      }

      if (dto.paymentMethod === 'CREDIT') {
        const nouveauSolde = client.soldeCredit.plus(total);
        if (nouveauSolde.greaterThan(client.limiteCredit)) {
          throw new BadRequestException('Limite de crédit dépassée pour ce client.');
        }
        await tx.client.update({ where: { id: clientId }, data: { soldeCredit: nouveauSolde } });
      }

      const reference = this.generateReference();
      const created = await tx.order.create({
        data: {
          reference,
          clientId,
          paymentMethod: dto.paymentMethod,
          adresseLivraison: dto.adresseLivraison,
          telephoneContact: dto.telephoneContact,
          notes: dto.notes,
          total,
          items: { create: itemsData },
        },
        include: ORDER_INCLUDE,
      });

      for (const item of itemsData) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockReel: { decrement: item.quantite } },
        });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: 'VENTE',
            quantite: item.quantite,
            orderId: created.id,
            motif: `Commande ${reference}`,
          },
        });
      }

      return created;
    });

    await this.notifications.notifyAllAdmins(
      'NOUVELLE_COMMANDE',
      'Nouvelle commande',
      `Commande ${order.reference} reçue.`,
      { orderId: order.id },
    );
    await this.checkLowStock(order.items.map((i) => i.productId));

    return toClientOrderDTO(order);
  }

  async findAllForClient(clientId: string) {
    const orders = await this.prisma.order.findMany({
      where: { clientId },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return orders.map(toClientOrderDTO);
  }

  async findOneForClient(clientId: string, id: string) {
    const order = await this.prisma.order.findFirst({ where: { id, clientId }, include: ORDER_INCLUDE });
    if (!order) throw new NotFoundException('Commande introuvable.');
    return toClientOrderDTO(order);
  }

  async reorder(clientId: string, orderId: string) {
    const previous = await this.prisma.order.findFirst({ where: { id: orderId, clientId }, include: ORDER_INCLUDE });
    if (!previous) throw new NotFoundException('Commande introuvable.');

    return this.createForClient(clientId, {
      items: previous.items.map((i) => ({ productId: i.productId, quantite: i.quantite })),
      paymentMethod: previous.paymentMethod,
      adresseLivraison: previous.adresseLivraison,
      telephoneContact: previous.telephoneContact,
    });
  }

  // ── ADMIN ────────────────────────────────────────────────────────────

  async findAllForAdmin(status?: OrderStatus) {
    const orders = await this.prisma.order.findMany({
      where: status ? { status } : undefined,
      include: ORDER_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return orders.map(toAdminOrderDTO);
  }

  async findOneForAdmin(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
    if (!order) throw new NotFoundException('Commande introuvable.');
    return toAdminOrderDTO(order);
  }

  async updateStatus(id: string, nextStatus: OrderStatusValue) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
    if (!order) throw new NotFoundException('Commande introuvable.');

    const allowed = NEXT_STATUS[order.status];
    if (!allowed.includes(nextStatus as OrderStatus)) {
      throw new ForbiddenException(`Transition ${order.status} → ${nextStatus} non autorisée.`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id }, data: { status: nextStatus as OrderStatus } });

      if (nextStatus === 'ANNULEE') {
        for (const item of order.items) {
          await tx.product.update({ where: { id: item.productId }, data: { stockReel: { increment: item.quantite } } });
          await tx.stockMovement.create({
            data: { productId: item.productId, type: 'RETOUR', quantite: item.quantite, orderId: id, motif: `Annulation ${order.reference}` },
          });
        }
        if (order.paymentMethod === 'CREDIT') {
          await tx.client.update({ where: { id: order.clientId }, data: { soldeCredit: { decrement: order.total } } });
        }
      }
    });

    const client = await this.prisma.client.findUnique({ where: { id: order.clientId }, select: { userId: true } });
    if (client) {
      await this.notifications.notifyUser(
        client.userId,
        'STATUT_COMMANDE',
        'Mise à jour de commande',
        `Votre commande ${order.reference} est maintenant "${nextStatus}".`,
        { orderId: id },
      );
    }

    return this.findOneForAdmin(id);
  }

  private generateReference(): string {
    const year = new Date().getFullYear();
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `CMD-${year}-${suffix}`;
  }

  private async checkLowStock(productIds: string[]) {
    const products = await this.prisma.product.findMany({ where: { id: { in: productIds } } });
    for (const product of products) {
      if (product.stockReel <= product.stockMinimum) {
        await this.notifications.notifyAllAdmins(
          'STOCK_FAIBLE',
          'Stock faible',
          `Stock faible pour "${product.nom}" (${product.stockReel} restant).`,
          { productId: product.id },
        );
      }
    }
  }
}
