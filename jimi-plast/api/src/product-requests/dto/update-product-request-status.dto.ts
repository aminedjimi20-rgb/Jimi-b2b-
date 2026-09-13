import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateProductRequestStatusDto {
  @IsEnum(['NEW', 'SEARCHING', 'FOUND', 'ORDERED', 'AVAILABLE', 'REFUSED'])
  status!: string;

  @IsOptional()
  @IsString()
  adminNote?: string;
}
