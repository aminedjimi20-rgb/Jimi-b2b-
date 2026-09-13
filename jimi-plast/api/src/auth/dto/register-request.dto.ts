import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterRequestDto {
  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsString()
  @MinLength(6)
  phone!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  wilaya?: string;

  @IsOptional()
  @IsString()
  businessName?: string;

  @IsOptional()
  @IsString()
  requestedRoleKey?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
