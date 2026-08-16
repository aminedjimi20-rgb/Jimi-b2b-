import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { FabricantsService } from './fabricants.service';
import { CreateFabricantDto } from './dto/create-fabricant.dto';

@Controller('fabricants')
@Roles('ADMIN')
export class FabricantsController {
  constructor(private fabricantsService: FabricantsService) {}

  @Get()
  findAll() {
    return this.fabricantsService.findAll();
  }

  // Must come before ':id'-style routes so "trash" isn't swallowed as an id param.
  @Get('trash')
  findTrash() {
    return this.fabricantsService.findTrash();
  }

  @Post()
  create(@Body() dto: CreateFabricantDto) {
    return this.fabricantsService.create(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.fabricantsService.findOneForAdmin(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateFabricantDto>) {
    return this.fabricantsService.update(id, dto);
  }

  @Post(':id/products/:productId')
  associateProduct(@Param('id') id: string, @Param('productId') productId: string) {
    return this.fabricantsService.associateProduct(id, productId);
  }

  @Delete(':id/products/:productId')
  dissociateProduct(@Param('id') id: string, @Param('productId') productId: string) {
    return this.fabricantsService.dissociateProduct(id, productId);
  }

  // Moves to the corbeille (reversible) — see DELETE :id/permanent to erase for good.
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.fabricantsService.remove(id);
  }

  @Post(':id/restore')
  restore(@Param('id') id: string) {
    return this.fabricantsService.restore(id);
  }

  @Delete(':id/permanent')
  permanentDelete(@Param('id') id: string) {
    return this.fabricantsService.permanentDelete(id);
  }
}
