import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { AdminCreateOrderDto } from './dto/admin-create-order.dto';
import { AdminEditOrderDto } from './dto/admin-edit-order.dto';
import { EmployeeCreateOrderDto } from './dto/employee-create-order.dto';
import { AssignEmployeeDto } from './dto/assign-employee.dto';
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

  // ── EMPLOYEE ─────────────────────────────────────────────────────────
  // Never sees another employee's/client's other orders, never sets
  // remisePourcentage, and can only move an order into PREPARATION/PRETE.

  @Roles('EMPLOYEE')
  @Post('staff')
  createForEmployee(@CurrentUser() user: AuthenticatedUser, @Body() dto: EmployeeCreateOrderDto) {
    return this.ordersService.createForEmployee(user.employeeId!, dto);
  }

  @Roles('EMPLOYEE')
  @Get('staff/mine')
  findMineEmployee(@CurrentUser() user: AuthenticatedUser) {
    return this.ordersService.findAllForEmployee(user.employeeId!);
  }

  @Roles('EMPLOYEE')
  @Get('staff/mine/:id')
  findMineOneEmployee(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ordersService.findOneForEmployee(user.employeeId!, id);
  }

  @Roles('EMPLOYEE')
  @Patch('staff/:id/status')
  updateStatusEmployee(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.ordersService.updateStatusForEmployee(user.employeeId!, id, dto.status);
  }

  // ── ADMIN ────────────────────────────────────────────────────────────

  // Counter sale: Admin places an order directly for a walk-in client.
  @Roles('ADMIN')
  @Post('admin')
  createForAdmin(@Body() dto: AdminCreateOrderDto) {
    const { clientId, remisePourcentage, fraisLivraison, transporteurId, destination, ...orderDto } = dto;
    return this.ordersService.createForClient(clientId, orderDto, {
      remisePourcentage,
      fraisLivraison,
      transporteurId,
      destination,
    });
  }

  @Roles('ADMIN')
  @Get()
  findAll(
    @Query('status') status?: OrderStatus,
    @Query('transporteurId') transporteurId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.ordersService.findAllForAdmin(status, { transporteurId, from, to });
  }

  // Must come before ':id' so "trash"/"delivery-history" aren't swallowed as an id param.
  @Roles('ADMIN')
  @Get('trash')
  findTrash() {
    return this.ordersService.findTrash();
  }

  @Roles('ADMIN')
  @Get('delivery-history')
  findDeliveryHistory(@Query('transporteurId') transporteurId?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.ordersService.findDeliveryHistory({ transporteurId, from, to });
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

  @Roles('ADMIN')
  @Patch(':id/assign')
  assignEmployee(@Param('id') id: string, @Body() dto: AssignEmployeeDto) {
    return this.ordersService.assignEmployee(id, dto.employeeId ?? null);
  }

  // Corrects an already-placed order — items/amounts, at any status except
  // ANNULEE — see OrdersService.adminUpdateItems for the stock/credit math.
  @Roles('ADMIN')
  @Patch(':id/admin-edit')
  adminEdit(@Param('id') id: string, @Body() dto: AdminEditOrderDto) {
    return this.ordersService.adminUpdateItems(id, dto);
  }

  @Roles('ADMIN')
  @Get(':id/history')
  getHistory(@Param('id') id: string) {
    return this.ordersService.getHistory(id);
  }

  // Un-cancels an order (ANNULEE -> EN_ATTENTE) — a mis-click on "Annuler" shouldn't be a dead end.
  @Roles('ADMIN')
  @Post(':id/reactivate')
  reactivate(@Param('id') id: string) {
    return this.ordersService.reactivate(id);
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
