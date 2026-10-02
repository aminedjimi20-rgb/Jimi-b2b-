import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { TrashService } from '../common/services/trash.service';
import { UpsertExpenseCategoryDto } from './dto/upsert-expense-category.dto';
import { UpsertExpenseDto } from './dto/upsert-expense.dto';

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly trash: TrashService,
  ) {}

  listCategories() {
    return this.prisma.expenseCategory.findMany({ where: { deletedAt: null }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
  }

  async createCategory(dto: UpsertExpenseCategoryDto, actorId: string) {
    const existing = await this.prisma.expenseCategory.findUnique({ where: { name: dto.name } });
    if (existing && !existing.deletedAt) throw new BadRequestException('Cette catégorie existe déjà');
    const category = existing
      ? await this.prisma.expenseCategory.update({ where: { id: existing.id }, data: { deletedAt: null, sortOrder: dto.sortOrder ?? existing.sortOrder } })
      : await this.prisma.expenseCategory.create({ data: dto });
    await this.auditLog.record({ entityType: 'ExpenseCategory', entityId: category.id, action: 'CREATE', actorId });
    return category;
  }

  async removeCategory(id: string, actorId: string) {
    const existing = await this.prisma.expenseCategory.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Catégorie introuvable');
    const inUse = await this.prisma.expense.count({ where: { categoryId: id, deletedAt: null } });
    if (inUse > 0) throw new BadRequestException('Catégorie utilisée par des dépenses existantes');

    await this.prisma.expenseCategory.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.auditLog.record({ entityType: 'ExpenseCategory', entityId: id, action: 'DELETE', actorId });
    return { id };
  }

  list(filters: { from?: string; to?: string; categoryId?: string }) {
    return this.prisma.expense.findMany({
      where: {
        deletedAt: null,
        categoryId: filters.categoryId || undefined,
        date: {
          gte: filters.from ? new Date(filters.from) : undefined,
          lte: filters.to ? new Date(`${filters.to}T23:59:59.999Z`) : undefined,
        },
      },
      include: { category: true, delivery: { include: { driver: true } } },
      orderBy: { date: 'desc' },
    });
  }

  async getById(id: string) {
    const expense = await this.prisma.expense.findFirst({
      where: { id, deletedAt: null },
      include: { category: true, delivery: { include: { driver: true } } },
    });
    if (!expense) throw new NotFoundException('Dépense introuvable');
    return expense;
  }

  history(id: string) {
    return this.auditLog.history('Expense', id);
  }

  async create(dto: UpsertExpenseDto, actorId: string) {
    const category = await this.prisma.expenseCategory.findFirst({ where: { id: dto.categoryId, deletedAt: null } });
    if (!category) throw new BadRequestException('Catégorie introuvable');

    const expense = await this.prisma.expense.create({
      data: {
        categoryId: dto.categoryId,
        amount: dto.amount,
        date: dto.date ? new Date(dto.date) : new Date(),
        notes: dto.notes,
        createdById: actorId,
      },
    });
    await this.auditLog.record({ entityType: 'Expense', entityId: expense.id, action: 'CREATE', actorId });
    return this.getById(expense.id);
  }

  async update(id: string, dto: UpsertExpenseDto, actorId: string) {
    const existing = await this.getById(id);
    const category = await this.prisma.expenseCategory.findFirst({ where: { id: dto.categoryId, deletedAt: null } });
    if (!category) throw new BadRequestException('Catégorie introuvable');

    await this.prisma.expense.update({
      where: { id },
      data: {
        categoryId: dto.categoryId,
        amount: dto.amount,
        date: dto.date ? new Date(dto.date) : existing.date,
        notes: dto.notes,
      },
    });
    await this.auditLog.record({
      entityType: 'Expense',
      entityId: id,
      action: 'UPDATE',
      oldValue: { amount: existing.amount, categoryId: existing.categoryId, date: existing.date },
      newValue: dto,
      actorId,
    });
    return this.getById(id);
  }

  async remove(id: string, reason: string | undefined, actorId: string) {
    const expense = await this.getById(id);
    await this.prisma.expense.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.trash.moveToTrash({ entityType: 'Expense', entityId: id, snapshot: expense as never, deletedById: actorId, reason });
    return { id };
  }
}
