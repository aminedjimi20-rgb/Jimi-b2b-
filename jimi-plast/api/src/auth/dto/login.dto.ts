import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  // Email OU numéro de téléphone — l'utilisateur tape l'un ou l'autre dans
  // le même champ, le service essaie les deux.
  @IsString()
  @MinLength(1)
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
