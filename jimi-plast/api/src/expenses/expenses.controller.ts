import { Body, Controller, Delete, Get, Param, Post, Put, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ExpensesService } from './expenses.service';
import { ExpensePdfService } from './expense-pdf.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UpsertExpenseCategoryDto } from './dto/upsert-expense-category.dto';
import { DeleteExpenseDto, UpsertExpenseDto } from './dto/upsert-expense.dto';

@Controller('expenses')
@RequirePermissions('expenses.manage')
export class ExpensesController {
  constructor(
    private readonly expensesService: ExpensesService,
    private readonly pdfService: ExpensePdfService,
  ) {}

  @Get('categories')
  listCategories() {
    return this.expensesService.listCategories();
  }

  @Post('categories')
  createCategory(@Body() dto: UpsertExpenseCategoryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.expensesService.createCategory(dto, user.id);
  }

  @Delete('categories/:id')
  removeCategory(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.expensesService.removeCategory(id, user.id);
  }

  @Get()
  list(@Query('from') from?: string, @Query('to') to?: string, @Query('categoryId') categoryId?: string) {
    return this.expensesService.list({ from, to, categoryId });
  }

  @Get('pdf')
  async pdf(@Query('from') from: string, @Query('to') to: string, @Query('categoryId') categoryId: string | undefined, @Res() res: Response) {
    const expenses = await this.expensesService.list({ from, to, categoryId });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="frais_${from ?? 'debut'}_${to ?? 'fin'}.pdf"`);
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    const doc = this.pdfService.generate(expenses as never, from ?? '—', to ?? '—');
    doc.pipe(res);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.expensesService.getById(id);
  }

  @Get(':id/history')
  history(@Param('id') id: string) {
    return this.expensesService.history(id);
  }

  @Post()
  create(@Body() dto: UpsertExpenseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.expensesService.create(dto, user.id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpsertExpenseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.expensesService.update(id, dto, user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Body() dto: DeleteExpenseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.expensesService.remove(id, dto.reason, user.id);
  }
}
