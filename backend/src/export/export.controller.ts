import { Controller, Get, Header, Res } from '@nestjs/common';
import { Response } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { ExportService } from './export.service';

@Roles('ADMIN')
@Controller('export')
export class ExportController {
  constructor(private exportService: ExportService) {}

  @Get('products')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @Header('Content-Disposition', 'attachment; filename="produits.xlsx"')
  async products(@Res() res: Response) {
    res.send(await this.exportService.productsWorkbook());
  }

  @Get('orders')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @Header('Content-Disposition', 'attachment; filename="commandes.xlsx"')
  async orders(@Res() res: Response) {
    res.send(await this.exportService.ordersWorkbook());
  }

  @Get('clients')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @Header('Content-Disposition', 'attachment; filename="clients.xlsx"')
  async clients(@Res() res: Response) {
    res.send(await this.exportService.clientsWorkbook());
  }
}
