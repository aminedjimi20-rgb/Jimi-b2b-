import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { PricingModule } from '../pricing/pricing.module';
import { OptionalAuthGuard } from '../common/guards/optional-auth.guard';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PricingModule, NotificationsModule], // JwtModule est global via SharedJwtModule
  controllers: [ProductsController],
  providers: [ProductsService, OptionalAuthGuard],
  exports: [ProductsService],
})
export class ProductsModule {}
