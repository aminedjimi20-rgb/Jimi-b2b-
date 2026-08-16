import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SequencesService } from '../common/sequences/sequences.service';
import { runOrExplainForeignKeyError } from '../common/prisma-errors.util';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatusValue } from './dto/update-order-status.dto';
import { toAdminOrderDTO, toClientOrderDTO } from './dto/order-response.dto';

const ORDER_INCLUDE = {
  items: {
    include: { product: { select: { id: true, nom: true, code: true, images: { select: { url: true, isPrimary: true } } } } },
  },
  client: { select: { raisonSociale: true, telephone: true } },
  transporteur: { select: { nom: true } },
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
    private sequences: SequencesService,
  ) {}

  // ── CLIENT ───────────────────────────────────────────────────────────

  // `options.remisePourcentage` is only ever passed by the ADMIN counter-sale
  // route (see OrdersController.createForAdmin) — a client's own CreateOrderDto
  // has no such field, so a client can never discount their own order.
  async createForClient(
    clientId: string,
    dto: CreateOrderDto,
    options?: { remisePourcentage?: number; fraisLivraison?: number; transporteurId?: string; destination?: string },
  ) {
    const order = await this.prisma.$transaction(async (tx) => {
      const client = await tx.client.findUnique({ where: { id: clientId } });
      if (!client) throw new NotFoundException('Client introuvable.');

      let subtotal = new Prisma.Decimal(0);
      const itemsData: { productId: string; quantite: number; prixUnitaire: Prisma.Decimal }[] = [];

      for (const line of dto.items) {
        const product = await tx.product.findUnique({ where: { id: line.productId } });
        if (!product || !product.actif || product.deletedAt) {
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
        subtotal = subtotal.plus(resolved.prix.mul(line.quantite));
        itemsData.push({ productId: product.id, quantite: line.quantite, prixUnitaire: resolved.prix });
      }

      const remise = options?.remisePourcentage;
      const fraisLivraison = new Prisma.Decimal(options?.fraisLivraison ?? 0);
      const totalApresRemise = remise ? subtotal.mul(new Prisma.Decimal(100).minus(remise)).div(100) : subtotal;
      const total = totalApresRemise.plus(fraisLivraison);

      if (dto.paymentMethod === 'CREDIT') {
        const nouveauSolde = client.soldeCredit.plus(total);
        if (nouveauSolde.greaterThan(client.limiteCredit)) {
          throw new BadRequestException('Limite de crédit dépassée pour ce client.');
        }
        await tx.client.update({ where: { id: clientId }, data: { soldeCredit: nouveauSolde } });
      }

      const reference = await this.generateReference();
      const created = await tx.order.create({
        data: {
          reference,
          nom: dto.nom,
          clientId,
          paymentMethod: dto.paymentMethod,
          adresseLivraison: dto.adresseLivraison,
          telephoneContact: dto.telephoneContact,
          notes: dto.notes,
          total,
          remisePourcentage: remise,
          fraisLivraison,
          transporteurId: options?.transporteurId,
          destination: options?.destination,
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
      where: { clientId, deletedAt: null },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return orders.map(toClientOrderDTO);
  }

  async findOneForClient(clientId: string, id: string) {
    const order = await this.prisma.order.findFirst({ where: { id, clientId, deletedAt: null }, include: ORDER_INCLUDE });
    if (!order) throw new NotFoundException('Commande introuvable.');
    return toClientOrderDTO(order);
  }

  async reorder(clientId: string, orderId: string) {
    const previous = await this.prisma.order.findFirst({ where: { id: orderId, clientId, deletedAt: null }, include: ORDER_INCLUDE });
    if (!previous) throw new NotFoundException('Commande introuvable.');

    return this.createForClient(clientId, {
      items: previous.items.map((i) => ({ productId: i.productId, quantite: i.quantite })),
      paymentMethod: previous.paymentMethod,
      adresseLivraison: previous.adresseLivraison,
      telephoneContact: previous.telephoneContact,
    });
  }

  // ── ADMIN ────────────────────────────────────────────────────────────

  async findAllForAdmin(status?: OrderStatus, filters?: { transporteurId?: string; from?: string; to?: string }) {
    const orders = await this.prisma.order.findMany({
      where: {
        deletedAt: null,
        ...(status ? { status } : {}),
        ...(filters?.transporteurId ? { transporteurId: filters.transporteurId } : {}),
        ...(filters?.from || filters?.to
          ? { createdAt: { ...(filters.from ? { gte: new Date(filters.from) } : {}), ...(filters.to ? { lte: new Date(filters.to) } : {}) } }
          : {}),
      },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return orders.map(toAdminOrderDTO);
  }

  /** Historique de livraisons — commandes avec un transporteur assigné, filtrable par date/transporteur. */
  async findDeliveryHistory(filters?: { transporteurId?: string; from?: string; to?: string }) {
    const orders = await this.prisma.order.findMany({
      where: {
        deletedAt: null,
        transporteurId: { not: null },
        ...(filters?.transporteurId ? { transporteurId: filters.transporteurId } : {}),
        ...(filters?.from || filters?.to
          ? { createdAt: { ...(filters.from ? { gte: new Date(filters.from) } : {}), ...(filters.to ? { lte: new Date(filters.to) } : {}) } }
          : {}),
      },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return orders.map(toAdminOrderDTO);
  }

  async findOneForAdmin(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
    if (!order || order.deletedAt) throw new NotFoundException('Commande introuvable.');
    return toAdminOrderDTO(order);
  }

  async updateStatus(id: string, nextStatus: OrderStatusValue) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
    if (!order || order.deletedAt) throw new NotFoundException('Commande introuvable.');

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

  // ── Corbeille ────────────────────────────────────────────────────────

  async findTrash() {
    const orders = await this.prisma.order.findMany({
      where: { deletedAt: { not: null } },
      include: ORDER_INCLUDE,
      orderBy: { deletedAt: 'desc' },
    });
    return orders.map(toAdminOrderDTO);
  }

  // Moves to the corbeille. Stock/credit were committed at creation time (not
  // at shipment), so any order still "in flight" (not yet ANNULEE — already
  // reversed — nor EXPEDIEE/LIVREE — goods physically gone) must have its
  // effects undone, exactly like cancelling it would — `restore` re-applies
  // them symmetrically, since nothing else can touch a trashed order.
  async remove(id: string) {
    const order = await this.getActiveWithItems(id);
    await this.prisma.$transaction(async (tx) => {
      if (this.isReversible(order.status)) {
        for (const item of order.items) {
          await tx.product.update({ where: { id: item.productId }, data: { stockReel: { increment: item.quantite } } });
        }
        if (order.paymentMethod === 'CREDIT') {
          await tx.client.update({ where: { id: order.clientId }, data: { soldeCredit: { decrement: order.total } } });
        }
      }
      await tx.order.update({ where: { id }, data: { deletedAt: new Date() } });
    });
  }

  async restore(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
    if (!order || !order.deletedAt) throw new NotFoundException('Commande introuvable dans la corbeille.');

    await this.prisma.$transaction(async (tx) => {
      if (this.isReversible(order.status)) {
        for (const item of order.items) {
          await tx.product.update({ where: { id: item.productId }, data: { stockReel: { decrement: item.quantite } } });
        }
        if (order.paymentMethod === 'CREDIT') {
          const client = await tx.client.findUnique({ where: { id: order.clientId } });
          if (client) {
            const nouveauSolde = client.soldeCredit.plus(order.total);
            if (nouveauSolde.greaterThan(client.limiteCredit)) {
              throw new BadRequestException('Restauration impossible : limite de crédit du client dépassée.');
            }
            await tx.client.update({ where: { id: order.clientId }, data: { soldeCredit: nouveauSolde } });
          }
        }
      }
      await tx.order.update({ where: { id }, data: { deletedAt: null } });
    });
  }

  async permanentDelete(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order || !order.deletedAt) throw new NotFoundException('Commande introuvable dans la corbeille.');

    await runOrExplainForeignKeyError(
      () => this.prisma.order.delete({ where: { id } }),
      'Impossible de supprimer définitivement : des données liées existent encore.',
    );
  }

  private isReversible(status: OrderStatus): boolean {
    return (['EN_ATTENTE', 'CONFIRMEE', 'PREPARATION', 'PRETE'] as OrderStatus[]).includes(status);
  }

  private async getActiveWithItems(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
    if (!order || order.deletedAt) throw new NotFoundException('Commande introuvable.');
    return order;
  }

  /** Human-readable, sequential, unique per year: BC-2026-0001, BC-2026-0002, ... */
  private async generateReference(): Promise<string> {
    const year = new Date().getFullYear();
    const n = await this.sequences.next(`BC-${year}`);
    return `BC-${year}-${String(n).padStart(4, '0')}`;
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
