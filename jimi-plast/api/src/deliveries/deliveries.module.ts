import { Module } from '@nestjs/common';
import { DeliveriesService } from './deliveries.service';
import { DeliveriesController } from './deliveries.controller';
import { VouchersModule } from '../vouchers/vouchers.module';
import { PurchaseVouchersModule } from '../purchase-vouchers/purchase-vouchers.module';

@Module({
  imports: [VouchersModule, PurchaseVouchersModule],
  controllers: [DeliveriesController],
  providers: [DeliveriesService],
})
export class DeliveriesModule {}
