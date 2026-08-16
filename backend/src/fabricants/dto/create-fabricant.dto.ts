import { IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateFabricantDto {
  @IsString()
  nom!: string;

  @IsOptional()
  @IsString()
  telephone?: string;

  @IsOptional()
  @IsString()
  adresse?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  notesInternes?: string;
}
