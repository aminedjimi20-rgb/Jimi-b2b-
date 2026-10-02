import { IsDateString, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class UpsertExpenseDto {
  @IsString()
  categoryId!: string;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class DeleteExpenseDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  reason?: string;
}
