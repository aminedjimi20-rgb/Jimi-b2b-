import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { AddPaymentDto, AddAdjustmentDto } from './dto/add-ledger-entry.dto';

const PASSWORD_SALT_ROUNDS = 12;

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  private async balanceOf(customerId: string): Promise<number> {
    const agg = await this.prisma.ledgerEntry.aggregate({
      where: { customerId },
      _sum: { amount: true },
    });
    return Number(agg._sum.amount ?? 0);
  }

  async list() {
    const customers = await this.prisma.customer.findMany({
      where: { deletedAt: null },
      include: { user: { select: { id: true, fullName: true, avatarUrl: true, email: true, phone: true, status: true, role: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const balances = await Promise.all(customers.map((c) => this.balanceOf(c.id)));
    return customers.map((c, i) => ({
      id: c.id,
      businessName: c.businessName,
      wilaya: c.wilaya,
      creditLimit: Number(c.creditLimit),
      user: c.user,
      balance: balances[i],
    }));
  }

  async getById(id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, deletedAt: null },
      include: { user: { select: { id: true, fullName: true, avatarUrl: true, email: true, phone: true, status: true, role: true } } },
    });
    if (!customer) throw new NotFoundException('Client introuvable');

    const entries = await this.prisma.ledgerEntry.findMany({
      where: { customerId: id },
      orderBy: { createdAt: 'desc' },
    });

    return {
      id: customer.id,
      businessName: customer.businessName,
      address: customer.address,
      wilaya: customer.wilaya,
      creditLimit: Number(customer.creditLimit),
      notes: customer.notes,
      user: customer.user,
      balance: entries.reduce((sum, e) => sum + Number(e.amount), 0),
      entries,
    };
  }

  async getByUserId(userId: string) {
    const customer = await this.prisma.customer.findUnique({ where: { userId } });
    if (!customer) return null;
    return this.getById(customer.id);
  }

  /** Créée automatiquement quand une demande d'inscription est acceptée avec un rôle commercial. */
  async createProfileForUser(
    userId: string,
    data: { businessName?: string; address?: string; wilaya?: string },
  ) {
    return this.prisma.customer.create({ data: { userId, ...data } });
  }

  /** Création directe par l'Admin (§10 du cahier des charges), sans passer par une demande. */
  async create(dto: CreateCustomerDto, actorId: string) {
    const existingUser = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existingUser) throw new ConflictException('Un compte existe déjà avec cet email');

    const role = await this.prisma.role.findUnique({ where: { key: dto.roleKey } });
    if (!role) throw new BadRequestException(`Rôle "${dto.roleKey}" inconnu`);

    const passwordHash = await bcrypt.hash(dto.initialPassword, PASSWORD_SALT_ROUNDS);

    const customer = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          phone: dto.phone,
          fullName: dto.fullName,
          passwordHash,
          roleId: role.id,
          status: 'ACTIVE',
        },
      });
      return tx.customer.create({
        data: {
          userId: user.id,
          businessName: dto.businessName,
          address: dto.address,
          wilaya: dto.wilaya,
        },
        include: {
          user: { select: { id: true, fullName: true, avatarUrl: true, email: true, phone: true, status: true, role: true } },
        },
      });
    });

    await this.auditLog.record({ entityType: 'Customer', entityId: customer.id, action: 'CREATE', actorId });
    return customer;
  }

  async update(id: string, dto: UpdateCustomerDto, actorId: string) {
    const existing = await this.prisma.customer.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException('Client introuvable');

    const updated = await this.prisma.customer.update({ where: { id }, data: dto });
    await this.auditLog.record({
      entityType: 'Customer',
      entityId: id,
      action: 'UPDATE',
      oldValue: existing,
      newValue: dto,
      actorId,
    });
    return updated;
  }

  async addPayment(customerId: string, dto: AddPaymentDto, actorId: string) {
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, deletedAt: null } });
    if (!customer) throw new NotFoundException('Client introuvable');
    if (dto.amount <= 0) throw new BadRequestException('Le montant doit être positif');

    await this.prisma.ledgerEntry.create({
      data: {
        customerId,
        type: 'PAYMENT',
        amount: -Math.abs(dto.amount),
        note: dto.note,
        createdById: actorId,
      },
    });

    await this.auditLog.record({
      entityType: 'Customer',
      entityId: customerId,
      action: 'UPDATE',
      field: 'payment',
      newValue: dto.amount,
      actorId,
    });

    return this.getById(customerId);
  }

  async addAdjustment(customerId: string, dto: AddAdjustmentDto, actorId: string) {
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, deletedAt: null } });
    if (!customer) throw new NotFoundException('Client introuvable');

    await this.prisma.ledgerEntry.create({
      data: {
        customerId,
        type: 'ADJUSTMENT',
        amount: dto.amount,
        note: dto.reason,
        createdById: actorId,
      },
    });

    await this.auditLog.record({
      entityType: 'Customer',
      entityId: customerId,
      action: 'UPDATE',
      field: 'adjustment',
      newValue: dto,
      reason: dto.reason,
      actorId,
    });

    return this.getById(customerId);
  }
}
