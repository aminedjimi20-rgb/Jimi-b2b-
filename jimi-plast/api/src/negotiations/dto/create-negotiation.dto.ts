import { IsInt, IsNumber, IsString, Min } from 'class-validator';

export class CreateNegotiationDto {
  @IsString()
  productId!: string;

  @IsNumber()
  @Min(0)
  requestedPrice!: number;

  @IsInt()
  @Min(1)
  requestedQuantity!: number;
}
