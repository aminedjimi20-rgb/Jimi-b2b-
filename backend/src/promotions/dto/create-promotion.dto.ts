import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreatePromotionDto {
  @IsString()
  nom!: string;

  @IsIn(['POURCENTAGE', 'MONTANT'])
  type!: 'POURCENTAGE' | 'MONTANT';

  @IsNumber()
  @Min(0)
  valeur!: number;

  @IsDateString()
  dateDebut!: string;

  @IsDateString()
  dateFin!: string;

  @IsOptional()
  @IsArray()
  @Type(() => String)
  productIds?: string[];

  @IsOptional()
  @IsArray()
  @Type(() => String)
  clientIds?: string[];
}
