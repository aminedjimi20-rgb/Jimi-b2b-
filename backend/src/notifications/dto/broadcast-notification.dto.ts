import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export const BROADCAST_AUDIENCES = ['ALL_CLIENTS', 'ALL_EMPLOYEES', 'ALL_ADMINS', 'EVERYONE', 'ONE_CLIENT', 'ONE_EMPLOYEE'] as const;
export type BroadcastAudience = (typeof BROADCAST_AUDIENCES)[number];

/** ADMIN-only: send a SYSTEME notification to a chosen audience or a single client/employee. */
export class BroadcastNotificationDto {
  @IsString()
  @MinLength(1)
  titre!: string;

  @IsString()
  @MinLength(1)
  message!: string;

  @IsIn(BROADCAST_AUDIENCES)
  audience!: BroadcastAudience;

  /** Required when audience is ONE_CLIENT/ONE_EMPLOYEE — the Client.id or Employee.id to target. */
  @IsOptional()
  @IsString()
  targetId?: string;
}
