import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { TrashService } from '../common/services/trash.service';
import { ProductsService } from '../products/products.service';
import { UpsertManufacturerDto } from './dto/upsert-manufacturer.dto';
import { AddPaymentDto, AddAdjustmentDto } from '../customers/dto/add-ledger-entry.dto';

@Injectable()
export class ManufacturersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly trash: TrashService,
    private readonly productsService: ProductsService,
  ) {}

  private async balanceOf(manufacturerId: string) {
    const agg = await this.prisma.supplierLedgerEntry.aggregate({
      where: { manufacturerId, voidedAt: null },
      _sum: { amount: true },
    });
    return Number(agg._sum.amount ?? 0);
  }

  async list(search?: string) {
    const manufacturers = await this.prisma.manufacturer.findMany({
      where: {
        deletedAt: null,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { company: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: { where: { deletedAt: null } } } }, pendingDeletions: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    const balances = await Promise.all(manufacturers.map((m) => this.balanceOf(m.id)));
    return manufacturers.map((m, i) => ({ ...m, balance: balances[i] }));
  }

  async getById(id: string) {
    const manufacturer = await this.prisma.manufacturer.findFirst({
      where: { id, deletedAt: null },
      include: {
        user: { select: { id: true, email: true, phone: true } },
        pendingDeletions: { orderBy: { createdAt: 'desc' }, take: 1, include: { requestedBy: { select: { fullName: true } } } },
      },
    });
    if (!manufacturer) throw new NotFoundException('Fabricant introuvable');

    const entries = await this.prisma.supplierLedgerEntry.findMany({
      where: { manufacturerId: id },
      orderBy: { createdAt: 'desc' },
      include: { pendingDeletions: { orderBy: { createdAt: 'desc' }, take: 1, include: { requestedBy: { select: { fullName: true } } } } },
    });

    return {
      ...manufacturer,
      balance: entries.filter((e) => !e.voidedAt).reduce((s, e) => s + Number(e.amount), 0),
      entries,
    };
  }

  async getByUserId(userId: string) {
    const manufacturer = await this.prisma.manufacturer.findUnique({ where: { userId } });
    if (!manufacturer) return null;
    return this.getById(manufacturer.id);
  }

  /** Relevé de compte pour une période donnée — même logique que les clients. */
  async getStatement(id: string, from?: Date, to?: Date) {
    const manufacturer = await this.prisma.manufacturer.findFirst({ where: { id, deletedAt: null } });
    if (!manufacturer) throw new NotFoundException('Fabricant introuvable');

    const startAgg = from
      ? await this.prisma.supplierLedgerEntry.aggregate({
          where: { manufacturerId: id, voidedAt: null, createdAt: { lt: from } },
          _sum: { amount: true },
        })
      : null;
    const startBalance = Number(startAgg?._sum.amount ?? 0);

    const entries = await this.prisma.supplierLedgerEntry.findMany({
      where: {
        manufacturerId: id,
        voidedAt: null,
        ...(from ? { createdAt: { gte: from } } : {}),
        ...(to ? { createdAt: { lte: to } } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });

    let running = startBalance;
    const rows = entries.map((e) => {
      running += Number(e.amount);
      return { ...e, balanceAfter: running };
    });

    return {
      name: manufacturer.name,
      company: manufacturer.company,
      from: from ?? null,
      to: to ?? null,
      startBalance,
      endBalance: running,
      entries: rows,
    };
  }

  // Vue rapide "combien j'ai travaillé avec lui / combien je lui ai payé"
  // sur une période — voir le pendant côté client pour le détail du
  // raisonnement (bons confirmés sur la période, pas les écritures du
  // ledger qui peuvent dater d'un ajustement ultérieur à un bon plus ancien).
  async getPeriodSummary(id: string, from?: Date, to?: Date) {
    const manufacturer = await this.prisma.manufacturer.findFirst({ where: { id, deletedAt: null } });
    if (!manufacturer) throw new NotFoundException('Fabricant introuvable');

    const vouchers = await this.prisma.purchaseVoucher.findMany({
      where: {
        manufacturerId: id,
        status: 'CONFIRMED',
        ...(from || to ? { confirmedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      },
      include: { items: { select: { lineTotal: true } } },
    });
    const totalBusiness = vouchers.reduce((sum, v) => {
      const subtotal = v.items.reduce((s, i) => s + Number(i.lineTotal), 0);
      return sum + subtotal - Number(v.discount) + Number(v.transportCost);
    }, 0);

    const paymentAgg = await this.prisma.supplierLedgerEntry.aggregate({
      where: {
        manufacturerId: id,
        type: 'PAYMENT',
        voidedAt: null,
        ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      },
      _sum: { amount: true },
    });
    const totalPaid = -Number(paymentAgg._sum.amount ?? 0);

    return { totalBusiness: Math.round(totalBusiness * 100) / 100, totalPaid: Math.round(totalPaid * 100) / 100 };
  }

  // Vue en lecture seule, réservée au fabricant lui-même — ne montre que
  // ses propres produits, et seulement si l'admin l'y a autorisé.
  async getMyCatalog(userId: string) {
    const manufacturer = await this.prisma.manufacturer.findUnique({ where: { userId } });
    if (!manufacturer) throw new NotFoundException('Aucune fiche fabricant liée à ce compte');
    if (!manufacturer.canViewCatalog) {
      throw new ForbiddenException("L'accès au catalogue n'est pas encore autorisé pour ce compte");
    }
    return this.productsService.list({ manufacturerId: manufacturer.id, pageSize: 100 }, []);
  }

  async create(dto: UpsertManufacturerDto, actorId: string) {
    const manufacturer = await this.prisma.manufacturer.create({ data: dto });
    await this.auditLog.record({ entityType: 'Manufacturer', entityId: manufacturer.id, action: 'CREATE', actorId });
    return manufacturer;
  }

  async update(id: string, dto: UpsertManufacturerDto, actorId: string) {
    const existing = await this.prisma.manufacturer.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException('Fabricant introuvable');

    const updated = await this.prisma.manufacturer.update({ where: { id }, data: dto });
    await this.auditLog.record({ entityType: 'Manufacturer', entityId: id, action: 'UPDATE', oldValue: existing, newValue: dto, actorId });
    return updated;
  }

  // Note générale affichée directement sur la fiche (pas cachée dans le
  // formulaire d'édition) — sauvegarde rapide, indépendante du reste du
  // formulaire. "hidden" replie juste l'affichage, le texte n'est jamais
  // perdu.
  async updateNote(id: string, dto: { note?: string; hidden?: boolean }) {
    const existing = await this.prisma.manufacturer.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException('Fabricant introuvable');
    await this.prisma.manufacturer.update({
      where: { id },
      data: {
        ...(dto.note !== undefined ? { notes: dto.note } : {}),
        ...(dto.hidden !== undefined ? { notesHidden: dto.hidden } : {}),
      },
    });
    return this.getById(id);
  }

  async remove(id: string, actorId: string, reason?: string) {
    const manufacturer = await this.prisma.manufacturer.findFirst({ where: { id, deletedAt: null } });
    if (!manufacturer) throw new NotFoundException('Fabricant introuvable');

    await this.prisma.manufacturer.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.trash.moveToTrash({
      entityType: 'Manufacturer',
      entityId: id,
      snapshot: manufacturer as unknown as Record<string, unknown>,
      deletedById: actorId,
      reason,
    });
    return { id };
  }

  async addPayment(manufacturerId: string, dto: AddPaymentDto, actorId: string) {
    await this.getById(manufacturerId);
    await this.prisma.supplierLedgerEntry.create({
      data: { manufacturerId, type: 'PAYMENT', amount: -Math.abs(dto.amount), note: dto.note, createdById: actorId },
    });
    return this.getById(manufacturerId);
  }

  async addAdjustment(manufacturerId: string, dto: AddAdjustmentDto, actorId: string) {
    await this.getById(manufacturerId);
    await this.prisma.supplierLedgerEntry.create({
      data: { manufacturerId, type: 'ADJUSTMENT', amount: dto.amount, note: dto.reason, createdById: actorId },
    });
    return this.getById(manufacturerId);
  }
}
