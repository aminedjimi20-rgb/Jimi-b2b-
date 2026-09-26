import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateProductRequestDto {
  @IsString()
  @MinLength(2)
  productName!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantityWanted?: number;
}
