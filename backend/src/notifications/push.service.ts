import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cert, initializeApp, type App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { readFileSync } from 'fs';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Sends push notifications via Firebase Cloud Messaging. Entirely
 * optional: if FIREBASE_SERVICE_ACCOUNT_PATH isn't set, this becomes a
 * no-op (logs once) instead of crashing the API — push is a nice-to-have
 * transport on top of the in-app Notification rows created by
 * NotificationsService, which always work regardless of FCM setup.
 */
@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private app: App | null = null;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  onModuleInit() {
    const credentialsPath = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_PATH');
    if (!credentialsPath) {
      this.logger.warn(
        'FIREBASE_SERVICE_ACCOUNT_PATH non défini — notifications push FCM désactivées (les notifications in-app restent actives).',
      );
      return;
    }
    try {
      const serviceAccount = JSON.parse(readFileSync(credentialsPath, 'utf-8'));
      this.app = initializeApp({ credential: cert(serviceAccount) });
      this.logger.log('Firebase Admin initialisé — notifications push activées.');
    } catch (error) {
      this.logger.error(`Échec d'initialisation de Firebase Admin: ${(error as Error).message}`);
    }
  }

  async registerToken(userId: string, token: string, platform: 'ANDROID' | 'IOS' | 'WEB') {
    await this.prisma.deviceToken.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, platform },
    });
  }

  async unregisterToken(token: string) {
    await this.prisma.deviceToken.deleteMany({ where: { token } });
  }

  async sendToUser(userId: string, title: string, body: string, data?: Record<string, string>) {
    if (!this.app) return;

    const tokens = await this.prisma.deviceToken.findMany({ where: { userId }, select: { token: true } });
    if (tokens.length === 0) return;

    try {
      const response = await getMessaging(this.app).sendEachForMulticast({
        tokens: tokens.map((t) => t.token),
        notification: { title, body },
        data,
      });

      const staleTokens = response.responses
        .map((r, i) => (r.success ? null : tokens[i].token))
        .filter((t): t is string => t !== null);
      if (staleTokens.length > 0) {
        await this.prisma.deviceToken.deleteMany({ where: { token: { in: staleTokens } } });
      }
    } catch (error) {
      this.logger.error(`Échec d'envoi push pour l'utilisateur ${userId}: ${(error as Error).message}`);
    }
  }

  async sendToUsers(userIds: string[], title: string, body: string, data?: Record<string, string>) {
    await Promise.all(userIds.map((id) => this.sendToUser(id, title, body, data)));
  }
}
