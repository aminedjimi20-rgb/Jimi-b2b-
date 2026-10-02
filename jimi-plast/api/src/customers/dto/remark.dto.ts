import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateRemarkDto {
  @IsString()
  @MinLength(1)
  text!: string;
}

export class VoidRemarkDto {
  @IsOptional()
  @IsBoolean()
  voided?: boolean;
}
