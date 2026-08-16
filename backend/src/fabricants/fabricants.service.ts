import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { runOrExplainForeignKeyError } from '../common/prisma-errors.util';
import { CreateFabricantDto } from './dto/create-fabricant.dto';

@Injectable()
export class FabricantsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const fabricants = await this.prisma.fabricant.findMany({
      where: { deletedAt: null },
      orderBy: { nom: 'asc' },
      include: { _count: { select: { products: true } } },
    });
    return fabricants.map(({ _count, ...f }) => ({ ...f, productCount: _count.products }));
  }

  async create(dto: CreateFabricantDto) {
    return this.prisma.fabricant.create({ data: dto });
  }

  async update(id: string, dto: Partial<CreateFabricantDto>) {
    await this.assertActiveExists(id);
    return this.prisma.fabricant.update({ where: { id }, data: dto });
  }

  // ── Corbeille ────────────────────────────────────────────────────────

  async findTrash() {
    const fabricants = await this.prisma.fabricant.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
      include: { _count: { select: { products: true } } },
    });
    return fabricants.map(({ _count, ...f }) => ({ ...f, productCount: _count.products }));
  }

  async remove(id: string) {
    await this.assertActiveExists(id);
    await this.prisma.fabricant.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async restore(id: string) {
    const fabricant = await this.prisma.fabricant.findUnique({ where: { id } });
    if (!fabricant || !fabricant.deletedAt) throw new NotFoundException('Fabricant introuvable dans la corbeille.');
    await this.prisma.fabricant.update({ where: { id }, data: { deletedAt: null } });
  }

  async permanentDelete(id: string) {
    const fabricant = await this.prisma.fabricant.findUnique({ where: { id } });
    if (!fabricant || !fabricant.deletedAt) throw new NotFoundException('Fabricant introuvable dans la corbeille.');

    await runOrExplainForeignKeyError(
      () => this.prisma.fabricant.delete({ where: { id } }),
      'Impossible de supprimer définitivement : des bons de réception ou des produits sont encore liés à ce fournisseur.',
    );
  }

  private async assertActiveExists(id: string) {
    const fabricant = await this.prisma.fabricant.findUnique({ where: { id } });
    if (!fabricant || fabricant.deletedAt) throw new NotFoundException('Fabricant introuvable.');
  }
}
