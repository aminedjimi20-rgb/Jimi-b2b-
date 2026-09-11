import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ProductsService, ProductListFilters } from './products.service';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OptionalUser } from '../common/decorators/optional-user.decorator';
import { OptionalAuthGuard } from '../common/guards/optional-auth.guard';
import { AuthenticatedUser } from '../auth/auth.types';
import { UpsertProductDto } from './dto/upsert-product.dto';
import { SetPriceDto } from './dto/set-price.dto';
import { AddImageDto } from './dto/add-image.dto';

function toBool(v?: string): boolean | undefined {
  if (v === undefined) return undefined;
  return v === 'true';
}

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Public()
  @UseGuards(OptionalAuthGuard)
  @Get()
  list(
    @Query() query: Record<string, string>,
    @OptionalUser() user: AuthenticatedUser | null,
  ) {
    const filters: ProductListFilters = {
      categoryId: query.categoryId,
      search: query.search,
      isNew: toBool(query.isNew),
      isFeatured: toBool(query.isFeatured),
      isSeasonal: toBool(query.isSeasonal),
      onSale: toBool(query.onSale),
      availability: query.availability as ProductListFilters['availability'],
      sort: query.sort as ProductListFilters['sort'],
      page: query.page ? Number(query.page) : undefined,
      pageSize: query.pageSize ? Number(query.pageSize) : undefined,
    };
    return this.productsService.list(filters, user?.permissions ?? null);
  }

  @Public()
  @UseGuards(OptionalAuthGuard)
  @Get(':id')
  getById(@Param('id') id: string, @OptionalUser() user: AuthenticatedUser | null) {
    return this.productsService.getById(id, user?.permissions ?? null);
  }

  @Get(':id/full')
  @RequirePermissions('costs.view')
  getFullById(@Param('id') id: string) {
    return this.productsService.getFullById(id);
  }

  @Get(':id/price-history')
  @RequirePermissions('prices.edit')
  priceHistory(@Param('id') id: string) {
    return this.productsService.priceHistory(id);
  }

  @Post()
  @RequirePermissions('catalog.manage')
  create(@Body() dto: UpsertProductDto, @CurrentUser() user: AuthenticatedUser) {
    return this.productsService.create(dto, user.id);
  }

  @Put(':id')
  @RequirePermissions('catalog.manage')
  update(@Param('id') id: string, @Body() dto: UpsertProductDto, @CurrentUser() user: AuthenticatedUser) {
    return this.productsService.update(id, dto, user.id);
  }

  @Put(':id/price')
  @RequirePermissions('prices.edit')
  setPrice(@Param('id') id: string, @Body() dto: SetPriceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.productsService.setPrice(id, dto, user.id);
  }

  @Post(':id/images')
  @RequirePermissions('catalog.manage')
  addImage(@Param('id') id: string, @Body() dto: AddImageDto) {
    return this.productsService.addImage(id, dto);
  }

  @Delete('images/:imageId')
  @RequirePermissions('catalog.manage')
  removeImage(@Param('imageId') imageId: string) {
    return this.productsService.removeImage(imageId);
  }

  @Delete(':id')
  @RequirePermissions('catalog.manage')
  remove(@Param('id') id: string, @Query('reason') reason: string, @CurrentUser() user: AuthenticatedUser) {
    return this.productsService.remove(id, user.id, reason);
  }
}
