import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { ConsoleNotificationChannel } from './console-notification.channel';
import { NOTIFICATION_CHANNELS } from './notifications.constants';

@Module({
  providers: [
    ConsoleNotificationChannel,
    {
      provide: NOTIFICATION_CHANNELS,
      useFactory: (consoleChannel: ConsoleNotificationChannel) => [consoleChannel],
      inject: [ConsoleNotificationChannel],
    },
    NotificationsService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
