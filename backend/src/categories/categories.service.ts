import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { runOrExplainForeignKeyError } from '../common/prisma-errors.util';
import { CreateCategoryDto } from './dto/create-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const categories = await this.prisma.category.findMany({
      where: { deletedAt: null },
      orderBy: { nom: 'asc' },
      include: { _count: { select: { products: true } } },
    });
    return categories.map(({ _count, ...c }) => ({ ...c, productCount: _count.products }));
  }

  async create(dto: CreateCategoryDto) {
    return this.prisma.category.create({ data: dto });
  }

  async update(id: string, dto: Partial<CreateCategoryDto>) {
    await this.assertActiveExists(id);
    return this.prisma.category.update({ where: { id }, data: dto });
  }

  // ── Corbeille ────────────────────────────────────────────────────────

  async findTrash() {
    const categories = await this.prisma.category.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
      include: { _count: { select: { products: true } } },
    });
    return categories.map(({ _count, ...c }) => ({ ...c, productCount: _count.products }));
  }

  async remove(id: string) {
    await this.assertActiveExists(id);
    await this.prisma.category.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async restore(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category || !category.deletedAt) throw new NotFoundException('Catégorie introuvable dans la corbeille.');
    await this.prisma.category.update({ where: { id }, data: { deletedAt: null } });
  }

  async permanentDelete(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category || !category.deletedAt) throw new NotFoundException('Catégorie introuvable dans la corbeille.');

    await runOrExplainForeignKeyError(
      () => this.prisma.category.delete({ where: { id } }),
      'Impossible de supprimer définitivement : des produits ou sous-catégories sont encore liés.',
    );
  }

  private async assertActiveExists(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category || category.deletedAt) throw new NotFoundException('Catégorie introuvable.');
  }
}
