import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { DeliveriesService } from './deliveries.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { CancelDeliveryDto, CreateStandaloneDeliveryDto, UpsertDeliveryDto } from './dto/upsert-delivery.dto';

@Controller('deliveries')
@RequirePermissions('transport.manage')
export class DeliveriesController {
  constructor(private readonly deliveriesService: DeliveriesService) {}

  @Get()
  list(@Query('status') _status?: string) {
    return this.deliveriesService.list();
  }

  @Post()
  createStandalone(@Body() dto: CreateStandaloneDeliveryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.deliveriesService.createStandalone(dto, user.id);
  }

  @Get('voucher/:voucherId')
  getByVoucher(@Param('voucherId') voucherId: string) {
    return this.deliveriesService.getByVoucher('sales', voucherId);
  }

  @Put('voucher/:voucherId')
  upsert(@Param('voucherId') voucherId: string, @Body() dto: UpsertDeliveryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.deliveriesService.upsertForVoucher('sales', voucherId, dto, user.id);
  }

  @Get('purchase-voucher/:voucherId')
  getByPurchaseVoucher(@Param('voucherId') voucherId: string) {
    return this.deliveriesService.getByVoucher('purchase', voucherId);
  }

  @Put('purchase-voucher/:voucherId')
  upsertForPurchase(@Param('voucherId') voucherId: string, @Body() dto: UpsertDeliveryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.deliveriesService.upsertForVoucher('purchase', voucherId, dto, user.id);
  }

  @Put(':id')
  updateStandalone(@Param('id') id: string, @Body() dto: UpsertDeliveryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.deliveriesService.updateStandalone(id, dto, user.id);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @Body() dto: CancelDeliveryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.deliveriesService.cancel(id, dto, user.id);
  }
}
