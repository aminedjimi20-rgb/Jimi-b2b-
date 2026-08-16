import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

// Client is never offered a sort depending on prixAchat/marge/stock exact —
// see ProductsService.CLIENT_SORT_OPTIONS.
const CLIENT_SORT_VALUES = ['nom', 'nomDesc', 'prix', 'prixAsc', 'nouveautes', 'dernierChangement'] as const;

export class SearchCatalogDto {
  @IsOptional()
  @IsString()
  q?: string; // matches nom, code

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsIn(CLIENT_SORT_VALUES)
  sortBy?: (typeof CLIENT_SORT_VALUES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  prixMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  prixMax?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 20;
}
