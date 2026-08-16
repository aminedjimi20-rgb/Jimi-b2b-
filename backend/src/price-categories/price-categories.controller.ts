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
  rename(@Param('id') id: string, @Body() dto: CreatePriceCategoryDto) {
    return this.priceCategoriesService.rename(id, dto.nom);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.priceCategoriesService.remove(id);
  }
}
