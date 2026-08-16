import { IsOptional, IsString } from 'class-validator';

export class AssignEmployeeDto {
  // Absent/null = unassign.
  @IsOptional()
  @IsString()
  employeeId?: string | null;
}
