import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { PermissionsResolverService } from '../services/permissions-resolver.service';
import { JwtPayload } from '../../auth/auth.types';

/**
 * Pour les routes publiques (catalogue) qui doivent néanmoins adapter leur
 * réponse si un utilisateur est connecté (prix visibles selon son rôle).
 * Ne bloque jamais la requête : jeton absent ou invalide → simplement anonyme.
 */
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly permissionsResolver: PermissionsResolverService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers?.authorization;
    if (!authHeader?.startsWith('Bearer ')) return true;

    try {
      const token = authHeader.slice('Bearer '.length);
      const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
      });

      const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, include: { role: true } });
      if (!user || user.status !== 'ACTIVE' || user.deletedAt) return true;

      const { permissions } = await this.permissionsResolver.resolveForUser(user.id);
      request.user = {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        roleId: user.roleId,
        roleKey: user.role.key,
        locale: user.locale,
        permissions,
      };
    } catch {
      // jeton invalide/expiré : on continue en anonyme, sans erreur
    }
    return true;
  }
}
