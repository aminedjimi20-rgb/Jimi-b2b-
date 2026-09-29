import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const CONFIRM_PHRASE = 'RESET';

// Jamais vidées : la structure technique (rôles/permissions), les comptes
// admin eux-mêmes, la vitrine de marque (logos + badge d'ancienneté) et les
// réglages/traductions génériques de l'appli — tout le reste est considéré
// "données métier" et repart à zéro.
const PRESERVED_TABLES = [
  '_prisma_migrations',
  'roles',
  'permissions',
  'role_permissions',
  'user_permissions',
  'users',
  'site_branding',
  'partner_logos',
  'settings',
  'translations',
];

@Injectable()
export class FactoryResetService {
  constructor(private readonly prisma: PrismaService) {}

  async reset(actorId: string, confirm: string) {
    if (confirm !== CONFIRM_PHRASE) {
      throw new BadRequestException(`Tapez exactement "${CONFIRM_PHRASE}" pour confirmer`);
    }

    const actor = await this.prisma.user.findUnique({ where: { id: actorId }, include: { role: true } });
    if (!actor || actor.role.key !== 'admin') {
      throw new ForbiddenException('Réservé à l’administrateur');
    }

    const tables = await this.prisma.$queryRawUnsafe<{ tablename: string }[]>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
    );

    for (const { tablename } of tables) {
      if (PRESERVED_TABLES.includes(tablename)) continue;
      await this.prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" RESTART IDENTITY CASCADE`);
    }

    // Tout ce qui référençait un compte non-admin a déjà été vidé ci-dessus
    // (bons, clients, fabricants, notes...) — supprimer ces comptes ne peut
    // donc plus violer aucune contrainte de clé étrangère.
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM "users" WHERE "roleId" NOT IN (SELECT "id" FROM "roles" WHERE "key" = 'admin')`,
    );

    return { ok: true };
  }
}
