import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { DepotsService } from './depots.service';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UpsertDepotDto } from './dto/upsert-depot.dto';

@Controller('depots')
export class DepotsController {
  constructor(private readonly depotsService: DepotsService) {}

  @Public()
  @Get()
  list() {
    return this.depotsService.list();
  }

  @Post()
  @RequirePermissions('catalog.manage')
  create(@Body() dto: UpsertDepotDto, @CurrentUser() user: AuthenticatedUser) {
    return this.depotsService.create(dto, user.id);
  }

  @Put(':id')
  @RequirePermissions('catalog.manage')
  update(@Param('id') id: string, @Body() dto: UpsertDepotDto, @CurrentUser() user: AuthenticatedUser) {
    return this.depotsService.update(id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermissions('catalog.manage')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.depotsService.remove(id, user.id);
  }
}
