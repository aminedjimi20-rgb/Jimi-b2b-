import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { NotificationsService } from './notifications.service';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.listForUser(user.userId);
  }

  @Patch(':id/read')
  markRead(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.notificationsService.markRead(user.userId, id);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllRead(user.userId);
  }

  /** Called by the mobile app once it has an FCM token, so push notifications can reach this device. */
  @Post('device-token')
  registerDeviceToken(@CurrentUser() user: AuthenticatedUser, @Body() dto: RegisterDeviceTokenDto) {
    return this.notificationsService.registerDeviceToken(user.userId, dto.token, dto.platform);
  }

  @Delete('device-token/:token')
  unregisterDeviceToken(@Param('token') token: string) {
    return this.notificationsService.unregisterDeviceToken(token);
  }
}
