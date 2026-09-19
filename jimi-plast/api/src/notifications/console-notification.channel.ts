import { Injectable, Logger } from '@nestjs/common';
import { NotificationChannel, NotificationEvent } from './notification-channel.interface';

/**
 * Canal par défaut tant qu'aucune intégration réelle (WhatsApp, email...) n'est branchée.
 * Remplacé/complété en Phase 8 par un WhatsAppNotificationChannel implémentant la même interface.
 */
@Injectable()
export class ConsoleNotificationChannel implements NotificationChannel {
  readonly name = 'console';
  private readonly logger = new Logger('Notification');

  async send(event: NotificationEvent): Promise<void> {
    this.logger.log(`[${event.type}] ${event.title} — ${event.body}`);
  }
}
