import { IsEmail, IsNumber, IsOptional, IsPhoneNumber, IsString, Min, MinLength } from 'class-validator';

/**
 * ADMIN-only: creates a client's login account + business profile in one
 * step. In a B2B wholesale context the Admin onboards the client (with
 * agreed commercial terms) rather than letting anyone self-register.
 */
export class CreateClientDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  phone!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  raisonSociale!: string;

  @IsString()
  telephone!: string;

  @IsOptional()
  @IsString()
  adresse?: string;

  @IsOptional()
  @IsString()
  ville?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  limiteCredit?: number;

  @IsOptional()
  @IsString()
  notesInternes?: string;

  // Catégorie de prix assignée (Prix de vente 1/2/3...) — voir PriceCategory.
  @IsOptional()
  @IsString()
  priceCategoryId?: string;
}
