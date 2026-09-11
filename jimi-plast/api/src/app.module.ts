import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { I18nModule } from './common/i18n/i18n.module';
import { CommonServicesModule } from './common/services/common-services.module';
import { SharedJwtModule } from './common/jwt/shared-jwt.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { RegistrationRequestsModule } from './registration-requests/registration-requests.module';
import { CategoriesModule } from './categories/categories.module';
import { CatalogSettingsModule } from './catalog-settings/catalog-settings.module';
import { ProductsModule } from './products/products.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 100 }] }),
    PrismaModule,
    I18nModule,
    CommonServicesModule,
    SharedJwtModule,
    NotificationsModule,
    AuthModule,
    UsersModule,
    RolesModule,
    RegistrationRequestsModule,
    CategoriesModule,
    CatalogSettingsModule,
    ProductsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
