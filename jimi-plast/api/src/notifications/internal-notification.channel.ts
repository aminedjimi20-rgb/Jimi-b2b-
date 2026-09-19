import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationChannel, NotificationEvent } from './notification-channel.interface';

/**
 * Alimente le centre de notifications interne (§71 du cahier des charges).
 * Si l'événement porte un userId précis dans data (ex: le client concerné
 * par son bon confirmé), seul ce destinataire est notifié ; sinon
 * l'événement est considéré "pour l'administration" et va à tous les ADMIN.
 */
@Injectable()
export class InternalNotificationChannel implements NotificationChannel {
  readonly name = 'internal';

  constructor(private readonly prisma: PrismaService) {}

  async send(event: NotificationEvent): Promise<void> {
    const targetUserId = event.data?.userId as string | undefined;

    const recipientIds = targetUserId
      ? [targetUserId]
      : (await this.prisma.user.findMany({ where: { role: { key: 'admin' } }, select: { id: true } })).map(
          (u) => u.id,
        );

    if (recipientIds.length === 0) return;

    await this.prisma.notification.createMany({
      data: recipientIds.map((userId) => ({
        userId,
        type: event.type,
        title: event.title,
        body: event.body,
        data: event.data as never,
      })),
    });
  }
}
