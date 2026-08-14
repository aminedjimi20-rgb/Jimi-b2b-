import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@Controller('orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  // ── CLIENT ───────────────────────────────────────────────────────────

  @Roles('CLIENT')
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateOrderDto) {
    return this.ordersService.createForClient(user.clientId!, dto);
  }

  @Roles('CLIENT')
  @Get('mine')
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.ordersService.findAllForClient(user.clientId!);
  }

  @Roles('CLIENT')
  @Get('mine/:id')
  findMineOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ordersService.findOneForClient(user.clientId!, id);
  }

  @Roles('CLIENT')
  @Post(':id/reorder')
  reorder(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ordersService.reorder(user.clientId!, id);
  }

  // ── ADMIN ────────────────────────────────────────────────────────────

  @Roles('ADMIN')
  @Get()
  findAll(@Query('status') status?: OrderStatus) {
    return this.ordersService.findAllForAdmin(status);
  }

  @Roles('ADMIN')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ordersService.findOneForAdmin(id);
  }

  @Roles('ADMIN')
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.ordersService.updateStatus(id, dto.status);
  }
}
