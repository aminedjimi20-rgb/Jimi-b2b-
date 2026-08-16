import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';

class StockReceiptItemInputDto {
  @IsString()
  productId!: string;

  @IsInt()
  @Min(1)
  cartons!: number;

  @IsInt()
  @Min(1)
  unitesParCarton!: number;

  @IsNumber()
  @Min(0)
  prixAchat!: number;

  @IsNumber()
  @Min(0)
  prixVente!: number;
}

export class CreateStockReceiptDto {
  @IsString()
  fabricantId!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  remisePourcentage?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StockReceiptItemInputDto)
  items!: StockReceiptItemInputDto[];
}
