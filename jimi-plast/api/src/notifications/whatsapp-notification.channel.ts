import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationChannel, NotificationEvent } from './notification-channel.interface';

const CALLMEBOT_ENDPOINT = 'https://api.callmebot.com/whatsapp.php';

/**
 * Envoie un message WhatsApp réel via l'API gratuite CallMeBot.
 * Nécessite que le numéro destinataire ait activé le bot une fois
 * (message "I allow callmebot to send me messages" au numéro CallMeBot)
 * pour obtenir WHATSAPP_CALLMEBOT_APIKEY — voir jimi-plast/README.md.
 * Silencieux (no-op) si la config est absente, pour ne jamais bloquer
 * les autres canaux.
 */
@Injectable()
export class WhatsAppNotificationChannel implements NotificationChannel {
  readonly name = 'whatsapp';
  private readonly logger = new Logger('Notification');
  private readonly phone?: string;
  private readonly apiKey?: string;
  private readonly eventTypes: Set<string>;

  constructor(config: ConfigService) {
    this.phone = config.get<string>('WHATSAPP_CALLMEBOT_PHONE');
    this.apiKey = config.get<string>('WHATSAPP_CALLMEBOT_APIKEY');
    const configuredTypes = config.get<string>('WHATSAPP_NOTIFY_EVENT_TYPES');
    this.eventTypes = new Set(
      (configuredTypes ?? 'registration.new').split(',').map((t) => t.trim()).filter(Boolean),
    );
  }

  async send(event: NotificationEvent): Promise<void> {
    if (!this.phone || !this.apiKey) return;
    if (!this.eventTypes.has(event.type)) return;

    const text = `${event.title}\n${event.body}`;
    const url = `${CALLMEBOT_ENDPOINT}?phone=${encodeURIComponent(this.phone)}&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(this.apiKey)}`;

    const res = await fetch(url);
    if (!res.ok) {
      this.logger.error(`CallMeBot a répondu ${res.status} pour l'événement "${event.type}"`);
    }
  }
}
