import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsString()
  phone!: string;

  @IsEmail()
  email!: string;

  @IsString()
  roleKey!: string; // "wholesaler" | "retailer" | ...

  @IsString()
  initialPassword!: string;

  @IsOptional()
  @IsString()
  businessName?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  wilaya?: string;
}
