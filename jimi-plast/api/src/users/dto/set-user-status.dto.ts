import { IsEnum } from 'class-validator';

export enum SettableUserStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export class SetUserStatusDto {
  @IsEnum(SettableUserStatus)
  status!: SettableUserStatus;
}
