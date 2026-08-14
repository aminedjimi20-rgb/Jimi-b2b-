import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Roles('ADMIN')
  @Post()
  create(@Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(dto);
  }

  @Roles('ADMIN')
  @Get()
  findAll(@Query('clientId') clientId?: string) {
    return this.paymentsService.findAllForAdmin(clientId);
  }

  @Roles('CLIENT')
  @Get('mine')
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.findAllForClient(user.clientId!);
  }
}
