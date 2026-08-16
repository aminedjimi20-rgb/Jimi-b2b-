import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { PriceCategoriesService } from './price-categories.service';
import { CreatePriceCategoryDto } from './dto/create-price-category.dto';

@Controller('price-categories')
@Roles('ADMIN')
export class PriceCategoriesController {
  constructor(private priceCategoriesService: PriceCategoriesService) {}

  @Get()
  findAll() {
    return this.priceCategoriesService.findAll();
  }

  @Post()
  create(@Body() dto: CreatePriceCategoryDto) {
    return this.priceCategoriesService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreatePriceCategoryDto>) {
    return this.priceCategoriesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.priceCategoriesService.remove(id);
  }
}
