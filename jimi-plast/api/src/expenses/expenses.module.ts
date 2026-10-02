import { Module } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { ExpensesController } from './expenses.controller';
import { ExpensePdfService } from './expense-pdf.service';

@Module({
  controllers: [ExpensesController],
  providers: [ExpensesService, ExpensePdfService],
})
export class ExpensesModule {}
