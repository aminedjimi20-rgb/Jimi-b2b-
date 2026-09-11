import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { UsersService } from './users.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { SetUserStatusDto } from './dto/set-user-status.dto';
import { SetUserPermissionsDto } from './dto/set-user-permissions.dto';

@Controller('users')
@RequirePermissions('users.manage')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  list() {
    return this.usersService.list();
  }

  @Put(':id/status')
  setStatus(
    @Param('id') id: string,
    @Body() dto: SetUserStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.setStatus(id, dto, user.id);
  }

  @Get(':id/permissions')
  getPermissions(@Param('id') id: string) {
    return this.usersService.getPermissions(id);
  }

  @Put(':id/permissions')
  setPermissions(
    @Param('id') id: string,
    @Body() dto: SetUserPermissionsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.setPermissions(id, dto, user.id);
  }
}
