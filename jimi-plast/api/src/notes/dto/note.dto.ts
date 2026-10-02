import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateNoteDto {
  @IsString()
  @MinLength(1)
  text!: string;
}

export class SetNoteHiddenDto {
  @IsOptional()
  @IsBoolean()
  hidden?: boolean;
}
