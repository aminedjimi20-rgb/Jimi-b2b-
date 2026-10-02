import { IsString, MinLength } from 'class-validator';

export class CancelVoucherDto {
  @IsString()
  @MinLength(2)
  reason!: string;
}
