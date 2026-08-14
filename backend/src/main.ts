import { NestExpressApplication } from '@nestjs/platform-express';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  app.use(
    helmet({
      // Product photos are served from /uploads and consumed cross-origin by the
      // mobile app's native HTTP client (not a browser) and by <img> tags in a
      // future Flutter Web build — the default CORP would silently block that.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  const allowedOrigins = config.get<string>('ALLOWED_ORIGINS');
  if (allowedOrigins) {
    app.enableCors({ origin: allowedOrigins.split(',').map((o) => o.trim()) });
  } else {
    // No allowlist configured (typical for a mobile-only backend, whose native
    // HTTP client never sends an Origin header and so is never subject to CORS
    // in the first place) — permissive default so a future Web/admin-console
    // client isn't blocked by surprise. Set ALLOWED_ORIGINS in production once
    // a browser-based client exists.
    app.enableCors();
    logger.warn('ALLOWED_ORIGINS non défini — CORS ouvert à toutes les origines.');
  }

  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strips any field not declared in the DTO — no unexpected fields reach services
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = config.get<string>('PORT') ?? 3000;
  await app.listen(port);
  logger.log(`JIMI B2B API running on http://localhost:${port}/api`);
}

bootstrap();
