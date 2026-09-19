import { Body, Controller, Delete, Get, Param, Post, Put, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CustomersService } from './customers.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { AddPaymentDto, AddAdjustmentDto } from './dto/add-ledger-entry.dto';
import { PendingDeletionsService } from '../pending-deletions/pending-deletions.service';
import { RequestDeletionDto } from '../pending-deletions/dto/request-deletion.dto';
import { StatementPdfService } from '../common/services/statement-pdf.service';

const ENTRY_TYPE_LABELS: Record<string, string> = {
  SALE_VOUCHER: 'Bon de vente',
  PAYMENT: 'Paiement',
  RETURN_CREDIT: 'Avoir retour',
  ADJUSTMENT: 'Ajustement',
};

@Controller('customers')
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly pendingDeletions: PendingDeletionsService,
    private readonly statementPdfService: StatementPdfService,
  ) {}

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

  @Get(':id/statement/pdf')
  @RequirePermissions('customers.manage')
  async statementPdf(
    @Param('id') id: string,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Res() res: Response,
  ) {
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(`${to}T23:59:59.999`) : undefined;
    const statement = await this.customersService.getStatement(id, fromDate, toDate);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="situation-${id}.pdf"`);
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    const doc = this.statementPdfService.generate({
      documentTitle: 'Situation client',
      partyLabel: 'Client',
      partyName: statement.businessName ?? statement.fullName,
      partySubtitle: statement.businessName ? statement.fullName : statement.phone,
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
  @RequirePermissions('customers.manage')
  create(@Body() dto: CreateCustomerDto, @CurrentUser() user: AuthenticatedUser) {
    return this.customersService.create(dto, user.id);
  }

  @Put(':id')
  @RequirePermissions('customers.manage')
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto, @CurrentUser() user: AuthenticatedUser) {
    return this.customersService.update(id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermissions('customers.manage')
  remove(@Param('id') id: string, @Query('reason') reason: string, @CurrentUser() user: AuthenticatedUser) {
    return this.customersService.remove(id, user.id, reason);
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

  @Post('entries/:entryId/request-deletion')
  @RequirePermissions('credits.manage')
  requestEntryDeletion(@Param('entryId') entryId: string, @Body() dto: RequestDeletionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.pendingDeletions.requestLedgerEntryDeletion(entryId, dto.reason, user.id);
  }
}
