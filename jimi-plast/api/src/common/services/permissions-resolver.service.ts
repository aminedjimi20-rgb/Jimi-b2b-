import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Calcule les droits effectifs d'un utilisateur : ceux de son rôle, plus les
 * surcharges individuelles (UserPermission.granted = true ajoute, false
 * retire). L'ADMIN a toujours tout, quoi qu'il arrive — un droit ajouté au
 * catalogue après coup n'a pas besoin d'être re-coché pour lui.
 */
@Injectable()
export class PermissionsResolverService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveForUser(userId: string): Promise<{ roleKey: string; permissions: string[] }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        role: { include: { rolePermissions: { include: { permission: true } } } },
        userPermissions: { include: { permission: true } },
      },
    });

    if (user.role.key === 'admin') {
      const all = await this.prisma.permission.findMany({ select: { key: true } });
      return { roleKey: user.role.key, permissions: all.map((p) => p.key) };
    }

    const fromRole = new Set(user.role.rolePermissions.map((rp) => rp.permission.key));
    for (const override of user.userPermissions) {
      if (override.granted) fromRole.add(override.permission.key);
      else fromRole.delete(override.permission.key);
    }

    return { roleKey: user.role.key, permissions: Array.from(fromRole) };
  }
}
