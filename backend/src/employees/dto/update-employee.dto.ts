import { IsOptional, IsString } from 'class-validator';

/** ADMIN-only — edits an employee's profile. Credentials (email/phone/password) are a separate concern. */
export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  nom?: string;

  @IsOptional()
  @IsString()
  telephone?: string;
}
