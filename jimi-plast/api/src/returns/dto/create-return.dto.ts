import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, Min, MinLength, ValidateNested } from 'class-validator';

class ReturnItemInputDto {
  @IsString()
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsString()
  @MinLength(2)
  reason!: string;

  @IsOptional()
  @IsIn(['DAMAGED', 'DEFECTIVE', 'OTHER'])
  condition?: 'DAMAGED' | 'DEFECTIVE' | 'OTHER';

  // Permet de corriger le prix au retour — un fabricant peut retourner un
  // article vendu il y a longtemps à un prix qui a changé depuis au catalogue.
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;
}

export class CreateReturnDto {
  @IsEnum(['CUSTOMER', 'SUPPLIER'])
  type!: 'CUSTOMER' | 'SUPPLIER';

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  manufacturerId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReturnItemInputDto)
  items!: ReturnItemInputDto[];
}
