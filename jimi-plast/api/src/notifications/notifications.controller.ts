import { Controller, Get, Param, Put, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('mine')
  async mine(@CurrentUser() user: AuthenticatedUser, @Query('unreadOnly') unreadOnly?: string) {
    return this.prisma.notification.findMany({
      where: { userId: user.id, ...(unreadOnly === 'true' ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  @Get('mine/unread-count')
  async unreadCount(@CurrentUser() user: AuthenticatedUser) {
    const count = await this.prisma.notification.count({ where: { userId: user.id, readAt: null } });
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
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }
}
