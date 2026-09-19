import { IsString } from 'class-validator';

export class UpdateReturnNotesDto {
  @IsString()
  notes!: string;
}
