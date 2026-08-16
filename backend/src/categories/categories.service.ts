import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { runOrExplainForeignKeyError } from '../common/prisma-errors.util';
import { CreateCategoryDto } from './dto/create-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  /**
   * `forRole` narrows the tree to what that role is allowed to browse
   * (Category.visibleToClient/visibleToEmployee, set by the Admin) — an
   * invisible category (and its products, filtered separately at the
   * product level) never appears in the Client/Employee catalog. Admin
   * (or no role, e.g. internal use) always sees everything, flags included,
   * since the Admin is the one managing that visibility.
   */
  async findAll(forRole?: 'CLIENT' | 'EMPLOYEE') {
    const visibilityFilter =
      forRole === 'CLIENT' ? { visibleToClient: true } : forRole === 'EMPLOYEE' ? { visibleToEmployee: true } : {};
    const categories = await this.prisma.category.findMany({
      where: { deletedAt: null, ...visibilityFilter },
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

  // Blocks moving a non-empty category to the corbeille — a soft-delete is
  // reversible but a category "disappearing" while still holding products
  // would strand them from every list/filter that excludes deleted categories.
  async remove(id: string) {
    await this.assertActiveExists(id);
    const activeProductCount = await this.prisma.product.count({ where: { categoryId: id, deletedAt: null } });
    if (activeProductCount > 0) {
      throw new BadRequestException('Impossible de supprimer ce dossier car il contient encore des produits.');
    }
    const activeChildCount = await this.prisma.category.count({ where: { parentId: id, deletedAt: null } });
    if (activeChildCount > 0) {
      throw new BadRequestException('Impossible de supprimer ce dossier car il contient encore des sous-dossiers.');
    }
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
