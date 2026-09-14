import { Module } from '@nestjs/common';
import { VouchersService } from './vouchers.service';
import { VouchersController } from './vouchers.controller';
import { VoucherPdfService } from './voucher-pdf.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [VouchersController],
  providers: [VouchersService, VoucherPdfService],
})
export class VouchersModule {}
