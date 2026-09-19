import { IsString, MinLength } from 'class-validator';

export class RespondBesoinDto {
  @IsString()
  @MinLength(1)
  response!: string;
}
