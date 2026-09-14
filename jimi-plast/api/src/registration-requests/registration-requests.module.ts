import { Module } from '@nestjs/common';
import { RegistrationRequestsService } from './registration-requests.service';
import { RegistrationRequestsController } from './registration-requests.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [RegistrationRequestsController],
  providers: [RegistrationRequestsService],
})
export class RegistrationRequestsModule {}
