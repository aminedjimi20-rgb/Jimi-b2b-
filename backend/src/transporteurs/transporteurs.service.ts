import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { runOrExplainForeignKeyError } from '../common/prisma-errors.util';
import { CreateTransporteurDto } from './dto/create-transporteur.dto';
import { SetDeliveryRateDto } from './dto/set-delivery-rate.dto';

@Injectable()
export class TransporteursService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const transporteurs = await this.prisma.transporteur.findMany({
      where: { deletedAt: null },
      orderBy: { nom: 'asc' },
      include: { rates: { orderBy: { destination: 'asc' } } },
    });
    return transporteurs;
  }

  async findOneForAdmin(id: string) {
    const transporteur = await this.prisma.transporteur.findUnique({
      where: { id },
      include: { rates: { orderBy: { destination: 'asc' } } },
    });
    if (!transporteur || transporteur.deletedAt) throw new NotFoundException('Transporteur introuvable.');
    return transporteur;
  }

  async create(dto: CreateTransporteurDto) {
    return this.prisma.transporteur.create({ data: { nom: dto.nom }, include: { rates: true } });
  }

  async update(id: string, dto: Partial<CreateTransporteurDto>) {
    await this.assertActiveExists(id);
    return this.prisma.transporteur.update({ where: { id }, data: dto, include: { rates: true } });
  }

  /** One tarif per (transporteur, destination) — creates or overwrites the price for that destination. */
  async setRate(transporteurId: string, dto: SetDeliveryRateDto) {
    await this.assertActiveExists(transporteurId);
    return this.prisma.deliveryRate.upsert({
      where: { transporteurId_destination: { transporteurId, destination: dto.destination } },
      create: { transporteurId, destination: dto.destination, prix: dto.prix },
      update: { prix: dto.prix },
    });
  }

  async removeRate(transporteurId: string, rateId: string) {
    const rate = await this.prisma.deliveryRate.findUnique({ where: { id: rateId } });
    if (!rate || rate.transporteurId !== transporteurId) throw new NotFoundException('Tarif introuvable.');
    await this.prisma.deliveryRate.delete({ where: { id: rateId } });
  }

  // ── Corbeille ────────────────────────────────────────────────────────

  async findTrash() {
    return this.prisma.transporteur.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
      include: { rates: true },
    });
  }

  async remove(id: string) {
    await this.assertActiveExists(id);
    await this.prisma.transporteur.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async restore(id: string) {
    const transporteur = await this.prisma.transporteur.findUnique({ where: { id } });
    if (!transporteur || !transporteur.deletedAt) throw new NotFoundException('Transporteur introuvable dans la corbeille.');
    await this.prisma.transporteur.update({ where: { id }, data: { deletedAt: null } });
  }

  async permanentDelete(id: string) {
    const transporteur = await this.prisma.transporteur.findUnique({ where: { id } });
    if (!transporteur || !transporteur.deletedAt) throw new NotFoundException('Transporteur introuvable dans la corbeille.');

    await runOrExplainForeignKeyError(
      () => this.prisma.transporteur.delete({ where: { id } }),
      'Impossible de supprimer définitivement : des commandes référencent encore ce transporteur.',
    );
  }

  private async assertActiveExists(id: string) {
    const transporteur = await this.prisma.transporteur.findUnique({ where: { id } });
    if (!transporteur || transporteur.deletedAt) throw new NotFoundException('Transporteur introuvable.');
  }
}
