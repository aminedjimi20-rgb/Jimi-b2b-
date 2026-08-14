import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { StockService } from './stock.service';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';

@Roles('ADMIN')
@Controller('stock')
export class StockController {
  constructor(private stockService: StockService) {}

  @Post('movements')
  createMovement(@Body() dto: CreateStockMovementDto) {
    return this.stockService.createMovement(dto);
  }

  @Get('movements/:productId')
  history(@Param('productId') productId: string) {
    return this.stockService.historyForProduct(productId);
  }

  @Get('low')
  lowStock() {
    return this.stockService.lowStockProducts();
  }
}
