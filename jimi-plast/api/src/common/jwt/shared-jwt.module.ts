import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

/**
 * JwtService configuré une seule fois et disponible partout (OptionalAuthGuard
 * en a besoin en dehors du module Auth, par exemple pour le catalogue public).
 */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  exports: [JwtModule],
})
export class SharedJwtModule {}
