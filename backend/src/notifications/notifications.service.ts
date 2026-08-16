import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { runOrExplainForeignKeyError } from '../common/prisma-errors.util';
import { BroadcastNotificationDto } from './dto/broadcast-notification.dto';
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

  /** ADMIN-only: send a SYSTEME notification to a chosen audience or a single client/employee. */
  async broadcast(dto: BroadcastNotificationDto) {
    let userIds: string[];

    switch (dto.audience) {
      case 'ALL_CLIENTS':
        userIds = await this.userIdsForRole('CLIENT');
        break;
      case 'ALL_EMPLOYEES':
        userIds = await this.userIdsForRole('EMPLOYEE');
        break;
      case 'ALL_ADMINS':
        userIds = await this.userIdsForRole('ADMIN');
        break;
      case 'EVERYONE':
        userIds = (
          await this.prisma.user.findMany({ where: { status: 'ACTIVE' }, select: { id: true } })
        ).map((u) => u.id);
        break;
      case 'ONE_CLIENT': {
        if (!dto.targetId) throw new NotFoundException('Client cible manquant.');
        const client = await this.prisma.client.findUnique({ where: { id: dto.targetId } });
        if (!client || client.deletedAt) throw new NotFoundException('Client introuvable.');
        userIds = [client.userId];
        break;
      }
      case 'ONE_EMPLOYEE': {
        if (!dto.targetId) throw new NotFoundException('Employé cible manquant.');
        const employee = await this.prisma.employee.findUnique({ where: { id: dto.targetId } });
        if (!employee || employee.deletedAt) throw new NotFoundException('Employé introuvable.');
        userIds = [employee.userId];
        break;
      }
    }

    if (userIds.length > 0) {
      await this.prisma.notification.createMany({
        data: userIds.map((userId) => ({ userId, type: 'SYSTEME' as NotificationType, titre: dto.titre, message: dto.message })),
      });
      await this.push.sendToUsers(userIds, dto.titre, dto.message, { type: 'SYSTEME' });
    }

    return { sent: userIds.length };
  }

  private async userIdsForRole(role: 'CLIENT' | 'EMPLOYEE' | 'ADMIN') {
    const users = await this.prisma.user.findMany({ where: { role, status: 'ACTIVE' }, select: { id: true } });
    return users.map((u) => u.id);
  }

  async listForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId, deletedAt: null },
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

  // ── Corbeille ────────────────────────────────────────────────────────

  async findTrash(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId, deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
    });
  }

  async remove(userId: string, id: string) {
    const notif = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!notif || notif.deletedAt) throw new NotFoundException('Notification introuvable.');
    await this.prisma.notification.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async restore(userId: string, id: string) {
    const notif = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!notif || !notif.deletedAt) throw new NotFoundException('Notification introuvable dans la corbeille.');
    await this.prisma.notification.update({ where: { id }, data: { deletedAt: null } });
  }

  async permanentDelete(userId: string, id: string) {
    const notif = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!notif || !notif.deletedAt) throw new NotFoundException('Notification introuvable dans la corbeille.');
    await runOrExplainForeignKeyError(
      () => this.prisma.notification.delete({ where: { id } }),
      'Impossible de supprimer définitivement cette notification.',
    );
  }

  async registerDeviceToken(userId: string, token: string, platform: 'ANDROID' | 'IOS' | 'WEB') {
    await this.push.registerToken(userId, token, platform);
  }

  async unregisterDeviceToken(token: string) {
    await this.push.unregisterToken(token);
  }
}
