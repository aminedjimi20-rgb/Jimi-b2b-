import { Module } from '@nestjs/common';
import { VouchersService } from './vouchers.service';
import { VouchersController } from './vouchers.controller';
import { VoucherPdfService } from './voucher-pdf.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { PendingDeletionsModule } from '../pending-deletions/pending-deletions.module';
import { BrandingModule } from '../branding/branding.module';

@Module({
  imports: [NotificationsModule, PendingDeletionsModule, BrandingModule],
  controllers: [VouchersController],
  providers: [VouchersService, VoucherPdfService, InvoicePdfService],
  exports: [VouchersService],
})
export class VouchersModule {}
