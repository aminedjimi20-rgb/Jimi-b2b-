import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { PermissionsResolverService } from '../common/services/permissions-resolver.service';
import { SetUserStatusDto } from './dto/set-user-status.dto';
import { SetUserPermissionsDto } from './dto/set-user-permissions.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly permissionsResolver: PermissionsResolverService,
  ) {}

  list() {
    return this.prisma.user.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        role: { select: { id: true, key: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async setStatus(userId: string, dto: SetUserStatusDto, actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (user.role.key === 'admin' && dto.status === 'SUSPENDED') {
      throw new BadRequestException('Impossible de suspendre un compte ADMIN');
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
