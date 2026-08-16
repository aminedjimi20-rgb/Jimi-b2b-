import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';

@Controller('categories')
export class CategoriesController {
  constructor(private categoriesService: CategoriesService) {}

  // Readable by any authenticated role (Admin + Client both need the category tree to browse/filter).
  @Roles('ADMIN', 'CLIENT')
  @Get()
  findAll() {
    return this.categoriesService.findAll();
  }

  // Must come before ':id'-style routes so "trash" isn't swallowed as an id param.
  @Roles('ADMIN')
  @Get('trash')
  findTrash() {
    return this.categoriesService.findTrash();
  }

  @Roles('ADMIN')
  @Post()
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @Roles('ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateCategoryDto>) {
    return this.categoriesService.update(id, dto);
  }

  // Moves to the corbeille (reversible) — see DELETE :id/permanent to erase for good.
  @Roles('ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }

  @Roles('ADMIN')
  @Post(':id/restore')
  restore(@Param('id') id: string) {
    return this.categoriesService.restore(id);
  }

  @Roles('ADMIN')
  @Delete(':id/permanent')
  permanentDelete(@Param('id') id: string) {
    return this.categoriesService.permanentDelete(id);
  }
}
