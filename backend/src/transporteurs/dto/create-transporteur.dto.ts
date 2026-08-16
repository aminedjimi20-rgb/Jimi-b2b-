import { IsString, MinLength } from 'class-validator';

export class CreateTransporteurDto {
  @IsString()
  @MinLength(1)
  nom!: string;
}
