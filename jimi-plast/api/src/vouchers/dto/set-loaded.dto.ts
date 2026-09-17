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
