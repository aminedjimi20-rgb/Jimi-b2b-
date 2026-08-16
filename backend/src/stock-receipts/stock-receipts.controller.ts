import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { StockReceiptsService } from './stock-receipts.service';
import { CreateStockReceiptDto } from './dto/create-stock-receipt.dto';
import { CreateBonEntreeDto } from './dto/create-bon-entree.dto';
import { ConfirmBonEntreeDto } from './dto/confirm-bon-entree.dto';
import { EditStockReceiptDto } from './dto/edit-stock-receipt.dto';

@Controller('stock-receipts')
export class StockReceiptsController {
  constructor(private stockReceiptsService: StockReceiptsService) {}

  // ── ADMIN ────────────────────────────────────────────────────────────

  @Roles('ADMIN')
  @Post()
  create(@Body() dto: CreateStockReceiptDto) {
    return this.stockReceiptsService.create(dto);
  }

  @Roles('ADMIN')
  @Get()
  findAll() {
    return this.stockReceiptsService.findAll();
  }

  // Must come before ':id' so "trash" isn't swallowed as an id param.
  @Roles('ADMIN')
  @Get('trash')
  findTrash() {
    return this.stockReceiptsService.findTrash();
  }

  @Roles('ADMIN')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.stockReceiptsService.findOne(id);
  }

  // Correction d'un bon déjà CONFIRMEE — voir StockReceiptsService.adminEditConfirmed.
  @Roles('ADMIN')
  @Patch(':id/admin-edit')
  adminEdit(@Param('id') id: string, @Body() dto: EditStockReceiptDto) {
    return this.stockReceiptsService.adminEditConfirmed(id, dto);
  }

  @Roles('ADMIN')
  @Get(':id/history')
  getHistory(@Param('id') id: string) {
    return this.stockReceiptsService.getHistory(id);
  }

  // Admin confirme directement un brouillon créé par un Employé.
  @Roles('ADMIN')
  @Post(':id/confirm')
  confirmForAdmin(@Param('id') id: string, @Body() dto: ConfirmBonEntreeDto) {
    return this.stockReceiptsService.confirmForAdmin(id, dto);
  }

  // Moves to the corbeille (reversible) — see DELETE :id/permanent to erase for good.
  @Roles('ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.stockReceiptsService.remove(id);
  }

  @Roles('ADMIN')
  @Post(':id/restore')
  restore(@Param('id') id: string) {
    return this.stockReceiptsService.restore(id);
  }

  @Roles('ADMIN')
  @Delete(':id/permanent')
  permanentDelete(@Param('id') id: string) {
    return this.stockReceiptsService.permanentDelete(id);
  }

  // ── EMPLOYEE ─────────────────────────────────────────────────────────
  // Bon d'entrée (Phase 38) — chaque méthode revérifie la permission côté
  // service (canCreateBonEntree/canModifierBonApresConfirmation), jamais
  // seulement gardée par le rôle EMPLOYEE.

  @Roles('EMPLOYEE')
  @Post('staff')
  createDraft(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBonEntreeDto) {
    return this.stockReceiptsService.createDraftForEmployee(user.employeeId!, dto);
  }

  @Roles('EMPLOYEE')
  @Get('staff/mine')
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.stockReceiptsService.findAllForEmployee(user.employeeId!);
  }

  @Roles('EMPLOYEE')
  @Get('staff/mine/:id')
  findMineOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.stockReceiptsService.findOneForEmployee(user.employeeId!, id);
  }

  @Roles('EMPLOYEE')
  @Patch('staff/:id')
  updateDraft(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: CreateBonEntreeDto) {
    return this.stockReceiptsService.updateDraftForEmployee(user.employeeId!, id, dto);
  }

  @Roles('EMPLOYEE')
  @Post('staff/:id/confirm')
  confirmDraft(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ConfirmBonEntreeDto) {
    return this.stockReceiptsService.confirmForEmployee(user.employeeId!, id, dto);
  }

  @Roles('EMPLOYEE')
  @Patch('staff/:id/edit-confirmed')
  editConfirmed(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: EditStockReceiptDto) {
    return this.stockReceiptsService.editConfirmedForEmployee(user.employeeId!, id, dto);
  }

  // Annule un brouillon — jamais appliqué au stock, rien à reverser.
  @Roles('EMPLOYEE')
  @Delete('staff/:id')
  cancelDraft(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.stockReceiptsService.cancelDraftForEmployee(user.employeeId!, id);
  }
}
