import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpsertDeliveryDto {
  @IsOptional()
  @IsString()
  driverId?: string;

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
  @IsNumber()
  billedToManufacturer?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateStandaloneDeliveryDto extends UpsertDeliveryDto {
  // Catégorie de frais dans laquelle imputer le coût de cette course — une
  // course sans bon ne touche jamais un compte client/fabricant, seulement
  // les Frais généraux. Par défaut : catégorie "Livraison".
  @IsOptional()
  @IsString()
  categoryId?: string;
}

export class CancelDeliveryDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
