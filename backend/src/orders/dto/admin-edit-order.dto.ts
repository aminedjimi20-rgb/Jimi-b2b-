import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';

class EditOrderItemDto {
  @IsString()
  productId!: string;

  @IsInt()
  @Min(1)
  quantite!: number;
}

// Admin-only correction of an already-placed order — items/amounts, never
// clientId or paymentMethod (switching those mid-flight would require
// re-deriving credit/stock effects from scratch, out of scope here).
export class AdminEditOrderDto {
  @IsOptional()
  @IsString()
  nom?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => EditOrderItemDto)
  items!: EditOrderItemDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  remisePourcentage?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fraisLivraison?: number;

  @IsOptional()
  @IsString()
  transporteurId?: string;

  @IsOptional()
  @IsString()
  destination?: string;

  @IsString()
  adresseLivraison!: string;

  @IsString()
  telephoneContact!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
