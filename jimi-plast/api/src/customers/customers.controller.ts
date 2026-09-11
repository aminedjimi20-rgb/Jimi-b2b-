import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { AddPaymentDto, AddAdjustmentDto } from './dto/add-ledger-entry.dto';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @RequirePermissions('customers.manage')
  list() {
    return this.customersService.list();
  }

  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.customersService.getByUserId(user.id);
  }

  @Get(':id')
  @RequirePermissions('customers.manage')
  getById(@Param('id') id: string) {
    return this.customersService.getById(id);
  }

  @Post()
  @RequirePermissions('customers.manage')
  create(@Body() dto: CreateCustomerDto, @CurrentUser() user: AuthenticatedUser) {
    return this.customersService.create(dto, user.id);
  }

  @Put(':id')
  @RequirePermissions('customers.manage')
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto, @CurrentUser() user: AuthenticatedUser) {
    return this.customersService.update(id, dto, user.id);
  }

  @Post(':id/payments')
  @RequirePermissions('credits.manage')
  addPayment(@Param('id') id: string, @Body() dto: AddPaymentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.customersService.addPayment(id, dto, user.id);
  }

  @Post(':id/adjustments')
  @RequirePermissions('credits.manage')
  addAdjustment(@Param('id') id: string, @Body() dto: AddAdjustmentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.customersService.addAdjustment(id, dto, user.id);
  }
}
