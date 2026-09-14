import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import { DeliveriesService } from './deliveries.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UpsertDeliveryDto } from './dto/upsert-delivery.dto';

@Controller('deliveries')
@RequirePermissions('transport.manage')
export class DeliveriesController {
  constructor(private readonly deliveriesService: DeliveriesService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.deliveriesService.list(status);
  }

  @Get('voucher/:voucherId')
  getByVoucher(@Param('voucherId') voucherId: string) {
    return this.deliveriesService.getByVoucher(voucherId);
  }

  @Put('voucher/:voucherId')
  upsert(@Param('voucherId') voucherId: string, @Body() dto: UpsertDeliveryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.deliveriesService.upsertForVoucher(voucherId, dto, user.id);
  }
}
