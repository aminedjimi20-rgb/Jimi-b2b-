import { IsNumber, IsString, Min } from 'class-validator';

export class ProductPriceInputDto {
  @IsString()
  priceTierTypeId!: string;

  @IsNumber()
  @Min(0)
  price!: number;
}
