import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TrashService } from '../common/services/trash.service';
import { CreateProductRequestDto } from './dto/create-product-request.dto';
import { UpdateProductRequestDto } from './dto/update-product-request.dto';
import { UpdateProductRequestStatusDto } from './dto/update-product-request-status.dto';

const REQUESTED_BY_SELECT = {
  id: true,
  fullName: true,
  phone: true,
  role: { select: { key: true, name: true } },
  customer: { select: { id: true, businessName: true } },
} satisfies Prisma.UserSelect;

@Injectable()
export class ProductRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly trash: TrashService,
  ) {}

  list(params: { q?: string; status?: string } = {}) {
    const { q, status } = params;
    return this.prisma.productRequest.findMany({
      where: {
        deletedAt: null,
        ...(status ? { status: status as never } : {}),
        ...(q
          ? {
              OR: [
                { productName: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
                { requestedBy: { fullName: { contains: q, mode: 'insensitive' } } },
                { requestedBy: { customer: { businessName: { contains: q, mode: 'insensitive' } } } },
              ],
            }
          : {}),
      },
      include: {
        requestedBy: { select: REQUESTED_BY_SELECT },
        remarks: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  listForUser(userId: string) {
    return this.prisma.productRequest.findMany({
      where: { requestedById: userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, dto: CreateProductRequestDto) {
    const request = await this.prisma.productRequest.create({ data: { requestedById: userId, ...dto } });

    await this.notifications.notify({
      type: 'product_request.new',
      title: 'Nouvelle demande de produit',
      body: `${dto.productName}${dto.quantityWanted ? ` (x${dto.quantityWanted})` : ''}`,
      data: { requestId: request.id },
    });

    return request;
  }

  async update(id: string, dto: UpdateProductRequestDto) {
    const request = await this.prisma.productRequest.findFirst({ where: { id, deletedAt: null } });
    if (!request) throw new NotFoundException('Demande introuvable');

    return this.prisma.productRequest.update({ where: { id }, data: dto });
  }

  async updateStatus(id: string, dto: UpdateProductRequestStatusDto) {
    const request = await this.prisma.productRequest.findFirst({ where: { id, deletedAt: null } });
    if (!request) throw new NotFoundException('Demande introuvable');

    return this.prisma.productRequest.update({
      where: { id },
      data: { status: dto.status as never, adminNote: dto.adminNote },
    });
  }

  async remove(id: string, actorId: string, reason?: string) {
    const request = await this.prisma.productRequest.findFirst({ where: { id, deletedAt: null } });
    if (!request) throw new NotFoundException('Demande introuvable');

    await this.prisma.productRequest.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.trash.moveToTrash({
      entityType: 'ProductRequest',
      entityId: id,
      snapshot: request as unknown as Record<string, unknown>,
      deletedById: actorId,
      reason,
    });

    return { id };
  }

  async addRemark(productRequestId: string, text: string, actorId: string) {
    const request = await this.prisma.productRequest.findUnique({ where: { id: productRequestId } });
    if (!request) throw new NotFoundException('Demande introuvable');

    return this.prisma.productRequestRemark.create({ data: { productRequestId, text, createdById: actorId } });
  }

  async voidRemark(remarkId: string, voided: boolean) {
    const remark = await this.prisma.productRequestRemark.findUnique({ where: { id: remarkId } });
    if (!remark) throw new NotFoundException('Remarque introuvable');

    return this.prisma.productRequestRemark.update({ where: { id: remarkId }, data: { voidedAt: voided ? new Date() : null } });
  }
}
