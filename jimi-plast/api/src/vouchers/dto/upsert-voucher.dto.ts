import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class VoucherItemInputDto {
  @IsString()
  productId!: string;

  @IsInt()
  @Min(1)
  quantityPackages!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  actualTotalUnits?: number;
}

export class UpsertVoucherDto {
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  transportCost?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  paidAmount?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VoucherItemInputDto)
  items?: VoucherItemInputDto[];

  // Confirme malgré un stock insuffisant sur un ou plusieurs articles —
  // même principe que le `force` de la confirmation initiale.
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
