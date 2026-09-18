import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterRequestDto {
  @IsString()
  @MinLength(2)
  fullName!: string;

  // Email OU téléphone : au moins un des deux est exigé (vérifié dans le
  // service, class-validator ne peut pas exprimer un "l'un ou l'autre").
  @IsOptional()
  @IsString()
  @MinLength(6)
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  // Mot de passe choisi par le demandeur lui-même à l'inscription (haché
  // immédiatement, jamais stocké en clair). S'il est absent, l'admin en
  // fixera un à l'acceptation comme avant.
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit faire au moins 8 caractères' })
  password?: string;

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
