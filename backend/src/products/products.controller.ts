import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { ProductsService, ProductSortBy } from './products.service';
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
  findAllAdmin(@Query('categoryId') categoryId?: string, @Query('sortBy') sortBy?: ProductSortBy) {
    return this.productsService.findAllForAdmin(categoryId, sortBy);
  }

  // Must come before ':id' so "trash"/"staff" aren't swallowed as an id param.
  @Roles('ADMIN')
  @Get('trash')
  findTrash() {
    return this.productsService.findTrash();
  }

  // ── EMPLOYEE ─────────────────────────────────────────────────────────
  // Same restriction as the client: never prixAchat/marge. Sees real stock
  // (needed to prepare/sell) and the normal price — no per-client pricing.

  @Roles('EMPLOYEE')
  @Get('staff')
  findAllEmployee() {
    return this.productsService.findAllForEmployee();
  }

  @Roles('EMPLOYEE')
  @Get('staff/:id')
  findOneEmployee(@Param('id') id: string) {
    return this.productsService.findOneForEmployee(id);
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

  // Moves to the corbeille (reversible) — see DELETE :id/permanent to erase for good.
  @Roles('ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }

  @Roles('ADMIN')
  @Post(':id/restore')
  restore(@Param('id') id: string) {
    return this.productsService.restore(id);
  }

  @Roles('ADMIN')
  @Delete(':id/permanent')
  permanentDelete(@Param('id') id: string) {
    return this.productsService.permanentDelete(id);
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
  @Post('catalog/search-image')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } }))
  searchByImage(@CurrentUser() user: AuthenticatedUser, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Aucune image reçue.');
    return this.productsService.searchByImage(user.clientId!, file.buffer);
  }

  @Roles('CLIENT')
  @Get('catalog/:id')
  getForClient(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.productsService.getProductForClient(user.clientId!, id);
  }
}
