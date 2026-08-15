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

  @Post()
  create(@Body() dto: CreateFabricantDto) {
    return this.fabricantsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateFabricantDto>) {
    return this.fabricantsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.fabricantsService.remove(id);
  }
}
