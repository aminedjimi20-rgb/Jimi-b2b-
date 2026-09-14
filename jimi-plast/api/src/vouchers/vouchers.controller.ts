import { Body, Controller, Delete, Get, Param, Post, Put, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { VouchersService } from './vouchers.service';
import { VoucherPdfService } from './voucher-pdf.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UpsertVoucherDto } from './dto/upsert-voucher.dto';
import { CancelVoucherDto } from './dto/cancel-voucher.dto';

@Controller('vouchers')
@RequirePermissions('vouchers.create')
export class VouchersController {
  constructor(
    private readonly vouchersService: VouchersService,
    private readonly pdfService: VoucherPdfService,
  ) {}

  @Get()
  list(
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('hidden') hidden?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.vouchersService.list({ status, customerId, hidden: hidden === 'true', dateFrom, dateTo });
  }

  @Get('mine')
  @RequirePermissions()
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.vouchersService.listMine(user.id);
  }

  @Post('mine/draft')
  @RequirePermissions()
  createMineDraft(@CurrentUser() user: AuthenticatedUser) {
    return this.vouchersService.getOrCreateOwnDraft(user.id);
  }

  @Get('mine/:id')
  @RequirePermissions()
  getMineById(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.vouchersService.getMineById(user.id, id);
  }

  @Put('mine/:id')
  @RequirePermissions()
  updateMine(@Param('id') id: string, @Body() dto: UpsertVoucherDto, @CurrentUser() user: AuthenticatedUser) {
    return this.vouchersService.updateMine(user.id, id, dto);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.vouchersService.getById(id);
  }

  @Get(':id/pdf')
  async pdf(@Param('id') id: string, @Res() res: Response) {
    const voucher = await this.vouchersService.getById(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${voucher.number ?? voucher.id}.pdf"`);
    const doc = this.pdfService.generate(voucher);
    doc.pipe(res);
  }

  @Post('draft')
  createDraft(@Body('customerId') customerId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.vouchersService.createDraft(customerId, user.id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpsertVoucherDto, @CurrentUser() user: AuthenticatedUser) {
    return this.vouchersService.update(id, dto, user.id);
  }

  @Post(':id/confirm')
  @RequirePermissions('vouchers.edit')
  confirm(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.vouchersService.confirm(id, user.id);
  }

  @Post(':id/deliver')
  @RequirePermissions('vouchers.edit')
  deliver(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.vouchersService.deliver(id, user.id);
  }

  @Post(':id/cancel')
  @RequirePermissions('vouchers.edit')
  cancel(@Param('id') id: string, @Body() dto: CancelVoucherDto, @CurrentUser() user: AuthenticatedUser) {
    return this.vouchersService.cancel(id, dto, user.id);
  }

  @Put(':id/hidden')
  @RequirePermissions('vouchers.edit')
  setHidden(@Param('id') id: string, @Body('hidden') hidden: boolean, @CurrentUser() user: AuthenticatedUser) {
    return this.vouchersService.setHidden(id, hidden, user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.vouchersService.remove(id, user.id);
  }
}
