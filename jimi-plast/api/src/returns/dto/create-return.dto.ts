import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsIn, IsInt, IsOptional, IsString, Min, MinLength, ValidateNested } from 'class-validator';

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
