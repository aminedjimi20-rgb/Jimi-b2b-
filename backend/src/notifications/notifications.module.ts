import { Global, Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PushService } from './push.service';

// Global: OrdersModule/StockModule inject NotificationsService without each declaring an import.
@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, PushService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
