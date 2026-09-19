import { Body, Controller, Delete, Get, Param, Post, Put, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { DriversService } from './drivers.service';
import { StatementPdfService } from '../common/services/statement-pdf.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UpsertDriverDto } from './dto/upsert-driver.dto';

function parseRange(from?: string, to?: string) {
  return { fromDate: from ? new Date(from) : undefined, toDate: to ? new Date(`${to}T23:59:59.999`) : undefined };
}

@Controller('drivers')
@RequirePermissions('transport.manage')
export class DriversController {
  constructor(
    private readonly driversService: DriversService,
    private readonly statementPdfService: StatementPdfService,
  ) {}

  @Get()
  list(@Query('includeInactive') includeInactive?: string) {
    return this.driversService.list(includeInactive === 'true');
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.driversService.getById(id);
  }

  @Get(':id/deliveries')
  deliveries(@Param('id') id: string, @Query('from') from?: string, @Query('to') to?: string) {
    const { fromDate, toDate } = parseRange(from, to);
    return this.driversService.getDeliveries(id, fromDate, toDate);
  }

  @Get(':id/situation')
  situation(@Param('id') id: string, @Query('from') from?: string, @Query('to') to?: string) {
    const { fromDate, toDate } = parseRange(from, to);
    return this.driversService.getSituation(id, fromDate, toDate);
  }

  @Get(':id/situation/pdf')
  async situationPdf(@Param('id') id: string, @Query('from') from: string | undefined, @Query('to') to: string | undefined, @Res() res: Response) {
    const { fromDate, toDate } = parseRange(from, to);
    const s = await this.driversService.getSituation(id, fromDate, toDate);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="situation-${id}.pdf"`);
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    const doc = this.statementPdfService.generate({
      documentTitle: 'Situation livreur',
      partyLabel: 'Livreur',
      partyName: s.driver.fullName,
      partySubtitle: s.driver.vehicle,
      from: s.from,
      to: s.to,
      startBalance: 0,
      endBalance: s.totalCost,
      entries: s.entries,
    });
    doc.pipe(res);
  }

  @Post()
  create(@Body() dto: UpsertDriverDto, @CurrentUser() user: AuthenticatedUser) {
    return this.driversService.create(dto, user.id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpsertDriverDto, @CurrentUser() user: AuthenticatedUser) {
    return this.driversService.update(id, dto, user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.driversService.remove(id, user.id);
  }

  @Post(':id/restore')
  restore(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.driversService.restore(id, user.id);
  }
}
