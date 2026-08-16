import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Thin abstraction over "send an email" — deliberately provider-agnostic.
 * Until MAIL_PROVIDER is set to a real provider, every email is written to
 * the server log instead of actually sent, so the verification/reset flows
 * are fully usable in development (and by an Admin reading the Railway logs)
 * without requiring an email account up front. Swapping in Resend/SMTP later
 * is a matter of adding a branch here — nothing above this service changes.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  constructor(private config: ConfigService) {}

  async send(to: string, subject: string, textBody: string): Promise<void> {
    const provider = this.config.get<string>('MAIL_PROVIDER') ?? 'log';

    if (provider === 'log') {
      this.logger.log(`[MAIL] To: ${to} | Subject: ${subject}\n${textBody}\n`);
      return;
    }

    this.logger.warn(`MAIL_PROVIDER="${provider}" is not implemented yet — logging instead.`);
    this.logger.log(`[MAIL] To: ${to} | Subject: ${subject}\n${textBody}\n`);
  }
}
