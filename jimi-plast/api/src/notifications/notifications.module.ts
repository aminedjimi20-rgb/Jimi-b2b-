import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { ConsoleNotificationChannel } from './console-notification.channel';
import { InternalNotificationChannel } from './internal-notification.channel';
import { WhatsAppNotificationChannel } from './whatsapp-notification.channel';
import { WhatsAppGreenApiChannel } from './whatsapp-greenapi.channel';
import { NotificationsController } from './notifications.controller';
import { NOTIFICATION_CHANNELS } from './notifications.constants';

@Module({
  controllers: [NotificationsController],
  providers: [
    ConsoleNotificationChannel,
    InternalNotificationChannel,
    WhatsAppNotificationChannel,
    WhatsAppGreenApiChannel,
    {
      provide: NOTIFICATION_CHANNELS,
      useFactory: (
        consoleChannel: ConsoleNotificationChannel,
        internalChannel: InternalNotificationChannel,
        whatsappChannel: WhatsAppNotificationChannel,
        whatsappGreenApiChannel: WhatsAppGreenApiChannel,
      ) => [consoleChannel, internalChannel, whatsappChannel, whatsappGreenApiChannel],
      inject: [
        ConsoleNotificationChannel,
        InternalNotificationChannel,
        WhatsAppNotificationChannel,
        WhatsAppGreenApiChannel,
      ],
    },
    NotificationsService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
