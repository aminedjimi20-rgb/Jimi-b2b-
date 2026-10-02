import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UpsertCategoryDto } from './dto/upsert-category.dto';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Public()
  @Get()
  list() {
    return this.categoriesService.list();
  }

  @Post()
  @RequirePermissions('catalog.manage')
  create(@Body() dto: UpsertCategoryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.categoriesService.create(dto, user.id);
  }

  @Put(':id')
  @RequirePermissions('catalog.manage')
  update(@Param('id') id: string, @Body() dto: UpsertCategoryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.categoriesService.update(id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermissions('catalog.manage')
  remove(@Param('id') id: string, @Query('reason') reason: string, @CurrentUser() user: AuthenticatedUser) {
    return this.categoriesService.remove(id, user.id, reason);
  }
}
