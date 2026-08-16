import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { AdminCreateOrderDto } from './dto/admin-create-order.dto';
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

  // Counter sale: Admin places an order directly for a walk-in client.
  @Roles('ADMIN')
  @Post('admin')
  createForAdmin(@Body() dto: AdminCreateOrderDto) {
    const { clientId, remisePourcentage, fraisLivraison, ...orderDto } = dto;
    return this.ordersService.createForClient(clientId, orderDto, { remisePourcentage, fraisLivraison });
  }

  @Roles('ADMIN')
  @Get()
  findAll(@Query('status') status?: OrderStatus) {
    return this.ordersService.findAllForAdmin(status);
  }

  // Must come before ':id' so "trash" isn't swallowed as an id param.
  @Roles('ADMIN')
  @Get('trash')
  findTrash() {
    return this.ordersService.findTrash();
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

  // Moves to the corbeille (reversible) — see DELETE :id/permanent to erase for good.
  @Roles('ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ordersService.remove(id);
  }

  @Roles('ADMIN')
  @Post(':id/restore')
  restore(@Param('id') id: string) {
    return this.ordersService.restore(id);
  }

  @Roles('ADMIN')
  @Delete(':id/permanent')
  permanentDelete(@Param('id') id: string) {
    return this.ordersService.permanentDelete(id);
  }
}
