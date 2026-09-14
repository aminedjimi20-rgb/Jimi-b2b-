import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ManufacturersService } from './manufacturers.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UpsertManufacturerDto } from './dto/upsert-manufacturer.dto';
import { AddPaymentDto, AddAdjustmentDto } from '../customers/dto/add-ledger-entry.dto';

@Controller('manufacturers')
@RequirePermissions('suppliers.view')
export class ManufacturersController {
  constructor(private readonly manufacturersService: ManufacturersService) {}

  @Get()
  list() {
    return this.manufacturersService.list();
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.manufacturersService.getById(id);
  }

  @Post()
  create(@Body() dto: UpsertManufacturerDto, @CurrentUser() user: AuthenticatedUser) {
    return this.manufacturersService.create(dto, user.id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpsertManufacturerDto, @CurrentUser() user: AuthenticatedUser) {
    return this.manufacturersService.update(id, dto, user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Query('reason') reason: string, @CurrentUser() user: AuthenticatedUser) {
    return this.manufacturersService.remove(id, user.id, reason);
  }

  @Post(':id/payments')
  addPayment(@Param('id') id: string, @Body() dto: AddPaymentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.manufacturersService.addPayment(id, dto, user.id);
  }

  @Post(':id/adjustments')
  addAdjustment(@Param('id') id: string, @Body() dto: AddAdjustmentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.manufacturersService.addAdjustment(id, dto, user.id);
  }
}
