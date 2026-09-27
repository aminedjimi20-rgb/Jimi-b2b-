import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateEmployeeNoteDto {
  @IsString()
  @MinLength(1)
  text!: string;
}

export class VoidEmployeeNoteDto {
  @IsOptional()
  @IsBoolean()
  voided?: boolean;
}
