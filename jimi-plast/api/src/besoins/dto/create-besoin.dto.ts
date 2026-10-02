import { IsString, MinLength } from 'class-validator';

export class CreateBesoinDto {
  @IsString()
  @MinLength(3)
  message!: string;
}
