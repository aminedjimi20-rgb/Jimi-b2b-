import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

/**
 * ADMIN-only: creates an employee's login account + profile in one step.
 * Employees are onboarded by the Admin, same as clients — no self-registration.
 */
export class CreateEmployeeDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  phone!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  nom!: string;

  @IsOptional()
  @IsString()
  telephone?: string;
}
