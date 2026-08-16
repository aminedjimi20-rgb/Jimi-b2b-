import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { FabricantsService } from './fabricants.service';
import { CreateFabricantDto } from './dto/create-fabricant.dto';

@Controller('fabricants')
export class FabricantsController {
  constructor(private fabricantsService: FabricantsService) {}

  // ── ADMIN ────────────────────────────────────────────────────────────

  @Roles('ADMIN')
  @Get()
  findAll() {
    return this.fabricantsService.findAll();
  }

  // Must come before ':id'-style routes so "trash"/"staff" aren't swallowed as an id param.
  @Roles('ADMIN')
  @Get('trash')
  findTrash() {
    return this.fabricantsService.findTrash();
  }

  @Roles('ADMIN')
  @Post()
  create(@Body() dto: CreateFabricantDto) {
    return this.fabricantsService.create(dto);
  }

  @Roles('ADMIN')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.fabricantsService.findOneForAdmin(id);
  }

  @Roles('ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateFabricantDto>) {
    return this.fabricantsService.update(id, dto);
  }

  @Roles('ADMIN')
  @Post(':id/products/:productId')
  associateProduct(@Param('id') id: string, @Param('productId') productId: string) {
    return this.fabricantsService.associateProduct(id, productId);
  }

  @Roles('ADMIN')
  @Delete(':id/products/:productId')
  dissociateProduct(@Param('id') id: string, @Param('productId') productId: string) {
    return this.fabricantsService.dissociateProduct(id, productId);
  }

  // Moves to the corbeille (reversible) — see DELETE :id/permanent to erase for good.
  @Roles('ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.fabricantsService.remove(id);
  }

  @Roles('ADMIN')
  @Post(':id/restore')
  restore(@Param('id') id: string) {
    return this.fabricantsService.restore(id);
  }

  @Roles('ADMIN')
  @Delete(':id/permanent')
  permanentDelete(@Param('id') id: string) {
    return this.fabricantsService.permanentDelete(id);
  }

  // ── EMPLOYEE ─────────────────────────────────────────────────────────
  // Only for picking/creating a fournisseur while building a bon d'entrée
  // (Phase 38) — createForEmployee still enforces canCreerFournisseur itself.

  @Roles('EMPLOYEE')
  @Get('staff')
  findAllForEmployee() {
    return this.fabricantsService.findAllForEmployee();
  }

  @Roles('EMPLOYEE')
  @Post('staff')
  createForEmployee(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateFabricantDto) {
    return this.fabricantsService.createForEmployee(user.employeeId!, dto);
  }
}
