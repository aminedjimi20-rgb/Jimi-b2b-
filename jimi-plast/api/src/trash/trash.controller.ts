import { BadRequestException, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TrashService } from '../common/services/trash.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';

/**
 * La corbeille est générique côté stockage (TrashItem + snapshot), mais la
 * restauration doit rendre l'entité d'origine visible à nouveau : chaque
 * type sait comment lever son propre `deletedAt`. Purger ne supprime jamais
 * la ligne d'origine (règle du projet : jamais de suppression SQL directe),
 * seulement le TrashItem qui devient non restaurable depuis l'interface.
 */
const RESTORABLE_ENTITY_UPDATERS: Record<string, (prisma: PrismaService, entityId: string) => Promise<unknown>> = {
  Product: (prisma, id) => prisma.product.update({ where: { id }, data: { deletedAt: null } }),
  Category: (prisma, id) => prisma.category.update({ where: { id }, data: { deletedAt: null } }),
  Manufacturer: (prisma, id) => prisma.manufacturer.update({ where: { id }, data: { deletedAt: null } }),
  Notification: (prisma, id) => prisma.notification.update({ where: { id }, data: { deletedAt: null } }),
};

@Controller('trash')
export class TrashController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trash: TrashService,
  ) {}

  @Get()
  @RequirePermissions('trash.restore')
  async list() {
    const items = await this.trash.list();
    const actorIds = [...new Set(items.map((i) => i.deletedById).filter((v): v is string => !!v))];
    const actors = actorIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, fullName: true } })
      : [];
    const actorNameById = new Map(actors.map((a) => [a.id, a.fullName]));
    return items.map((item) => ({
      ...item,
      deletedByName: item.deletedById ? (actorNameById.get(item.deletedById) ?? null) : null,
    }));
  }

  @Post(':id/restore')
  @RequirePermissions('trash.restore')
  async restore(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const item = await this.prisma.trashItem.findUnique({ where: { id } });
    if (!item || item.restoredAt || item.purgedAt) throw new NotFoundException('Élément de corbeille introuvable');

    const updater = RESTORABLE_ENTITY_UPDATERS[item.entityType];
    if (!updater) {
      throw new BadRequestException(`Restauration non prise en charge pour "${item.entityType}"`);
    }
    await updater(this.prisma, item.entityId);
    return this.trash.markRestored(id, user.id);
  }

  @Post(':id/purge')
  @RequirePermissions('trash.purge')
  async purge(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.trash.purge(id, user.id);
  }
}
