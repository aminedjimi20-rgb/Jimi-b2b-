import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { SequencesModule } from './common/sequences/sequences.module';
import { AuthModule } from './auth/auth.module';
import { ClientsModule } from './clients/clients.module';
import { CategoriesModule } from './categories/categories.module';
import { FabricantsModule } from './fabricants/fabricants.module';
import { ProductsModule } from './products/products.module';
import { PromotionsModule } from './promotions/promotions.module';
import { FavoritesModule } from './favorites/favorites.module';
import { UploadsModule } from './uploads/uploads.module';
import { OrdersModule } from './orders/orders.module';
import { StockModule } from './stock/stock.module';
import { StockReceiptsModule } from './stock-receipts/stock-receipts.module';
import { PaymentsModule } from './payments/payments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { StatsModule } from './stats/stats.module';
import { ExportModule } from './export/export.module';
import { BackupModule } from './backup/backup.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    SequencesModule,
    NotificationsModule,
    AuthModule,
    ClientsModule,
    CategoriesModule,
    FabricantsModule,
    ProductsModule,
    PromotionsModule,
    FavoritesModule,
    UploadsModule,
    OrdersModule,
    StockModule,
    StockReceiptsModule,
    PaymentsModule,
    StatsModule,
    ExportModule,
    BackupModule,
  ],
  providers: [
    // Order matters: rate limit -> auth -> role check, applied to every route by default.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
