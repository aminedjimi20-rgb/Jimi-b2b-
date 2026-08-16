import { IsIn } from 'class-validator';

export class UpdateEmployeeStatusDto {
  @IsIn(['ACTIVE', 'SUSPENDED'])
  status!: 'ACTIVE' | 'SUSPENDED';
}
