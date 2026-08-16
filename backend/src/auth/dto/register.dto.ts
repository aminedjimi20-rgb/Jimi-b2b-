import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

/**
 * Public self-registration — always creates a CLIENT account. Admin and
 * Employee accounts stay Admin-provisioned only (see CreateEmployeeDto /
 * CreateClientDto), consistent with a B2B app where staff access is granted,
 * not requested. The account is tied to the email (spec requirement — one
 * account usable from several devices), not the phone.
 */
export class RegisterDto {
  @IsEmail()
  email!: string;

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
}
