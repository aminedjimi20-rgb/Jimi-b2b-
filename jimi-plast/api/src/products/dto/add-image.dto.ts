import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class AddImageDto {
  @IsString()
  url!: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
