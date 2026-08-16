import { IsBoolean, IsOptional, IsString } from 'class-validator';

/** ADMIN-only — edits an employee's profile. Credentials (email/phone/password) are a separate concern. */
export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  nom?: string;

  @IsOptional()
  @IsString()
  telephone?: string;

  // Granular visibility toggles — off unless the Admin explicitly grants them (see schema.prisma Employee).
  @IsOptional()
  @IsBoolean()
  canSeeClientPhone?: boolean;

  @IsOptional()
  @IsBoolean()
  canSeeClientAddress?: boolean;

  // Bon d'entrée (Phase 38) — voir schema.prisma Employee pour le détail de chaque permission.
  @IsOptional()
  @IsBoolean()
  canCreateBonEntree?: boolean;

  @IsOptional()
  @IsBoolean()
  canModifierPrixAchat?: boolean;

  @IsOptional()
  @IsBoolean()
  canVoirPrixVente?: boolean;

  @IsOptional()
  @IsBoolean()
  canCreerProduit?: boolean;

  @IsOptional()
  @IsBoolean()
  canCreerFournisseur?: boolean;

  @IsOptional()
  @IsBoolean()
  canModifierProduit?: boolean;

  @IsOptional()
  @IsBoolean()
  canModifierBonApresConfirmation?: boolean;
}
