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
}
