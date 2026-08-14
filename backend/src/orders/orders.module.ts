import { Module } from '@nestjs/common';
import { PricingModule } from '../pricing/pricing.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [PricingModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
