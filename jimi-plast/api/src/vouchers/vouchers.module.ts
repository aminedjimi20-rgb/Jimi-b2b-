import { Module } from '@nestjs/common';
import { VouchersService } from './vouchers.service';
import { VouchersController } from './vouchers.controller';
import { VoucherPdfService } from './voucher-pdf.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { PendingDeletionsModule } from '../pending-deletions/pending-deletions.module';

@Module({
  imports: [NotificationsModule, PendingDeletionsModule],
  controllers: [VouchersController],
  providers: [VouchersService, VoucherPdfService],
  exports: [VouchersService],
})
export class VouchersModule {}
