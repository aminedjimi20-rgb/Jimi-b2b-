import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { PurchaseVouchersService } from './purchase-vouchers.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UpsertPurchaseVoucherDto } from './dto/upsert-purchase-voucher.dto';
import { CancelVoucherDto } from '../vouchers/dto/cancel-voucher.dto';

@Controller('purchase-vouchers')
@RequirePermissions('suppliers.view')
export class PurchaseVouchersController {
  constructor(private readonly service: PurchaseVouchersService) {}

  @Get()
  list(@Query('status') status?: string, @Query('manufacturerId') manufacturerId?: string) {
    return this.service.list({ status, manufacturerId });
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Post('draft')
  createDraft(@Body('manufacturerId') manufacturerId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createDraft(manufacturerId, user.id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpsertPurchaseVoucherDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.update(id, dto, user.id);
  }

  @Post(':id/confirm')
  @RequirePermissions('stock.manage')
  confirm(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.confirm(id, user.id);
  }

  @Post(':id/cancel')
  @RequirePermissions('stock.manage')
  cancel(@Param('id') id: string, @Body() dto: CancelVoucherDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.cancel(id, dto, user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.remove(id, user.id);
  }
}
