import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const CONFIRM_PHRASE = 'RESET';

// Jamais vidées : la structure technique (rôles/permissions), la table users
// elle-même (le compte de qui déclenche le reset y est explicitement
// préservé plus bas, tout le reste y est supprimé), la vitrine de marque
// (logos + badge d'ancienneté) et les réglages/traductions génériques de
// l'appli — tout le reste est considéré "données métier" et repart à zéro.
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

    // Toutes les instructions d'un même reset dans une seule transaction :
    // soit tout passe, soit rien n'est touché — jamais un état à moitié vidé
    // si une étape échoue en cours de route.
    const usersDeleted = await this.prisma.$transaction(
      async (tx) => {
        const tables = await tx.$queryRawUnsafe<{ tablename: string }[]>(
          `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
        );

        for (const { tablename } of tables) {
          if (PRESERVED_TABLES.includes(tablename)) continue;
          await tx.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" RESTART IDENTITY CASCADE`);
        }

        // Seul le compte de qui a lancé le reset survit — pas "n'importe quel
        // admin" : si quelqu'un d'autre a aussi le rôle admin, son compte est
        // effacé comme tout le reste. Tout ce qui référençait ces comptes a
        // déjà été vidé ci-dessus (bons, clients, fabricants, notes...), donc
        // ça ne peut plus violer aucune contrainte de clé étrangère.
        return tx.$executeRaw`DELETE FROM "users" WHERE "id" != ${actorId}`;
      },
      { timeout: 60_000 },
    );

    return { ok: true, usersDeleted };
  }
}
