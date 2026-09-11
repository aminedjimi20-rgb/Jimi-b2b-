import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { StockService } from './stock.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { AdjustStockDto } from './dto/adjust-stock.dto';

@Controller('stock')
@RequirePermissions('stock.manage')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get('movements')
  movements(@Query('productId') productId?: string) {
    return this.stockService.movements(productId);
  }

  @Get('alerts')
  alerts() {
    return this.stockService.lowStockAlerts();
  }

  @Post('adjust')
  adjust(@Body() dto: AdjustStockDto, @CurrentUser() user: AuthenticatedUser) {
    return this.stockService.adjust(dto, user.id);
  }
}
