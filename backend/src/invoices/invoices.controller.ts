import { Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { InvoicesService } from './invoices.service';

@Controller('invoices')
export class InvoicesController {
  constructor(private invoicesService: InvoicesService) {}

  // ── ADMIN ────────────────────────────────────────────────────────────

  @Roles('ADMIN')
  @Post('from-order/:orderId')
  generateFromOrder(@Param('orderId') orderId: string) {
    return this.invoicesService.generateFromOrder(orderId);
  }

  @Roles('ADMIN')
  @Get()
  findAllAdmin() {
    return this.invoicesService.findAllForAdmin();
  }

  // Must come before ':id' so "trash" isn't swallowed as an id param.
  @Roles('ADMIN')
  @Get('trash')
  findTrash() {
    return this.invoicesService.findTrash();
  }

  @Roles('ADMIN')
  @Get(':id')
  findOneAdmin(@Param('id') id: string) {
    return this.invoicesService.findOneForAdmin(id);
  }

  // Moves to the corbeille (reversible) — see DELETE :id/permanent to erase for good.
  @Roles('ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.invoicesService.remove(id);
  }

  @Roles('ADMIN')
  @Post(':id/restore')
  restore(@Param('id') id: string) {
    return this.invoicesService.restore(id);
  }

  @Roles('ADMIN')
  @Delete(':id/permanent')
  permanentDelete(@Param('id') id: string) {
    return this.invoicesService.permanentDelete(id);
  }

  // ── CLIENT ───────────────────────────────────────────────────────────

  @Roles('CLIENT')
  @Get('mine')
  findAllClient(@CurrentUser() user: AuthenticatedUser) {
    return this.invoicesService.findAllForClient(user.clientId!);
  }

  @Roles('CLIENT')
  @Get('mine/:id')
  findOneClient(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.invoicesService.findOneForClient(user.clientId!, id);
  }
}
