import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { runOrExplainForeignKeyError } from '../common/prisma-errors.util';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateProductRequestDto } from './dto/create-product-request.dto';
import { toAdminProductRequestDTO, toClientProductRequestDTO } from './dto/product-request-response.dto';
import { UpdateProductRequestStatusDto } from './dto/update-product-request-status.dto';

const REQUEST_INCLUDE = { client: { select: { raisonSociale: true, telephone: true } } } as const;

@Injectable()
export class ProductRequestsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  // ── CLIENT ───────────────────────────────────────────────────────────

  async create(clientId: string, dto: CreateProductRequestDto) {
    const request = await this.prisma.productRequest.create({
      data: { clientId, imageUrl: dto.imageUrl, description: dto.description },
    });

    await this.notifications.notifyAllAdmins(
      'DEMANDE_PRODUIT',
      'Nouvelle demande de produit',
      'Un client a demandé un produit par photo.',
      { productRequestId: request.id },
    );

    return toClientProductRequestDTO(request);
  }

  async findAllForClient(clientId: string) {
    const requests = await this.prisma.productRequest.findMany({
      where: { clientId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return requests.map(toClientProductRequestDTO);
  }

  // ── ADMIN ────────────────────────────────────────────────────────────

  async findAllForAdmin(status?: 'EN_ATTENTE' | 'TRAITEE' | 'REJETEE') {
    const requests = await this.prisma.productRequest.findMany({
      where: { deletedAt: null, ...(status ? { status } : {}) },
      include: REQUEST_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return requests.map(toAdminProductRequestDTO);
  }

  async updateStatus(id: string, dto: UpdateProductRequestStatusDto) {
    const request = await this.prisma.productRequest.findUnique({ where: { id } });
    if (!request || request.deletedAt) throw new NotFoundException('Demande introuvable.');

    const updated = await this.prisma.productRequest.update({
      where: { id },
      data: { status: dto.status, adminNote: dto.adminNote },
      include: REQUEST_INCLUDE,
    });

    const client = await this.prisma.client.findUnique({ where: { id: updated.clientId } });
    if (client) {
      const titre = dto.status === 'TRAITEE' ? 'Votre demande de produit a été traitée' : 'Votre demande de produit a été refusée';
      await this.notifications.notifyUser(client.userId, 'DEMANDE_PRODUIT', titre, dto.adminNote ?? titre, { productRequestId: id });
    }

    return toAdminProductRequestDTO(updated);
  }

  // ── Corbeille ────────────────────────────────────────────────────────

  async findTrash() {
    const requests = await this.prisma.productRequest.findMany({
      where: { deletedAt: { not: null } },
      include: REQUEST_INCLUDE,
      orderBy: { deletedAt: 'desc' },
    });
    return requests.map(toAdminProductRequestDTO);
  }

  async remove(id: string) {
    const request = await this.prisma.productRequest.findUnique({ where: { id } });
    if (!request || request.deletedAt) throw new NotFoundException('Demande introuvable.');
    await this.prisma.productRequest.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async restore(id: string) {
    const request = await this.prisma.productRequest.findUnique({ where: { id } });
    if (!request || !request.deletedAt) throw new NotFoundException('Demande introuvable dans la corbeille.');
    await this.prisma.productRequest.update({ where: { id }, data: { deletedAt: null } });
  }

  async permanentDelete(id: string) {
    const request = await this.prisma.productRequest.findUnique({ where: { id } });
    if (!request || !request.deletedAt) throw new NotFoundException('Demande introuvable dans la corbeille.');
    await runOrExplainForeignKeyError(
      () => this.prisma.productRequest.delete({ where: { id } }),
      'Impossible de supprimer définitivement cette demande.',
    );
  }
}
