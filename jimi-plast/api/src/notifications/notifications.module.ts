import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { ConsoleNotificationChannel } from './console-notification.channel';
import { InternalNotificationChannel } from './internal-notification.channel';
import { NotificationsController } from './notifications.controller';
import { NOTIFICATION_CHANNELS } from './notifications.constants';

@Module({
  controllers: [NotificationsController],
  providers: [
    ConsoleNotificationChannel,
    InternalNotificationChannel,
    {
      provide: NOTIFICATION_CHANNELS,
      useFactory: (consoleChannel: ConsoleNotificationChannel, internalChannel: InternalNotificationChannel) => [
        consoleChannel,
        internalChannel,
      ],
      inject: [ConsoleNotificationChannel, InternalNotificationChannel],
    },
    NotificationsService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
