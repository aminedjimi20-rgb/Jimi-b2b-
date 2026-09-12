import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationChannel, NotificationEvent } from './notification-channel.interface';

/**
 * Alternative à WhatsAppNotificationChannel (CallMeBot) : envoie via
 * Green API (green-api.com), une instance WhatsApp liée par QR code
 * (comme WhatsApp Web) plutôt qu'un bot tiers auquel il faut écrire.
 * Plus fiable/immédiat que CallMeBot mais demande une inscription
 * (email) — voir jimi-plast/README.md. Silencieux si non configuré.
 */
@Injectable()
export class WhatsAppGreenApiChannel implements NotificationChannel {
  readonly name = 'whatsapp-greenapi';
  private readonly logger = new Logger('Notification');
  private readonly instanceId?: string;
  private readonly apiToken?: string;
  private readonly targetPhone?: string;
  private readonly eventTypes: Set<string>;

  constructor(config: ConfigService) {
    this.instanceId = config.get<string>('GREENAPI_INSTANCE_ID');
    this.apiToken = config.get<string>('GREENAPI_API_TOKEN');
    this.targetPhone = config.get<string>('GREENAPI_TARGET_PHONE');
    const configuredTypes = config.get<string>('WHATSAPP_NOTIFY_EVENT_TYPES');
    this.eventTypes = new Set(
      (configuredTypes ?? 'registration.new').split(',').map((t) => t.trim()).filter(Boolean),
    );
  }

  async send(event: NotificationEvent): Promise<void> {
    if (!this.instanceId || !this.apiToken || !this.targetPhone) return;
    if (!this.eventTypes.has(event.type)) return;

    const url = `https://api.green-api.com/waInstance${this.instanceId}/sendMessage/${this.apiToken}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId: `${this.targetPhone}@c.us`,
        message: `${event.title}\n${event.body}`,
      }),
    });
    if (!res.ok) {
      this.logger.error(`Green API a répondu ${res.status} pour l'événement "${event.type}"`);
    }
  }
}
