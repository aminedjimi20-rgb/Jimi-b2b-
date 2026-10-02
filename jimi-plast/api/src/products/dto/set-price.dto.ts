import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class SetPriceDto {
  @IsString()
  priceTierTypeId!: string;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
