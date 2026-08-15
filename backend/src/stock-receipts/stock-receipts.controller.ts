import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { StockReceiptsService } from './stock-receipts.service';
import { CreateStockReceiptDto } from './dto/create-stock-receipt.dto';

@Controller('stock-receipts')
@Roles('ADMIN')
export class StockReceiptsController {
  constructor(private stockReceiptsService: StockReceiptsService) {}

  @Post()
  create(@Body() dto: CreateStockReceiptDto) {
    return this.stockReceiptsService.create(dto);
  }

  @Get()
  findAll() {
    return this.stockReceiptsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.stockReceiptsService.findOne(id);
  }
}
