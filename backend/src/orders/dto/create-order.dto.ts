import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

class OrderItemInputDto {
  @IsString()
  productId!: string;

  @IsInt()
  @Min(1)
  quantite!: number;
}

export class CreateOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  items!: OrderItemInputDto[];

  @IsIn(['ESPECES', 'VIREMENT', 'BARIDIMOB', 'LIVRAISON', 'CREDIT'])
  paymentMethod!: 'ESPECES' | 'VIREMENT' | 'BARIDIMOB' | 'LIVRAISON' | 'CREDIT';

  @IsString()
  adresseLivraison!: string;

  @IsString()
  telephoneContact!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
