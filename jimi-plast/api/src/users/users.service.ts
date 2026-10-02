import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { TrashService } from '../common/services/trash.service';
import { PermissionsResolverService } from '../common/services/permissions-resolver.service';
import { SetUserStatusDto } from './dto/set-user-status.dto';
import { SetUserPermissionsDto } from './dto/set-user-permissions.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const PASSWORD_SALT_ROUNDS = 12;
const USER_SELECT = {
  id: true,
  fullName: true,
  avatarUrl: true,
  email: true,
  phone: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  role: { select: { id: true, key: true, name: true } },
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly trash: TrashService,
    private readonly permissionsResolver: PermissionsResolverService,
  ) {}

  list() {
    return this.prisma.user.findMany({
      where: { deletedAt: null },
      select: USER_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null }, select: USER_SELECT });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return user;
  }

  /** Création directe d'un compte personnel (employé/admin/rôle sur mesure) —
   * pas de fiche Customer/Manufacturer associée, contrairement à
   * CustomersService.create()/ManufacturersService — juste le compte. */
  async create(dto: CreateUserDto, actorId: string) {
    const email = dto.email?.trim() || undefined;
    const phone = dto.phone?.trim() || undefined;
    if (!email && !phone) throw new BadRequestException('Renseignez un email ou un téléphone pour la connexion');

    if (email) {
      const existing = await this.prisma.user.findUnique({ where: { email } });
      if (existing) throw new ConflictException('Un compte existe déjà avec cet email');
    }
    if (phone) {
      const existing = await this.prisma.user.findUnique({ where: { phone } });
      if (existing) throw new ConflictException('Un compte existe déjà avec ce téléphone');
    }

    const role = await this.prisma.role.findUnique({ where: { key: dto.roleKey } });
    if (!role) throw new BadRequestException(`Rôle "${dto.roleKey}" inconnu`);

    const passwordHash = await bcrypt.hash(dto.initialPassword, PASSWORD_SALT_ROUNDS);
    const user = await this.prisma.user.create({
      data: { fullName: dto.fullName, email, phone, passwordHash, roleId: role.id, status: 'ACTIVE' },
      select: USER_SELECT,
    });

    await this.auditLog.record({ entityType: 'User', entityId: user.id, action: 'CREATE', actorId });
    return user;
  }

  async update(id: string, dto: UpdateUserDto, actorId: string) {
    const existing = await this.prisma.user.findFirst({ where: { id, deletedAt: null }, include: { role: true } });
    if (!existing) throw new NotFoundException('Utilisateur introuvable');

    const email = dto.email !== undefined ? dto.email?.trim() || null : undefined;
    const phone = dto.phone !== undefined ? dto.phone?.trim() || null : undefined;

    if (email && email !== existing.email) {
      const conflict = await this.prisma.user.findUnique({ where: { email } });
      if (conflict) throw new ConflictException('Un compte existe déjà avec cet email');
    }
    if (phone && phone !== existing.phone) {
      const conflict = await this.prisma.user.findUnique({ where: { phone } });
      if (conflict) throw new ConflictException('Un compte existe déjà avec ce téléphone');
    }

    let roleId: string | undefined;
    if (dto.roleKey !== undefined && dto.roleKey !== existing.role.key) {
      if (existing.role.key === 'admin') throw new BadRequestException('Impossible de changer le rôle ADMIN');
      const role = await this.prisma.role.findUnique({ where: { key: dto.roleKey } });
      if (!role) throw new BadRequestException(`Rôle "${dto.roleKey}" inconnu`);
      roleId = role.id;
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(roleId ? { roleId } : {}),
      },
      select: USER_SELECT,
    });

    await this.auditLog.record({ entityType: 'User', entityId: id, action: 'UPDATE', newValue: dto, actorId });
    return updated;
  }

  async remove(id: string, actorId: string, reason?: string) {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null }, include: { role: true } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (id === actorId) throw new BadRequestException('Impossible de supprimer votre propre compte');
    if (user.role.key === 'admin') {
      const activeAdmins = await this.prisma.user.count({
        where: { role: { key: 'admin' }, status: 'ACTIVE', deletedAt: null },
      });
      if (activeAdmins <= 1) throw new BadRequestException('Impossible de supprimer le dernier compte ADMIN actif');
    }

    await this.prisma.user.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.trash.moveToTrash({
      entityType: 'User',
      entityId: id,
      snapshot: user as unknown as Record<string, unknown>,
      deletedById: actorId,
      reason,
    });

    return { id };
  }

  async setAvatar(userId: string, avatarUrl: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: { id: true, fullName: true, avatarUrl: true },
    });
  }

  async setStatus(userId: string, dto: SetUserStatusDto, actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (dto.status === 'SUSPENDED') {
      if (userId === actorId) throw new BadRequestException('Impossible de suspendre votre propre compte');
      if (user.role.key === 'admin') {
        const activeAdmins = await this.prisma.user.count({
          where: { role: { key: 'admin' }, status: 'ACTIVE', deletedAt: null },
        });
        if (activeAdmins <= 1) throw new BadRequestException('Impossible de suspendre le dernier compte ADMIN actif');
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { status: dto.status },
    });

    await this.auditLog.record({
      entityType: 'User',
      entityId: userId,
      action: 'UPDATE',
      field: 'status',
      oldValue: user.status,
      newValue: dto.status,
      actorId,
    });

    return updated;
  }

  async getPermissions(userId: string) {
    const overrides = await this.prisma.userPermission.findMany({
      where: { userId },
      include: { permission: true },
    });
    const { permissions, roleKey } = await this.permissionsResolver.resolveForUser(userId);
    return {
      roleKey,
      effective: permissions,
      overrides: overrides.map((o) => ({ permissionKey: o.permission.key, granted: o.granted })),
    };
  }

  async setPermissions(userId: string, dto: SetUserPermissionsDto, actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (user.role.key === 'admin') {
      throw new BadRequestException('Le rôle ADMIN a toujours tous les droits, non modifiable');
    }

    const permissions = await this.prisma.permission.findMany({
      where: { key: { in: dto.overrides.map((o) => o.permissionKey) } },
    });
    const permissionByKey = new Map(permissions.map((p) => [p.key, p.id]));

    await this.prisma.$transaction(
      dto.overrides
        .filter((o) => permissionByKey.has(o.permissionKey))
        .map((o) =>
          this.prisma.userPermission.upsert({
            where: {
              userId_permissionId: { userId, permissionId: permissionByKey.get(o.permissionKey)! },
            },
            create: { userId, permissionId: permissionByKey.get(o.permissionKey)!, granted: o.granted },
            update: { granted: o.granted },
          }),
        ),
    );

    await this.auditLog.record({
      entityType: 'User',
      entityId: userId,
      action: 'UPDATE',
      field: 'permissions',
      newValue: dto.overrides,
      actorId,
    });

    return this.getPermissions(userId);
  }
}
