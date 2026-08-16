import { IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateTransporteurDto {
  @IsString()
  @MinLength(1)
  nom!: string;

  @IsOptional()
  @IsString()
  chauffeur?: string | null;

  @IsOptional()
  @IsString()
  vehicule?: string | null;

  @IsOptional()
  @IsNumber()
  tonnage?: number | null;
}
