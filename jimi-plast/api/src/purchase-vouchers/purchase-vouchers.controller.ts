import { Body, Controller, Delete, Get, Param, Post, Put, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PurchaseVouchersService } from './purchase-vouchers.service';
import { PurchaseVoucherPdfService } from './purchase-voucher-pdf.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UpsertPurchaseVoucherDto } from './dto/upsert-purchase-voucher.dto';
import { CancelVoucherDto } from '../vouchers/dto/cancel-voucher.dto';
import { PendingDeletionsService } from '../pending-deletions/pending-deletions.service';
import { RequestDeletionDto } from '../pending-deletions/dto/request-deletion.dto';

@Controller('purchase-vouchers')
@RequirePermissions('suppliers.view')
export class PurchaseVouchersController {
  constructor(
    private readonly service: PurchaseVouchersService,
    private readonly pdfService: PurchaseVoucherPdfService,
    private readonly pendingDeletions: PendingDeletionsService,
  ) {}

  @Get()
  list(@Query('status') status?: string, @Query('manufacturerId') manufacturerId?: string) {
    return this.service.list({ status, manufacturerId });
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Get(':id/pdf')
  async pdf(@Param('id') id: string, @Res() res: Response) {
    const voucher = await this.service.getById(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${voucher.number ?? voucher.id}.pdf"`);
    // Le bon contient des données fournisseur/prix — jamais indexable par les moteurs de recherche.
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    const doc = this.pdfService.generate(voucher);
    doc.pipe(res);
  }

  @Get(':id/history')
  history(@Param('id') id: string) {
    return this.service.history(id);
  }

  @Post('draft')
  createDraft(@Body('manufacturerId') manufacturerId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createDraft(manufacturerId, user.id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpsertPurchaseVoucherDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.update(id, dto, user.id);
  }

  @Post(':id/confirm')
  @RequirePermissions('stock.manage')
  confirm(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.confirm(id, user.id);
  }

  @Post(':id/cancel')
  @RequirePermissions('stock.manage')
  cancel(@Param('id') id: string, @Body() dto: CancelVoucherDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.cancel(id, dto, user.id);
  }

  @Post(':id/revert-cancel')
  @RequirePermissions('stock.manage')
  revertCancel(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.revertCancel(id, user.id);
  }

  @Post(':id/request-deletion')
  requestDeletion(@Param('id') id: string, @Body() dto: RequestDeletionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.pendingDeletions.requestPurchaseVoucherDeletion(id, dto.reason, user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.remove(id, user.id);
  }
}
