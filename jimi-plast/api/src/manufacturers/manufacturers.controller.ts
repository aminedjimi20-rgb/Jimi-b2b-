import { Body, Controller, Delete, Get, Param, Post, Put, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ManufacturersService } from './manufacturers.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UpsertManufacturerDto } from './dto/upsert-manufacturer.dto';
import { AddPaymentDto, AddAdjustmentDto } from '../customers/dto/add-ledger-entry.dto';
import { PendingDeletionsService } from '../pending-deletions/pending-deletions.service';
import { RequestDeletionDto } from '../pending-deletions/dto/request-deletion.dto';
import { StatementPdfService } from '../common/services/statement-pdf.service';

const ENTRY_TYPE_LABELS: Record<string, string> = {
  PURCHASE_VOUCHER: "Bon d'achat",
  PAYMENT: 'Paiement',
  ADJUSTMENT: 'Ajustement',
};

@Controller('manufacturers')
@RequirePermissions('suppliers.view')
export class ManufacturersController {
  constructor(
    private readonly manufacturersService: ManufacturersService,
    private readonly pendingDeletions: PendingDeletionsService,
    private readonly statementPdfService: StatementPdfService,
  ) {}

  @Get()
  list(@Query('search') search?: string) {
    return this.manufacturersService.list(search);
  }

  @Get('me')
  @RequirePermissions()
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.manufacturersService.getByUserId(user.id);
  }

  @Get('me/catalog')
  @RequirePermissions()
  myCatalog(@CurrentUser() user: AuthenticatedUser) {
    return this.manufacturersService.getMyCatalog(user.id);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.manufacturersService.getById(id);
  }

  @Get(':id/statement/pdf')
  async statementPdf(
    @Param('id') id: string,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Res() res: Response,
  ) {
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(`${to}T23:59:59.999`) : undefined;
    const statement = await this.manufacturersService.getStatement(id, fromDate, toDate);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="situation-${id}.pdf"`);
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    const doc = this.statementPdfService.generate({
      documentTitle: 'Situation fournisseur',
      partyLabel: 'Fournisseur',
      partyName: statement.company && statement.company !== statement.name ? statement.company : statement.name,
      partySubtitle: statement.company && statement.company !== statement.name ? statement.name : null,
      from: statement.from,
      to: statement.to,
      startBalance: statement.startBalance,
      endBalance: statement.endBalance,
      entries: statement.entries.map((e) => ({
        createdAt: e.createdAt,
        typeLabel: ENTRY_TYPE_LABELS[e.type] ?? e.type,
        note: e.note,
        amount: Number(e.amount),
        balanceAfter: e.balanceAfter,
      })),
    });
    doc.pipe(res);
  }

  @Post()
  create(@Body() dto: UpsertManufacturerDto, @CurrentUser() user: AuthenticatedUser) {
    return this.manufacturersService.create(dto, user.id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpsertManufacturerDto, @CurrentUser() user: AuthenticatedUser) {
    return this.manufacturersService.update(id, dto, user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Query('reason') reason: string, @CurrentUser() user: AuthenticatedUser) {
    return this.manufacturersService.remove(id, user.id, reason);
  }

  @Post(':id/request-deletion')
  requestDeletion(@Param('id') id: string, @Body() dto: RequestDeletionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.pendingDeletions.requestManufacturerDeletion(id, dto.reason, user.id);
  }

  @Post('entries/:entryId/request-deletion')
  requestEntryDeletion(@Param('entryId') entryId: string, @Body() dto: RequestDeletionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.pendingDeletions.requestSupplierLedgerEntryDeletion(entryId, dto.reason, user.id);
  }

  @Post(':id/payments')
  addPayment(@Param('id') id: string, @Body() dto: AddPaymentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.manufacturersService.addPayment(id, dto, user.id);
  }

  @Post(':id/adjustments')
  addAdjustment(@Param('id') id: string, @Body() dto: AddAdjustmentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.manufacturersService.addAdjustment(id, dto, user.id);
  }
}
