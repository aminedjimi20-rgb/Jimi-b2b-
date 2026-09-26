import { IsOptional, IsString, MinLength } from 'class-validator';

export class AcceptRegistrationRequestDto {
  @IsString()
  roleKey!: string;

  // Non requis si le demandeur a choisi son propre mot de passe à
  // l'inscription (auto-inscription) — sinon l'admin doit en fixer un ici.
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Le mot de passe initial doit faire au moins 8 caractères' })
  initialPassword?: string;

  @IsOptional()
  @IsString()
  reviewNote?: string;
}
