import { IsString, MinLength } from 'class-validator';

export class RequestDeletionDto {
  @IsString()
  @MinLength(2)
  reason!: string;
}
