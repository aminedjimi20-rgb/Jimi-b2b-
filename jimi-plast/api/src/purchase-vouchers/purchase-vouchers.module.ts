import { Module } from '@nestjs/common';
import { PurchaseVouchersService } from './purchase-vouchers.service';
import { PurchaseVouchersController } from './purchase-vouchers.controller';

@Module({
  controllers: [PurchaseVouchersController],
  providers: [PurchaseVouchersService],
})
export class PurchaseVouchersModule {}
