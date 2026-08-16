import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { CreateProductRequestDto } from './dto/create-product-request.dto';
import { UpdateProductRequestStatusDto } from './dto/update-product-request-status.dto';
import { ProductRequestsService } from './product-requests.service';

@Controller('product-requests')
export class ProductRequestsController {
  constructor(private productRequestsService: ProductRequestsService) {}

  // ── CLIENT ───────────────────────────────────────────────────────────

  @Roles('CLIENT')
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateProductRequestDto) {
    return this.productRequestsService.create(user.clientId!, dto);
  }

  @Roles('CLIENT')
  @Get('mine')
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.productRequestsService.findAllForClient(user.clientId!);
  }

  // ── EMPLOYEE ─────────────────────────────────────────────────────────

  @Roles('EMPLOYEE')
  @Post('staff')
  createForEmployee(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateProductRequestDto) {
    return this.productRequestsService.createForEmployee(user.employeeId!, dto);
  }

  @Roles('EMPLOYEE')
  @Get('staff/mine')
  findMineEmployee(@CurrentUser() user: AuthenticatedUser) {
    return this.productRequestsService.findAllForEmployee(user.employeeId!);
  }

  // ── ADMIN ────────────────────────────────────────────────────────────

  @Roles('ADMIN')
  @Get()
  findAll(@Query('status') status?: 'EN_ATTENTE' | 'TRAITEE' | 'REJETEE') {
    return this.productRequestsService.findAllForAdmin(status);
  }

  // Must come before ':id/...' so "trash" isn't swallowed as an id param.
  @Roles('ADMIN')
  @Get('trash')
  findTrash() {
    return this.productRequestsService.findTrash();
  }

  @Roles('ADMIN')
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateProductRequestStatusDto) {
    return this.productRequestsService.updateStatus(id, dto);
  }

  // Moves to the corbeille (reversible) — see DELETE :id/permanent to erase for good.
  @Roles('ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productRequestsService.remove(id);
  }

  @Roles('ADMIN')
  @Post(':id/restore')
  restore(@Param('id') id: string) {
    return this.productRequestsService.restore(id);
  }

  @Roles('ADMIN')
  @Delete(':id/permanent')
  permanentDelete(@Param('id') id: string) {
    return this.productRequestsService.permanentDelete(id);
  }
}
