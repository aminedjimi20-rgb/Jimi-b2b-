import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { TransporteursService } from './transporteurs.service';
import { CreateTransporteurDto } from './dto/create-transporteur.dto';
import { SetDeliveryRateDto } from './dto/set-delivery-rate.dto';

@Controller('transporteurs')
@Roles('ADMIN')
export class TransporteursController {
  constructor(private transporteursService: TransporteursService) {}

  // Read-only — an Employee needs the transporteur list to fill the
  // livraison section of a counter order or a bon d'entrée (Phase 38).
  @Roles('ADMIN', 'EMPLOYEE')
  @Get()
  findAll() {
    return this.transporteursService.findAll();
  }

  // Must come before ':id' so "trash" isn't swallowed as an id param.
  @Get('trash')
  findTrash() {
    return this.transporteursService.findTrash();
  }

  @Post()
  create(@Body() dto: CreateTransporteurDto) {
    return this.transporteursService.create(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.transporteursService.findOneForAdmin(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateTransporteurDto>) {
    return this.transporteursService.update(id, dto);
  }

  @Post(':id/rates')
  setRate(@Param('id') id: string, @Body() dto: SetDeliveryRateDto) {
    return this.transporteursService.setRate(id, dto);
  }

  @Delete(':id/rates/:rateId')
  removeRate(@Param('id') id: string, @Param('rateId') rateId: string) {
    return this.transporteursService.removeRate(id, rateId);
  }

  // Moves to the corbeille (reversible) — see DELETE :id/permanent to erase for good.
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.transporteursService.remove(id);
  }

  @Post(':id/restore')
  restore(@Param('id') id: string) {
    return this.transporteursService.restore(id);
  }

  @Delete(':id/permanent')
  permanentDelete(@Param('id') id: string) {
    return this.transporteursService.permanentDelete(id);
  }
}
