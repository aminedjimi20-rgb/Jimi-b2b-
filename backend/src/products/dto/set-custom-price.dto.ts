import { IsNumber, IsString, Min } from 'class-validator';

export class SetCustomPriceDto {
  @IsString()
  clientId!: string;

  @IsNumber()
  @Min(0)
  prix!: number;
}
