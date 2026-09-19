import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateProductRequestDto } from './dto/create-product-request.dto';
import { UpdateProductRequestStatusDto } from './dto/update-product-request-status.dto';

@Injectable()
export class ProductRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  list() {
    return this.prisma.productRequest.findMany({
      include: { customer: { include: { user: { select: { fullName: true, phone: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  listForUser(userId: string) {
    return this.prisma.productRequest.findMany({
      where: { customer: { userId } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, dto: CreateProductRequestDto) {
    const customer = await this.prisma.customer.findUnique({ where: { userId } });
    if (!customer) throw new BadRequestException('Aucun dossier client associé à ce compte');

    const request = await this.prisma.productRequest.create({ data: { customerId: customer.id, ...dto } });

    await this.notifications.notify({
      type: 'product_request.new',
      title: 'Nouvelle demande de produit',
      body: `${dto.productName}${dto.quantityWanted ? ` (x${dto.quantityWanted})` : ''}`,
      data: { requestId: request.id },
    });

    return request;
  }

  async updateStatus(id: string, dto: UpdateProductRequestStatusDto) {
    const request = await this.prisma.productRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Demande introuvable');

    return this.prisma.productRequest.update({
      where: { id },
      data: { status: dto.status as never, adminNote: dto.adminNote },
    });
  }
}
