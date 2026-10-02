import { IsString, MinLength } from 'class-validator';

export class ReviewNoteDto {
  @IsString()
  @MinLength(2)
  reviewNote!: string;
}
