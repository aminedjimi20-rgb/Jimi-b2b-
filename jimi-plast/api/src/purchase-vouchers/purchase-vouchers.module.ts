import { Module } from '@nestjs/common';
import { PurchaseVouchersService } from './purchase-vouchers.service';
import { PurchaseVouchersController } from './purchase-vouchers.controller';
import { PurchaseVoucherPdfService } from './purchase-voucher-pdf.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { PendingDeletionsModule } from '../pending-deletions/pending-deletions.module';

@Module({
  imports: [NotificationsModule, PendingDeletionsModule],
  controllers: [PurchaseVouchersController],
  providers: [PurchaseVouchersService, PurchaseVoucherPdfService],
  exports: [PurchaseVouchersService],
})
export class PurchaseVouchersModule {}
