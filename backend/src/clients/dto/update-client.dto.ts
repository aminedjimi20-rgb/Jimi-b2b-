import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

/** ADMIN-only — edits a client's business profile. Credentials (email/phone/password) are a separate concern. */
export class UpdateClientDto {
  @IsOptional()
  @IsString()
  raisonSociale?: string;

  @IsOptional()
  @IsString()
  telephone?: string;

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

  // Catégorie de prix assignée (Prix de vente 1/2/3...) — chaîne vide/null = revenir au prix normal.
  @IsOptional()
  @IsString()
  priceCategoryId?: string | null;
}
