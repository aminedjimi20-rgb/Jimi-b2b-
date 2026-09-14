import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpsertDeliveryDto {
  @IsOptional()
  @IsString()
  driverName?: string;

  @IsOptional()
  @IsString()
  driverPhotoUrl?: string;

  @IsOptional()
  @IsString()
  vehicle?: string;

  @IsOptional()
  @IsString()
  driverPhone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  wilaya?: string;

  @IsOptional()
  @IsIn(['TO_PREPARE', 'PREPARED', 'IN_PROGRESS', 'DELIVERED', 'CANCELLED', 'PROBLEM'])
  status?: string;

  @IsOptional()
  @IsNumber()
  cost?: number;

  @IsOptional()
  @IsNumber()
  billedToCustomer?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
