import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { DriversService } from './drivers.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UpsertDriverDto } from './dto/upsert-driver.dto';

@Controller('drivers')
@RequirePermissions('transport.manage')
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Get()
  list(@Query('includeInactive') includeInactive?: string) {
    return this.driversService.list(includeInactive === 'true');
  }

  @Post()
  create(@Body() dto: UpsertDriverDto, @CurrentUser() user: AuthenticatedUser) {
    return this.driversService.create(dto, user.id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpsertDriverDto, @CurrentUser() user: AuthenticatedUser) {
    return this.driversService.update(id, dto, user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.driversService.remove(id, user.id);
  }

  @Post(':id/restore')
  restore(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.driversService.restore(id, user.id);
  }
}
