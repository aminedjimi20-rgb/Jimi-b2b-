import { IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpsertPromotionDto {
  @IsString()
  priceTierTypeId!: string;

  @IsEnum(['PERCENT', 'AMOUNT'])
  discountType!: 'PERCENT' | 'AMOUNT';

  @IsNumber()
  @Min(0)
  discountValue!: number;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
