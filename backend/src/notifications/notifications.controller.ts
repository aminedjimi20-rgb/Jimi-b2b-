import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { BroadcastNotificationDto } from './dto/broadcast-notification.dto';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.listForUser(user.userId);
  }

  // Must come before ':id/...' so "trash" isn't swallowed as an id param.
  @Get('trash')
  findTrash(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.findTrash(user.userId);
  }

  /** ADMIN-only: push a SYSTEME notification to a chosen audience or a single client/employee. */
  @Roles('ADMIN')
  @Post('broadcast')
  broadcast(@Body() dto: BroadcastNotificationDto) {
    return this.notificationsService.broadcast(dto);
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

  // Moves to the corbeille (reversible) — see DELETE :id/permanent to erase for good.
  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.notificationsService.remove(user.userId, id);
  }

  @Post(':id/restore')
  restore(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.notificationsService.restore(user.userId, id);
  }

  @Delete(':id/permanent')
  permanentDelete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.notificationsService.permanentDelete(user.userId, id);
  }
}
