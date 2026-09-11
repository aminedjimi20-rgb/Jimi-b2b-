import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { PricingModule } from '../pricing/pricing.module';
import { OptionalAuthGuard } from '../common/guards/optional-auth.guard';

@Module({
  imports: [PricingModule], // JwtModule est global via SharedJwtModule
  controllers: [ProductsController],
  providers: [ProductsService, OptionalAuthGuard],
  exports: [ProductsService],
})
export class ProductsModule {}
