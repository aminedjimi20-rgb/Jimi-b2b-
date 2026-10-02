import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateNegotiationDto } from './dto/create-negotiation.dto';
import { RespondNegotiationDto } from './dto/respond-negotiation.dto';

const ROLE_TO_TIER_KEY: Record<string, string> = { wholesaler: 'wholesale', retailer: 'retail' };

@Injectable()
export class NegotiationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  list() {
    return this.prisma.negotiation.findMany({
      include: {
        customer: { include: { user: { select: { fullName: true } } } },
        product: { select: { nameFr: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  listForUser(userId: string) {
    return this.prisma.negotiation.findMany({
      where: { customer: { userId } },
      include: { product: { select: { nameFr: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, dto: CreateNegotiationDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
      include: { user: { include: { role: true } } },
    });
    if (!customer) throw new BadRequestException('Aucun dossier client associé à ce compte');

    const tierKey = ROLE_TO_TIER_KEY[customer.user.role.key];
    const tier = tierKey ? await this.prisma.priceTierType.findUnique({ where: { key: tierKey } }) : null;
    const price = tier
      ? await this.prisma.productPrice.findUnique({
          where: { productId_priceTierTypeId: { productId: dto.productId, priceTierTypeId: tier.id } },
        })
      : null;

    const negotiation = await this.prisma.negotiation.create({
      data: {
        customerId: customer.id,
        productId: dto.productId,
        currentPrice: price ? price.price : 0,
        requestedPrice: dto.requestedPrice,
        requestedQuantity: dto.requestedQuantity,
      },
    });

    await this.notifications.notify({
      type: 'negotiation.new',
      title: 'Nouvelle demande de négociation',
      body: `${customer.user.fullName} propose ${dto.requestedPrice} DA pour ${dto.requestedQuantity} pièces`,
      data: { negotiationId: negotiation.id },
    });

    return negotiation;
  }

  async respond(id: string, dto: RespondNegotiationDto) {
    const negotiation = await this.prisma.negotiation.findUnique({ where: { id } });
    if (!negotiation) throw new NotFoundException('Négociation introuvable');
    if (negotiation.status !== 'PENDING') throw new BadRequestException('Cette négociation a déjà une réponse');

    return this.prisma.negotiation.update({
      where: { id },
      data: {
        status: dto.status,
        counterPrice: dto.counterPrice,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
        respondedAt: new Date(),
      },
    });
  }
}
