import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { SearchCatalogDto } from './dto/search-catalog.dto';
import { SetCustomPriceDto } from './dto/set-custom-price.dto';

@Controller('products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  // ── ADMIN ────────────────────────────────────────────────────────────

  @Roles('ADMIN')
  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Roles('ADMIN')
  @Get()
  findAllAdmin(@Query('categoryId') categoryId?: string) {
    return this.productsService.findAllForAdmin(categoryId);
  }

  @Roles('ADMIN')
  @Get(':id')
  findOneAdmin(@Param('id') id: string) {
    return this.productsService.findOneForAdmin(id);
  }

  @Roles('ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Roles('ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }

  @Roles('ADMIN')
  @Post(':id/custom-price')
  setCustomPrice(@Param('id') productId: string, @Body() dto: SetCustomPriceDto) {
    return this.productsService.setCustomPrice(productId, dto.clientId, dto.prix);
  }

  // ── CLIENT ───────────────────────────────────────────────────────────

  @Roles('CLIENT')
  @Get('catalog/search')
  searchCatalog(@CurrentUser() user: AuthenticatedUser, @Query() query: SearchCatalogDto) {
    return this.productsService.searchCatalogForClient(user.clientId!, query);
  }

  @Roles('CLIENT')
  @Get('catalog/:id')
  getForClient(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.productsService.getProductForClient(user.clientId!, id);
  }
}
