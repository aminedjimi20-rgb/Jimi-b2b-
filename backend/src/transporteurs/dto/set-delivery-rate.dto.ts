import { IsNumber, IsString, Min, MinLength } from 'class-validator';

export class SetDeliveryRateDto {
  @IsString()
  @MinLength(1)
  destination!: string;

  @IsNumber()
  @Min(0)
  prix!: number;
}
