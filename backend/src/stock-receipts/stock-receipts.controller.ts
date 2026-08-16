import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
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

  // Must come before ':id' so "trash" isn't swallowed as an id param.
  @Get('trash')
  findTrash() {
    return this.stockReceiptsService.findTrash();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.stockReceiptsService.findOne(id);
  }

  // Moves to the corbeille (reversible) — see DELETE :id/permanent to erase for good.
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.stockReceiptsService.remove(id);
  }

  @Post(':id/restore')
  restore(@Param('id') id: string) {
    return this.stockReceiptsService.restore(id);
  }

  @Delete(':id/permanent')
  permanentDelete(@Param('id') id: string) {
    return this.stockReceiptsService.permanentDelete(id);
  }
}
