import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { TrashService } from '../common/services/trash.service';
import { UpsertCategoryDto } from './dto/upsert-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly trash: TrashService,
  ) {}

  list() {
    return this.prisma.category.findMany({
      where: { deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { nameFr: 'asc' }],
      include: { _count: { select: { products: true } } },
    });
  }

  async create(dto: UpsertCategoryDto, actorId: string) {
    const existing = await this.prisma.category.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new BadRequestException('Ce slug existe déjà');

    const category = await this.prisma.category.create({ data: dto });
    await this.auditLog.record({
      entityType: 'Category',
      entityId: category.id,
      action: 'CREATE',
      actorId,
    });
    return category;
  }

  async update(id: string, dto: UpsertCategoryDto, actorId: string) {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Catégorie introuvable');

    if (dto.parentId === id) throw new BadRequestException('Une catégorie ne peut pas être son propre parent');

    const updated = await this.prisma.category.update({ where: { id }, data: dto });
    await this.auditLog.record({
      entityType: 'Category',
      entityId: id,
      action: 'UPDATE',
      oldValue: existing,
      newValue: dto,
      actorId,
    });
    return updated;
  }

  async remove(id: string, actorId: string, reason?: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { products: { where: { deletedAt: null }, take: 1 }, children: { take: 1 } },
    });
    if (!category) throw new NotFoundException('Catégorie introuvable');
    if (category.products.length > 0 || category.children.length > 0) {
      throw new BadRequestException(
        'Impossible de supprimer une catégorie contenant des produits ou sous-catégories',
      );
    }

    await this.prisma.category.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.trash.moveToTrash({
      entityType: 'Category',
      entityId: id,
      snapshot: category as unknown as Record<string, unknown>,
      deletedById: actorId,
      reason,
    });
    return { id };
  }
}
