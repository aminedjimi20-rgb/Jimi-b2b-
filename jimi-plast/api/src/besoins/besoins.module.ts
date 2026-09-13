import { Module } from '@nestjs/common';
import { BesoinsService } from './besoins.service';
import { BesoinsController } from './besoins.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [BesoinsController],
  providers: [BesoinsService],
})
export class BesoinsModule {}
