import { Module } from '@nestjs/common';
import { ProductRequestsService } from './product-requests.service';
import { ProductRequestsController } from './product-requests.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [ProductRequestsController],
  providers: [ProductRequestsService],
})
export class ProductRequestsModule {}
