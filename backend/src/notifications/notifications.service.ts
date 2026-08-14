import { Injectable } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from './push.service';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private push: PushService,
  ) {}

  /** Internal helper used by OrdersService/StockService — never exposed directly as an endpoint. */
  async notifyUser(userId: string, type: NotificationType, titre: string, message: string, data?: Prisma.InputJsonValue) {
    await this.prisma.notification.create({ data: { userId, type, titre, message, data } });
    await this.push.sendToUser(userId, titre, message, { type });
  }

  async notifyAllAdmins(type: NotificationType, titre: string, message: string, data?: Prisma.InputJsonValue) {
    const admins = await this.prisma.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' }, select: { id: true } });
    await this.prisma.notification.createMany({
      data: admins.map((a) => ({ userId: a.id, type, titre, message, data })),
    });
    await this.push.sendToUsers(admins.map((a) => a.id), titre, message, { type });
  }

  async listForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async markRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({ where: { id, userId }, data: { lu: true } });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({ where: { userId, lu: false }, data: { lu: true } });
  }

  async registerDeviceToken(userId: string, token: string, platform: 'ANDROID' | 'IOS' | 'WEB') {
    await this.push.registerToken(userId, token, platform);
  }

  async unregisterDeviceToken(token: string) {
    await this.push.unregisterToken(token);
  }
}
