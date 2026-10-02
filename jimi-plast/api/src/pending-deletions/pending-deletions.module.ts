import { Module } from '@nestjs/common';
import { PendingDeletionsService } from './pending-deletions.service';
import { PendingDeletionsController } from './pending-deletions.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [PendingDeletionsController],
  providers: [PendingDeletionsService],
  exports: [PendingDeletionsService],
})
export class PendingDeletionsModule {}
