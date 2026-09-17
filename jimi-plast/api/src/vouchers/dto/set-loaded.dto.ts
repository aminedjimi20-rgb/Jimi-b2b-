import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class SetLoadedByDto {
  @IsOptional()
  @IsString()
  loadedById?: string;
}

export class SetItemLoadedDto {
  @IsBoolean()
  loaded!: boolean;
}

export class SetDepotDto {
  @IsOptional()
  @IsString()
  depot?: string;
}
