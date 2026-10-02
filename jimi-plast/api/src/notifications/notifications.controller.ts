import { Controller, Delete, Get, NotFoundException, Param, Put, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TrashService } from '../common/services/trash.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trash: TrashService,
  ) {}

  @Get('mine')
  async mine(@CurrentUser() user: AuthenticatedUser, @Query('unreadOnly') unreadOnly?: string) {
    return this.prisma.notification.findMany({
      where: { userId: user.id, deletedAt: null, ...(unreadOnly === 'true' ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  @Get('mine/unread-count')
  async unreadCount(@CurrentUser() user: AuthenticatedUser) {
    const count = await this.prisma.notification.count({
      where: { userId: user.id, readAt: null, deletedAt: null },
    });
    return { count };
  }

  @Put(':id/read')
  async markRead(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.prisma.notification.updateMany({
      where: { id, userId: user.id },
      data: { readAt: new Date() },
    });
    return { id };
  }

  @Put('read-all')
  async markAllRead(@CurrentUser() user: AuthenticatedUser) {
    await this.prisma.notification.updateMany({
      where: { userId: user.id, readAt: null, deletedAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId: user.id, deletedAt: null },
    });
    if (!notification) throw new NotFoundException('Notification introuvable');

    await this.prisma.notification.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.trash.moveToTrash({
      entityType: 'Notification',
      entityId: id,
      snapshot: notification as unknown as Record<string, unknown>,
      deletedById: user.id,
    });
    return { id };
  }
}
