import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { CreateRoleDto } from './dto/create-role.dto';

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  listPermissions() {
    return this.prisma.permission.findMany({ orderBy: [{ group: 'asc' }, { key: 'asc' }] });
  }

  async listRoles() {
    const roles = await this.prisma.role.findMany({
      include: { rolePermissions: { include: { permission: true } }, _count: { select: { users: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return roles.map((role) => ({
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      usersCount: role._count.users,
      permissionKeys: role.rolePermissions.map((rp) => rp.permission.key),
    }));
  }

  async createRole(dto: CreateRoleDto) {
    const existing = await this.prisma.role.findUnique({ where: { key: dto.key } });
    if (existing) throw new ConflictException('Cette clé de rôle existe déjà');
    return this.prisma.role.create({ data: dto });
  }

  async setRolePermissions(roleId: string, permissionKeys: string[], actorId?: string) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Rôle introuvable');
    if (role.key === 'admin') {
      throw new BadRequestException('Le rôle ADMIN a toujours tous les droits, non modifiable');
    }

    const permissions = await this.prisma.permission.findMany({
      where: { key: { in: permissionKeys } },
    });

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId } }),
      this.prisma.rolePermission.createMany({
        data: permissions.map((p) => ({ roleId, permissionId: p.id })),
      }),
    ]);

    await this.auditLog.record({
      entityType: 'Role',
      entityId: roleId,
      action: 'UPDATE',
      field: 'permissions',
      newValue: permissionKeys,
      actorId,
    });

    return this.listRoles();
  }
}
