import { IsInt, IsString, Min, MinLength } from 'class-validator';

export class AdjustStockDto {
  @IsString()
  productId!: string;

  @IsInt()
  @Min(0)
  newQuantity!: number;

  @IsString()
  @MinLength(2)
  reason!: string;
}
