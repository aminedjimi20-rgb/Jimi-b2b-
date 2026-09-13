import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { RolesService } from './roles.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateRoleDto } from './dto/create-role.dto';
import { SetRolePermissionsDto } from './dto/set-role-permissions.dto';

@Controller()
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('permissions')
  @RequirePermissions('users.manage')
  listPermissions() {
    return this.rolesService.listPermissions();
  }

  @Get('roles')
  @RequirePermissions('users.manage')
  listRoles() {
    return this.rolesService.listRoles();
  }

  @Post('roles')
  @RequirePermissions('users.manage')
  createRole(@Body() dto: CreateRoleDto) {
    return this.rolesService.createRole(dto);
  }

  @Put('roles/:id/permissions')
  @RequirePermissions('users.manage')
  setRolePermissions(
    @Param('id') id: string,
    @Body() dto: SetRolePermissionsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rolesService.setRolePermissions(id, dto.permissionKeys, user.id);
  }
}
