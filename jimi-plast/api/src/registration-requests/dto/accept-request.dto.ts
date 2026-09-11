import { IsOptional, IsString, MinLength } from 'class-validator';

export class AcceptRegistrationRequestDto {
  @IsString()
  roleKey!: string;

  @IsString()
  @MinLength(8, { message: 'Le mot de passe initial doit faire au moins 8 caractères' })
  initialPassword!: string;

  @IsOptional()
  @IsString()
  reviewNote?: string;
}
