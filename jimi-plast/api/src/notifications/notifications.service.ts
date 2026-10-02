import { Inject, Injectable, Logger } from '@nestjs/common';
import { NotificationChannel, NotificationEvent } from './notification-channel.interface';
import { NOTIFICATION_CHANNELS } from './notifications.constants';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(NOTIFICATION_CHANNELS) private readonly channels: NotificationChannel[],
  ) {}

  async notify(event: NotificationEvent): Promise<void> {
    await Promise.all(
      this.channels.map((channel) =>
        channel.send(event).catch((err) =>
          this.logger.error(`Canal "${channel.name}" en échec pour "${event.type}": ${err.message}`),
        ),
      ),
    );
  }
}
