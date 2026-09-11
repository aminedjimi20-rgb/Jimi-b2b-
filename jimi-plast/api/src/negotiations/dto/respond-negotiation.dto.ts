import { IsDateString, IsEnum, IsNumber, IsOptional, Min } from 'class-validator';

export class RespondNegotiationDto {
  @IsEnum(['ACCEPTED', 'REJECTED', 'COUNTERED'])
  status!: 'ACCEPTED' | 'REJECTED' | 'COUNTERED';

  @IsOptional()
  @IsNumber()
  @Min(0)
  counterPrice?: number;

  @IsOptional()
  @IsDateString()
  validUntil?: string;
}
